import { TourState } from '../state/TourState';
import { AudioManager } from '../audio/AudioManager';

/**
 * Interactive Intro Screen & Experience Entry Gateway.
 * Acts as the compliant first user-interaction point to initiate audio playback
 * and unlock WebKit / Blink autoplay restrictions on mobile (iOS Safari & Android).
 */
export class IntroScreen {
  private element: HTMLElement;
  private tourState: TourState;
  private hasEntered = false;
  private isDismissed = false;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.bindEvents();
  }

  private createElement(): HTMLElement {
    const screen = document.createElement('div');
    screen.id = 'intro-screen';
    screen.className = 'intro-screen';
    screen.setAttribute('role', 'button');
    screen.setAttribute('tabindex', '0');
    screen.setAttribute('aria-label', 'Enter The Urbana virtual tour experience');

    // Blurred property backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'intro-backdrop';
    backdrop.style.backgroundImage = `url('/assets/panoramas/living-room.jpg')`;

    const content = document.createElement('div');
    content.className = 'intro-content';

    const title = document.createElement('h1');
    title.className = 'intro-title project-font-branding';
    title.textContent = this.tourState.getConfig().projectName; // "The Urbana"

    const subtitle = document.createElement('div');
    subtitle.className = 'intro-sub';
    subtitle.textContent = this.tourState.getConfig().credits; // "Experience by Lost in Renders"

    // Luxury glass interactive entry pill
    const enterBtn = document.createElement('div');
    enterBtn.className = 'intro-enter-btn glass-interactive';
    enterBtn.innerHTML = `
      <span class="intro-enter-text">Enter Experience</span>
      <svg class="intro-enter-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">
        <polygon points="6 4 20 12 6 20 6 4"></polygon>
      </svg>
    `;

    const hint = document.createElement('div');
    hint.className = 'intro-hint';
    hint.textContent = 'Tap anywhere to enter';

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(enterBtn);
    content.appendChild(hint);

    screen.appendChild(backdrop);
    screen.appendChild(content);

    return screen;
  }

  private bindEvents(): void {
    const triggerEnter = (e?: Event) => {
      if (this.hasEntered) return;
      this.hasEntered = true;

      if (e) {
        e.stopPropagation();
      }

      // 1-5. DIRECT SYNCHRONOUS INVOCATION WITHIN USER GESTURE CALLSTACK
      // Initialises volume, unmuted, calls audio.play() and catches the promise.
      try {
        AudioManager.getInstance().startOnUserGesture();
      } catch (err) {
        console.warn('Audio gesture start error:', err);
      }

      // 6. Enter the 360° tour
      this.dismiss();
    };

    // User taps anywhere on the intro screen or enter button
    this.element.addEventListener('pointerup', triggerEnter);
    this.element.addEventListener('touchend', triggerEnter, { passive: true });
    this.element.addEventListener('click', triggerEnter);

    // Keyboard accessibility (Enter or Space)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.hasEntered && (e.key === 'Enter' || e.key === ' ')) {
        triggerEnter(e);
      }
    });
  }

  /**
   * Called when first room panorama is rendered in background.
   * We intentionally do NOT auto-dismiss here so the user's first tap
   * serves as the legitimate user gesture required by mobile browsers for audio.
   */
  public notifyFirstRoomReady(): void {
    // Non-blocking; tour is ready underneath whenever user taps
  }

  public dismiss(): void {
    if (this.isDismissed) return;
    this.isDismissed = true;

    this.element.classList.add('intro-fade-out');
    setTimeout(() => {
      this.element.remove();
    }, 1100);
  }
}
