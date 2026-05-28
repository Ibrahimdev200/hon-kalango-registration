// ========================================
//   Professional Campaign Website JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // ========================================
    //   Hero Background Slider
    // ========================================
    const heroSlides = document.querySelectorAll('.hero-bg-slider .slide');
    if (heroSlides.length > 0) {
        let currentSlide = 0;
        setInterval(() => {
            heroSlides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % heroSlides.length;
            heroSlides[currentSlide].classList.add('active');
        }, 5000); // Change image every 5 seconds
    }
    
    // ========================================
    //   Mobile Menu Toggle
    // ========================================
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const menuOverlay = document.querySelector('.menu-overlay');
    const body = document.body;
    
    function toggleMobileMenu() {
        const isActive = navLinks.classList.contains('active');
        
        if (isActive) {
            mobileMenuBtn.classList.remove('active');
            navLinks.classList.remove('active');
            menuOverlay.classList.remove('active');
            body.classList.remove('menu-open');
        } else {
            mobileMenuBtn.classList.add('active');
            navLinks.classList.add('active');
            menuOverlay.classList.add('active');
            body.classList.add('menu-open');
        }
    }
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', function() {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
                menuOverlay.classList.remove('active');
                body.classList.remove('menu-open');
            });
        });
        
        // Close menu when clicking on overlay
        if (menuOverlay) {
            menuOverlay.addEventListener('click', function() {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
                menuOverlay.classList.remove('active');
                body.classList.remove('menu-open');
            });
        }
    }
    
    // ========================================
    //   Header Scroll Effect
    // ========================================
    const header = document.getElementById('header');
    
    function handleScroll() {
        if (window.scrollY > 80) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on page load
    
    // ========================================
    //   Smooth Scroll for Navigation Links
    // ========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerHeight = header.offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight + 1;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ========================================
    //   Active Navigation Link on Scroll
    // ========================================
    const sections = document.querySelectorAll('section[id]');
    
    function highlightNavLink() {
        const scrollPosition = window.scrollY + header.offsetHeight + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-links a').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', highlightNavLink);
    
    // ========================================
    //   Contact Form Handling
    // ========================================
    const contactForm = document.getElementById('contactForm');
    const successMessage = document.getElementById('successMessage');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const formData = new FormData(this);
            const name = formData.get('name');
            const phone = formData.get('phone');
            const polling = formData.get('polling_unit');
            
            // Simple validation
            if (!name || !phone || !polling) {
                showMessage('Please fill in all required text fields.', 'error');
                return;
            }
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Sending...';
            submitBtn.disabled = true;
            
            // Check if action is still placeholder
            if (this.action.includes('YOUR_FORM_ID') || this.action.includes('#')) {
                setTimeout(() => {
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    showMessage('Please update the Formspree URL in index.html to submit.', 'error');
                }, 1000);
                return;
            }
            
            fetch(this.action, {
                method: this.method,
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            }).then(response => {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                if (response.ok) {
                    contactForm.reset();
                    showMessage('Thank you for volunteering! We will contact you soon.', 'success');
                } else {
                    response.json().then(data => {
                        if (Object.hasOwn(data, 'errors')) {
                            showMessage(data["errors"].map(error => error["message"]).join(", "), 'error');
                        } else {
                            showMessage('Oops! There was a problem submitting your form.', 'error');
                        }
                    })
                }
            }).catch(error => {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                showMessage('Oops! There was a network problem submitting your form.', 'error');
            });
        });
    }
    
    function showMessage(text, type) {
        if (!successMessage) return;
        
        successMessage.textContent = text;
        successMessage.className = 'success-message show';
        successMessage.style.display = 'block';
        
        if (type === 'error') {
            successMessage.style.background = 'rgba(239, 68, 68, 0.1)';
            successMessage.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            successMessage.style.color = '#ef4444';
        } else {
            successMessage.style.background = 'rgba(16, 185, 129, 0.1)';
            successMessage.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            successMessage.style.color = '#10b981';
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
    }
    
    // ========================================
    //   Intersection Observer for .reveal
    // ========================================
    const revealOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const revealObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Run animation only once
            }
        });
    }, revealOptions);
    
    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });
    
    console.log('Kalango Campaign Website Loaded Successfully!');
});
