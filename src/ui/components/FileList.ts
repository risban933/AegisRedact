/**
 * File list component to show loaded files
 */

export interface FileItem {
  file: File;
  pages?: number;
}

export class FileList {
  private element: HTMLDivElement;
  private files: FileItem[] = [];
  private onSelect: (index: number) => void;
  private selectedIndex: number = -1;

  constructor(onSelect: (index: number) => void) {
    this.onSelect = onSelect;
    this.element = this.createFileList();
  }

  private createFileList(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'file-list';
    container.innerHTML = '<h3 class="file-list-title">Files</h3>';
    return container;
  }

  setFiles(files: FileItem[]) {
    this.files = files;
    this.selectedIndex = files.length > 0 ? 0 : -1;
    this.render();
  }

  private render() {
    // Keep the title, replace the list
    const title = this.element.querySelector('.file-list-title');
    this.element.innerHTML = '';
    if (title) {
      this.element.appendChild(title);
    }

    const list = document.createElement('ul');
    list.className = 'file-list-items';

    this.files.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'file-list-item';
      if (index === this.selectedIndex) {
        li.classList.add('file-list-item-selected');
      }

      const icon = item.file.type.startsWith('image/') ? '🖼️' : '📄';
      const pageInfo = item.pages ? ` (${item.pages} pages)` : '';

      li.innerHTML = `
        <span class="file-list-icon">${icon}</span>
        <span class="file-list-name">${item.file.name}${pageInfo}</span>
      `;

      li.addEventListener('click', () => {
        this.selectedIndex = index;
        this.render();
        this.onSelect(index);
      });

      list.appendChild(li);
    });

    this.element.appendChild(list);
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }
}
