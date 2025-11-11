/**
 * Privacy Panel Component
 *
 * Displays privacy score, risks, and recommendations with
 * one-click maximum privacy export.
 */

import { PrivacyAnalyzer } from '../../lib/privacy';
import type { PrivacyAnalysis, PrivacyRisk, RiskSeverity } from '../../lib/privacy';

export class PrivacyPanel {
  private element: HTMLElement;
  private analysis: PrivacyAnalysis | null = null;
  private onMaxPrivacyExport?: () => void;

  constructor(onMaxPrivacyExport?: () => void) {
    this.onMaxPrivacyExport = onMaxPrivacyExport;
    this.element = this.createPanel();
    this.attachEventListeners();
  }

  /**
   * Create panel HTML
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'privacy-panel';
    panel.style.display = 'none'; // Hidden by default

    panel.innerHTML = `
      <div class="privacy-panel-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Privacy Analysis
        </h3>
        <button class="privacy-panel-close" aria-label="Close privacy panel">×</button>
      </div>

      <div class="privacy-panel-content" id="privacy-content">
        <p class="privacy-empty">No analysis yet. Load a document to see privacy score.</p>
      </div>
    `;

    return panel;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const closeBtn = this.element.querySelector('.privacy-panel-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Max privacy export button (attached dynamically when rendering)
    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('#max-privacy-export-btn');
      if (btn && this.onMaxPrivacyExport) {
        this.onMaxPrivacyExport();
      }
    });
  }

  /**
   * Update panel with new analysis
   */
  updateAnalysis(analysis: PrivacyAnalysis): void {
    this.analysis = analysis;
    this.render();
    this.show();
  }

  /**
   * Render analysis content
   */
  private render(): void {
    if (!this.analysis) {
      return;
    }

    const content = this.element.querySelector('#privacy-content');
    if (!content) return;

    const { score, risks, recommendations } = this.analysis;

    content.innerHTML = `
      <!-- Privacy Score -->
      <div class="privacy-score-section">
        <div class="privacy-score-circle" style="--score-color: ${PrivacyAnalyzer.getScoreColor(score.overall)}">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--bg-tertiary)"
              stroke-width="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--score-color)"
              stroke-width="8"
              stroke-dasharray="${score.overall * 3.39} 339.29"
              stroke-dashoffset="84.82"
              stroke-linecap="round"
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="60" text-anchor="middle" dy="8" class="score-value">${score.overall}</text>
            <text x="60" y="78" text-anchor="middle" class="score-grade">${score.grade}</text>
          </svg>
        </div>
        <div class="privacy-score-breakdown">
          <h4>Score Breakdown</h4>
          <div class="score-item">
            <span class="score-label">Metadata</span>
            <div class="score-bar-container">
              <div class="score-bar" style="width: ${score.metadata}%; background: ${PrivacyAnalyzer.getScoreColor(score.metadata)}"></div>
            </div>
            <span class="score-number">${score.metadata}</span>
          </div>
          <div class="score-item">
            <span class="score-label">EXIF Data</span>
            <div class="score-bar-container">
              <div class="score-bar" style="width: ${score.exifData}%; background: ${PrivacyAnalyzer.getScoreColor(score.exifData)}"></div>
            </div>
            <span class="score-number">${score.exifData}</span>
          </div>
          <div class="score-item">
            <span class="score-label">PII Redaction</span>
            <div class="score-bar-container">
              <div class="score-bar" style="width: ${score.piiDetection}%; background: ${PrivacyAnalyzer.getScoreColor(score.piiDetection)}"></div>
            </div>
            <span class="score-number">${score.piiDetection}</span>
          </div>
          <div class="score-item">
            <span class="score-label">Text Layer</span>
            <div class="score-bar-container">
              <div class="score-bar" style="width: ${score.textLayer}%; background: ${PrivacyAnalyzer.getScoreColor(score.textLayer)}"></div>
            </div>
            <span class="score-number">${score.textLayer}</span>
          </div>
        </div>
      </div>

      ${risks.length > 0 ? `
        <!-- Privacy Risks -->
        <div class="privacy-risks-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Privacy Risks Found
          </h4>
          <div class="risk-list">
            ${risks.map(risk => this.renderRisk(risk)).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Recommendations -->
      <div class="privacy-recommendations-section">
        <h4>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Recommendations
        </h4>
        <ul class="recommendation-list">
          ${recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>

      <!-- Maximum Privacy Export Button -->
      ${risks.length > 0 ? `
        <div class="privacy-actions">
          <button class="btn-primary btn-large" id="max-privacy-export-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 12 15 16 10"/>
            </svg>
            <span>Maximum Privacy Export</span>
          </button>
          <p class="privacy-action-hint">Applies all privacy protections automatically</p>
        </div>
      ` : ''}
    `;
  }

  /**
   * Render individual risk item
   */
  private renderRisk(risk: PrivacyRisk): string {
    const severityColor = PrivacyAnalyzer.getSeverityColor(risk.severity);
    const severityIcon = this.getSeverityIcon(risk.severity);

    return `
      <div class="risk-item risk-${risk.severity}">
        <div class="risk-header">
          <div class="risk-severity-badge" style="background: ${severityColor}20; color: ${severityColor}">
            ${severityIcon}
            <span>${risk.severity.toUpperCase()}</span>
          </div>
          <span class="risk-category">${this.escapeHtml(risk.category)}</span>
        </div>
        <h5 class="risk-title">${this.escapeHtml(risk.title)}</h5>
        <p class="risk-description">${this.escapeHtml(risk.description)}</p>
        ${risk.details ? `<p class="risk-details"><code>${this.escapeHtml(risk.details)}</code></p>` : ''}
      </div>
    `;
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: RiskSeverity): string {
    switch (severity) {
      case 'critical':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
      case 'high':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
      case 'medium':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      case 'low':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
      default:
        return '';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show panel
   */
  show(): void {
    this.element.style.display = 'block';
  }

  /**
   * Hide panel
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.element.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Get panel element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Clear analysis
   */
  clear(): void {
    this.analysis = null;
    const content = this.element.querySelector('#privacy-content');
    if (content) {
      content.innerHTML = '<p class="privacy-empty">No analysis yet. Load a document to see privacy score.</p>';
    }
    this.hide();
  }
}
