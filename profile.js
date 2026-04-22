// profile.js - Complete Working Version

// profile.js - Add this at the VERY TOP
const OWNER_UID = "6JkPCRetiCOX65opu4ofqAiTXaY2";

// Owner premium info
const OWNER_INFO = {
    displayName: "Obinna Eze",
    title: "Founder & Lead Developer",
    badge: "👑",
    bio: "🌐 Full-Stack Developer | Creator of SocialNest\n💡 Building the future of social media",
    location: "🌍 Nigeria | Global",
    skills: ["Firebase", "html", "CSS", "JavaScript"],
    achievements: [
        "🏆 Built SocialNest from scratch",
        "⭐ 1000+ hours of coding"
    ]
};

function isOwner() {
    return currentUser && currentUser.uid === OWNER_UID;
}

console.log("profile.js loaded");

document.addEventListener('DOMContentLoaded', async function() {
    
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    
    if (!window.db) {
        console.error("Firebase not ready");
        return;
    }
    
    const { ref, get, update, remove, onValue } = window.firebaseRTDB;
    const auth = window.auth;
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    
    let currentUser = null;
    
    // OWNER CONFIG - Replace with your actual Firebase UID
    const OWNER_UID = "6JkPCRetiCOX65opu4ofqAiTXaY2";
    
    function showToast(msg) {
        let t = document.getElementById('toastMsg');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toastMsg';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        setTimeout(() => t.style.opacity = '0', 2000);
    }
    
    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function isOwner() {
        return currentUser && currentUser.uid === OWNER_UID;
    }
    
    function applyOwnerGlow() {
        if (!isOwner()) return;
        const container = document.querySelector('.profile-container');
        if (container) {
            container.classList.add('owner-glow');
        }
    }
    
    async function loadUserData(user) {
        const userRef = ref(window.db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            currentUser = { uid: user.uid, ...snapshot.val() };
        } else {
            currentUser = {
                uid: user.uid,
                displayName: user.email?.split('@')[0] || 'User',
                username: user.email?.split('@')[0] || 'user',
                profilePic: `https://ui-avatars.com/api/?background=667eea&color=fff&name=${(user.email?.split('@')[0] || 'User')[0]}`,
                bio: '',
                location: '',
                coverPic: '',
                work: '',
                education: '',
                relationship: '',
                friends: [],
                friendRequests: [],
                posts: []
            };
            await update(ref(window.db, `users/${user.uid}`), currentUser);
        }
        
        // Make currentUser globally available
        window.currentUser = currentUser;
        
        renderProfile();
        renderUserPosts();
        updateStats();
        applyOwnerGlow();
        
        // Show admin menu for owner
        showAdminMenuForOwner();
    }
    
    // Update all user's posts with new display name
async function updateAllPostsWithNewName(newDisplayName, newProfilePic = null) {
    try {
        const postsRef = ref(window.db, 'posts');
        const snapshot = await get(postsRef);
        const allPosts = snapshot.val();
        
        if (!allPosts) return;
        
        let updateCount = 0;
        
        for (const [postId, post] of Object.entries(allPosts)) {
            if (post.userId === currentUser.uid) {
                const updates = {};
                if (newDisplayName) updates.userName = newDisplayName;
                if (newProfilePic) updates.userProfilePic = newProfilePic;
                
                if (Object.keys(updates).length > 0) {
                    await update(ref(window.db, `posts/${postId}`), updates);
                    updateCount++;
                }
            }
        }
        
        console.log(`Updated ${updateCount} posts with new name`);
        return updateCount;
    } catch (error) {
        console.error("Error updating posts:", error);
        return 0;
    }
}

// Update all comments with new name
async function updateAllCommentsWithNewName(newDisplayName) {
    try {
        const postsRef = ref(window.db, 'posts');
        const snapshot = await get(postsRef);
        const allPosts = snapshot.val();
        
        if (!allPosts) return;
        
        let updateCount = 0;
        
        for (const [postId, post] of Object.entries(allPosts)) {
            let postUpdated = false;
            
            if (post.comments && post.comments.length > 0) {
                const updatedComments = post.comments.map(comment => {
                    if (comment.userId === currentUser.uid && comment.userName !== newDisplayName) {
                        updateCount++;
                        postUpdated = true;
                        return { ...comment, userName: newDisplayName };
                    }
                    return comment;
                });
                
                if (postUpdated) {
                    await update(ref(window.db, `posts/${postId}`), { comments: updatedComments });
                }
            }
        }
        
        console.log(`Updated ${updateCount} comments with new name`);
        return updateCount;
    } catch (error) {
        console.error("Error updating comments:", error);
        return 0;
    }
}
    
    function updateStats() {
        const postCountEl = document.getElementById('postCount');
        const friendCountEl = document.getElementById('friendCount');
        if (postCountEl) postCountEl.textContent = currentUser.posts?.length || 0;
        if (friendCountEl) friendCountEl.textContent = currentUser.friends?.length || 0;
    }
    
    function renderProfile() {
    const profileImg = document.getElementById('profileImage');
    if (profileImg) {
        profileImg.src = currentUser.profilePic || `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(currentUser.displayName || 'User')}`;
    }
    
    const displayNameEl = document.getElementById('displayName');
    if (displayNameEl) {
        if (isOwner()) {
            displayNameEl.innerHTML = `${escapeHTML(currentUser.displayName)} <span class="owner-badge"><i class="fas fa-crown"></i> Creator</span> <span class="premium-badge"><i class="fas fa-star"></i> Premium</span>`;
        } else {
            displayNameEl.textContent = currentUser.displayName || 'User';
        }
    }
    
    // FIXED: Username display
    const usernameEl = document.getElementById('username');
    if (usernameEl) {
        const username = currentUser.username || currentUser.email?.split('@')[0] || 'user';
        usernameEl.textContent = '@' + username;
    }
    
    const displayBioEl = document.getElementById('displayBio');
    if (displayBioEl) {
        displayBioEl.textContent = currentUser.bio || 'No bio yet';
    }
   
   
    
    // ... rest of the function
}   

    async function renderUserPosts() {
        const container = document.getElementById('userPostsContainer');
        if (!container) return;
        
        const postsRef = ref(window.db, 'posts');
        const snapshot = await get(postsRef);
        const allPosts = snapshot.val() || {};
        
        const userPosts = [];
        for (const [id, post] of Object.entries(allPosts)) {
            if (post.userId === currentUser.uid) {
                userPosts.push({ id, ...post });
            }
        }
        userPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (userPosts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px;">No posts yet</div>';
            return;
        }
        
        container.innerHTML = userPosts.map(post => `
            <div class="profile-post-card">
                <small>${new Date(post.timestamp).toLocaleDateString()} • ${post.privacy === 'public' ? '🌍 Public' : '🔒 Private'}</small>
                <p style="margin-top:8px;">${escapeHTML(post.content)}</p>
                ${post.media ? (post.mediaType === 'image' ? `<img src="${post.media}" style="max-width:100%; border-radius:16px; margin-top:8px;">` : `<video src="${post.media}" controls style="max-width:100%; border-radius:16px; margin-top:8px;"></video>`) : ''}
                <div style="margin-top:10px;"><span>❤️ ${post.likes?.length || 0}</span> <span>💬 ${post.comments?.length || 0}</span></div>
                <button class="delete-post-btn" data-post-id="${post.id}" style="background:#dc2626; color:white; border:none; padding:6px 12px; border-radius:20px; margin-top:8px; cursor:pointer;">Delete</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this post?')) {
                    await remove(ref(window.db, `posts/${btn.dataset.postId}`));
                    showToast('Post deleted');
                    renderUserPosts();
                    updateStats();
                }
            });
        });
    }
    
    async function updateProfile(displayName, bio, location, profilePic, coverPic, work, education, relationship) {
    try {
        const updates = {};
        let nameChanged = false;
        let picChanged = false;
        let oldName = currentUser.displayName;
        let oldPic = currentUser.profilePic;
        
        if (displayName && displayName.trim()) {
            updates.displayName = displayName.trim();
            nameChanged = true;
        }
        if (bio !== undefined) updates.bio = bio;
        if (location !== undefined) updates.location = location;
        if (profilePic && profilePic.trim()) {
            updates.profilePic = profilePic.trim();
            picChanged = true;
        }
        if (coverPic && coverPic.trim()) updates.coverPic = coverPic.trim();
        if (work !== undefined) updates.work = work;
        if (education !== undefined) updates.education = education;
        if (relationship !== undefined) updates.relationship = relationship;
        
        await update(ref(window.db, `users/${currentUser.uid}`), updates);
        
        // Update current user object
        if (displayName && displayName.trim()) currentUser.displayName = displayName.trim();
        if (bio !== undefined) currentUser.bio = bio;
        if (location !== undefined) currentUser.location = location;
        if (profilePic && profilePic.trim()) currentUser.profilePic = profilePic.trim();
        if (coverPic && coverPic.trim()) currentUser.coverPic = coverPic.trim();
        if (work !== undefined) currentUser.work = work;
        if (education !== undefined) currentUser.education = education;
        if (relationship !== undefined) currentUser.relationship = relationship;
        
        // Update all existing posts with new name
        if (nameChanged) {
            showToast("Updating your name on all posts...");
            await updateAllPostsWithNewName(displayName.trim(), picChanged ? profilePic.trim() : null);
            await updateAllCommentsWithNewName(displayName.trim());
        }
        
        if (picChanged) {
            await updateAllPostsWithNewName(null, profilePic.trim());
        }
        
        renderProfile();
        showToast('Profile updated successfully!');
        
        // Refresh feed if on dashboard
        if (typeof setupRealtimeFeed === 'function') {
            setupRealtimeFeed();
        }
        
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast("Error updating profile");
    }
}
    
    function handleImageUpload(file, isProfile) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please select an image');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const field = isProfile ? 'profilePic' : 'coverPic';
            await update(ref(window.db, `users/${currentUser.uid}`), { [field]: e.target.result });
            currentUser[field] = e.target.result;
            renderProfile();
            showToast(isProfile ? 'Profile picture updated!' : 'Cover photo updated!');
        };
        reader.readAsDataURL(file);
    }
    
    async function sendFriendRequest(username) {
        if (!username) {
            showToast('Enter a username');
            return;
        }
        
        const usersRef = ref(window.db, 'users');
        const snapshot = await get(usersRef);
        const users = snapshot.val() || {};
        
        let targetUserId = null;
        let targetUser = null;
        
        for (const [id, user] of Object.entries(users)) {
            if (user.username === username && id !== currentUser.uid) {
                targetUserId = id;
                targetUser = user;
                break;
            }
        }
        
        if (!targetUserId) {
            showToast('User not found');
            return;
        }
        
        if (currentUser.friends?.includes(targetUserId)) {
            showToast('Already friends');
            return;
        }
        
        const targetRef = ref(window.db, `users/${targetUserId}`);
        const currentRequests = targetUser.friendRequests || [];
        if (!currentRequests.includes(currentUser.uid)) {
            await update(targetRef, { friendRequests: [...currentRequests, currentUser.uid] });
            showToast(`Friend request sent to ${targetUser.displayName}`);
        }
    }
    
    async function renderFriendsModal() {
        const container = document.getElementById('friendsListModal');
        if (!container) return;
        
        const usersRef = ref(window.db, 'users');
        const snapshot = await get(usersRef);
        const users = snapshot.val() || {};
        
        const availableUsers = [];
        for (const [id, user] of Object.entries(users)) {
            if (id !== currentUser.uid && !currentUser.friends?.includes(id)) {
                availableUsers.push({ uid: id, ...user });
            }
        }
        
        if (availableUsers.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px;">No users to add</div>';
            return;
        }
        
        container.innerHTML = availableUsers.map(u => `
            <div style="display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid #eef2f6;">
                <img src="${u.profilePic}" style="width:40px; height:40px; border-radius:50%;">
                <div style="flex:1;"><strong>${escapeHTML(u.displayName)}</strong><br><small>@${escapeHTML(u.username)}</small></div>
                <button class="add-friend-btn" data-username="${u.username}" style="background:#667eea; color:white; border:none; padding:6px 12px; border-radius:20px; cursor:pointer;">Add Friend</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.add-friend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await sendFriendRequest(btn.dataset.username);
                btn.textContent = 'Sent!';
                btn.disabled = true;
            });
        });
    }
    
    async function renderFriendRequestsModal() {
        const container = document.getElementById('friendRequestsList');
        if (!container) return;
        
        const requests = currentUser.friendRequests || [];
        if (requests.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px;">No pending requests</div>';
            return;
        }
        
        let html = '';
        for (const id of requests) {
            const userRef = ref(window.db, `users/${id}`);
            const snapshot = await get(userRef);
            const requester = snapshot.val();
            if (requester) {
                html += `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #eef2f6;">
                        <img src="${requester.profilePic}" style="width:48px; height:48px; border-radius:50%;">
                        <div style="flex:1;"><strong>${escapeHTML(requester.displayName)}</strong><br><small>@${escapeHTML(requester.username)}</small></div>
                        <button class="accept-request-btn" data-user-id="${id}" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:20px; cursor:pointer;">Accept</button>
                        <button class="reject-request-btn" data-user-id="${id}" style="background:#dc2626; color:white; border:none; padding:6px 12px; border-radius:20px; cursor:pointer;">Reject</button>
                    </div>
                `;
            }
        }
        container.innerHTML = html;
        
        document.querySelectorAll('.accept-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fromUserId = btn.dataset.userId;
                const userRef = ref(window.db, `users/${currentUser.uid}`);
                const newFriends = [...(currentUser.friends || []), fromUserId];
                const newRequests = (currentUser.friendRequests || []).filter(id => id !== fromUserId);
                await update(userRef, { friends: newFriends, friendRequests: newRequests });
                
                const requesterRef = ref(window.db, `users/${fromUserId}`);
                const requesterSnapshot = await get(requesterRef);
                const requesterFriends = requesterSnapshot.val()?.friends || [];
                await update(requesterRef, { friends: [...requesterFriends, currentUser.uid] });
                
                currentUser.friends = newFriends;
                currentUser.friendRequests = newRequests;
                showToast("Friend request accepted!");
                renderFriendRequestsModal();
                updateStats();
            });
        });
        
        document.querySelectorAll('.reject-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fromUserId = btn.dataset.userId;
                const userRef = ref(window.db, `users/${currentUser.uid}`);
                const newRequests = (currentUser.friendRequests || []).filter(id => id !== fromUserId);
                await update(userRef, { friendRequests: newRequests });
                currentUser.friendRequests = newRequests;
                showToast("Friend request rejected");
                renderFriendRequestsModal();
            });
        });
    }
    
    async function deleteUserAccount() {
        const confirmInput = document.getElementById('deleteConfirmInput');
        if (!confirmInput || confirmInput.value !== 'DELETE MY ACCOUNT') {
            showToast('❌ Please type "DELETE MY ACCOUNT" to confirm');
            return;
        }
        
        showToast('🗑️ Deleting your account... Please wait');
        
        try {
            const userId = currentUser.uid;
            
            const postsRef = ref(window.db, 'posts');
            const postsSnapshot = await get(postsRef);
            const posts = postsSnapshot.val();
            if (posts) {
                for (const [postId, post] of Object.entries(posts)) {
                    if (post.userId === userId) {
                        await remove(ref(window.db, `posts/${postId}`));
                    }
                }
            }
            
            const usersRef = ref(window.db, 'users');
            const usersSnapshot = await get(usersRef);
            const users = usersSnapshot.val();
            if (users) {
                for (const [otherUserId, otherUser] of Object.entries(users)) {
                    if (otherUser.friends && otherUser.friends.includes(userId)) {
                        const updatedFriends = otherUser.friends.filter(id => id !== userId);
                        await update(ref(window.db, `users/${otherUserId}`), { friends: updatedFriends });
                    }
                    if (otherUser.friendRequests && otherUser.friendRequests.includes(userId)) {
                        const updatedRequests = otherUser.friendRequests.filter(id => id !== userId);
                        await update(ref(window.db, `users/${otherUserId}`), { friendRequests: updatedRequests });
                    }
                }
            }
            
            const messagesRef = ref(window.db, 'messages');
            const messagesSnapshot = await get(messagesRef);
            const chats = messagesSnapshot.val();
            if (chats) {
                for (const [chatId] of Object.entries(chats)) {
                    if (chatId.includes(userId)) {
                        await remove(ref(window.db, `messages/${chatId}`));
                    }
                }
            }
            
            await remove(ref(window.db, `users/${userId}`));
            
            const user = auth.currentUser;
            if (user) {
                await user.delete();
            }
            
            localStorage.clear();
            sessionStorage.clear();
            
            showToast('✅ Account deleted successfully');
            setTimeout(() => {
                window.location.href = 'signup.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            showToast('❌ Error: ' + error.message);
        }
    }
    
    function showAdminMenuForOwner() {
        const adminMenuItem = document.getElementById('adminPanelMenuItem');
        if (adminMenuItem && isOwner()) {
            adminMenuItem.style.display = 'flex';
        }
    }
    
    // Event Listeners
    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('editModal');
        if (modal) {
            document.getElementById('editDisplayName').value = currentUser.displayName || '';
            document.getElementById('editBio').value = currentUser.bio || '';
            document.getElementById('editLocation').value = currentUser.location || '';
            document.getElementById('editAvatarUrl').value = currentUser.profilePic || '';
            document.getElementById('editCoverUrl').value = currentUser.coverPic || '';
            document.getElementById('editWork').value = currentUser.work || '';
            document.getElementById('editEducation').value = currentUser.education || '';
            document.getElementById('relationShipSelect').value = currentUser.relationship || '';
            modal.style.display = 'flex';
        }
    });
    
    document.getElementById('closeEditModal')?.addEventListener('click', () => {
        document.getElementById('editModal').style.display = 'none';
    });
    
    document.getElementById('saveProfileChanges')?.addEventListener('click', async () => {
        await updateProfile(
            document.getElementById('editDisplayName').value,
            document.getElementById('editBio').value,
            document.getElementById('editLocation').value,
            document.getElementById('editAvatarUrl').value,
            document.getElementById('editCoverUrl').value,
            document.getElementById('editWork').value,
            document.getElementById('editEducation').value,
            document.getElementById('relationShipSelect').value
        );
        document.getElementById('editModal').style.display = 'none';
    });
    
    document.getElementById('profilePicWrapper')?.addEventListener('click', () => {
        document.getElementById('profileImageUpload').click();
    });
    
    document.getElementById('profileImageUpload')?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImageUpload(e.target.files[0], true);
        e.target.value = '';
    });
    
    document.getElementById('coverArea')?.addEventListener('click', () => {
        document.getElementById('coverImageUpload').click();
    });
    
    document.getElementById('coverImageUpload')?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImageUpload(e.target.files[0], false);
        e.target.value = '';
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    
    document.getElementById('showFriendsModalBtn')?.addEventListener('click', async () => {
        await renderFriendsModal();
        document.getElementById('friendsModal').style.display = 'flex';
    });
    
    document.getElementById('viewFriendRequestsBtn')?.addEventListener('click', async () => {
        await renderFriendRequestsModal();
        document.getElementById('friendRequestsModal').style.display = 'flex';
    });
    
    document.getElementById('closeFriendsModal')?.addEventListener('click', () => {
        document.getElementById('friendsModal').style.display = 'none';
    });
    
    document.getElementById('closeRequestsModal')?.addEventListener('click', () => {
        document.getElementById('friendRequestsModal').style.display = 'none';
    });
    
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteUserAccount);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
        document.getElementById('deleteModal').style.display = 'none';
    });
    
    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserData(user);
        } else {
            window.location.href = 'login.html';
        }
    });
    // ========== FIX FOR VIEW-PROFILE PAGE ==========
// Check if we're on view-profile page
if (window.location.pathname.includes('view-profile')) {
    console.log("On view-profile page, skipping profile initialization");
    return;
}

// Also check if the page has view-profile elements
if (document.getElementById('reportModal') || window.location.search.includes('uid')) {
    console.log("View-profile page detected, skipping profile.js");
    return;
}
});