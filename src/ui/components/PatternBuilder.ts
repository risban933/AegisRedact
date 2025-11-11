/**
 * Pattern Builder Modal
 *
 * UI for creating and editing custom detection patterns with
 * live testing and validation.
 */

import { customPatternRegistry, PatternValidator } from '../../lib/detect/custom';
import type { CustomPattern } from '../../lib/detect/custom';

export class PatternBuilder {
  private element: HTMLElement;
  private editingPattern: CustomPattern | null = null;
  private onSave?: (pattern: CustomPattern) => void;
  private onCancel?: () => void;

  constructor(pattern?: CustomPattern) {
    this.editingPattern = pattern || null;
    this.element = this.createModal();
    this.attachEventListeners();

    // Pre-fill form if editing
    if (pattern) {
      this.fillForm(pattern);
    }
  }

  /**
   * Create modal HTML
   */
  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'pattern-builder-modal modal-overlay';

    const title = this.editingPattern ? 'Edit Pattern' : 'Create Custom Pattern';

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" aria-label="Close">×</button>
        </div>

        <div class="modal-body">
          <form id="pattern-form">
            <div class="form-group">
              <label for="pattern-name">
                Pattern Name *
                <span class="help-text">A descriptive name for this pattern</span>
              </label>
              <input
                type="text"
                id="pattern-name"
                placeholder="e.g., Employee ID Format"
                required
                maxlength="50"
              />
            </div>

            <div class="form-group">
              <label for="pattern-regex">
                Regular Expression *
                <span class="help-text">
                  JavaScript regex pattern.
                  <a href="https://regex101.com" target="_blank" rel="noopener">Test on regex101.com</a>
                </span>
              </label>
              <textarea
                id="pattern-regex"
                placeholder="e.g., EMP-\\d{6}"
                rows="3"
                required
              ></textarea>
              <div id="regex-validation" class="validation-message"></div>
            </div>

            <div class="form-group">
              <label for="pattern-type">
                Category
              </label>
              <select id="pattern-type">
                <option value="custom">Custom</option>
                <option value="id">ID Number</option>
                <option value="financial">Financial</option>
                <option value="medical">Medical</option>
                <option value="personal">Personal Info</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>

            <div class="form-group">
              <label for="pattern-description">
                Description (optional)
              </label>
              <textarea
                id="pattern-description"
                placeholder="e.g., Matches company employee ID numbers"
                rows="2"
                maxlength="200"
              ></textarea>
            </div>

            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" id="pattern-case-sensitive" />
                <span>Case Sensitive</span>
              </label>
              <label>
                <input type="checkbox" id="pattern-enabled" checked />
                <span>Enabled</span>
              </label>
            </div>

            <hr />

            <div class="test-section">
              <h3>Test Pattern</h3>
              <div class="form-group">
                <label for="test-text">
                  Sample Text
                </label>
                <textarea
                  id="test-text"
                  placeholder="Paste sample text here to test your pattern..."
                  rows="5"
                ></textarea>
              </div>

              <button type="button" id="test-btn" class="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Test Pattern
              </button>

              <div id="test-results" class="test-results"></div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button type="submit" form="pattern-form" class="btn btn-primary" id="save-btn">
            ${this.editingPattern ? 'Update Pattern' : 'Save Pattern'}
          </button>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Close button
    this.element.querySelector('.modal-close')?.addEventListener('click', () => {
      this.close();
    });

    // Close on overlay click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    // Cancel button
    this.element.querySelector('#cancel-btn')?.addEventListener('click', () => {
      this.close();
    });

