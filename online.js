// online.js - Real-time user online/offline status for SocialNest
// Usage:
//   1. Include after Firebase initialization
//   2. Call OnlineStatus.init(currentUser.uid, db)
//   3. Use OnlineStatus.attachIndicator(containerElement, userId, db)
//   4. Use OnlineStatus.getStatusOnce(userId, db, callback)

(function(window) {
  // Store active listeners to avoid duplicates
  const statusListeners = new Map();
  
  /**
   * Initialize online presence for the current user
   * @param {string} userId - Current user's UID
   * @param {object} db - Firebase Realtime Database instance
   */
  function initOnlineStatus(userId, db) {
    if (!userId || !db) {
      console.error("initOnlineStatus: userId and db required");
      return;
    }
    
    const userStatusRef = db.ref(`users/${userId}/status`);
    const userLastSeenRef = db.ref(`users/${userId}/lastSeen`);
    const connectedRef = db.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        userStatusRef.set('online');
        userStatusRef.onDisconnect().set('offline');
        userLastSeenRef.onDisconnect().set(Date.now());
        userLastSeenRef.set(Date.now());
      }
    });
    
    window.addEventListener('beforeunload', () => {
      userStatusRef.set('offline');
      userLastSeenRef.set(Date.now());
    });
    
    console.log(`Online status initialized for user ${userId}`);
  }
  
  /**
   * Subscribe to a user's online status
   * @param {string} userId - Target user's UID
   * @param {object} db - Firebase Realtime Database instance
   * @param {function} callback - Called with status ('online' or 'offline')
   * @returns {function} Unsubscribe function
   */
  function subscribeToUserStatus(userId, db, callback) {
    if (!userId || !db || !callback) {
      console.error("subscribeToUserStatus: missing parameters");
      return () => {};
    }
    
    // If already subscribed, return existing unsubscribe
    if (statusListeners.has(userId)) {
      db.ref(`users/${userId}/status`).once('value', (snap) => {
        callback(snap.val() === 'online' ? 'online' : 'offline');
      });
      return statusListeners.get(userId);
    }
    
    const statusRef = db.ref(`users/${userId}/status`);
    const onValue = (snap) => {
      const status = snap.val() === 'online' ? 'online' : 'offline';
      callback(status);
    };
    statusRef.on('value', onValue);
    
    const unsubscribe = () => {
      statusRef.off('value', onValue);
      statusListeners.delete(userId);
    };
    statusListeners.set(userId, unsubscribe);
    return unsubscribe;
  }
  
  /**
   * Attach a status indicator (dot) to an HTML element (e.g., avatar container)
   * @param {HTMLElement} element - The element that contains the avatar (must have position relative)
   * @param {string} userId - Target user's UID
   * @param {object} db - Firebase Realtime Database instance
   * @param {string} position - 'bottom-right' (default) or 'top-right'
   */
  function attachStatusIndicator(element, userId, db, position = 'bottom-right') {
    if (!element || !userId || !db) return;
    
    // Create or find status dot
    let dot = element.querySelector('.online-status-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'online-status-dot';
      dot.style.position = 'absolute';
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.border = '2px solid white';
      dot.style.backgroundColor = '#9ca3af'; // grey default (offline)
      
      // Position based on parameter
      if (position === 'bottom-right') {
        dot.style.bottom = '2px';
        dot.style.right = '2px';
      } else if (position === 'top-right') {
        dot.style.top = '2px';
        dot.style.right = '2px';
      } else {
        dot.style.bottom = '2px';
        dot.style.right = '2px';
      }
      
      // Ensure parent has position relative
      if (getComputedStyle(element).position === 'static') {
        element.style.position = 'relative';
      }
      element.appendChild(dot);
    }
    
    // Subscribe to status updates
    subscribeToUserStatus(userId, db, (status) => {
      dot.style.backgroundColor = status === 'online' ? '#22c55e' : '#9ca3af';
      dot.style.animation = status === 'online' ? 'pulse-green 1.5s infinite' : 'none';
    });
  }
  
  /**
   * Get a user's status once (non‑realtime)
   * @param {string} userId - Target user's UID
   * @param {object} db - Firebase Realtime Database instance
   * @param {function} callback - Called with status ('online' or 'offline')
   */
  function getStatusOnce(userId, db, callback) {
    if (!userId || !db || !callback) return;
    db.ref(`users/${userId}/status`).once('value', (snap) => {
      callback(snap.val() === 'online' ? 'online' : 'offline');
    });
  }
  
  // Add CSS animation for online dot
  const style = document.createElement('style');
  style.textContent = `
        @keyframes pulse-green {
            0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
            70% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
            100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
    `;
  document.head.appendChild(style);
  
  // Expose functions globally
  window.OnlineStatus = {
    init: initOnlineStatus,
    subscribe: subscribeToUserStatus,
    attachIndicator: attachStatusIndicator,
    getStatusOnce: getStatusOnce
  };
})(window);