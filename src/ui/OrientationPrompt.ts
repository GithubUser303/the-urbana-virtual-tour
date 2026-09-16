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
    // Mount directly on body so position:fixed resolves against the true viewport
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

    // Wait for custom fonts to load before the initial orientation check so
    // the layout is stable and the brand font renders correctly.
    if ('fonts' in document) {
      (document as any).fonts.ready.then(() => {
        this.checkOrientation();
      });
    } else {
      // Fallback for browsers without document.fonts
      this.checkOrientation();
    }
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
          <div class="orientation-icon-glow"></div>
          <svg class="orientation-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <!-- Phone chassis tinted glass gradient -->
              <linearGradient id="urbana-phone-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="rgba(34, 44, 60, 0.85)" />
                <stop offset="100%" stop-color="rgba(14, 20, 30, 0.95)" />
              </linearGradient>

              <!-- Phone display screen gradient -->
              <linearGradient id="urbana-phone-screen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(10, 14, 22, 0.75)" />
                <stop offset="100%" stop-color="rgba(20, 28, 42, 0.85)" />
              </linearGradient>

              <!-- Orbit path gradient -->
              <linearGradient id="urbana-orbit-grad" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#e2b96f" stop-opacity="0.15" />
                <stop offset="60%" stop-color="#e2b96f" stop-opacity="0.75" />
                <stop offset="100%" stop-color="#e2b96f" stop-opacity="1" />
              </linearGradient>
            </defs>

            <!-- Target Landscape Destination Silhouette (Faint alignment guide) -->
            <rect x="24" y="34" width="52" height="32" rx="6" class="orientation-target-silhouette" />

            <!-- Orbit Rotation Guide Arc & Arrowhead -->
            <path d="M 50 9 A 41 41 0 0 0 9 46" class="orientation-orbit-path" />
            <circle cx="50" cy="9" r="2" class="orientation-orbit-dot" />
            <path d="M 5 44 L 13 44 L 9 52 Z" class="orientation-orbit-arrow" />

            <!-- Animated Rotating Phone Group -->
            <g class="orientation-device-rotator">
              <!-- Chassis Frame -->
              <rect x="34" y="24" width="32" height="52" rx="6" class="phone-frame" />
              
              <!-- Screen Area -->
              <rect x="36.5" y="28" width="27" height="44" rx="4" class="phone-screen" />
              
              <!-- Architectural Horizon Preview -->
              <path d="M 38 52 L 44 48 L 50 51 L 56 47 L 62 52" class="phone-horizon" />
              <circle cx="55" cy="41" r="1.8" class="phone-sun" />

              <!-- Speaker Notch / Dynamic Island -->
              <rect x="46" y="25.5" width="8" height="1.6" rx="0.8" class="phone-notch" />
              
              <!-- Home Indicator Bar -->
              <rect x="44.5" y="68.5" width="11" height="1.2" rx="0.6" class="phone-home" />
            </g>
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
    this.element.classList.remove('dismissing');
    this.element.classList.add('active');
    document.body.classList.add('orientation-lock-active');
  }

  /**
   * Smooth transition to landscape:
   * 1. Detect landscape orientation.
   * 2. Fade out the orientation card and soften backdrop blur.
   * 3. Recalculate Three.js viewport & GUI geometry.
   * 4. Once landscape layout is rendered, reveal the tour seamlessly without jumps.
   */
  private handleRotateToLandscape(): void {
    this.isTransitioning = true;

    // Start graceful card scale/fade and blur reduction
    this.element.classList.add('dismissing');

    // First frame: allow browser to settle landscape CSS
    requestAnimationFrame(() => {
      // Trigger Three.js renderer and navigation slider dimension recalculations
      window.dispatchEvent(new Event('resize'));

      // Second frame: confirm layout coordinates have settled
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));

        // Start backdrop opacity fade out
        this.element.classList.remove('active');
        document.body.classList.remove('orientation-lock-active');

        // Complete transition after fade animation finishes
        setTimeout(() => {
          this.element.classList.remove('dismissing');
          this.isVisible = false;
          this.isTransitioning = false;
          // Final layout verification for slider thumb & Three.js canvas
          window.dispatchEvent(new Event('resize'));
        }, 480);
      });
    });
  }

  public hide(): void {
    this.handleRotateToLandscape();
  }
}
