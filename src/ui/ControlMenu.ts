import { TourState } from '../state/TourState';
import { AudioManager } from '../audio/AudioManager';

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
  private lastActionTime = 0;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    this.restorePill = this.createRestorePill();
    document.body.appendChild(this.element);
    document.body.appendChild(this.restorePill);

    this.tourState.on('audioChange', (state) => {
      this.updateMusicButton(state.isAudioMuted);
    });

    this.tourState.on('fullscreenChange', (state) => {
      this.fullscreenBtn.innerHTML = `
        <span class="control-item-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            ${state.isFullscreen
              ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
              : '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'}
          </svg>
        </span>
        <span class="control-item-label">${state.isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}</span>
      `;
    });

    this.tourState.on('uiVisibilityChange', (state) => {
      this.hideUiBtn.innerHTML = `
        <span class="control-item-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            ${state.isUiHidden
              ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
              : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
          </svg>
        </span>
        <span class="control-item-label">${state.isUiHidden ? 'Unhide UI' : 'Hide UI'}</span>
      `;
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

  private updateMusicButton(isMuted: boolean): void {
    const isPlaying = !isMuted;
    this.musicBtn.innerHTML = `
      <span class="control-item-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          ${isPlaying
            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>'
            : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>'}
        </svg>
      </span>
      <span class="control-item-label">${isPlaying ? 'Mute Background Music' : 'Unmute Background Music'}</span>
    `;
    this.musicBtn.setAttribute('aria-label', isPlaying ? 'Mute Background Music' : 'Unmute Background Music');
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'control-menu-container';
    container.className = 'control-menu-container';

    // Prevent pointer event leaking to Three.js canvas
    container.addEventListener('pointerdown', (e) => e.stopPropagation());
    container.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

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
    this.fullscreenBtn.innerHTML = `
      <span class="control-item-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </span>
      <span class="control-item-label">Go Fullscreen</span>
    `;
    const onFullscreen = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastActionTime < 300) return;
      this.lastActionTime = now;
      this.toggleFullscreen();
      this.close();
    };
    this.fullscreenBtn.addEventListener('pointerup', onFullscreen);
    this.fullscreenBtn.addEventListener('click', onFullscreen);

    // 2. Hide UI Button
    this.hideUiBtn = document.createElement('button');
    this.hideUiBtn.className = 'control-item-btn glass-interactive';
    this.hideUiBtn.innerHTML = `
      <span class="control-item-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </span>
      <span class="control-item-label">Hide UI</span>
    `;
    const onHideUi = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastActionTime < 300) return;
      this.lastActionTime = now;
      this.tourState.toggleUiVisibility();
      this.close();
    };
    this.hideUiBtn.addEventListener('pointerup', onHideUi);
    this.hideUiBtn.addEventListener('click', onHideUi);

    // 3. Audio Toggle Button
    this.musicBtn = document.createElement('button');
    this.musicBtn.className = 'control-item-btn glass-interactive';
    this.updateMusicButton(AudioManager.getInstance().isMuted());

    const onAudioToggle = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastActionTime < 300) return;
      this.lastActionTime = now;

      // Invoke centralized audio controller synchronously within user-gesture stack
      const isMuted = AudioManager.getInstance().toggleMute();
      this.updateMusicButton(isMuted);
      this.close();
    };

    this.musicBtn.addEventListener('pointerup', onAudioToggle);
    this.musicBtn.addEventListener('click', onAudioToggle);

    this.menuDropdown.appendChild(this.fullscreenBtn);
    this.menuDropdown.appendChild(this.hideUiBtn);
    this.menuDropdown.appendChild(this.musicBtn);

    const onTrigger = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastActionTime < 300) return;
      this.lastActionTime = now;
      this.toggle();
    };

    triggerBtn.addEventListener('pointerup', onTrigger);
    triggerBtn.addEventListener('click', onTrigger);

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
    triggerBtnExpanded: this.element.querySelector('.control-trigger-btn')?.setAttribute('aria-expanded', 'true');
  }

  public close(): void {
    this.isOpen = false;
    this.menuDropdown.classList.remove('open');
    this.arrowIcon.classList.remove('rotated');
    this.element.querySelector('.control-trigger-btn')?.setAttribute('aria-expanded', 'false');
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
