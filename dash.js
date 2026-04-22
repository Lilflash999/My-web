// dash.js - Real-time user profile sync, notifications, repost
console.log("dash.js loaded");

// Global user cache
const userCache = new Map();
const userListeners = new Map();

document.addEventListener('DOMContentLoaded', async function() {
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!window.db) return;
    
    const { ref, get, push, onValue, update, remove } = window.firebaseRTDB;
    const auth = window.auth;
    
    let currentUser = null;
    let currentFeed = 'public';
    let pendingMedia = null;
    let pendingMediaType = null;
    let notificationCount = 0;
    
    // ========== TOAST ==========
    function showToast(msg, isError = false) {
        let t = document.getElementById('toastMsg');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toastMsg';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.background = isError ? '#dc2626' : '#1e293b';
        t.style.opacity = '1';
        setTimeout(() => t.style.opacity = '0', 2000);
    }
    
    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    }
    
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    
    // ========== NOTIFICATION SYSTEM ==========
    async function addNotification(userId, type, data) {
        const notifRef = ref(window.db, `notifications/${userId}`);
        const newNotif = push(notifRef);
        await set(newNotif, {
            id: newNotif.key,
            type: type,
            data: data,
            read: false,
            timestamp: Date.now()
        });
        updateNotificationBadge(userId);
    }
    
    async function updateNotificationBadge(userId) {
        const notifRef = ref(window.db, `notifications/${userId}`);
        const snapshot = await get(notifRef);
        const notifs = snapshot.val() || {};
        const unread = Object.values(notifs).filter(n => !n.read).length;
        notificationCount = unread;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (unread > 0) {
                badge.style.display = 'flex';
                badge.textContent = unread > 9 ? '9+' : unread;
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    function listenToNotifications(userId) {
        const notifRef = ref(window.db, `notifications/${userId}`);
        onValue(notifRef, async (snap) => {
            await updateNotificationBadge(userId);
            renderNotifications();
        });
    }
    
    async function renderNotifications() {
        const container = document.getElementById('notificationsList');
        if (!container) return;
        const notifRef = ref(window.db, `notifications/${currentUser.uid}`);
        const snap = await get(notifRef);
        const notifs = snap.val() || {};
        const sorted = Object.values(notifs).sort((a,b) => b.timestamp - a.timestamp);
        if (sorted.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">No notifications</div>';
            return;
        }
        container.innerHTML = sorted.map(n => {
            let html = '';
            switch(n.type) {
                case 'friend_request':
                    html = `<strong>${escapeHTML(n.data.fromName)}</strong> sent you a friend request.`;
                    break;
                case 'comment':
                    html = `<strong>${escapeHTML(n.data.fromName)}</strong> commented on your post: "${escapeHTML(n.data.comment)}"`;
                    break;
                case 'like':
                    html = `<strong>${escapeHTML(n.data.fromName)}</strong> liked your post.`;
                    break;
                case 'friend_post':
                    html = `<strong>${escapeHTML(n.data.fromName)}</strong> posted something new.`;
                    break;
                default: html = 'New notification';
            }
            return `<div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" style="padding:12px; border-bottom:1px solid #eef2f6; background:${n.read ? 'white' : '#f0f7ff'}; cursor:pointer;">
                        <div>${html}</div>
                        <small style="color:#8a99b4;">${getTimeAgo(new Date(n.timestamp))}</small>
                    </div>`;
        }).join('');
        
        // Mark as read when clicked
        document.querySelectorAll('.notification-item').forEach(el => {
            el.onclick = async () => {
                const id = el.dataset.id;
                await update(ref(window.db, `notifications/${currentUser.uid}/${id}`), { read: true });
                renderNotifications();
            };
        });
    }
    
    // ========== REPOST FUNCTION ==========
    async function repostPost(originalPost, originalUserId) {
        if (!currentUser) return;
        // Check if already reposted by this user
        const repostKey = `repost_${currentUser.uid}_${originalPost.id}`;
        const repostCheck = ref(window.db, `reposts/${repostKey}`);
        const checkSnap = await get(repostCheck);
        if (checkSnap.exists()) {
            showToast("You already reposted this", true);
            return;
        }
        // Fetch original user's name
        const userSnap = await get(ref(window.db, `users/${originalUserId}`));
        const originalUser = userSnap.val();
        const originalName = originalUser?.displayName || originalUser?.username || "someone";
        
        // Create a new post as a repost
        const postsRef = ref(window.db, 'posts');
        const newPostRef = push(postsRef);
        const repostContent = `🔁 Reposted from @${originalName}: ${originalPost.content || ""}`;
        const repostData = {
            id: newPostRef.key,
            content: repostContent,
            media: originalPost.media || null,
            mediaType: originalPost.mediaType || null,
            userId: currentUser.uid,
            originalPostId: originalPost.id,
            originalAuthorId: originalUserId,
            timestamp: new Date().toISOString(),
            likes: [],
            comments: [],
            privacy: 'public', // reposts are always public
            repostCount: (originalPost.repostCount || 0) + 1
        };
        await set(newPostRef, repostData);
        
        // Save repost reference
        await set(repostCheck, { postId: originalPost.id, repostedAt: Date.now() });
        
        // Update original post's repost count
        await update(ref(window.db, `posts/${originalPost.id}`), { repostCount: (originalPost.repostCount || 0) + 1 });
        
        showToast("Reposted!");
    }
    
    // ========== CREATE POST ==========
    async function createPost(content, mediaData, mediaType, isPublic = true) {
        if (!content && !mediaData) {
            showToast("Please enter something or add media");
            return false;
        }
        if (!currentUser) return false;
        const postsRef = ref(window.db, 'posts');
        const newPostRef = push(postsRef);
        const postData = {
            id: newPostRef.key,
            content: content || "",
            media: mediaData || null,
            mediaType: mediaType || null,
            userId: currentUser.uid,
            timestamp: new Date().toISOString(),
            likes: [],
            comments: [],
            privacy: isPublic ? 'public' : 'private',
            repostCount: 0
        };
        await set(newPostRef, postData);
        showToast(isPublic ? "✅ Posted publicly!" : "✅ Private post");
        
        // Notify all friends about new post
        const friends = currentUser.friends || [];
        for (const friendId of friends) {
            await addNotification(friendId, 'friend_post', {
                fromId: currentUser.uid,
                fromName: currentUser.displayName || currentUser.username,
                postId: newPostRef.key,
                postContent: content.substring(0, 50)
            });
        }
        
        pendingMedia = null;
        pendingMediaType = null;
        const captionInput = document.getElementById('text-caption');
        if (captionInput) captionInput.value = '';
        const mediaContainer = document.getElementById('mediaPreviewContainer');
        if (mediaContainer) {
            mediaContainer.style.display = 'none';
            mediaContainer.innerHTML = '';
        }
        return true;
    }
    
    // ========== LIKE with notification ==========
    async function toggleLike(postId, currentLikes, postUserId) {
        try {
            const postRef = ref(window.db, `posts/${postId}`);
            const newLikes = currentLikes.includes(currentUser.uid) 
                ? currentLikes.filter(id => id !== currentUser.uid)
                : [...currentLikes, currentUser.uid];
            await update(postRef, { likes: newLikes });
            
            // Notify post owner if not self-like
            if (newLikes.includes(currentUser.uid) && postUserId !== currentUser.uid) {
                await addNotification(postUserId, 'like', {
                    fromId: currentUser.uid,
                    fromName: currentUser.displayName || currentUser.username,
                    postId: postId
                });
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    }
    
    // ========== COMMENT with notification ==========
    async function addComment(postId, commentText, postUserId) {
        if (!commentText.trim()) return;
        try {
            const postRef = ref(window.db, `posts/${postId}`);
            const snapshot = await get(postRef);
            const post = snapshot.val();
            const currentComments = post?.comments || [];
            const newComment = {
                id: Date.now().toString(),
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.username,
                userProfilePic: currentUser.profilePic,
                text: commentText.trim(),
                timestamp: new Date().toISOString()
            };
            await update(postRef, { comments: [...currentComments, newComment] });
            showToast("💬 Comment added");
            
            // Notify post owner
            if (postUserId !== currentUser.uid) {
                await addNotification(postUserId, 'comment', {
                    fromId: currentUser.uid,
                    fromName: currentUser.displayName || currentUser.username,
                    postId: postId,
                    comment: commentText.trim()
                });
            }
        } catch (error) {
            console.error("Error adding comment:", error);
        }
    }
    
    // ========== MAIN FEED RENDERER (with repost button) ==========
    function setupRealtimeFeed() {
        const postsRef = ref(window.db, 'posts');
        
        onValue(postsRef, async (snapshot) => {
            const container = document.getElementById('postsContainer');
            if (!container) return;
            
            const posts = snapshot.val();
            if (!posts) {
                container.innerHTML = '<div class="empty-state">No posts yet. Create your first post!</div>';
                return;
            }
            
            let postsArray = Object.values(posts);
            postsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (currentFeed === 'my') {
                postsArray = postsArray.filter(p => p.userId === currentUser?.uid);
            } else {
                postsArray = postsArray.filter(p => p.privacy === 'public');
            }
            
            if (postsArray.length === 0) {
                container.innerHTML = '<div class="empty-state">No posts to show</div>';
                return;
            }
            
            container.innerHTML = '';
            
            for (const post of postsArray) {
                const postId = post.id;
                const isOwn = post.userId === currentUser?.uid;
                const isRepost = !!post.originalPostId;
                
                const card = document.createElement('div');
                card.className = 'post-card';
                card.dataset.postId = postId;
                
                card.innerHTML = `
                    <div class="post-header" id="post-header-${postId}">
                        <div class="skeleton skeleton-avatar" style="width:44px; height:44px;"></div>
                        <div style="flex:1;">
                            <div class="skeleton skeleton-name"></div>
                            <div class="skeleton skeleton-text" style="width: 40%;"></div>
                        </div>
                    </div>
                    <div class="post-content">
                        ${isRepost ? `<div style="background:#f0f2f5; border-radius:16px; padding:8px; margin-bottom:8px; font-size:13px;"><i class="fas fa-retweet"></i> Reposted</div>` : ''}
                        <p>${escapeHTML(post.content)}</p>
                        ${post.media ? (post.mediaType === 'image' ? `<img src="${post.media}" style="max-width:100%; border-radius:16px; margin-top:8px;">` : `<video src="${post.media}" controls style="max-width:100%; border-radius:16px; margin-top:8px;"></video>`) : ''}
                    </div>
                    <div class="post-stats">
                        <span>❤️ ${post.likes?.length || 0}</span>
                        <span>💬 ${post.comments?.length || 0}</span>
                        <span>🔁 ${post.repostCount || 0}</span>
                    </div>
                    <div class="post-actions">
                        <button class="post-action like-btn ${post.likes?.includes(currentUser?.uid) ? 'liked' : ''}" data-post-id="${postId}">❤️ Like</button>
                        <button class="post-action comment-toggle" data-post-id="${postId}">💬 Comment</button>
                        ${!isOwn && post.privacy === 'public' ? `<button class="post-action repost-btn" data-post-id="${postId}">🔁 Repost</button>` : ''}
                        ${isOwn ? `<button class="post-action delete-btn" data-post-id="${postId}">🗑️ Delete</button>` : ''}
                    </div>
                    <div class="comment-section" style="display:none; margin-top:16px; background:#fafbfc; border-radius:20px; padding:14px;">
                        <div class="comment-list">${post.comments?.map(c => `<div class="comment-item"><strong>${escapeHTML(c.userName)}</strong>: ${escapeHTML(c.text)}</div>`).join('') || '<div style="color:#8a99b4;">No comments yet</div>'}</div>
                        <div class="comment-input-area" style="display:flex; gap:8px; margin-top:12px;">
                            <input type="text" placeholder="Write a comment..." data-comment-input style="flex:1; border:1px solid #ddd; border-radius:30px; padding:10px;">
                            <button data-submit-comment data-post-id="${postId}" style="background:#667eea; border:none; padding:8px 16px; border-radius:30px; color:white;">Post</button>
                        </div>
                    </div>
                `;
                
                container.appendChild(card);
                
                // Fetch real user data
                const userRef = ref(window.db, `users/${post.userId}`);
                const userSnap = await get(userRef);
                const userData = userSnap.val();
                if (userData) {
                    const profilePic = userData.profilePic || `https://ui-avatars.com/api/?background=667eea&color=fff&name=${userData.displayName?.charAt(0) || 'U'}`;
                    const displayName = userData.displayName || userData.username || "User";
                    const username = userData.username || "user";
                    const timeAgo = getTimeAgo(new Date(post.timestamp));
                    const headerDiv = card.querySelector(`.post-header`);
                    if (headerDiv) {
                        headerDiv.innerHTML = `
                            <img class="post-avatar" src="${profilePic}" style="width:44px; height:44px; border-radius:50%; cursor:pointer;" onclick="window.location.href='view-profile.html?uid=${post.userId}'">
                            <div>
                                <strong style="cursor:pointer;" onclick="window.location.href='view-profile.html?uid=${post.userId}'">${escapeHTML(displayName)}</strong>
                                ${!isOwn ? `<small>@${escapeHTML(username)}</small>` : ''}
                                <br><span class="post-time">${timeAgo} <span class="privacy-badge">${post.privacy === 'public' ? '🌍 Public' : '🔒 Private'}</span></span>
                            </div>
                        `;
                    }
                }
            }
            
            attachPostEventListeners();
        });
    }
    
    function attachPostEventListeners() {
        // Like buttons
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.onclick = async () => {
                const postId = btn.dataset.postId;
                const postRef = ref(window.db, `posts/${postId}`);
                const snap = await get(postRef);
                const post = snap.val();
                if (!post) return;
                const currentLikes = post.likes || [];
                await toggleLike(postId, currentLikes, post.userId);
            };
        });
        
        // Comment toggle
        document.querySelectorAll('.comment-toggle').forEach(btn => {
            btn.onclick = (e) => {
                const card = e.target.closest('.post-card');
                const commentSection = card.querySelector('.comment-section');
                if (commentSection) commentSection.style.display = commentSection.style.display === 'none' ? 'block' : 'none';
            };
        });
        
        // Delete
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => deletePost(btn.dataset.postId);
        });
        
        // Submit comment
        document.querySelectorAll('[data-submit-comment]').forEach(btn => {
            btn.onclick = async () => {
                const postId = btn.dataset.postId;
                const card = btn.closest('.post-card');
                const input = card.querySelector('[data-comment-input]');
                const text = input.value.trim();
                if (text) {
                    const postRef = ref(window.db, `posts/${postId}`);
                    const snap = await get(postRef);
                    const post = snap.val();
                    await addComment(postId, text, post.userId);
                    input.value = '';
                }
            };
        });
        
        // Repost button
        document.querySelectorAll('.repost-btn').forEach(btn => {
            btn.onclick = async () => {
                const postId = btn.dataset.postId;
                const postRef = ref(window.db, `posts/${postId}`);
                const snap = await get(postRef);
                const post = snap.val();
                if (post) {
                    await repostPost(post, post.userId);
                }
            };
        });
    }
    
    async function deletePost(postId) {
        if (confirm('Delete this post?')) {
            try {
                await remove(ref(window.db, `posts/${postId}`));
                showToast("Post deleted");
            } catch (error) {
                console.error(error);
            }
        }
    }
    
    // ========== LOAD CURRENT USER & FRIEND REQUESTS NOTIFICATION ==========
    async function loadUserData(user) {
        const userRef = ref(window.db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            currentUser = { uid: user.uid, ...snapshot.val() };
        } else {
            const defaultName = user.email?.split('@')[0] || 'User';
            currentUser = {
                uid: user.uid,
                displayName: defaultName,
                username: defaultName.toLowerCase(),
                profilePic: `https://ui-avatars.com/api/?background=667eea&color=fff&name=${defaultName.charAt(0)}`,
                bio: '',
                location: '',
                friends: [],
                friendRequests: []
            };
            await set(ref(window.db, `users/${user.uid}`), currentUser);
        }
        window.currentUser = currentUser;
        
        // Update profile images
        const profileImg = document.getElementById('profileImage');
        const bottomImg = document.getElementById('bottomProfileImg');
        if (profileImg) profileImg.src = currentUser.profilePic;
        if (bottomImg) bottomImg.src = currentUser.profilePic;
        
        // Listen for friend requests and send notifications
        const friendRequestsRef = ref(window.db, `users/${currentUser.uid}/friendRequests`);
        onValue(friendRequestsRef, async (snap) => {
            const requests = snap.val() || [];
            if (requests.length > 0) {
                // For each new request (simplified: we just notify for the latest)
                // But we'll add a notification for each new request when it appears.
                // We'll listen to child_added instead.
            }
        });
        // Child added for friend requests
        const friendReqRef = ref(window.db, `users/${currentUser.uid}/friendRequests`);
        onValue(friendReqRef, (snap) => {
            // already handled by separate listener; we'll add notification in the sendFriendRequest function.
        });
        
        setupRealtimeFeed();
        listenToNotifications(currentUser.uid);
        
        // Listen for friend requests as they come
        const friendReqListener = ref(window.db, `users/${currentUser.uid}/friendRequests`);
        onValue(friendReqListener, (snap) => {
            // No need to double notify, but we can update UI
        });
    }
    
    // Override sendFriendRequest to add notification
    window.sendFriendRequest = async function(targetUserId, targetUsername) {
        const targetRef = ref(window.db, `users/${targetUserId}`);
        const targetSnap = await get(targetRef);
        if (!targetSnap.exists()) return false;
        const currentRequests = targetSnap.val().friendRequests || [];
        if (currentRequests.includes(currentUser.uid)) {
            showToast("Request already sent");
            return false;
        }
        await update(targetRef, { friendRequests: [...currentRequests, currentUser.uid] });
        // Add notification to target user
        await addNotification(targetUserId, 'friend_request', {
            fromId: currentUser.uid,
            fromName: currentUser.displayName || currentUser.username
        });
        showToast(`Friend request sent to ${targetUsername}`);
        return true;
    };
    
    // ========== UI EVENT SETUP ==========
    function setupDashboardEvents() {
        const submitBtn = document.getElementById('submitPostBtn');
        if (submitBtn) {
            submitBtn.onclick = () => {
                const content = document.getElementById('text-caption')?.value.trim() || '';
                const privacySelect = document.getElementById('privacySelect');
                const isPublic = privacySelect?.value === 'public';
                createPost(content, pendingMedia, pendingMediaType, isPublic);
            };
        }
        
        const photoBtn = document.getElementById('photoVideoBtn');
        const mediaInput = document.getElementById('postMediaInput');
        if (photoBtn && mediaInput) {
            photoBtn.onclick = () => mediaInput.click();
            mediaInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        pendingMedia = ev.target.result;
                        pendingMediaType = file.type.startsWith('image') ? 'image' : 'video';
                        const preview = document.getElementById('mediaPreviewContainer');
                        if (preview) {
                            preview.style.display = 'block';
                            preview.innerHTML = `<div style="position:relative; display:inline-block;">
                                ${pendingMediaType === 'image' ? `<img src="${pendingMedia}" style="max-width:200px; border-radius:16px;">` : `<video src="${pendingMedia}" controls style="max-width:200px; border-radius:16px;"></video>`}
                                <button onclick="clearPendingMedia()" style="position:absolute; top:-8px; right:-8px; background:red; color:white; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>
                            </div>`;
                        }
                        showToast("Media added! Click Post to share");
                    };
                    reader.readAsDataURL(file);
                }
                mediaInput.value = '';
            };
        }
        
        const feelingBtn = document.getElementById('feelingBtn');
        if (feelingBtn) {
            feelingBtn.onclick = () => {
                const feel = prompt("How are you feeling? (Happy, Sad, Excited, etc.)");
                if (feel) {
                    const caption = document.getElementById('text-caption');
                    if (caption) caption.value = `Feeling ${feel}`;
                }
            };
        }
        
        const myFeedTab = document.getElementById('myFeedTab');
        const publicFeedTab = document.getElementById('publicFeedTab');
        if (myFeedTab && publicFeedTab) {
            myFeedTab.onclick = () => {
                currentFeed = 'my';
                myFeedTab.classList.add('active');
                publicFeedTab.classList.remove('active');
                setupRealtimeFeed();
            };
            publicFeedTab.onclick = () => {
                currentFeed = 'public';
                publicFeedTab.classList.add('active');
                myFeedTab.classList.remove('active');
                setupRealtimeFeed();
            };
        }
        
        // Notification bell click
        const notifBtn = document.getElementById('navNotifications');
        if (notifBtn) {
            notifBtn.onclick = () => {
                const modal = document.getElementById('notificationsModal');
                if (modal) modal.style.display = 'flex';
                renderNotifications();
            };
        }
    }
    
    window.clearPendingMedia = function() {
        pendingMedia = null;
        pendingMediaType = null;
        const container = document.getElementById('mediaPreviewContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        showToast("Media removed");
    };
    
    // ========== AUTH ==========
    window.auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadUserData(user);
            setupDashboardEvents();
        } else if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('signup.html')) {
            window.location.href = 'login.html';
        }
    });
});