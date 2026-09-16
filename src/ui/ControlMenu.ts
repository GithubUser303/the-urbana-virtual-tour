import { TourState } from '../state/TourState';

export class ControlMenu {
  private element: HTMLElement;
  private tourState: TourState;
  private isOpen = false;
  private restorePill: HTMLElement;
  private arrowIcon!: SVGElement;
  private menuDropdown!: HTMLElement;
  private fullscreenBtn!: HTMLButtonElement;
  private hideUiBtn!: HTMLButtonElement;
  private musicBtn!: HTMLButtonElement;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    this.restorePill = this.createRestorePill();
    document.body.appendChild(this.element);
    document.body.appendChild(this.restorePill);

    this.tourState.on('audioChange', (state) => {
      this.musicBtn.textContent = state.isAudioMuted ? 'Play Music' : 'Mute Music';
    });

    this.tourState.on('fullscreenChange', (state) => {
      this.fullscreenBtn.textContent = state.isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen';
    });

    this.tourState.on('uiVisibilityChange', (state) => {
      this.hideUiBtn.textContent = state.isUiHidden ? 'Unhide UI' : 'Hide UI';
      if (state.isUiHidden) {
        this.element.classList.add('ui-hidden-fade');
        this.restorePill.classList.add('visible');
      } else {
        this.element.classList.remove('ui-hidden-fade');
        this.restorePill.classList.remove('visible');
      }
    });

    document.addEventListener('fullscreenchange', () => {
      this.tourState.setFullscreen(!!document.fullscreenElement);
    });
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'control-menu-container';
    container.className = 'control-menu-container';

    // Floating glass trigger button with rotating arrow
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'control-trigger-btn glass-panel glass-interactive';
    triggerBtn.setAttribute('aria-label', 'Toggle quick controls menu');
    triggerBtn.setAttribute('aria-expanded', 'false');

    triggerBtn.innerHTML = `
      <svg class="control-arrow-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;

    this.arrowIcon = triggerBtn.querySelector('.control-arrow-icon')!;

    // Dropdown list
    this.menuDropdown = document.createElement('div');
    this.menuDropdown.className = 'control-dropdown glass-panel';

    // 1. Fullscreen Button
    this.fullscreenBtn = document.createElement('button');
    this.fullscreenBtn.className = 'control-item-btn glass-interactive';
    this.fullscreenBtn.textContent = 'Go Fullscreen';
    this.fullscreenBtn.addEventListener('click', () => {
      this.toggleFullscreen();
      this.close();
    });

    // 2. Hide UI Button
    this.hideUiBtn = document.createElement('button');
    this.hideUiBtn.className = 'control-item-btn glass-interactive';
    this.hideUiBtn.textContent = 'Hide UI';
    this.hideUiBtn.addEventListener('click', () => {
      this.tourState.toggleUiVisibility();
      this.close();
    });

    // 3. Audio Toggle Button
    this.musicBtn = document.createElement('button');
    this.musicBtn.className = 'control-item-btn glass-interactive';
    this.musicBtn.textContent = this.tourState.getState().isAudioMuted ? 'Play Music' : 'Mute Music';
    this.musicBtn.addEventListener('click', () => {
      this.tourState.toggleAudio();
      this.close();
    });

    this.menuDropdown.appendChild(this.fullscreenBtn);
    this.menuDropdown.appendChild(this.hideUiBtn);
    this.menuDropdown.appendChild(this.musicBtn);

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !container.contains(e.target as Node)) {
        this.close();
      }
    });

    container.appendChild(this.menuDropdown);
    container.appendChild(triggerBtn);

    return container;
  }

  private createRestorePill(): HTMLElement {
    const pill = document.createElement('button');
    pill.className = 'restore-ui-pill glass-panel glass-interactive';
    pill.setAttribute('aria-label', 'Restore UI elements');
    pill.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>Unhide UI</span>
    `;

    pill.addEventListener('click', () => {
      this.tourState.setUiVisibility(false);
    });

    return pill;
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    this.isOpen = true;
    this.menuDropdown.classList.add('open');
    this.arrowIcon.classList.add('rotated');
  }

  public close(): void {
    this.isOpen = false;
    this.menuDropdown.classList.remove('open');
    this.arrowIcon.classList.remove('rotated');
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}

