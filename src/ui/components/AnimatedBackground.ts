/**
 * Animated Background Component
 * Creates a mesh gradient background with optional floating particles
 */

export class AnimatedBackground {
  private container: HTMLElement;
  private particleCount: number;

  constructor(particleCount: number = 20) {
    this.particleCount = particleCount;
    this.container = this.createBackground();
  }

  private createBackground(): HTMLElement {
    const bg = document.createElement('div');
    bg.className = 'animated-bg';
    bg.setAttribute('aria-hidden', 'true');

    // Create mesh gradient layer
    const mesh = document.createElement('div');
    mesh.className = 'mesh-gradient';
    bg.appendChild(mesh);

    // Create floating particles
    this.createParticles(bg);

    return bg;
  }

  private createParticles(container: HTMLElement): void {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return; // Skip particles for accessibility
    }

    for (let i = 0; i < this.particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      // Random position
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;

      // Random animation delay and duration
      const delay = Math.random() * 6;
      const duration = 4 + Math.random() * 4;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;

      // Random opacity
      particle.style.opacity = `${0.2 + Math.random() * 0.5}`;

      container.appendChild(particle);
    }
  }

  getElement(): HTMLElement {
    return this.container;
  }

  destroy(): void {
    this.container.remove();
  }
}
