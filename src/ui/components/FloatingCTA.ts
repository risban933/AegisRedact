/**
 * Floating CTA Button
 * Sticky call-to-action button that appears after scrolling
 */

export class FloatingCTA {
  private button: HTMLElement;
  private isVisible: boolean = false;
  private scrollThreshold: number = 600;
  private scrollContainer: HTMLElement | Window = window;

  constructor(private text: string, private onClick: () => void, scrollContainer?: HTMLElement) {
    if (scrollContainer) {
      this.scrollContainer = scrollContainer;
    }
    this.button = this.createButton();
    this.init();
  }

  private createButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'floating-cta';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>${this.text}</span>
    `;
    button.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5);
      z-index: 10001;
      transform: translateY(150%);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      pointer-events: auto;
    `;

    button.addEventListener('click', () => this.onClick());
    document.body.appendChild(button);
    return button;
  }

  private init(): void {
    this.scrollContainer.addEventListener('scroll', () => this.handleScroll());
    this.handleScroll(); // Check initial position
  }

  private handleScroll(): void {
    let scrolled: number;

    if (this.scrollContainer instanceof Window) {
      scrolled = window.scrollY || document.documentElement.scrollTop;
    } else {
      scrolled = this.scrollContainer.scrollTop;
    }

    if (scrolled > this.scrollThreshold && !this.isVisible) {
      this.show();
    } else if (scrolled <= this.scrollThreshold && this.isVisible) {
      this.hide();
    }
  }

  private show(): void {
    this.isVisible = true;
    this.button.style.transform = 'translateY(0)';
    this.button.style.opacity = '1';
  }

  private hide(): void {
    this.isVisible = false;
    this.button.style.transform = 'translateY(150%)';
    this.button.style.opacity = '0';
  }

  destroy(): void {
    this.button.remove();
  }
}
