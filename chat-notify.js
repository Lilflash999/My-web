// chat-notify.js - Real-time chat notification badge
(function() {
  // Wait for Firebase and user to be ready
  function waitForFirebase() {
    if (window.db && window.auth && window.firebaseRTDB) {
      const user = window.auth.currentUser;
      if (user) {
        startListening(user.uid);
      } else {
        window.auth.onAuthStateChanged((u) => {
          if (u) startListening(u.uid);
        });
      }
    } else {
      setTimeout(waitForFirebase, 500);
    }
  }
  
  async function startListening(currentUserId) {
    const { ref, onValue } = window.firebaseRTDB;
    const db = window.db;
    const messagesRef = ref(db, 'messages');
    let unreadSenders = new Set();
    
    function updateBadge() {
      const navChat = document.getElementById('navChat');
      if (!navChat) return;
      
      // Create or get badge element
      let badge = navChat.querySelector('.chat-badge');
      const count = unreadSenders.size;
      
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'chat-badge';
          badge.style.cssText = `
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #ef4444;
                        color: white;
                        border-radius: 50%;
                        min-width: 18px;
                        height: 18px;
                        font-size: 11px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0 5px;
                        box-shadow: 0 0 0 2px white;
                        z-index: 10;
                    `;
          navChat.style.position = 'relative';
          navChat.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else {
        if (badge) badge.style.display = 'none';
      }
    }
    
    // Listen to all messages
    onValue(messagesRef, (snapshot) => {
      const allChats = snapshot.val();
      unreadSenders.clear();
      
      if (allChats) {
        for (const [chatId, messages] of Object.entries(allChats)) {
          // chatId format: "uid1_uid2"
          const ids = chatId.split('_');
          const otherUserId = ids[0] === currentUserId ? ids[1] : ids[0];
          if (!otherUserId) continue;
          
          const messagesArray = Object.values(messages);
          const hasUnread = messagesArray.some(msg =>
            msg.to === currentUserId && msg.from === otherUserId && !msg.read
          );
          if (hasUnread) {
            unreadSenders.add(otherUserId);
          }
        }
      }
      updateBadge();
    });
  }
  
  waitForFirebase();
})();