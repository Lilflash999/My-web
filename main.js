// main.js - Complete user registration for SocialNest

document.addEventListener('DOMContentLoaded', function() {
  console.log('Signup page loaded');
  
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    console.log('Signup form found');
    
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Form submitted');
      
      // Get form values
      const username = document.getElementById('username')?.value.trim() || '';
      const fullname = document.getElementById('fullname')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const birthday = document.getElementById('birthday')?.value || '';
      
      // Get gender from select dropdown
      const genderSelect = document.getElementById('gender');
      const gender = genderSelect ? genderSelect.value : '';
      
      // Get terms agreement
      const agreeTerms = document.querySelector('input[name="agree"]')?.checked || false;
      
      // Error message element
      const errorMessageDiv = document.getElementById('errorMessage');
      if (errorMessageDiv) {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.color = 'red';
      }
      
      // Validation
      if (username.length < 3) {
        showError(errorMessageDiv, 'Username must be at least 3 characters');
        return;
      }
      
      if (fullname.length < 3) {
        showError(errorMessageDiv, 'Please enter your full name');
        return;
      }
      
      // Email validation - accept common email providers
      const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError(errorMessageDiv, 'Enter a valid email address');
        return;
      }
      
      if (password.length < 6) {
        showError(errorMessageDiv, 'Password must be at least 6 characters');
        return;
      }
      
      if (!birthday) {
        showError(errorMessageDiv, 'Please enter your birthday');
        return;
      }
      
      if (!gender) {
        showError(errorMessageDiv, 'Please select your gender');
        return;
      }
      
      if (!agreeTerms) {
        showError(errorMessageDiv, 'You must agree to the terms and conditions');
        return;
      }
      
      // Load existing users from SocialNest storage
      const STORAGE_USERS = "socialnest_users_master";
      let existingUsers = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
      
      // Check if user already exists
      const userExists = existingUsers.some(user =>
        user.username === username || user.email === email
      );
      
      if (userExists) {
        showError(errorMessageDiv, 'Username or email already exists. Please choose another.');
        return;
      }
      
      // Create user object for SocialNest
      const userData = {
        id: Date.now().toString(),
        username: username,
        displayName: fullname,
        fullname: fullname,
        email: email,
        password: password,
        birthday: birthday,
        gender: gender,
        profilePic: `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(fullname)}`,
        bio: '',
        location: '',
        posts: [],
        friends: [],
        createdAt: new Date().toISOString(),
        isActive: true
      };
      
      console.log('Creating user:', userData);
      
      // Save to SocialNest storage
      existingUsers.push(userData);
      localStorage.setItem(STORAGE_USERS, JSON.stringify(existingUsers));
      
      // Create session using SocialNest format
      const STORAGE_SESSION = "socialnest_session_active";
      const sessionData = {
        userId: userData.id,
        username: userData.username,
        fullname: userData.fullname,
        email: userData.email,
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionData));
      
      // Also keep legacy format for compatibility
      localStorage.setItem('allUsers', JSON.stringify(existingUsers));
      localStorage.setItem('currentSession', JSON.stringify(sessionData));
      localStorage.setItem('userData', JSON.stringify(userData));
      
      // Initialize profile data
      localStorage.setItem('pf_display_name', userData.displayName);
      localStorage.setItem('pf_profile_pic', userData.profilePic);
      localStorage.setItem('pf_display_bio', '');
      localStorage.setItem('pf_detail_location', '');
      
      // Show success message
      if (errorMessageDiv) {
        errorMessageDiv.style.color = 'green';
        errorMessageDiv.textContent = '✅ Account created successfully! Redirecting to dashboard...';
      }
      
      // Redirect after delay
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    });
  }
  
  // Helper function to show errors
  function showError(element, message) {
    if (element) {
      element.style.color = 'red';
      element.textContent = message;
    }
    console.log('Error:', message);
  }
});

// ==================== LOGIN FUNCTION ====================
function loginUser(usernameOrEmail, password) {
  const STORAGE_USERS = "socialnest_users_master";
  const existingUsers = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  
  const user = existingUsers.find(user =>
    (user.username === usernameOrEmail || user.email === usernameOrEmail) &&
    user.password === password
  );
  
  if (user) {
    const STORAGE_SESSION = "socialnest_session_active";
    const sessionData = {
      userId: user.id,
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionData));
    localStorage.setItem('currentSession', JSON.stringify(sessionData));
    localStorage.setItem('userData', JSON.stringify(user));
    
    // Sync profile data
    localStorage.setItem('pf_display_name', user.displayName || user.fullname);
    localStorage.setItem('pf_profile_pic', user.profilePic || `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(user.fullname)}`);
    localStorage.setItem('pf_display_bio', user.bio || '');
    localStorage.setItem('pf_detail_location', user.location || '');
    
    return { success: true, user: user };
  } else {
    return { success: false, message: 'Invalid username/email or password' };
  }
}

// ==================== LOGOUT FUNCTION ====================
function logoutUser() {
  const STORAGE_SESSION = "socialnest_session_active";
  localStorage.removeItem(STORAGE_SESSION);
  localStorage.removeItem('currentSession');
  localStorage.removeItem('userData');
  window.location.href = 'index.html';
}

// ==================== CHECK LOGIN STATUS ====================
function isLoggedIn() {
  const STORAGE_SESSION = "socialnest_session_active";
  const session = localStorage.getItem(STORAGE_SESSION);
  if (session) {
    try {
      const sessionData = JSON.parse(session);
      return sessionData.isLoggedIn === true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// ==================== GET CURRENT USER ====================
function getCurrentUser() {
  const STORAGE_SESSION = "socialnest_session_active";
  const STORAGE_USERS = "socialnest_users_master";
  const session = localStorage.getItem(STORAGE_SESSION);
  if (session) {
    try {
      const sessionData = JSON.parse(session);
      const allUsers = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
      return allUsers.find(user => user.id === sessionData.userId);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ==================== LOGIN FORM HANDLER ====================
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const usernameOrEmail = document.getElementById('usernameOrEmail')?.value || '';
    const password = document.getElementById('password')?.value || '';
    const errorMessage = document.getElementById('errorMessage');
    
    const result = loginUser(usernameOrEmail, password);
    
    if (result.success) {
      if (errorMessage) {
        errorMessage.style.color = 'green';
        errorMessage.textContent = 'Login successful! Redirecting...';
      }
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    } else {
      if (errorMessage) {
        errorMessage.style.color = 'red';
        errorMessage.textContent = result.message;
      }
    }
  });
}

// Dashboard protection
if (window.location.pathname.includes('dashboard.html') ||
  window.location.pathname.includes('profile.html')) {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

// Display user data on dashboard
if (document.getElementById('dashboard')) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    const usernameElement = document.getElementById('usernameDisplay');
    const emailElement = document.getElementById('emailDisplay');
    const fullnameElement = document.getElementById('fullnameDisplay');
    
    if (usernameElement) usernameElement.textContent = currentUser.username;
    if (emailElement) emailElement.textContent = currentUser.email;
    if (fullnameElement) fullnameElement.textContent = currentUser.fullname;
  }
}