/**
 * The Urbana — Secure Authenticator (TOTP) Access Gate.
 * Renders an architectural tinted-glass modal requiring a 6-digit TOTP
 * code before granting access to the 360° virtual tour and protected assets.
 */
export class AuthGate {
  private element: HTMLElement;
  private input!: HTMLInputElement;
  private errorElement!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private spinnerElement!: HTMLElement;
  private btnTextElement!: HTMLElement;
  private onSuccess: () => void;
  private isVerifying = false;

  constructor(onSuccess: () => void) {
    this.onSuccess = onSuccess;
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.bindEvents();

    // Focus input on desktop (avoid auto-popping virtual keyboard immediately on mobile if undesired)
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (!isMobile) {
      setTimeout(() => this.input.focus(), 250);
    }
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'auth-gate';
    backdrop.className = 'auth-gate';

    // Blurred property backdrop matching the cinematic atmosphere
    const bg = document.createElement('div');
    bg.className = 'auth-backdrop';
    bg.style.backgroundImage = `url('/assets/panoramas/living-room.jpg')`;

    const card = document.createElement('div');
    card.className = 'auth-card glass-panel';

    card.innerHTML = `
      <div class="auth-glow"></div>
      <div class="auth-header">
        <h1 class="auth-title project-font-branding">The Urbana</h1>
        <div class="auth-badge">SECURE ACCESS</div>
        <p class="auth-instruction">Enter 6-digit authentication code</p>
      </div>

      <form class="auth-form" autocomplete="off" novalidate>
        <div class="auth-input-container">
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="• • • • • •"
            class="auth-input"
            aria-label="6-digit TOTP authentication code"
            required
            spellcheck="false"
          />
        </div>

        <div class="auth-error-msg" aria-live="polite"></div>

        <button type="submit" class="auth-verify-btn glass-interactive" aria-label="Verify authentication code">
          <span class="auth-btn-text">VERIFY</span>
          <div class="auth-btn-spinner" style="display: none;"></div>
        </button>
      </form>
    `;

    backdrop.appendChild(bg);
    backdrop.appendChild(card);

    this.input = card.querySelector('.auth-input')!;
    this.errorElement = card.querySelector('.auth-error-msg')!;
    this.submitBtn = card.querySelector('.auth-verify-btn')!;
    this.btnTextElement = card.querySelector('.auth-btn-text')!;
    this.spinnerElement = card.querySelector('.auth-btn-spinner')!;

    return backdrop;
  }

  private bindEvents(): void {
    // Sanitize input to digits only & handle formatting
    this.input.addEventListener('input', () => {
      const sanitized = this.input.value.replace(/\D/g, '').slice(0, 6);
      this.input.value = sanitized;
      this.clearError();

      // Auto-submit when all 6 digits are typed or pasted
      if (sanitized.length === 6 && !this.isVerifying) {
        this.verifyCode(sanitized);
      }
    });

    // Handle paste cleanly
    this.input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || (window as any).clipboardData)?.getData('text') || '';
      const sanitized = pasteData.replace(/\D/g, '').slice(0, 6);
      this.input.value = sanitized;
      this.clearError();

      if (sanitized.length === 6 && !this.isVerifying) {
        this.verifyCode(sanitized);
      }
    });

    // Form submission
    const form = this.element.querySelector('.auth-form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.isVerifying) return;
      const code = this.input.value.trim();
      if (code.length !== 6) {
        this.showError('Please enter a complete 6-digit code.');
        this.input.focus();
        return;
      }
      this.verifyCode(code);
    });
  }

  private async verifyCode(code: string): Promise<void> {
    this.isVerifying = true;
    this.setLoading(true);
    this.clearError();

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.handleSuccess();
      } else {
        const errorMsg =
          data.error || 'Invalid authentication code. Please try again.';
        this.showError(errorMsg);
        this.triggerCardShake();
        this.input.select();
      }
    } catch (err) {
      console.error('Authentication request failed:', err);
      this.showError('Connection error. Please check your network and try again.');
    } finally {
      this.isVerifying = false;
      this.setLoading(false);
    }
  }

  private handleSuccess(): void {
    // Graceful fade out and reveal the tour intro
    this.element.classList.add('auth-fade-out');

    setTimeout(() => {
      this.element.remove();
      this.onSuccess();
    }, 550);
  }

  private showError(msg: string): void {
    this.errorElement.textContent = msg;
    this.errorElement.classList.add('visible');
  }

  private clearError(): void {
    this.errorElement.textContent = '';
    this.errorElement.classList.remove('visible');
  }

  private triggerCardShake(): void {
    const card = this.element.querySelector('.auth-card');
    if (card) {
      card.classList.remove('shake');
      // Trigger reflow to restart animation
      void (card as HTMLElement).offsetWidth;
      card.classList.add('shake');
    }
  }

  private setLoading(loading: boolean): void {
    if (loading) {
      this.submitBtn.disabled = true;
      this.btnTextElement.style.opacity = '0';
      this.spinnerElement.style.display = 'block';
    } else {
      this.submitBtn.disabled = false;
      this.btnTextElement.style.opacity = '1';
      this.spinnerElement.style.display = 'none';
    }
  }
}