    // Form submission
    const form = this.element.querySelector('#pattern-form') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });

    // Live regex validation
    const regexInput = this.element.querySelector('#pattern-regex') as HTMLTextAreaElement;
    regexInput.addEventListener('input', () => {
      this.validateRegex();
    });

    // Test button
    this.element.querySelector('#test-btn')?.addEventListener('click', () => {
      this.testPattern();
    });
  }

  /**
   * Validate regex pattern
   */
  private validateRegex(): void {
    const regexInput = this.element.querySelector('#pattern-regex') as HTMLTextAreaElement;
    const validationDiv = this.element.querySelector('#regex-validation') as HTMLElement;
    const saveBtn = this.element.querySelector('#save-btn') as HTMLButtonElement;

    const pattern = regexInput.value.trim();

    if (!pattern) {
      validationDiv.textContent = '';
      validationDiv.className = 'validation-message';
      saveBtn.disabled = true;
      return;
    }

    const validation = PatternValidator.validate(pattern);

    if (validation.valid) {
      validationDiv.textContent = '✓ Valid pattern';
      validationDiv.className = 'validation-message valid';
      saveBtn.disabled = false;
    } else {
      validationDiv.textContent = `✗ ${validation.error}`;
      validationDiv.className = 'validation-message invalid';
      saveBtn.disabled = true;
    }
  }

  /**
   * Test pattern against sample text
   */
  private testPattern(): void {
    const regexInput = this.element.querySelector('#pattern-regex') as HTMLTextAreaElement;
    const testText = this.element.querySelector('#test-text') as HTMLTextAreaElement;
    const caseSensitive = (this.element.querySelector('#pattern-case-sensitive') as HTMLInputElement).checked;
    const resultsDiv = this.element.querySelector('#test-results') as HTMLElement;

    const pattern = regexInput.value.trim();
    const text = testText.value.trim();

    if (!pattern || !text) {
      resultsDiv.innerHTML = '<p class="no-results">Enter both pattern and sample text to test.</p>';
      return;
    }

    const result = PatternValidator.test(pattern, text, caseSensitive);

    if (result.count === 0) {
      resultsDiv.innerHTML = '<p class="no-matches">No matches found</p>';
    } else {
      const matchesHtml = result.matches
        .slice(0, 10) // Limit to 10 matches
        .map(m => `<code class="match">${this.escapeHtml(m)}</code>`)
        .join('');

      const more = result.count > 10 ? `<p class="more-matches">... and ${result.count - 10} more</p>` : '';

      resultsDiv.innerHTML = `
        <p class="match-count">✓ Found ${result.count} match(es):</p>
        <div class="match-list">${matchesHtml}</div>
        ${more}
      `;
    }
  }

  /**
   * Handle save button click
   */
  private handleSave(): void {
    const form = this.element.querySelector('#pattern-form') as HTMLFormElement;
    const formData = new FormData(form);

    const name = (this.element.querySelector('#pattern-name') as HTMLInputElement).value.trim();
    const regex = (this.element.querySelector('#pattern-regex') as HTMLTextAreaElement).value.trim();
    const type = (this.element.querySelector('#pattern-type') as HTMLSelectElement).value;
    const description = (this.element.querySelector('#pattern-description') as HTMLTextAreaElement).value.trim();
    const caseSensitive = (this.element.querySelector('#pattern-case-sensitive') as HTMLInputElement).checked;
    const enabled = (this.element.querySelector('#pattern-enabled') as HTMLInputElement).checked;

    // Validate
    if (!name) {
      alert('Please enter a pattern name');
      return;
    }

    if (!regex) {
      alert('Please enter a regex pattern');
      return;
    }

    const validation = PatternValidator.validate(regex);
    if (!validation.valid) {
      alert(`Invalid pattern: ${validation.error}`);
      return;
    }

    // Save or update
    try {
      if (this.editingPattern) {
        customPatternRegistry.updatePattern(this.editingPattern.id, {
          name,
          regex,
          type,
          description,
          caseSensitive,
          enabled
        });
      } else {
        customPatternRegistry.addPattern({
          name,
          regex,
          type,
          description,
          caseSensitive,
          enabled
        });
      }

      this.close();
      this.onSave?.(customPatternRegistry.getAllPatterns()[0]); // TODO: Get actual pattern
    } catch (error) {
      alert(`Failed to save pattern: ${(error as Error).message}`);
    }
  }

  /**
   * Fill form with existing pattern data
   */
  private fillForm(pattern: CustomPattern): void {
    (this.element.querySelector('#pattern-name') as HTMLInputElement).value = pattern.name;
    (this.element.querySelector('#pattern-regex') as HTMLTextAreaElement).value = pattern.regex;
    (this.element.querySelector('#pattern-type') as HTMLSelectElement).value = pattern.type;
    (this.element.querySelector('#pattern-description') as HTMLTextAreaElement).value = pattern.description || '';
    (this.element.querySelector('#pattern-case-sensitive') as HTMLInputElement).checked = pattern.caseSensitive;
    (this.element.querySelector('#pattern-enabled') as HTMLInputElement).checked = pattern.enabled;

    this.validateRegex();
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
   * Show modal
   */
  show(): void {
    document.body.appendChild(this.element);
    // Focus first input
    setTimeout(() => {
      (this.element.querySelector('#pattern-name') as HTMLInputElement)?.focus();
    }, 100);
  }

  /**
   * Close modal
   */
  close(): void {
    this.element.remove();
    this.onCancel?.();
  }

  /**
   * Set save callback
   */
  setSaveCallback(callback: (pattern: CustomPattern) => void): void {
    this.onSave = callback;
  }

  /**
   * Set cancel callback
   */
  setCancelCallback(callback: () => void): void {
    this.onCancel = callback;
  }
}
