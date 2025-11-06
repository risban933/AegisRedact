/**
 * Progress Bar Component
 * Animated progress indicator for multi-page operations
 */

export class ProgressBar {
  private container: HTMLElement;
  private progressFill: HTMLElement;
  private label: HTMLElement;

  constructor() {
    this.container = this.createProgressBar();
    this.progressFill = this.container.querySelector('.progress-fill') as HTMLElement;
    this.label = this.container.querySelector('.progress-label') as HTMLElement;
  }

  private createProgressBar(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'progress-bar-container';
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9998;
      width: 90%;
      max-width: 500px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    container.innerHTML = `
      <div class="progress-card glass-card" style="padding: 2rem;">
        <div class="progress-label" style="
          text-align: center;
          margin-bottom: 1rem;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        ">Processing...</div>
        <div class="progress-track" style="
          width: 100%;
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 999px;
          overflow: hidden;
          position: relative;
        ">
          <div class="progress-fill" style="
            height: 100%;
            width: 0%;
            background: var(--gradient-primary);
            border-radius: 999px;
            transition: width 0.3s ease;
            position: relative;
            overflow: hidden;
          ">
            <div style="
              position: absolute;
              inset: 0;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              animation: shimmer 1.5s infinite;
            "></div>
          </div>
        </div>
        <div class="progress-percentage" style="
          text-align: center;
          margin-top: 0.75rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        ">0%</div>
      </div>
    `;

    return container;
  }

  show(label: string = 'Processing...'): void {
    this.label.textContent = label;
    document.body.appendChild(this.container);
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }

  update(progress: number, current?: number, total?: number): void {
    const percentage = Math.min(100, Math.max(0, progress));
    this.progressFill.style.width = `${percentage}%`;

    const percentageEl = this.container.querySelector('.progress-percentage') as HTMLElement;
    if (current !== undefined && total !== undefined) {
      percentageEl.textContent = `${current} / ${total} (${Math.round(percentage)}%)`;
    } else {
      percentageEl.textContent = `${Math.round(percentage)}%`;
    }
  }

  hide(): void {
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.remove();
    }, 300);
  }

  getElement(): HTMLElement {
    return this.container;
  }
}
