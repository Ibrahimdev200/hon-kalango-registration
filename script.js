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

    // ========================================
    //   Project Gallery
    // ========================================
    const galleryImages = [
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.30 PM.jpeg', title: 'Project Photo 1', description: 'A project moment drawn from our community outreach activities.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.32 PM.jpeg', title: 'Project Photo 2', description: 'A snapshot from our development work in Nembe Constituency II.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.34 PM.jpeg', title: 'Project Photo 3', description: 'A scene of collaborative community planning and engagement.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.37 PM (1).jpeg', title: 'Project Photo 4', description: 'Community members joining hands to support local progress.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.37 PM.jpeg', title: 'Project Photo 5', description: 'A strong moment of support during one of our outreach programs.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.54 PM (1).jpeg', title: 'Project Photo 6', description: 'A photo capturing project impact in the constituency.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.54 PM (2).jpeg', title: 'Project Photo 7', description: 'Engaged stakeholders and volunteers working together.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.54 PM.jpeg', title: 'Project Photo 8', description: 'A community event highlighting our development goals.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.55 PM.jpeg', title: 'Project Photo 9', description: 'A community ceremony celebrating local achievements.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.56 PM.jpeg', title: 'Project Photo 10', description: 'Project activities that support youth empowerment.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.47.59 PM.jpeg', title: 'Project Photo 11', description: 'A strong visual of community leadership and progress.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.08 PM.jpeg', title: 'Project Photo 12', description: 'A meaningful project moment from a local initiative.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.10 PM.jpeg', title: 'Project Photo 13', description: 'A snapshot capturing real project impact in the field.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.12 PM.jpeg', title: 'Project Photo 14', description: 'A real example of community progress and teamwork.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.16 PM.jpeg', title: 'Project Photo 15', description: 'Supporters and volunteers working together for the cause.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.34 PM.jpeg', title: 'Project Photo 16', description: 'A project scene that reflects our campaign commitments.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.39 PM.jpeg', title: 'Project Photo 17', description: 'A photo from one of our key outreach events.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.43 PM.jpeg', title: 'Project Photo 18', description: 'Community members engaging with our development team.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.50 PM.jpeg', title: 'Project Photo 19', description: 'A photo highlighting local project delivery and outreach.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.54 PM.jpeg', title: 'Project Photo 20', description: 'A photo representing progress and community resilience.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.57 PM.jpeg', title: 'Project Photo 21', description: 'A real moment from our campaign activities.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.58 PM (1).jpeg', title: 'Project Photo 22', description: 'A photo highlighting active community participation.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.58 PM (2).jpeg', title: 'Project Photo 23', description: 'A shared community experience from our events.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.58 PM (3).jpeg', title: 'Project Photo 24', description: 'A moment of local collaboration and impact.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.58 PM.jpeg', title: 'Project Photo 25', description: 'A visual story of our team working with residents.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.59 PM (1).jpeg', title: 'Project Photo 26', description: 'A photo that highlights the spirit of service.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.59 PM (2).jpeg', title: 'Project Photo 27', description: 'A project image representing local development action.' },
        { src: 'project-img/WhatsApp Image 2026-06-15 at 4.48.59 PM.jpeg', title: 'Project Photo 28', description: 'A final image showing our continued commitment to the people.' }
    ];

    const projectGallery = document.getElementById('projectGallery');
    const galleryPrevBtn = document.getElementById('galleryPrev');
    const galleryNextBtn = document.getElementById('galleryNext');
    const galleryModal = document.getElementById('galleryModal');
    const galleryModalClose = document.getElementById('galleryModalClose');
    const galleryModalImage = document.getElementById('galleryModalImage');
    const galleryModalTitle = document.getElementById('galleryModalTitle');
    const galleryModalDescription = document.getElementById('galleryModalDescription');

    const galleryDisplaySize = 4;
    let galleryShuffled = [];
    let galleryPage = 0;

    function shuffleArray(array) {
        const result = array.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function openGalleryModal(item) {
        galleryModalImage.src = item.src;
        galleryModalImage.alt = item.title;
        galleryModalTitle.textContent = item.title;
        galleryModalDescription.textContent = item.description;
        galleryModal.classList.add('open');
        galleryModal.setAttribute('aria-hidden', 'false');
    }

    function closeGalleryModal() {
        galleryModal.classList.remove('open');
        galleryModal.setAttribute('aria-hidden', 'true');
        galleryModalImage.src = '';
        galleryModalImage.alt = '';
    }

    function updateGalleryControls() {
        if (!galleryPrevBtn || !galleryNextBtn) return;
        const pages = Math.ceil(galleryShuffled.length / galleryDisplaySize);
        galleryPrevBtn.disabled = pages <= 1;
        galleryNextBtn.disabled = pages <= 1;
    }

    function renderGallery() {
        if (!projectGallery || galleryShuffled.length === 0) return;
        const start = galleryPage * galleryDisplaySize;
        const displayItems = galleryShuffled.slice(start, start + galleryDisplaySize);
        if (displayItems.length < galleryDisplaySize) {
            displayItems.push(...galleryShuffled.slice(0, galleryDisplaySize - displayItems.length));
        }

        projectGallery.innerHTML = displayItems.map(item => {
            return `
                <article class="gallery-card reveal">
                    <img src="${item.src}" alt="${item.title}">
                    <div class="gallery-card-overlay"></div>
                    <div class="gallery-card-copy">
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                    </div>
                </article>
            `;
        }).join('');

        const cards = projectGallery.querySelectorAll('.gallery-card');
        cards.forEach((card, index) => {
            card.addEventListener('click', () => openGalleryModal(displayItems[index]));
            setTimeout(() => card.classList.add('visible'), index * 100 + 80);
        });

        projectGallery.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
        updateGalleryControls();
    }

    function changeGalleryPage(offset) {
        const pages = Math.ceil(galleryShuffled.length / galleryDisplaySize);
        galleryPage = (galleryPage + offset + pages) % pages;
        projectGallery.querySelectorAll('.gallery-card').forEach(card => card.classList.remove('visible'));
        setTimeout(renderGallery, 150);
    }

    function initGallery() {
        galleryShuffled = shuffleArray(galleryImages);
        galleryPage = 0;
        renderGallery();
    }

    initGallery();

    if (galleryPrevBtn) {
        galleryPrevBtn.addEventListener('click', () => changeGalleryPage(-1));
    }
    if (galleryNextBtn) {
        galleryNextBtn.addEventListener('click', () => changeGalleryPage(1));
    }

    galleryModalClose.addEventListener('click', closeGalleryModal);
    galleryModal.addEventListener('click', function(event) {
        if (event.target === galleryModal) {
            closeGalleryModal();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && galleryModal.classList.contains('open')) {
            closeGalleryModal();
        }
    });

    console.log('Kalango Campaign Website Loaded Successfully!');
});
