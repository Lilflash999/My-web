// call.js - Voice & Video Calling Module for SocialNest

// This script expects the following global variables to be set by the main chat script:
// window.currentUser = { uid, fullName, ... }
// window.currentFriend = { uid, fullName, ... }
// window.db = Firebase Realtime Database instance (from main script)
// Also requires firebase-app and firebase-database already imported in main module.

(function() {
    // DOM elements we will create dynamically
    let incomingCallModal = null;
    let activeCallContainer = null;
    
    // WebRTC globals
    let peerConnection = null;
    let localStream = null;
    let remoteStream = null;
    let callActive = false;
    let currentCallType = null; // 'audio' or 'video'
    
    // Firebase reference for current call (signaling)
    let callSignalRef = null;
    let callSignalListener = null;
    
    // STUN servers (free, public)
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    // Helper: show a temporary toast (reuse main's toast if available)
    function showCallToast(msg, isError = false) {
        const toast = document.getElementById('toastMsg');
        if (toast) {
            toast.textContent = msg;
            toast.style.opacity = '1';
            toast.style.background = isError ? '#b91c1c' : '#1e293b';
            setTimeout(() => toast.style.opacity = '0', 3000);
        } else {
            alert(msg);
        }
    }
    
    // Create incoming call UI modal
    function createIncomingCallModal() {
        if (document.getElementById('incomingCallModal')) return;
        const modalDiv = document.createElement('div');
        modalDiv.id = 'incomingCallModal';
        modalDiv.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: none; align-items: center;
            justify-content: center; z-index: 10000; backdrop-filter: blur(4px);
        `;
        modalDiv.innerHTML = `
            <div style="background: white; border-radius: 32px; width: 280px; padding: 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">📞</div>
                <h3 id="callerName" style="margin-bottom: 8px;">Incoming Call</h3>
                <p id="callTypeText" style="color: #65676b; margin-bottom: 24px;">Voice call...</p>
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <button id="acceptCallBtn" style="background: #22c55e; border: none; padding: 12px 24px; border-radius: 40px; color: white; font-weight: bold; cursor: pointer;">Accept</button>
                    <button id="rejectCallBtn" style="background: #ef4444; border: none; padding: 12px 24px; border-radius: 40px; color: white; font-weight: bold; cursor: pointer;">Decline</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        return modalDiv;
    }
    
    // Create active call UI (video/audio container)
    function createActiveCallUI() {
        if (document.getElementById('activeCallContainer')) return;
        const container = document.createElement('div');
        container.id = 'activeCallContainer';
        container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #1e1e2f; z-index: 10001; display: none;
            flex-direction: column; align-items: center; justify-content: center;
        `;
        container.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; background: #000;">
                <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                <video id="localVideo" autoplay playsinline muted style="position: absolute; bottom: 20px; right: 20px; width: 120px; border-radius: 16px; border: 2px solid white; z-index: 10;"></video>
                <div style="position: absolute; bottom: 30px; left: 0; right: 0; text-align: center; z-index: 20;">
                    <button id="endCallBtn" style="background: #ef4444; border: none; padding: 14px 28px; border-radius: 50px; color: white; font-weight: bold; cursor: pointer; font-size: 16px;"><i class="fas fa-phone-slash"></i> End Call</button>
                </div>
                <div style="position: absolute; top: 20px; left: 0; right: 0; text-align: center; color: white; background: rgba(0,0,0,0.5); padding: 8px; font-weight: bold;" id="callStatusText">Connecting...</div>
            </div>
        `;
        document.body.appendChild(container);
        return container;
    }
    
    // Clean up call resources
    async function endCall() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (callSignalRef) {
            // Delete the signaling node to notify other party
            try {
                await callSignalRef.set(null);
            } catch(e) { console.warn(e); }
            callSignalRef = null;
        }
        if (callSignalListener) {
            callSignalListener();
            callSignalListener = null;
        }
        callActive = false;
        currentCallType = null;
        
        // Hide UI
        const activeContainer = document.getElementById('activeCallContainer');
        if (activeContainer) activeContainer.style.display = 'none';
        const incomingModal = document.getElementById('incomingCallModal');
        if (incomingModal) incomingModal.style.display = 'none';
        
        // Re-enable chat input if needed
        const msgInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        if (msgInput) msgInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        
        showCallToast("Call ended");
    }
    
    // Setup peer connection event handlers
    async function setupPeerConnection(isCaller, isVideo) {
        peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream tracks
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) remoteVideo.srcObject = remoteStream;
        };
        
        // ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && callSignalRef) {
                callSignalRef.child('candidates').push().set(event.candidate.toJSON());
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            const status = document.getElementById('callStatusText');
            if (status) {
                if (peerConnection.iceConnectionState === 'connected') {
                    status.textContent = 'Connected';
                } else if (peerConnection.iceConnectionState === 'failed') {
                    status.textContent = 'Connection failed';
                    showCallToast("Connection failed", true);
                    endCall();
                } else if (peerConnection.iceConnectionState === 'disconnected') {
                    status.textContent = 'Disconnected';
                }
            }
        };
        
        if (!isCaller) {
            // Answerer: set remote description from offer (handled by listener)
        }
    }
    
    // Send answer (when user accepts call)
    async function answerCall(callerId, isVideo) {
        try {
            await setupPeerConnection(false, isVideo);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await callSignalRef.update({
                answer: { type: answer.type, sdp: answer.sdp },
                status: 'answered'
            });
            callActive = true;
            document.getElementById('callStatusText').innerText = 'Connected';
        } catch (err) {
            console.error("Answer error:", err);
            showCallToast("Failed to answer call", true);
            endCall();
        }
    }
    
    // Initiate a call
    async function startCall(isVideo) {
        if (!window.currentUser || !window.currentFriend) {
            showCallToast("Please select a friend first", true);
            return;
        }
        if (callActive) {
            showCallToast("Call already in progress", true);
            return;
        }
        
        currentCallType = isVideo ? 'video' : 'audio';
        
        // Request media devices
        const constraints = isVideo ? { video: true, audio: true } : { audio: true };
        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            const localVideo = document.getElementById('localVideo');
            if (localVideo) localVideo.srcObject = localStream;
            
            // Create a unique call ID based on both users
            const callId = [window.currentUser.uid, window.currentFriend.uid].sort().join('_') + '_' + Date.now();
            callSignalRef = window.ref(window.db, `calls/${callId}`);
            
            await setupPeerConnection(true, isVideo);
            
            // Create offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Store call info in Firebase
            await callSignalRef.set({
                callerId: window.currentUser.uid,
                callerName: window.currentUser.fullName,
                calleeId: window.currentFriend.uid,
                type: currentCallType,
                offer: { type: offer.type, sdp: offer.sdp },
                status: 'ringing',
                timestamp: Date.now()
            });
            
            // Listen for answer or rejection
            callSignalListener = window.onValue(callSignalRef, (snap) => {
                const data = snap.val();
                if (!data) return; // call removed
            
                if (data.status === 'rejected') {
                    showCallToast("Call was rejected");
                    endCall();
                } else if (data.status === 'answered' && data.answer) {
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    callActive = true;
                    document.getElementById('callStatusText').innerText = 'Connected';
                    showCallToast("Call connected");
                } else if (data.candidates) {
                    // Add ICE candidates
                    for (let key in data.candidates) {
                        if (data.candidates[key]) {
                            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidates[key]));
                        }
                    }
                }
            });
            
            // Show active call UI
            const activeContainer = createActiveCallUI();
            activeContainer.style.display = 'flex';
            document.getElementById('callStatusText').innerText = 'Ringing...';
            
        } catch (err) {
            console.error("Media error:", err);
            showCallToast("Cannot access camera/microphone", true);
            endCall();
        }
    }
    
    // Listen for incoming calls (global listener)
    function listenForIncomingCalls() {
        if (!window.currentUser) return;
        const callsRef = window.ref(window.db, 'calls');
        window.onValue(callsRef, (snapshot) => {
            if (callActive) return; // already in call
            const calls = snapshot.val();
            if (!calls) return;
            
            // Find a call where current user is callee and status is 'ringing'
            for (let callId in calls) {
                const call = calls[callId];
                if (call.calleeId === window.currentUser.uid && call.status === 'ringing' && !callActive) {
                    // Show incoming call modal
                    const modal = createIncomingCallModal();
                    document.getElementById('callerName').innerText = call.callerName;
                    document.getElementById('callTypeText').innerText = call.type === 'video' ? 'Video call...' : 'Voice call...';
                    modal.style.display = 'flex';
                    
                    // Store call reference for answering
                    const thisCallRef = window.ref(window.db, `calls/${callId}`);
                    
                    // Accept handler
                    const acceptBtn = document.getElementById('acceptCallBtn');
                    const newAccept = async () => {
                        modal.style.display = 'none';
                        currentCallType = call.type;
                        callSignalRef = thisCallRef;
                        try {
                            // Get media
                            const constraints = call.type === 'video' ? { video: true, audio: true } : { audio: true };
                            localStream = await navigator.mediaDevices.getUserMedia(constraints);
                            const localVideo = document.getElementById('localVideo');
                            if (localVideo) localVideo.srcObject = localStream;
                            
                            await setupPeerConnection(false, call.type === 'video');
                            // Set remote offer
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
                            // Create answer
                            const answer = await peerConnection.createAnswer();
                            await peerConnection.setLocalDescription(answer);
                            await thisCallRef.update({
                                answer: { type: answer.type, sdp: answer.sdp },
                                status: 'answered'
                            });
                            callActive = true;
                            
                            // Show active UI
                            const activeContainer = createActiveCallUI();
                            activeContainer.style.display = 'flex';
                            document.getElementById('callStatusText').innerText = 'Connected';
                            
                            // Listen for ICE candidates on this call
                            window.onValue(thisCallRef, (snap) => {
                                const data = snap.val();
                                if (data && data.candidates && peerConnection) {
                                    for (let key in data.candidates) {
                                        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidates[key]));
                                    }
                                }
                            });
                            
                        } catch (err) {
                            console.error("Accept error:", err);
                            showCallToast("Failed to accept call", true);
                            await thisCallRef.set(null);
                            endCall();
                        }
                        acceptBtn.removeEventListener('click', newAccept);
                        rejectBtn.removeEventListener('click', newReject);
                    };
                    
                    const rejectBtn = document.getElementById('rejectCallBtn');
                    const newReject = async () => {
                        modal.style.display = 'none';
                        await thisCallRef.update({ status: 'rejected' });
                        setTimeout(() => thisCallRef.set(null), 1000);
                        showCallToast("Call declined");
                        rejectBtn.removeEventListener('click', newReject);
                        acceptBtn.removeEventListener('click', newAccept);
                    };
                    
                    // Remove old listeners to avoid duplicates
                    acceptBtn.replaceWith(acceptBtn.cloneNode(true));
                    rejectBtn.replaceWith(rejectBtn.cloneNode(true));
                    const newAcceptBtn = document.getElementById('acceptCallBtn');
                    const newRejectBtn = document.getElementById('rejectCallBtn');
                    newAcceptBtn.addEventListener('click', newAccept);
                    newRejectBtn.addEventListener('click', newReject);
                    break;
                }
            }
        });
    }
    
    // Expose call functions to window and attach event listeners when ready
    window.initCallModule = function() {
        // Wait for DOM and user data
        const checkUser = setInterval(() => {
            if (window.currentUser && window.currentFriend && window.db) {
                clearInterval(checkUser);
                listenForIncomingCalls();
                
                // Attach to buttons in the chat UI (the dropdown items)
                const voiceCallBtn = document.getElementById('voiceCall');
                const videoCallBtn = document.getElementById('videoCall');
                const allCallBtn = document.getElementById('allCall');
                const callDropMenu = document.getElementById('callDropMenu');
                
                if (voiceCallBtn) {
                    voiceCallBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (callDropMenu) callDropMenu.classList.remove('show');
                        startCall(false);
                    });
                }
                if (videoCallBtn) {
                    videoCallBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (callDropMenu) callDropMenu.classList.remove('show');
                        startCall(true);
                    });
                }
                if (allCallBtn) {
                    allCallBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Toggle dropdown
                        if (callDropMenu) callDropMenu.classList.toggle('show');
                    });
                }
                // End call button (will be created dynamically)
                document.addEventListener('click', (e) => {
                    if (e.target.id === 'endCallBtn') {
                        endCall();
                    }
                });
            }
        }, 500);
    };
    
    // Also expose endCall and startCall for external use
    window.endCall = endCall;
    window.startCall = startCall;
    
    // Auto-init when script loads
    window.initCallModule();
})();