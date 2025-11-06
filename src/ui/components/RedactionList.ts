import type { Box } from '../../lib/pdf/find';

/**
 * Redaction list component showing found matches
 */

export interface RedactionItem extends Box {
  id: string;
  enabled: boolean;
}

export class RedactionList {
  private element: HTMLDivElement;
  private items: RedactionItem[] = [];
  private onChange: (items: RedactionItem[]) => void;

  constructor(onChange: (items: RedactionItem[]) => void) {
    this.onChange = onChange;
    this.element = this.createList();
  }

  private createList(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'redaction-list';
    container.innerHTML = '<h3 class="redaction-list-title">Detections (0)</h3>';
    return container;
  }

  setItems(boxes: Box[]) {
    this.items = boxes.map((box, index) => ({
      ...box,
      id: `detection-${index}`,
      enabled: true
    }));
    this.render();
  }

  private render() {
    const title = `Detections (${this.items.length})`;
    this.element.querySelector('.redaction-list-title')!.textContent = title;

    // Remove old list
    const oldList = this.element.querySelector('.redaction-list-items');
    if (oldList) oldList.remove();

    if (this.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'redaction-list-empty';
      empty.textContent = 'No detections found. Adjust settings or draw boxes manually.';
      this.element.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'redaction-list-items';

    this.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'redaction-list-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.enabled;
      checkbox.id = item.id;
      checkbox.addEventListener('change', () => {
        item.enabled = checkbox.checked;
        this.onChange(this.items);
      });

      const label = document.createElement('label');
      label.htmlFor = item.id;
      label.textContent = item.text.substring(0, 30);
      if (item.text.length > 30) {
        label.textContent += '...';
      }

      li.appendChild(checkbox);
      li.appendChild(label);
      list.appendChild(li);
    });

    this.element.appendChild(list);
  }

  getEnabledBoxes(): Box[] {
    return this.items.filter((item) => item.enabled);
  }

  getElement(): HTMLDivElement {
    return this.element;
  }
}
