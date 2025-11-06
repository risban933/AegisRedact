/**
 * Success Animation Component
 * Shows a celebration animation when export completes
 */

export class SuccessAnimation {
  private container: HTMLElement;

  constructor() {
    this.container = this.createAnimation();
  }

  private createAnimation(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'success-animation';
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create checkmark circle
    const circle = document.createElement('div');
    circle.style.cssText = `
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 60px rgba(102, 126, 234, 0.6);
      animation: successPulse 0.6s ease-out;
    `;

    // Create checkmark SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '60');
    svg.setAttribute('height', '60');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'fill: none; stroke: white; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M20 6L9 17l-5-5');
    path.style.cssText = `
      stroke-dasharray: 30;
      stroke-dashoffset: 30;
      animation: checkmarkDraw 0.5s ease-out 0.2s forwards;
    `;

    svg.appendChild(path);
    circle.appendChild(svg);
    container.appendChild(circle);

    // Add confetti
    this.createConfetti(container);

    return container;
  }

  private createConfetti(container: HTMLElement): void {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#2ecc71'];

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 8 + 4;
      const startX = Math.random() * 40 - 20; // -20 to 20
      const endX = (Math.random() - 0.5) * 400; // -200 to 200
      const endY = Math.random() * 400 + 200; // 200 to 600
      const rotation = Math.random() * 720;
      const delay = Math.random() * 0.2;

      confetti.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        left: calc(50% + ${startX}px);
        top: 50%;
        opacity: 1;
        animation: confettiFall 1.5s ease-out ${delay}s forwards;
        transform-origin: center;
      `;

      confetti.style.setProperty('--end-x', `${endX}px`);
      confetti.style.setProperty('--end-y', `${endY}px`);
      confetti.style.setProperty('--rotation', `${rotation}deg`);

      container.appendChild(confetti);
    }
  }

  show(): void {
    document.body.appendChild(this.container);

    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });

    // Auto-hide after animation completes
    setTimeout(() => {
      this.hide();
    }, 2000);
  }

  hide(): void {
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.remove();
    }, 300);
  }
}
