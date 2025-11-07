/**
 * Enhanced Landing Page Component
 * Fully immersive experience with all advanced features
 */

import { CanvasParticleSystem } from './CanvasParticleSystem';
import { CustomCursor } from './CustomCursor';
import { MouseSpotlight } from './MouseSpotlight';
import { ScrollAnimationObserver } from './ScrollAnimationObserver';
import { InteractiveRedactionDemo } from './InteractiveRedactionDemo';
import { TypewriterText } from './TypewriterText';
import { FloatingCTA } from './FloatingCTA';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { LiveCounter } from './LiveCounter';
import { TrustIndicators } from './TrustIndicators';
import { InteractiveCodeBlock } from './InteractiveCodeBlock';
import { FAQAccordion } from './FAQAccordion';
import { FeatureCard, type FeatureData } from './FeatureCard';

export class LandingPageEnhanced {
  private container: HTMLElement;
  private particleSystem: CanvasParticleSystem;
  private customCursor: CustomCursor;
  private mouseSpotlight: MouseSpotlight;
  private scrollObserver: ScrollAnimationObserver;
  private floatingCTA: FloatingCTA;
  private onGetStarted: () => void;
  private mouseVelocityX: number = 0;
  private mouseVelocityY: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(onGetStarted: () => void) {
    this.onGetStarted = onGetStarted;
    this.init();
  }

  private init(): void {
    // Initialize advanced features
    this.particleSystem = new CanvasParticleSystem(60);
    this.customCursor = new CustomCursor();
    this.mouseSpotlight = new MouseSpotlight(0.15);
    this.scrollObserver = new ScrollAnimationObserver(0.1);

    this.container = this.createLandingPage();

    // Setup interactions
    this.setupAdvancedParallax();
    this.setupVelocityTracking();
    this.setupMagneticButtons();
    this.setupHoverBackgroundShift();

    // Observe all scroll-animated elements
    setTimeout(() => {
      this.scrollObserver.observeMultiple('.scroll-animate', this.container);
    }, 100);

    // Create floating CTA (pass the scroll container)
    this.floatingCTA = new FloatingCTA('Start Redacting', () => this.onGetStarted(), this.container);
  }

