/**
 * Statistics Dashboard - Displays document analytics and charts
 */

import type { RedactionItem } from './RedactionList';
import { AnalyticsAggregator } from '../../lib/analytics/aggregator';
import type { DocumentStatistics, PageHotspot } from '../../lib/analytics/types';

export class StatsDashboard {
  private element: HTMLDivElement;
  private isVisible: boolean = false;
  private items: RedactionItem[] = [];
  private totalPages: number = 0;
  private onPageNavigate?: (page: number) => void;

  constructor(onPageNavigate?: (page: number) => void) {
    this.onPageNavigate = onPageNavigate;
    this.element = this.createDashboard();
  }

  private createDashboard(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'stats-dashboard';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="stats-dashboard-header">
        <h3>Document Statistics</h3>
        <div class="stats-dashboard-controls">
          <button id="stats-export-csv" class="btn-icon" aria-label="Export CSV" title="Export to CSV">
            💾
          </button>
          <button id="stats-close" class="btn-icon" aria-label="Close dashboard">
            ✕
          </button>
        </div>
      </div>
      <div class="stats-dashboard-content"></div>
    `;

    // Event listeners
    container.querySelector('#stats-export-csv')?.addEventListener('click', () => {
      this.exportToCSV();
    });

    container.querySelector('#stats-close')?.addEventListener('click', () => {
      this.hide();
    });

    return container;
  }

  /**
   * Update statistics with new data
   */
  update(items: RedactionItem[], totalPages: number): void {
    this.items = items;
    this.totalPages = totalPages;
    this.render();
  }

  /**
   * Render dashboard content
   */
  private render(): void {
    const content = this.element.querySelector('.stats-dashboard-content');
    if (!content) return;

    if (this.items.length === 0) {
      content.innerHTML = '<p class="stats-empty">No detections to analyze</p>';
      return;
    }

    const stats = AnalyticsAggregator.computeStatistics(this.items, this.totalPages);
    const typeStats = AnalyticsAggregator.getTypeStatistics(this.items);
    const hotspots = AnalyticsAggregator.getHotspots(this.items, 5);

    content.innerHTML = `
      <div class="stats-section">
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-value">${stats.totalDetections}</div>
            <div class="stat-label">Total Detections</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.pagesWithDetections} / ${stats.totalPages}</div>
            <div class="stat-label">Pages Analyzed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${AnalyticsAggregator.getConfidenceBadge(stats.averageConfidence)} ${Math.round(stats.averageConfidence * 100)}%</div>
            <div class="stat-label">Avg. Confidence</div>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h4>By Type</h4>
        <div class="stats-chart">
          ${this.renderTypeChart(typeStats)}
        </div>
      </div>

