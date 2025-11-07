/**
 * User menu component
 * Displays user info and account actions
 */

import type { UserProfile } from '../../../lib/auth/session.js';

export class UserMenu {
  private element: HTMLElement;
  private dropdownOpen = false;
  private onLogout: () => void;
  private onViewFiles: () => void;

  constructor(
    private user: UserProfile,
    onLogout: () => void,
    onViewFiles: () => void
  ) {
    this.onLogout = onLogout;
    this.onViewFiles = onViewFiles;
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'user-menu';
    container.style.cssText = `
      position: relative;
      display: inline-block;
    `;

    // User button
    const button = document.createElement('button');
    button.className = 'user-menu-button';
    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: white;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 12px;
    `;
    avatar.textContent = this.user.email.charAt(0).toUpperCase();

    const email = document.createElement('span');
    email.textContent = this.user.email;
    email.style.cssText = 'max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

    button.appendChild(avatar);
    button.appendChild(email);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'user-menu-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      min-width: 250px;
      display: none;
      z-index: 1000;
    `;

    dropdown.innerHTML = this.getDropdownContent();

    button.addEventListener('click', () => this.toggleDropdown());

    container.appendChild(button);
    container.appendChild(dropdown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    // Attach dropdown event listeners
    setTimeout(() => this.attachDropdownListeners(), 0);

    return container;
  }

  private getDropdownContent(): string {
    const usedGB = (this.user.storage_used_bytes / (1024 * 1024 * 1024)).toFixed(2);
    const quotaGB = (this.user.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(2);
    const percentUsed = Math.round(
      (this.user.storage_used_bytes / this.user.storage_quota_bytes) * 100
    );

    return `
      <div style="padding: 16px; border-bottom: 1px solid #e0e0e0;">
        <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">
          ${this.user.email}
        </div>
        <div style="font-size: 12px; color: #666;">
          Signed in
        </div>
      </div>

      <div style="padding: 16px; border-bottom: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 13px; color: #666;">Storage</span>
          <span style="font-size: 13px; font-weight: 500; color: #1a1a1a;">
            ${usedGB} / ${quotaGB} GB
          </span>
        </div>
        <div style="width: 100%; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;">
          <div style="width: ${percentUsed}%; height: 100%; background: linear-gradient(90deg, #2563eb 0%, #1e40af 100%);"></div>
        </div>
      </div>

      <div style="padding: 8px;">
        <button
          class="menu-item menu-files"
          style="width: 100%; padding: 10px 12px; background: none; border: none; text-align: left; border-radius: 6px; cursor: pointer; font-size: 14px; color: #1a1a1a; transition: background 0.2s; display: flex; align-items: center; gap: 8px;"
        >
          <span>📁</span>
          <span>My Files</span>
        </button>
        <button
          class="menu-item menu-logout"
          style="width: 100%; padding: 10px 12px; background: none; border: none; text-align: left; border-radius: 6px; cursor: pointer; font-size: 14px; color: #dc2626; transition: background 0.2s; display: flex; align-items: center; gap: 8px;"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    `;
  }

  private attachDropdownListeners(): void {
    const filesButton = this.element.querySelector('.menu-files');
    const logoutButton = this.element.querySelector('.menu-logout');

    filesButton?.addEventListener('click', () => {
      this.onViewFiles();
      this.closeDropdown();
    });

    logoutButton?.addEventListener('click', () => {
      this.onLogout();
      this.closeDropdown();
    });

    // Hover effects
    this.element.querySelectorAll('.menu-item').forEach((item) => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.background = '#f5f5f5';
      });
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.background = 'none';
      });
    });
  }

  private toggleDropdown(): void {
    const dropdown = this.element.querySelector('.user-menu-dropdown') as HTMLElement;
    this.dropdownOpen = !this.dropdownOpen;
    dropdown.style.display = this.dropdownOpen ? 'block' : 'none';
  }

  private closeDropdown(): void {
    const dropdown = this.element.querySelector('.user-menu-dropdown') as HTMLElement;
    this.dropdownOpen = false;
    dropdown.style.display = 'none';
  }

  updateUser(user: UserProfile): void {
    this.user = user;
    const container = this.element;
    const newElement = this.createElement();
    container.replaceWith(newElement);
    this.element = newElement;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