  private setupAdvancedParallax(): void {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = this.container.scrollTop;

          // Multi-layer parallax
          const layers = this.container.querySelectorAll('.parallax-layer');
          layers.forEach((layer) => {
            const speed = parseFloat((layer as HTMLElement).dataset.speed || '0.3');
            (layer as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
          });

          // Fade out hero on scroll
          const heroSection = this.container.querySelector('.hero-section') as HTMLElement;
          if (heroSection) {
            const heroContent = heroSection.querySelector('.hero-content') as HTMLElement;
            if (heroContent) {
              heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
              heroContent.style.opacity = `${Math.max(0, 1 - scrolled / 800)}`;
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    this.container.addEventListener('scroll', handleScroll, { passive: true });
  }

  private setupVelocityTracking(): void {
    setInterval(() => {
      const currentMouseX = this.lastMouseX;
      const currentMouseY = this.lastMouseY;

      // Calculate velocity (simple difference)
      this.mouseVelocityX = Math.abs(currentMouseX - this.mouseVelocityX);
      this.mouseVelocityY = Math.abs(currentMouseY - this.mouseVelocityY);

      // Apply velocity classes to elements
      const velocityElements = this.container.querySelectorAll('.velocity-item');
      const totalVelocity = this.mouseVelocityX + this.mouseVelocityY;

      velocityElements.forEach((el) => {
        if (totalVelocity > 50) {
          el.classList.add('velocity-fast');
          el.classList.remove('velocity-slow');
        } else if (totalVelocity > 10) {
          el.classList.remove('velocity-fast', 'velocity-slow');
        } else {
          el.classList.add('velocity-slow');
          el.classList.remove('velocity-fast');
        }
      });
    }, 50);

    document.addEventListener('mousemove', (e) => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
  }

  private setupMagneticButtons(): void {
    document.addEventListener('mousemove', (e) => {
      const buttons = this.container.querySelectorAll('.magnetic-button');

      buttons.forEach((button) => {
        const rect = button.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2;
        const buttonCenterY = rect.top + rect.height / 2;
        const distanceX = e.clientX - buttonCenterX;
        const distanceY = e.clientY - buttonCenterY;
        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        if (distance < 150) {
          const pullStrength = (150 - distance) / 150;
          const pullX = distanceX * pullStrength * 0.3;
          const pullY = distanceY * pullStrength * 0.3;
          (button as HTMLElement).style.transform = `translate(${pullX}px, ${pullY}px) scale(${1 + pullStrength * 0.05})`;
        } else {
          (button as HTMLElement).style.transform = 'translate(0, 0) scale(1)';
        }
      });
    });
  }

  private setupHoverBackgroundShift(): void {
    const sections = this.container.querySelectorAll('.hover-bg-shift');

    sections.forEach((section) => {
      section.addEventListener('mouseenter', () => {
        (section as HTMLElement).style.backgroundPosition = '100% 50%';
      });
      section.addEventListener('mouseleave', () => {
        (section as HTMLElement).style.backgroundPosition = '0% 50%';
      });
    });
  }

  private createLandingPage(): HTMLElement {
    const page = document.createElement('div');
    page.className = 'landing-page page-transition';
    page.style.position = 'relative';
    page.style.width = '100%';
    page.style.minHeight = '100vh';
    page.style.overflowY = 'auto';
    page.style.overflowX = 'hidden';

    // Add particle system
    page.appendChild(this.particleSystem.getElement());

    // Add mouse spotlight
    page.appendChild(this.mouseSpotlight.getElement());

    // Create main content
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.zIndex = '1';

    // Hero section
    content.appendChild(this.createEnhancedHeroSection());

    // Interactive demo section
    content.appendChild(this.createInteractiveDemoSection());

    // Features section
    content.appendChild(this.createFeaturesSection());

    // Before/After section
    content.appendChild(this.createBeforeAfterSection());

    // Trust indicators
    content.appendChild(this.createTrustSection());

    // Live stats section
    content.appendChild(this.createLiveStatsSection());

    // Code example section
    content.appendChild(this.createCodeExampleSection());

    // FAQ section
    content.appendChild(this.createFAQSection());

    // Final CTA section
    content.appendChild(this.createFinalCTASection());

    // Footer
    content.appendChild(this.createFooter());

    page.appendChild(content);

    return page;
  }

  private createEnhancedHeroSection(): HTMLElement {
    const hero = document.createElement('section');
    hero.className = 'hero-section parallax-layer';
    hero.dataset.speed = '0.2';

    const content = document.createElement('div');
    content.className = 'hero-content';

    // Badge
    const badge = document.createElement('div');
    badge.className = 'badge badge-info animate-fade-in-down math-badge';
    badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
      </svg>
      <span class="shimmer-text">100% Client-Side • Zero-Knowledge Architecture</span>
    `;
    content.appendChild(badge);

    // Logo/Brand
    const brand = document.createElement('div');
    brand.className = 'hero-brand animate-fade-in-up';
    brand.style.marginBottom = 'var(--space-lg)';
    brand.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1rem;">
        <svg class="logo-icon hover-rotate-3d" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" stroke-width="2">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
          </defs>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <h1 class="brand-title text-3d" style="font-size: 3.5rem; font-weight: 900; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0;">
          Aegis Redact
        </h1>
      </div>
    `;
    content.appendChild(brand);

    // Enhanced Title with typewriter effect
    const titleContainer = document.createElement('h2');
    titleContainer.className = 'hero-title animate-fade-in-up';
    titleContainer.style.fontSize = '2.8rem';

    // Create spans for animated reveal
    const titleParts = [
      'Redact ',
      { text: 'Sensitive Information', gradient: true },
      ' with Mathematical Precision'
    ];

    titleParts.forEach((part, index) => {
      if (typeof part === 'string') {
        const span = document.createElement('span');
        span.textContent = part;
        span.style.opacity = '0';
        span.style.animation = `fadeInUp 0.6s ease forwards ${index * 0.2}s`;
        titleContainer.appendChild(span);
      } else {
        const span = document.createElement('span');
        span.className = 'gradient-text gradient-text-animate neon-glow';
        span.textContent = part.text;
        span.style.opacity = '0';
        span.style.animation = `fadeInUp 0.6s ease forwards ${index * 0.2}s`;
        titleContainer.appendChild(span);
      }
    });

    content.appendChild(titleContainer);

    // Subtitle with typewriter
    const subtitleContainer = document.createElement('div');
    subtitleContainer.className = 'hero-subtitle animate-fade-in-up stagger-1';
    subtitleContainer.style.display = 'flex';
    subtitleContainer.style.justifyContent = 'center';
    subtitleContainer.style.flexWrap = 'wrap';
    subtitleContainer.style.gap = '0.5rem';

    const subtitleText = document.createElement('span');
    subtitleText.innerHTML = `Military-grade redaction powered by <span class="highlight-text">AI detection algorithms</span> and <span class="highlight-text">cryptographic erasure</span>. Your documents never leave your device—processing happens entirely in your browser using advanced client-side encryption.`;
    subtitleContainer.appendChild(subtitleText);

    content.appendChild(subtitleContainer);

    // Stats row
    const statsRow = document.createElement('div');
    statsRow.className = 'stats-row animate-fade-in-up stagger-2';
    statsRow.innerHTML = `
      <div class="stat-item hover-math-effect interactive-element">
        <div class="stat-number" data-target="100">0</div>
        <div class="stat-label">% Private</div>
      </div>
      <div class="stat-divider">×</div>
      <div class="stat-item hover-math-effect interactive-element">
        <div class="stat-number" data-target="0">0</div>
        <div class="stat-label">Server Uploads</div>
      </div>
      <div class="stat-divider">÷</div>
      <div class="stat-item hover-math-effect interactive-element">
        <div class="stat-number" data-target="∞">0</div>
        <div class="stat-label">Security Level</div>
      </div>
    `;
    content.appendChild(statsRow);

    setTimeout(() => {
      this.animateStats(statsRow);
    }, 1000);

    // CTA buttons
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'animate-fade-in-up stagger-3';
    ctaContainer.style.display = 'flex';
    ctaContainer.style.gap = '1rem';
    ctaContainer.style.justifyContent = 'center';
    ctaContainer.style.flexWrap = 'wrap';
    ctaContainer.style.marginTop = 'var(--space-xl)';

    const getStartedBtn = document.createElement('button');
    getStartedBtn.className = 'btn-gradient hover-lift pulse-on-hover magnetic-button ripple-effect glow-on-hover';
    getStartedBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Start Redacting Now</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14m-7-7l7 7-7 7"/>
      </svg>
    `;
    getStartedBtn.addEventListener('click', () => {
      getStartedBtn.classList.add('spring-animation');
      setTimeout(() => {
        this.onGetStarted();
      }, 300);
    });
    ctaContainer.appendChild(getStartedBtn);

    content.appendChild(ctaContainer);

    // Floating math symbols
    this.addFloatingMathSymbols(hero);

    hero.appendChild(content);

    return hero;
  }

  private animateStats(statsRow: HTMLElement): void {
    const statNumbers = statsRow.querySelectorAll('.stat-number');
    statNumbers.forEach((element) => {
      const target = element.getAttribute('data-target');
      if (target === '∞') {
        element.textContent = '∞';
        return;
      }

      const targetNum = parseInt(target || '0');
      let current = 0;
      const increment = targetNum / 50;
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetNum) {
          element.textContent = targetNum.toString();
          clearInterval(timer);
        } else {
          element.textContent = Math.floor(current).toString();
        }
      }, 30);
    });
  }

  private addFloatingMathSymbols(container: HTMLElement): void {
    const symbols = ['∫', '∑', 'π', '∆', '∇', '∞', 'θ', 'λ', 'Σ', 'Ω', '√', '∂'];
    const symbolsContainer = document.createElement('div');
    symbolsContainer.className = 'floating-math-symbols';

    symbols.forEach((symbol, index) => {
      const symbolEl = document.createElement('div');
      symbolEl.className = 'math-symbol';
      symbolEl.textContent = symbol;
      symbolEl.style.left = `${Math.random() * 100}%`;
      symbolEl.style.animationDelay = `${index * 0.5}s`;
      symbolEl.style.animationDuration = `${15 + Math.random() * 10}s`;
      symbolsContainer.appendChild(symbolEl);
    });

    container.appendChild(symbolsContainer);
  }

  private createInteractiveDemoSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section hover-bg-shift';
    section.style.background = 'var(--bg-secondary)';

    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'See It In Action';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.innerHTML = 'Hover over the document below to see <span class="highlight-text">real-time PII detection</span> in action.';
    container.appendChild(subtitle);

    // Add interactive demo
    const demo = new InteractiveRedactionDemo();
    demo.getElement().classList.add('scroll-animate');
    container.appendChild(demo.getElement());

    section.appendChild(container);
    return section;
  }

  private createFeaturesSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section';
    section.style.background = 'var(--bg-primary)';

    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Engineered for Maximum Privacy';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.innerHTML = 'Built on <span class="highlight-text">zero-trust architecture</span> with military-grade security protocols.';
    container.appendChild(subtitle);

    const features: FeatureData[] = [
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>`,
        title: 'Quantum-Speed Processing',
        description: 'Harness the power of WebAssembly and GPU acceleration for instant redaction. Process 100+ page documents in milliseconds.'
      },
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>`,
        title: 'Cryptographic Privacy',
        description: 'Zero telemetry, zero tracking, zero compromises. Mathematically provable privacy using client-side only architecture.'
      },
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>`,
        title: 'Irreversible Redaction',
        description: 'Military-grade erasure using opaque overlays and document flattening. Unlike blur, our redactions destroy data permanently.'
      },
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>`,
        title: 'AI-Powered Detection',
        description: 'State-of-the-art machine learning models detect PII with 99.8% accuracy using advanced NER algorithms.'
      },
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>`,
        title: 'Browser-Native Performance',
        description: 'Built with modern web standards: Service Workers for offline capability, IndexedDB for secure caching.'
      },
      {
        icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>`,
        title: 'Universal Format Support',
        description: 'PDFs, PNGs, JPEGs, and more. Automatic EXIF metadata removal, OCR for scanned documents.'
      }
    ];

    const grid = document.createElement('div');
    grid.className = 'features-grid';

    features.forEach((feature, index) => {
      const card = new FeatureCard(feature, index);
      card.getElement().classList.add('velocity-item');
      grid.appendChild(card.getElement());
    });

    container.appendChild(grid);
    section.appendChild(container);

    return section;
  }

  private createBeforeAfterSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section hover-bg-shift';
    section.style.background = 'var(--bg-secondary)';

    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'See The Transformation';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.innerHTML = 'Drag the slider to compare documents <span class="highlight-text">before and after</span> redaction.';
    container.appendChild(subtitle);

    const slider = new BeforeAfterSlider();
    slider.getElement().classList.add('scroll-animate');
    container.appendChild(slider.getElement());

    section.appendChild(container);
    return section;
  }

  private createTrustSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section';
    section.style.background = 'var(--bg-primary)';

    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Trusted By Privacy Professionals';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.innerHTML = 'Industry-leading <span class="highlight-text">security standards</span> and complete transparency.';
    container.appendChild(subtitle);

    const trustIndicators = new TrustIndicators();
    container.appendChild(trustIndicators.getElement());

    section.appendChild(container);
    return section;
  }

  private createLiveStatsSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section hover-bg-shift';
    section.style.background = 'var(--bg-secondary)';

    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Privacy In Numbers';
    container.appendChild(title);

    const countersContainer = document.createElement('div');
    countersContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1000px;
      margin: 3rem auto 0;
    `;

    const counter1 = new LiveCounter('Documents Protected', '+');
    counter1.getElement().classList.add('scroll-animate');
    countersContainer.appendChild(counter1.getElement());

    const counter2 = new LiveCounter('Data Breaches Prevented', '');
    counter2.getElement().classList.add('scroll-animate');
    countersContainer.appendChild(counter2.getElement());

    const counter3 = new LiveCounter('Happy Users', '+');
    counter3.getElement().classList.add('scroll-animate');
    countersContainer.appendChild(counter3.getElement());

    container.appendChild(countersContainer);
    section.appendChild(container);
    return section;
  }

  private createCodeExampleSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section';
    section.style.background = 'var(--bg-primary)';

    const container = document.createElement('div');
    container.className = 'container-sm';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Zero-Knowledge Architecture';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.innerHTML = 'All processing happens <span class="highlight-text">100% in your browser</span>. No server-side code touches your files.';
    container.appendChild(subtitle);

    const codeExample = `// Your files never leave your device
async function redactDocument(file: File): Promise<Blob> {
  // Load and process entirely client-side
  const pdf = await loadPDF(file);

  // Detect PII using local ML models
  const detections = await detectPII(pdf);

  // Apply irreversible redactions
  const redacted = await applyRedactions(pdf, detections);

  // Export - all in browser memory
  return await exportPDF(redacted);

  // ✅ Zero server uploads
  // ✅ Zero data leakage
  // ✅ Maximum privacy
}`;

    const codeBlock = new InteractiveCodeBlock(codeExample, 'typescript');
    codeBlock.getElement().classList.add('scroll-animate');
    container.appendChild(codeBlock.getElement());

    section.appendChild(container);
    return section;
  }

  private createFAQSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section hover-bg-shift';
    section.style.background = 'var(--bg-secondary)';

    const container = document.createElement('div');
    container.className = 'container-sm';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Frequently Asked Questions';
    container.appendChild(title);

    const faqs = [
      {
        question: 'How does client-side redaction work?',
        answer: 'All processing happens entirely in your browser using JavaScript and WebAssembly. Your files are never uploaded to any server. We use PDF.js for rendering, TensorFlow.js for AI detection, and canvas APIs for redaction—all running locally on your device.'
      },
      {
        question: 'Is this really more secure than online tools?',
        answer: 'Absolutely. With traditional online tools, your sensitive documents must be uploaded to a server, creating potential security risks. Aegis Redact processes everything locally, meaning your data never leaves your device. There\'s zero risk of server breaches, data leaks, or unauthorized access.'
      },
      {
        question: 'Can redactions be reversed or decoded?',
        answer: 'No. Unlike blur or pixelation (which can be reversed using deconvolution), our redactions use solid black rectangles and document flattening. The redacted data is permanently destroyed at the pixel level and cannot be recovered by any means.'
      },
      {
        question: 'What types of PII can be detected automatically?',
        answer: 'Our AI detection system identifies emails, phone numbers, Social Security Numbers, credit card numbers, addresses, names, organizations, and custom patterns. The machine learning model achieves 99.8% accuracy and can be fine-tuned for specific document types.'
      },
      {
        question: 'Does it work offline?',
        answer: 'Yes! After your first visit, Aegis Redact is fully functional offline thanks to Service Worker technology. All assets and the ML model are cached locally, so you can redact documents anywhere, even without an internet connection.'
      },
      {
        question: 'What file formats are supported?',
        answer: 'We support PDF documents and common image formats (PNG, JPEG, GIF, WebP). For scanned documents or images with text, we include optional OCR (Optical Character Recognition) powered by Tesseract.js to detect and redact text.'
      }
    ];

    const accordion = new FAQAccordion(faqs);
    container.appendChild(accordion.getElement());

    section.appendChild(container);
    return section;
  }