      <div class="stats-section">
        <h4>By Source</h4>
        <div class="stats-breakdown">
          <div class="stat-row">
            <span class="stat-icon">🤖</span>
            <span class="stat-text">ML Detection</span>
            <span class="stat-number">${stats.bySource.ml}</span>
            <span class="stat-percent">(${Math.round((stats.bySource.ml / stats.totalDetections) * 100)}%)</span>
          </div>
          <div class="stat-row">
            <span class="stat-icon">🔍</span>
            <span class="stat-text">Regex</span>
            <span class="stat-number">${stats.bySource.regex}</span>
            <span class="stat-percent">(${Math.round((stats.bySource.regex / stats.totalDetections) * 100)}%)</span>
          </div>
          <div class="stat-row">
            <span class="stat-icon">✏️</span>
            <span class="stat-text">Manual</span>
            <span class="stat-number">${stats.bySource.manual}</span>
            <span class="stat-percent">(${Math.round((stats.bySource.manual / stats.totalDetections) * 100)}%)</span>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h4>Confidence Distribution</h4>
        <div class="stats-breakdown">
          <div class="stat-row">
            <span class="stat-icon">🟢</span>
            <span class="stat-text">High (≥90%)</span>
            <span class="stat-number">${stats.byConfidence.high}</span>
            <span class="stat-percent">(${Math.round((stats.byConfidence.high / stats.totalDetections) * 100)}%)</span>
          </div>
          <div class="stat-row">
            <span class="stat-icon">🟡</span>
            <span class="stat-text">Medium (70-89%)</span>
            <span class="stat-number">${stats.byConfidence.medium}</span>
            <span class="stat-percent">(${Math.round((stats.byConfidence.medium / stats.totalDetections) * 100)}%)</span>
          </div>
          <div class="stat-row">
            <span class="stat-icon">🟠</span>
            <span class="stat-text">Low (<70%)</span>
            <span class="stat-number">${stats.byConfidence.low}</span>
            <span class="stat-percent">(${Math.round((stats.byConfidence.low / stats.totalDetections) * 100)}%)</span>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h4>Hotspots</h4>
        <div class="stats-hotspots">
          ${this.renderHotspots(hotspots)}
        </div>
      </div>
    `;

    // Add click handlers for hotspots
    content.querySelectorAll('[data-page]').forEach((el) => {
      el.addEventListener('click', () => {
        const page = parseInt((el as HTMLElement).dataset.page!, 10);
        this.onPageNavigate?.(page);
      });
    });
  }

  /**
   * Render type chart (horizontal bar chart)
   */
  private renderTypeChart(typeStats: any[]): string {
    if (typeStats.length === 0) return '<p class="stats-empty">No data</p>';

    const maxCount = Math.max(...typeStats.map((t) => t.count));

    return typeStats
      .map((stat) => {
        const widthPercent = (stat.count / maxCount) * 100;
        const icon = this.getTypeIcon(stat.type);

        return `
        <div class="chart-bar">
          <div class="chart-label">
            <span class="chart-icon">${icon}</span>
            <span class="chart-text">${this.formatTypeName(stat.type)}</span>
          </div>
          <div class="chart-track">
            <div class="chart-fill" style="width: ${widthPercent}%"></div>
          </div>
          <div class="chart-value">${stat.count}</div>
          <div class="chart-percent">(${Math.round(stat.percentage)}%)</div>
        </div>
      `;
      })
      .join('');
  }

  /**
   * Render hotspots list
   */
  private renderHotspots(hotspots: PageHotspot[]): string {
    if (hotspots.length === 0) return '<p class="stats-empty">No hotspots</p>';

    return hotspots
      .map((hotspot) => {
        const densityPercent = Math.round(hotspot.density * 100);
        const densityColor = AnalyticsAggregator.getHeatmapColor(hotspot.density, 1.0);

        return `
        <div class="hotspot-item" data-page="${hotspot.page}">
          <div class="hotspot-indicator" style="background-color: ${densityColor}"></div>
          <div class="hotspot-info">
            <div class="hotspot-page">Page ${hotspot.page + 1}</div>
            <div class="hotspot-count">${hotspot.count} detections</div>
          </div>
          <div class="hotspot-density">${densityPercent}%</div>
        </div>
      `;
      })
      .join('');
  }

  /**
   * Get icon for detection type
   */
  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      email: '📧',
      phone: '📱',
      ssn: '🆔',
      card: '💳',
    };
    return icons[type] || '📄';
  }

  /**
   * Format type name
   */
  private formatTypeName(type: string): string {
    const names: Record<string, string> = {
      email: 'Emails',
      phone: 'Phone Numbers',
      ssn: 'SSNs',
      card: 'Credit Cards',
    };
    return names[type] || type;
  }

  /**
   * Export to CSV
   */
  private exportToCSV(): void {
    const csv = AnalyticsAggregator.exportToCSV(this.items);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `redactions-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Show dashboard
   */
  show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
    this.render();
  }

  /**
   * Hide dashboard
   */
  hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  /**
   * Toggle dashboard visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get dashboard element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.element.remove();
  }
}
