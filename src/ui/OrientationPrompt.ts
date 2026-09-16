/**
 * OrientationPrompt displays a premium frosted-glass overlay when the site
 * is opened on phone-sized mobile devices in portrait orientation, prompting
 * the user to rotate to landscape mode for the intended 360° architectural experience.
 *
 * Automatically fades out when rotated to landscape and triggers layout updates.
 */
export class OrientationPrompt {
  private element: HTMLElement;
  private isVisible = false;
  private mediaQuery: MediaQueryList;

  constructor() {
    this.element = this.createElement();
    document.body.appendChild(this.element);

    // Target phone-sized screens in portrait orientation
    // Excludes desktop, laptops, and large tablets
    this.mediaQuery = window.matchMedia(
      '(orientation: portrait) and (max-width: 600px)'
    );

    this.checkOrientation = this.checkOrientation.bind(this);

    // Listen to orientation and media query changes
    if (typeof this.mediaQuery.addEventListener === 'function') {
      this.mediaQuery.addEventListener('change', this.checkOrientation);
    } else {
      // Legacy Safari / mobile webview fallback
      this.mediaQuery.addListener(this.checkOrientation);
    }

    window.addEventListener('orientationchange', () => {
      // Small timeout allows window.innerWidth/innerHeight to settle on mobile OS
      setTimeout(this.checkOrientation, 100);
    });
    window.addEventListener('resize', this.checkOrientation);

    // Initial check
    this.checkOrientation();
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'orientation-prompt';
    backdrop.className = 'orientation-prompt';
    backdrop.setAttribute('role', 'alert');
    backdrop.setAttribute('aria-live', 'polite');

    backdrop.innerHTML = `
      <div class="orientation-card glass-panel">
        <h2 class="orientation-title">Please rotate your device</h2>
        
        <div class="orientation-icon-wrapper">
          <svg class="orientation-phone-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <!-- Phone outline -->
            <rect x="14" y="6" width="20" height="36" rx="4" ry="4" class="phone-body" />
            <line x1="22" y1="36" x2="26" y2="36" class="phone-home" />
            <!-- Rotate arrow circle -->
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
    // Only trigger on mobile phone screen sizes in portrait
    const isPortraitPhone =
      this.mediaQuery.matches ||
      (window.innerHeight > window.innerWidth && window.innerWidth <= 600);

    if (isPortraitPhone && !this.isVisible) {
      this.show();
    } else if (!isPortraitPhone && this.isVisible) {
      this.hide();
    }
  }

  public show(): void {
    this.isVisible = true;
    this.element.classList.add('active');
    document.body.classList.add('orientation-lock-active');
  }

  public hide(): void {
    this.isVisible = false;
    this.element.classList.remove('active');
    document.body.classList.remove('orientation-lock-active');

    // Notify window and components to re-measure layout and WebGL canvas
    window.dispatchEvent(new Event('resize'));
  }
}