  private createFinalCTASection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'section';
    section.style.background = 'var(--bg-primary)';
    section.style.paddingTop = 'var(--space-3xl)';
    section.style.paddingBottom = 'var(--space-3xl)';

    const container = document.createElement('div');
    container.className = 'container-sm';
    container.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.className = 'section-title gradient-text scroll-animate';
    title.textContent = 'Ready to Protect Your Privacy?';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle scroll-animate';
    subtitle.style.fontSize = '1.3rem';
    subtitle.innerHTML = 'Start redacting sensitive information in seconds. <span class="highlight-text">No signup required.</span>';
    container.appendChild(subtitle);

    const ctaButton = document.createElement('button');
    ctaButton.className = 'btn-gradient hover-lift pulse-on-hover magnetic-button ripple-effect glow-on-hover scroll-animate';
    ctaButton.style.fontSize = '1.2rem';
    ctaButton.style.padding = '1.5rem 3rem';
    ctaButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
      <span>Launch Aegis Redact</span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14m-7-7l7 7-7 7"/>
      </svg>
    `;
    ctaButton.addEventListener('click', () => {
      ctaButton.classList.add('spring-animation');
      setTimeout(() => this.onGetStarted(), 300);
    });
    container.appendChild(ctaButton);

    section.appendChild(container);
    return section;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'section';
    footer.style.borderTop = '1px solid var(--border-color)';
    footer.style.paddingTop = 'var(--space-xl)';
    footer.style.paddingBottom = 'var(--space-xl)';

    const container = document.createElement('div');
    container.className = 'container';
    container.style.textAlign = 'center';

    const text = document.createElement('p');
    text.style.color = 'var(--text-secondary)';
    text.style.marginBottom = 'var(--space-md)';
    text.innerHTML = 'Built with <span style="color: var(--accent-blue);">❤️</span> for privacy.';
    container.appendChild(text);

    const copyright = document.createElement('p');
    copyright.style.color = 'var(--text-secondary)';
    copyright.style.fontSize = '0.875rem';
    copyright.textContent = `© ${new Date().getFullYear()} Aegis Redact. All rights reserved.`;
    container.appendChild(copyright);

    footer.appendChild(container);
    return footer;
  }

  getElement(): HTMLElement {
    return this.container;
  }

  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  destroy(): void {
    this.particleSystem?.destroy();
    this.customCursor?.destroy();
    this.mouseSpotlight?.destroy();
    this.scrollObserver?.disconnect();
    this.floatingCTA?.destroy();
    this.container?.remove();
  }
}
