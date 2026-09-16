import { HotspotConfig } from '../config/types';
import { TourState } from '../state/TourState';

export class HotspotView {
  public config: HotspotConfig;
  public element: HTMLElement;
  private tourState: TourState;
  private isVisible = true;

  constructor(config: HotspotConfig) {
    this.config = config;
    this.tourState = TourState.get();
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'tour-hotspot glass-interactive';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', `Navigate to ${this.config.label}`);

    // Inner breathing container
    const breathingCircle = document.createElement('div');
    breathingCircle.className = 'hotspot-breather';

    // Custom supplied icon image
    const iconImg = document.createElement('img');
    iconImg.className = 'hotspot-icon-img';
    iconImg.src = this.config.icon;
    iconImg.alt = this.config.label;
    iconImg.loading = 'eager';

    breathingCircle.appendChild(iconImg);
    wrapper.appendChild(breathingCircle);

    // Tooltip / destination label
    const tooltip = document.createElement('div');
    tooltip.className = 'hotspot-tooltip';
    tooltip.textContent = this.config.label;
    wrapper.appendChild(tooltip);

    // Click and touch interactions
    const activate = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      this.tourState.setRoom(this.config.targetRoomId);
    };

    wrapper.addEventListener('click', activate);
    wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        activate(e);
      }
    });

    return wrapper;
  }

  public setScreenPosition(x: number, y: number, visible: boolean): void {
    if (!visible) {
      if (this.isVisible) {
        this.element.style.display = 'none';
        this.isVisible = false;
      }
      return;
    }

    if (!this.isVisible) {
      this.element.style.display = 'flex';
      this.isVisible = true;
    }

    this.element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  public destroy(): void {
    this.element.remove();
  }
}

