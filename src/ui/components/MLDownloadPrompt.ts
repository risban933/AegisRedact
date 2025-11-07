/**
 * MLDownloadPrompt - Modal dialog prompting users to download the ML model
 *
 * Shown when users click "Start Redacting" for the first time.
 * Allows users to download the ML model upfront or skip and proceed.
 */

import type { ProgressCallback } from '../../lib/detect/ml';
import { mlDetector } from '../../lib/detect/ml';

export interface MLDownloadPromptCallbacks {
  onDownloadAndContinue: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export class MLDownloadPrompt {
  private container: HTMLElement;
  private progressContainer: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private downloadBtn: HTMLButtonElement | null = null;
  private skipBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private isDownloading = false;

  constructor(private callbacks: MLDownloadPromptCallbacks) {
    this.container = this.createPrompt();
  }

  private createPrompt(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'ml-download-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.className = 'ml-download-modal';
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid rgba(52, 152, 219, 0.3);
      border-radius: 16px;
      padding: 32px;
      max-width: 520px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.4s ease;
    `;

    // Header with icon
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 24px;';
    header.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">🤖</div>
      <h2 style="margin: 0 0 8px 0; color: #3498db; font-size: 24px; font-weight: 600;">
        AI-Powered Detection Available
      </h2>
      <p style="margin: 0; color: #95a5a6; font-size: 14px;">
        Enhance accuracy with machine learning
      </p>
    `;

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'margin-bottom: 24px;';
    content.innerHTML = `
      <div style="background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; color: #ecf0f1; font-size: 15px; line-height: 1.6;">
          Our AI model can detect <strong>names, organizations, and locations</strong> that regex patterns might miss.
        </p>
        <p style="margin: 0; color: #95a5a6; font-size: 13px; line-height: 1.5;">
          ✓ 100% private (runs in your browser)<br>
          ✓ One-time download (~110MB)<br>
          ✓ Cached for future use
        </p>
      </div>

      <div style="display: flex; gap: 16px; margin-bottom: 16px;">
        <div style="flex: 1; background: rgba(46, 204, 113, 0.1); border: 1px solid rgba(46, 204, 113, 0.3); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; margin-bottom: 4px;">⚡</div>
          <div style="color: #2ecc71; font-weight: 600; font-size: 13px;">Better Accuracy</div>
        </div>
        <div style="flex: 1; background: rgba(155, 89, 182, 0.1); border: 1px solid rgba(155, 89, 182, 0.3); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; margin-bottom: 4px;">🔒</div>
          <div style="color: #9b59b6; font-weight: 600; font-size: 13px;">Still Private</div>
        </div>
        <div style="flex: 1; background: rgba(52, 152, 219, 0.1); border: 1px solid rgba(52, 152, 219, 0.3); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 20px; margin-bottom: 4px;">💾</div>
          <div style="color: #3498db; font-weight: 600; font-size: 13px;">One Download</div>
        </div>
      </div>
    `;

    // Progress container (hidden initially)
    this.progressContainer = document.createElement('div');
    this.progressContainer.style.cssText = 'display: none; margin-bottom: 16px;';
    this.progressContainer.innerHTML = `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #95a5a6; font-size: 13px;">Downloading model...</span>
          <span id="ml-progress-text" style="color: #3498db; font-size: 13px; font-weight: 600;">0%</span>
        </div>
        <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="ml-progress-bar" style="background: linear-gradient(90deg, #3498db, #2ecc71); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
    this.progressBar = this.progressContainer.querySelector('#ml-progress-bar');
    this.progressText = this.progressContainer.querySelector('#ml-progress-text');

    // Buttons
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 12px;';

    this.downloadBtn = document.createElement('button');
    this.downloadBtn.className = 'ml-download-btn';
    this.downloadBtn.textContent = 'Download & Continue';
    this.downloadBtn.style.cssText = `
      flex: 1;
      padding: 14px 24px;
      background: linear-gradient(135deg, #3498db, #2ecc71);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
    `;
    this.downloadBtn.addEventListener('mouseenter', () => {
      if (!this.isDownloading) {
        this.downloadBtn!.style.transform = 'translateY(-2px)';
        this.downloadBtn!.style.boxShadow = '0 6px 20px rgba(52, 152, 219, 0.4)';
      }
    });
    this.downloadBtn.addEventListener('mouseleave', () => {
      this.downloadBtn!.style.transform = 'translateY(0)';
      this.downloadBtn!.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
    });
    this.downloadBtn.addEventListener('click', () => this.handleDownload());

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'ml-skip-btn';
    this.skipBtn.textContent = 'Skip for Now';
    this.skipBtn.style.cssText = `
      flex: 1;
      padding: 14px 24px;
      background: rgba(255, 255, 255, 0.05);
      color: #95a5a6;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    this.skipBtn.addEventListener('mouseenter', () => {
      this.skipBtn!.style.background = 'rgba(255, 255, 255, 0.08)';
      this.skipBtn!.style.color = '#ecf0f1';
    });
    this.skipBtn.addEventListener('mouseleave', () => {
      this.skipBtn!.style.background = 'rgba(255, 255, 255, 0.05)';
      this.skipBtn!.style.color = '#95a5a6';
    });
    this.skipBtn.addEventListener('click', () => this.handleSkip());

    buttons.appendChild(this.downloadBtn);
    buttons.appendChild(this.skipBtn);

    // Cancel link
    const cancelLink = document.createElement('div');
    cancelLink.style.cssText = 'text-align: center; margin-top: 16px;';
    this.cancelBtn = document.createElement('button');
    this.cancelBtn.textContent = '← Back to Homepage';
    this.cancelBtn.style.cssText = `
      background: none;
      border: none;
      color: #7f8c8d;
      font-size: 13px;
      cursor: pointer;
      text-decoration: underline;
      padding: 8px;
      transition: color 0.2s ease;
    `;
    this.cancelBtn.addEventListener('mouseenter', () => {
      this.cancelBtn!.style.color = '#95a5a6';
    });
    this.cancelBtn.addEventListener('mouseleave', () => {
      this.cancelBtn!.style.color = '#7f8c8d';
    });
    this.cancelBtn.addEventListener('click', () => this.handleCancel());
    cancelLink.appendChild(this.cancelBtn);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(this.progressContainer);
    modal.appendChild(buttons);
    modal.appendChild(cancelLink);

    overlay.appendChild(modal);

    // Close on overlay click (only if not downloading)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !this.isDownloading) {
        this.handleCancel();
      }
    });

    return overlay;
  }

  private async handleDownload(): Promise<void> {
    if (this.isDownloading) return;

    this.isDownloading = true;
    this.downloadBtn!.disabled = true;
    this.downloadBtn!.style.opacity = '0.6';
    this.downloadBtn!.style.cursor = 'not-allowed';
    this.skipBtn!.disabled = true;
    this.skipBtn!.style.opacity = '0.6';
    this.skipBtn!.style.cursor = 'not-allowed';
    this.cancelBtn!.disabled = true;
    this.cancelBtn!.style.opacity = '0.3';

    // Show progress
    this.progressContainer!.style.display = 'block';

    const progressCallback: ProgressCallback = (progress) => {
      if (this.progressBar && this.progressText) {
        this.progressBar.style.width = `${progress.percent}%`;
        this.progressText.textContent = `${progress.percent}%`;
      }
    };

    try {
      // Load the model
      await mlDetector.loadModel(progressCallback);

      // Enable ML detection in settings
      localStorage.setItem('ml-detection-enabled', 'true');

      // Mark that user has been prompted
      localStorage.setItem('ml-download-prompted', 'true');

      // Success animation
      this.progressText!.textContent = '✓ Ready!';
      this.progressBar!.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';

      // Wait a moment to show success, then continue
      setTimeout(() => {
        this.callbacks.onDownloadAndContinue();
        this.hide();
      }, 800);
    } catch (error) {
      console.error('Failed to load ML model:', error);

      // Show error state
      this.progressText!.textContent = '✗ Download failed';
      this.progressBar!.style.background = '#e74c3c';

      // Re-enable buttons
      this.isDownloading = false;
      this.downloadBtn!.disabled = false;
      this.downloadBtn!.style.opacity = '1';
      this.downloadBtn!.style.cursor = 'pointer';
      this.skipBtn!.disabled = false;
      this.skipBtn!.style.opacity = '1';
      this.skipBtn!.style.cursor = 'pointer';
      this.cancelBtn!.disabled = false;
      this.cancelBtn!.style.opacity = '1';

      // Hide progress after 2 seconds
      setTimeout(() => {
        this.progressContainer!.style.display = 'none';
        this.progressBar!.style.width = '0%';
        this.progressBar!.style.background = 'linear-gradient(90deg, #3498db, #2ecc71)';
      }, 2000);
    }
  }

  private handleSkip(): void {
    // Mark that user has been prompted (so we don't ask again immediately)
    localStorage.setItem('ml-download-prompted', 'true');
    // Don't enable ML detection
    localStorage.setItem('ml-detection-enabled', 'false');

    this.callbacks.onSkip();
    this.hide();
  }

  private handleCancel(): void {
    this.callbacks.onCancel();
    this.hide();
  }

  public show(): void {
    document.body.appendChild(this.container);
  }

  public hide(): void {
    this.container.style.opacity = '0';
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 300);
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
