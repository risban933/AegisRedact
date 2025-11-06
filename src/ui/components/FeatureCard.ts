/**
 * Feature Card Component
 * Displays a feature with icon, title, and description
 */

export interface FeatureData {
  icon: string; // SVG string or emoji
  title: string;
  description: string;
}

export class FeatureCard {
  private container: HTMLElement;
  private data: FeatureData;

  constructor(data: FeatureData, index: number = 0) {
    this.data = data;
    this.container = this.createCard(index);
  }

  private createCard(index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'feature-card glass-card-hover animate-fade-in-up';
    card.style.animationDelay = `${index * 0.1}s`;
    card.style.opacity = '0';
    card.style.animationFillMode = 'forwards';

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'feature-icon';
    iconContainer.innerHTML = this.data.icon;
    card.appendChild(iconContainer);

    // Title
    const title = document.createElement('h3');
    title.className = 'feature-title';
    title.textContent = this.data.title;
    card.appendChild(title);

    // Description
    const description = document.createElement('p');
    description.className = 'feature-description';
    description.textContent = this.data.description;
    card.appendChild(description);

    return card;
  }

  getElement(): HTMLElement {
    return this.container;
  }
}
