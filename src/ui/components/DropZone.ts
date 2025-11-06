/**
 * File drop zone component
 */

export class DropZone {
  private element: HTMLDivElement;
  private onFiles: (files: File[]) => void;

  constructor(onFiles: (files: File[]) => void) {
    this.onFiles = onFiles;
    this.element = this.createDropZone();
  }

  private createDropZone(): HTMLDivElement {
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute('aria-label', 'Drop files here or click to select');

    dropZone.innerHTML = `
      <div class="drop-zone-content">
        <svg class="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="drop-zone-text">Drop files here or click to select</p>
        <p class="drop-zone-hint">Supports: PDF, JPEG, PNG, WebP</p>
      </div>
    `;

    // Click to open file picker
    dropZone.addEventListener('click', () => this.openFilePicker());

    // Keyboard support
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openFilePicker();
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone-active');

      const files = Array.from(e.dataTransfer?.files || []);
      this.handleFiles(files);
    });

    return dropZone;
  }

  private async openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.webp';

    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      this.handleFiles(files);
    });

    input.click();
  }

  private handleFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      ];
      return validTypes.includes(file.type);
    });

    if (validFiles.length > 0) {
      this.onFiles(validFiles);
    }
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  hide() {
    this.element.style.display = 'none';
  }

  show() {
    this.element.style.display = 'flex';
  }
}
