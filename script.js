    // Get elements
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseBtn');
    const mobileToggle = document.getElementById('mobileToggle');
    const mainContent = document.getElementById('mainContent');
    // Function to toggle sidebar collapse on desktop
    function toggleCollapse() {
        sidebar.classList.toggle('collapsed');
        
        // Change button icon
        if (sidebar.classList.contains('collapsed')) {
            collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
            collapseBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        }
    }
    
    // Function for mobile menu
    function toggleMobile() {
        sidebar.classList.toggle('collapsed');
        
        // Update button icon if needed
        if (sidebar.classList.contains('collapsed')) {
            collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
            collapseBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        }
    }
    
    // Add click events
    if (collapseBtn) {
        collapseBtn.addEventListener('click', toggleCollapse);
    }
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobile);
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(event) {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile && sidebar && mobileToggle) {
            const isSidebarOpen = !sidebar.classList.contains('collapsed');
            
            if (isSidebarOpen) {
                if (!sidebar.contains(event.target) && !mobileToggle.contains(event.target)) {
                    sidebar.classList.add('collapsed');
                    collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                }
            }
        }
    });
    
    // On mobile load, sidebar is hidden
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            // Desktop - reset sidebar to visible
            sidebar.classList.remove('collapsed');
            collapseBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            sidebar.style.transform = '';
        } else {
            // Mobile - hide sidebar
            sidebar.classList.add('collapsed');
            collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        }
    });
    
    
  

//2//

// Loading Screen Manager
class LoadingManager {
    constructor() {
        this.overlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.loadingSubtext = document.getElementById('loadingSubtext');
        this.progressBar = document.getElementById('loadingProgressBar');
        this.mainElements = document.querySelectorAll('.wrapper, .whatsapp-float, .mobile-toggle');
        this.setupLoadingSequence();
        this.setupLinkHandlers();
    }
    
    setupLoadingSequence() {
        // Show loading screen immediately
        this.showLoading('Welcome to Dårë~Dê✓ïl§', 'Initializing experience...', 0);
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressInterval);
                this.progressBar.style.width = '100%';
                
                // Change text during loading
                setTimeout(() => {
                    this.loadingSubtext.textContent = 'Almost ready...';
                }, 500);
                
                setTimeout(() => {
                    this.loadingText.textContent = 'Loading Complete!';
                    this.loadingSubtext.textContent = 'Welcome';
                }, 1000);
                
                setTimeout(() => {
                    this.hideLoading();
                    this.showMainContent();
                }, 1500);
            }
            this.progressBar.style.width = progress + '%';
        }, 200);
    }
    
    showLoading(text, subtext, progress = 0) {
        if (text) this.loadingText.textContent = text;
        if (subtext) this.loadingSubtext.textContent = subtext;
        this.progressBar.style.width = progress + '%';
        this.overlay.classList.add('active');
    }
    
    hideLoading() {
        this.overlay.classList.remove('active');
    }
    
    showMainContent() {
        this.mainElements.forEach(el => {
            if (el) el.classList.add('content-loaded');
        });
    }
    
    setupLinkHandlers() {
        // Handle all internal navigation links
        const internalLinks = document.querySelectorAll('a[data-link="internal"]');
        const externalLinks = document.querySelectorAll('a[data-link="external"]');
        
        // For internal links (like main.html, index.html)
        internalLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href !== '#' && href !== 'javascript:void(0)') {
                    e.preventDefault();
                    this.navigateWithLoading(href);
                }
            });
        });
        
        // For external links (WhatsApp, details.txt, about.txt)
        externalLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                const target = link.getAttribute('target');
                
                if (href && href.startsWith('http')) {
                    // External WhatsApp links - show brief loading then open
                    e.preventDefault();
                    this.showExternalLoading(href, target);
                } else if (href && (href.endsWith('.txt') || href.includes('wa.me'))) {
                    // Text files and WhatsApp numbers
                    e.preventDefault();
                    this.showExternalLoading(href, target);
                }
            });
        });
    }
    
    navigateWithLoading(url) {
        this.showLoading('Loading page...', 'Please wait while we prepare your content', 0);
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressInterval);
                this.progressBar.style.width = '100%';
                setTimeout(() => {
                    window.location.href = url;
                }, 500);
            }
            this.progressBar.style.width = progress + '%';
        }, 150);
    }
    
    showExternalLoading(url, target = '_blank') {
        this.showLoading('Opening link...', 'Redirecting you now', 0);
        
        // Simple loading animation
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 25;
            this.progressBar.style.width = progress + '%';
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                setTimeout(() => {
                    window.open(url, target || '_blank');
                    this.hideLoading();
                }, 300);
            }
        }, 100);
    }
}

// Initialize loading manager when page is ready
document.addEventListener('DOMContentLoaded', () => {
    window.loadingManager = new LoadingManager();
});

// Optional: Handle audio loading
const audioElement = document.querySelector('audio');
if (audioElement) {
    audioElement.addEventListener('loadstart', () => {
        if (window.loadingManager) {
            window.loadingManager.loadingSubtext.textContent = 'Loading audio player...';
        }
    });
}

// Handle page refresh prevention (optional)
window.addEventListener('beforeunload', (e) => {
    if (window.loadingManager && window.loadingManager.overlay.classList.contains('active')) {
        e.preventDefault();
        e.returnValue = '';
    }
});