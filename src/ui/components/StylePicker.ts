/**
 * Style Picker - UI for selecting redaction styles
 */

import { StyleRegistry } from '../../lib/redact/styles';
import type { RedactionStyle, StyleOptions } from '../../lib/redact/styles';
import { TEXT_TEMPLATES } from '../../lib/redact/renderers/text';

export class StylePicker {
  private element: HTMLDivElement;
  private currentStyleId: string = 'solid';
  private currentOptions: StyleOptions = {};
  private onChange: (styleId: string, options: StyleOptions) => void;
  private isOpen: boolean = false;

  constructor(onChange: (styleId: string, options: StyleOptions) => void) {
    this.onChange = onChange;
    this.element = this.createPicker();
  }

  private createPicker(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'style-picker';

    container.innerHTML = `
      <button class="style-picker-toggle" aria-label="Select redaction style">
        <span class="style-picker-icon">▨</span>
        <span class="style-picker-label">Solid Black</span>
        <span class="style-picker-arrow">▼</span>
      </button>
      <div class="style-picker-dropdown" style="display: none;">
        <div class="style-picker-options"></div>
      </div>
    `;

    // Toggle dropdown
    const toggle = container.querySelector('.style-picker-toggle');
    toggle?.addEventListener('click', () => this.toggleDropdown());

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    this.renderOptions();
    return container;
  }

  /**
   * Render style options
   */
  private renderOptions(): void {
    const optionsContainer = this.element.querySelector('.style-picker-options');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    const styles = StyleRegistry.getAll();

    styles.forEach((style) => {
      const option = this.createStyleOption(style);
      optionsContainer.appendChild(option);
    });
  }

  /**
   * Create a single style option
   */
  private createStyleOption(style: RedactionStyle): HTMLDivElement {
    const option = document.createElement('div');
    option.className = 'style-picker-option';
    if (style.id === this.currentStyleId) {
      option.classList.add('style-picker-option--active');
    }

    // Create preview
    const preview = document.createElement('div');
    preview.className = 'style-picker-preview';
    const previewImg = document.createElement('img');
    previewImg.src = style.getPreview();
    previewImg.alt = `${style.name} preview`;
    preview.appendChild(previewImg);

    // Create info
    const info = document.createElement('div');
    info.className = 'style-picker-info';
    info.innerHTML = `
      <div class="style-picker-name">${style.name}</div>
      <div class="style-picker-description">${style.description}</div>
    `;

    option.appendChild(preview);
    option.appendChild(info);

    // Click handler
    option.addEventListener('click', () => {
      this.selectStyle(style.id);
    });

    return option;
  }

  /**
   * Select a style
   */
  private selectStyle(styleId: string): void {
    this.currentStyleId = styleId;

    // Update UI
    const label = this.element.querySelector('.style-picker-label');
    const style = StyleRegistry.get(styleId);
    if (label && style) {
      label.textContent = style.name;
    }

    // Update active option
    this.element.querySelectorAll('.style-picker-option').forEach((option, index) => {
      const styles = StyleRegistry.getAll();
      if (styles[index].id === styleId) {
        option.classList.add('style-picker-option--active');
      } else {
        option.classList.remove('style-picker-option--active');
      }
    });

    // Show custom text modal if text style selected
    if (styleId === 'text') {
      this.showTextModal();
    } else {
      this.onChange(styleId, this.currentOptions);
      this.closeDropdown();
    }
  }

  /**
   * Show custom text modal
   */
  private showTextModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Custom Redaction Text</h3>
          <button class="modal-close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="text-input">Text:</label>
            <input type="text" id="text-input" value="${this.currentOptions.text || 'REDACTED'}" placeholder="Enter custom text" />
          </div>
          <div class="form-group">
            <label>Templates:</label>
            <div class="text-templates">
              ${TEXT_TEMPLATES.map((template) => `
                <button class="template-button" data-template="${template}">${template}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label for="font-size-input">Font Size:</label>
            <select id="font-size-input">
              <option value="auto">Auto</option>
              <option value="8">8px</option>
              <option value="10">10px</option>
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </div>
          <div class="form-group">
            <label>Preview:</label>
            <div class="text-preview">REDACTED</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="text-cancel">Cancel</button>
          <button class="btn-primary" id="text-apply">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const textInput = modal.querySelector('#text-input') as HTMLInputElement;
    const fontSizeInput = modal.querySelector('#font-size-input') as HTMLSelectElement;
    const preview = modal.querySelector('.text-preview') as HTMLDivElement;

    // Update preview
    const updatePreview = () => {
      preview.textContent = textInput.value || 'REDACTED';
      const fontSize = fontSizeInput.value === 'auto' ? 16 : parseInt(fontSizeInput.value);
      preview.style.fontSize = `${fontSize}px`;
    };

    textInput.addEventListener('input', updatePreview);
    fontSizeInput.addEventListener('change', updatePreview);

    // Template buttons
    modal.querySelectorAll('.template-button').forEach((button) => {
      button.addEventListener('click', () => {
        textInput.value = (button as HTMLElement).dataset.template!;
        updatePreview();
      });
    });

    // Close handler
    const closeModal = () => modal.remove();

    modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('#text-cancel')?.addEventListener('click', closeModal);

    // Apply handler
    modal.querySelector('#text-apply')?.addEventListener('click', () => {
      const options: StyleOptions = {
        text: textInput.value || 'REDACTED',
        fontSize: fontSizeInput.value === 'auto' ? undefined : parseInt(fontSizeInput.value),
      };

      this.currentOptions = options;
      this.onChange(this.currentStyleId, options);
      closeModal();
      this.closeDropdown();
    });

    // Initial preview
    updatePreview();
  }

  /**
   * Toggle dropdown
   */
  private toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  private openDropdown(): void {
    const dropdown = this.element.querySelector('.style-picker-dropdown') as HTMLElement;
    dropdown.style.display = 'block';
    this.isOpen = true;
  }

  /**
   * Close dropdown
   */
  private closeDropdown(): void {
    const dropdown = this.element.querySelector('.style-picker-dropdown') as HTMLElement;
    dropdown.style.display = 'none';
    this.isOpen = false;
  }

  /**
   * Get current style ID
   */
  getCurrentStyleId(): string {
    return this.currentStyleId;
  }

  /**
   * Get current style options
   */
  getCurrentOptions(): StyleOptions {
    return this.currentOptions;
  }

  /**
   * Get the picker element
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
