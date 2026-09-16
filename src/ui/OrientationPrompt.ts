/**
 * OrientationPrompt displays a premium frosted-glass overlay when the site
 * is opened on phone-sized mobile devices in portrait orientation, prompting
 * the user to rotate to landscape mode for the intended 360° architectural experience.
 *
 * Smoothly recalculates layout, WebGL renderer, and UI coordinates BEFORE
 * fading out to eliminate any one-frame jumps or layout shifts.
 */
export class OrientationPrompt {
  private element: HTMLElement;
  private isVisible = false;
  private isTransitioning = false;

  constructor() {
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.checkOrientation = this.checkOrientation.bind(this);

    // Orientation changes and resize listeners
    window.addEventListener('resize', this.checkOrientation, { passive: true });
    window.addEventListener('orientationchange', () => {
      // Small stepped delays allow mobile OS browser chrome to finish animating
      this.checkOrientation();
      setTimeout(this.checkOrientation, 100);
      setTimeout(this.checkOrientation, 300);
    });

    if ('screen' in window && 'orientation' in window.screen) {
      try {
        window.screen.orientation.addEventListener('change', this.checkOrientation);
      } catch (_) {}
    }

    // Initial check
    this.checkOrientation();
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'orientation-prompt';
    backdrop.className = 'orientation-prompt';
    backdrop.setAttribute('role', 'alert');
    backdrop.setAttribute('aria-live', 'assertive');

    backdrop.innerHTML = `
      <div class="orientation-card glass-panel">
        <h2 class="orientation-title">Please rotate your device</h2>
        
        <div class="orientation-icon-wrapper">
          <svg class="orientation-phone-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <!-- Phone outline -->
            <rect x="14" y="6" width="20" height="36" rx="4" ry="4" class="phone-body" />
            <line x1="22" y1="36" x2="26" y2="36" class="phone-home" />
            <!-- Rotate arrow indicator -->
            <path d="M38 16 A 18 18 0 1 0 38 32" stroke-dasharray="3 3" opacity="0.4" />
            <path d="M40 20 L 40 14 L 34 14" stroke-width="2" />
          </svg>
        </div>

        <p class="orientation-desc">
          View the experience in<br />
          <span>landscape mode</span>
        </p>
      </div>
    `;

    return backdrop;
  }

  private checkOrientation(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;

    // Smallest dimension: on phones this is <= 550px
    const minDim = Math.min(width, height);
    const screenMinDim =
      typeof window.screen !== 'undefined' && window.screen.width
        ? Math.min(window.screen.width, window.screen.height)
        : minDim;

    // Coarse pointer / touch detection
    const isCoarse =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    // Exclude tablets (iPad Mini is >= 744px) and desktop screens
    const isPhoneSize = minDim <= 600 || screenMinDim <= 600;
    const isPortraitPhone = isPortrait && isPhoneSize && isCoarse;

    if (isPortraitPhone && !this.isVisible && !this.isTransitioning) {
      this.show();
    } else if (!isPortraitPhone && this.isVisible && !this.isTransitioning) {
      this.handleRotateToLandscape();
    }
  }

  public show(): void {
    this.isVisible = true;
    this.isTransitioning = false;
    this.element.classList.add('active');
    document.body.classList.add('orientation-lock-active');
  }

  /**
   * Smooth transition to landscape:
   * 1. Keep prompt visible while browser dimensions settle.
   * 2. Recalculate Three.js viewport & GUI geometry.
   * 3. Once landscape layout is rendered, fade out prompt to eliminate jumps.
   */
  private handleRotateToLandscape(): void {
    this.isTransitioning = true;

    // First frame: allow browser to update landscape CSS
    requestAnimationFrame(() => {
      // Trigger Three.js and navigation slider dimension recalculations
      window.dispatchEvent(new Event('resize'));

      // Second frame: confirm layout coordinates have settled
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));

        // Start smooth CSS fade out
        this.element.classList.remove('active');
        document.body.classList.remove('orientation-lock-active');

        // Complete transition after fade animation finishes
        setTimeout(() => {
          this.isVisible = false;
          this.isTransitioning = false;
          // Final sanity check for slider thumb & canvas
          window.dispatchEvent(new Event('resize'));
        }, 450);
      });
    });
  }

  public hide(): void {
    this.handleRotateToLandscape();
  }
}
