import type { Box } from '../../lib/pdf/find';
import { AnalyticsAggregator } from '../../lib/analytics/aggregator';

/**
 * Redaction list component showing matches across the whole document
 */

export interface RedactionItem extends Box {
  id: string;
  enabled: boolean;
  page: number;
  type?: string;
  source?: 'regex' | 'ml' | 'manual';
  confidence?: number;
}

export class RedactionList {
  private element: HTMLDivElement;
  private items: RedactionItem[] = [];
  private activePage: number = 0;
  private onChange: (items: RedactionItem[]) => void;
  private onNavigate: (item: RedactionItem) => void;

  constructor(onChange: (items: RedactionItem[]) => void, onNavigate: (item: RedactionItem) => void) {
    this.onChange = onChange;
    this.onNavigate = onNavigate;
    this.element = this.createList();
  }

  private createList(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'redaction-list';
    container.innerHTML = '<h3 class="redaction-list-title">Detections (0)</h3>';
    return container;
  }

  setItems(items: RedactionItem[]) {
    this.items = items;
    this.render();
  }

  setActivePage(page: number) {
    this.activePage = page;
    this.highlightActivePage();
  }

  private highlightActivePage() {
    const rows = this.element.querySelectorAll<HTMLLIElement>('.redaction-list-item');
    rows.forEach((row) => {
      const rowPage = Number(row.dataset.page ?? -1);
      if (rowPage === this.activePage) {
        row.classList.add('redaction-list-item--active');
      } else {
        row.classList.remove('redaction-list-item--active');
      }
    });
  }

  private render() {
    const title = `Detections (${this.items.length})`;
    this.element.querySelector('.redaction-list-title')!.textContent = title;

    // Remove old content (both list and empty message)
    const oldList = this.element.querySelector('.redaction-list-items');
    if (oldList) oldList.remove();

    const oldEmpty = this.element.querySelector('.redaction-list-empty');
    if (oldEmpty) oldEmpty.remove();

    if (this.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'redaction-list-empty';
      empty.textContent = 'No detections found. Draw boxes manually to redact areas.';
      this.element.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'redaction-list-items';

    const sortedItems = [...this.items].sort((a, b) => a.page - b.page);

    sortedItems.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'redaction-list-item';
      li.dataset.page = item.page.toString();
      if (item.page === this.activePage) {
        li.classList.add('redaction-list-item--active');
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.enabled;
      checkbox.id = item.id;
      checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        item.enabled = checkbox.checked;
        this.onChange(this.items);
      });

      const meta = document.createElement('div');
      meta.className = 'redaction-list-item-meta';
      const typeLabel = item.type ? item.type.toUpperCase() : 'MATCH';
      const pageLabel = `Page ${item.page + 1}`;
      meta.textContent = `${pageLabel} · ${typeLabel}`;

      // Add confidence badge if available
      if (item.confidence !== undefined) {
        const badge = document.createElement('span');
        badge.className = 'confidence-badge';
        const confidencePct = Math.round(item.confidence * 100);
        const emoji = AnalyticsAggregator.getConfidenceBadge(item.confidence);
        const color = AnalyticsAggregator.getConfidenceColor(item.confidence);
        badge.textContent = `${emoji} ${confidencePct}%`;
        badge.style.color = color;
        badge.title = `Confidence: ${confidencePct}%`;
        meta.appendChild(document.createTextNode(' · '));
        meta.appendChild(badge);
      }

      const label = document.createElement('p');
      label.className = 'redaction-list-item-text';
      label.textContent = this.truncate(item.text || '', 80);
      label.title = item.text;

      li.appendChild(checkbox);
      li.appendChild(meta);
      li.appendChild(label);

      li.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).tagName === 'INPUT') {
          return;
        }
        this.onNavigate(item);
      });

      li.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.onNavigate(item);
        }
      });

      li.tabIndex = 0;
      list.appendChild(li);
    });

    this.element.appendChild(list);
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.substring(0, max)}…`;
  }

  getItems(): RedactionItem[] {
    return this.items;
  }

  getElement(): HTMLDivElement {
    return this.element;
  }
}
