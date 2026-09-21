import { AdminLoginModal } from './AdminLoginModal';

/**
 * The Urbana — Secure Authenticator (TOTP) Access Gate.
 * Renders an architectural tinted-glass modal requiring a 6-digit TOTP
 * code before granting access to the 360° virtual tour and protected assets.
 */
export class AuthGate {
  private element: HTMLElement;
  private inputContainer!: HTMLElement;
  private input!: HTMLInputElement;
  private slots: HTMLElement[] = [];
  private errorElement!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private spinnerElement!: HTMLElement;
  private btnTextElement!: HTMLElement;
  private onSuccess: (role: 'user' | 'admin') => void;
  private isVerifying = false;

  constructor(onSuccess: (role: 'user' | 'admin') => void, initialMessage?: string) {
    this.onSuccess = onSuccess;
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.updateSlots();

    if (initialMessage) {
      this.showError(initialMessage);
    }

    this.bindEvents();

    // Focus input on desktop (avoid auto-popping virtual keyboard immediately on mobile if undesired)
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (!isMobile) {
      setTimeout(() => {
        this.input.focus();
        this.updateSlots();
      }, 250);
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

    const topBar = document.createElement('div');
    topBar.className = 'auth-gate-top-bar';
    topBar.innerHTML = `
      <button type="button" class="auth-top-admin-btn glass-interactive" aria-label="Open Admin Login">
        Admin Login
      </button>
    `;

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
            class="auth-input-hidden"
            aria-label="6-digit TOTP authentication code"
            required
            spellcheck="false"
          />
          <div class="auth-otp-track" aria-hidden="true">
            <div class="auth-otp-slot" data-index="0"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
            <div class="auth-otp-slot" data-index="1"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
            <div class="auth-otp-slot" data-index="2"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
            <div class="auth-otp-slot" data-index="3"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
            <div class="auth-otp-slot" data-index="4"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
            <div class="auth-otp-slot" data-index="5"><span class="auth-otp-dot"></span><span class="auth-otp-caret"></span></div>
          </div>
        </div>

        <div class="auth-error-msg" aria-live="polite"></div>

        <button type="submit" class="auth-verify-btn glass-interactive" aria-label="Verify authentication code">
          <span class="auth-btn-text">VERIFY</span>
          <div class="auth-btn-spinner" style="display: none;"></div>
        </button>
      </form>
    `;

    backdrop.appendChild(bg);
    backdrop.appendChild(topBar);
    backdrop.appendChild(card);

    this.inputContainer = card.querySelector('.auth-input-container')!;
    this.input = card.querySelector('.auth-input-hidden')!;
    this.slots = Array.from(card.querySelectorAll<HTMLElement>('.auth-otp-slot'));
    this.errorElement = card.querySelector('.auth-error-msg')!;
    this.submitBtn = card.querySelector('.auth-verify-btn')!;
    this.btnTextElement = card.querySelector('.auth-btn-text')!;
    this.spinnerElement = card.querySelector('.auth-btn-spinner')!;

    return backdrop;
  }

  private updateSlots(): void {
    const val = this.input.value;
    const len = val.length;
    const isFocused = document.activeElement === this.input;

    if (isFocused) {
      this.inputContainer.classList.add('is-focused');
    } else {
      this.inputContainer.classList.remove('is-focused');
    }

    this.slots.forEach((slot, index) => {
      slot.classList.remove('filled', 'active');
      if (index < len) {
        slot.classList.add('filled');
      } else if (index === len && isFocused && len < 6) {
        slot.classList.add('active');
      }
    });
  }

  private bindEvents(): void {
    // Top-right Admin Login button opens AdminLoginModal directly
    const adminBtn = this.element.querySelector('.auth-top-admin-btn');
    adminBtn?.addEventListener('click', () => {
      AdminLoginModal.open(
        () => {
          this.handleSuccess('admin');
        },
        () => {
          this.input.focus();
          this.updateSlots();
        }
      );
    });

    // Tapping container focuses hidden input
    this.inputContainer.addEventListener('click', () => {
      this.input.focus();
      this.updateSlots();
    });

    this.input.addEventListener('focus', () => {
      this.updateSlots();
    });

    this.input.addEventListener('blur', () => {
      this.updateSlots();
    });

    // Sanitize input to digits only & update visual slots immediately
    this.input.addEventListener('input', () => {
      const sanitized = this.input.value.replace(/\D/g, '').slice(0, 6);
      this.input.value = sanitized;
      this.clearError();
      this.updateSlots();

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
      this.updateSlots();

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
        this.updateSlots();
        return;
      }
      this.verifyCode(code);
    });
  }

  private async verifyCode(code: string): Promise<void> {
    this.isVerifying = true;
    this.setLoading(true);
    this.clearError();

    const endpoint = '/api/auth/verify';
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ code })
      });
    } catch (networkError) {
      // Genuine network/DNS/offline failure
      if (import.meta.env.DEV) {
        console.warn(`[AuthGate] Network failure calling ${endpoint}:`, networkError);
      }
      this.showError('Unable to connect to authentication service. Please try again.');
      this.isVerifying = false;
      this.setLoading(false);
      return;
    }

    try {
      let data: any = null;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (import.meta.env.DEV) {
        console.log(`[AuthGate] Response from ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          success: data?.success,
          errorId: data?.error
        });
      }

      if (response.ok && data?.success) {
        this.handleSuccess('user');
        return;
      }

      // Handle 429 Rate Limit
      if (response.status === 429) {
        const msg = data?.error || 'Too many failed attempts. Please wait a moment and try again.';
        this.showError(msg);
        this.triggerCardShake();
        return;
      }

      // Handle 400 / 401 Invalid Code
      if (response.status === 400 || response.status === 401) {
        const msg = data?.error || 'Invalid or expired authentication code.';
        this.showError(msg);
        this.triggerCardShake();
        this.input.select();
        return;
      }

      // 5xx Server Error or unexpected status
      const msg = data?.error || 'Unable to connect to authentication service. Please try again.';
      this.showError(msg);
      this.triggerCardShake();
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error('[AuthGate] Error handling response:', parseError);
      }
      this.showError('Unable to connect to authentication service. Please try again.');
    } finally {
      this.isVerifying = false;
      this.setLoading(false);
    }
  }

  private handleSuccess(role: 'user' | 'admin' = 'user'): void {
    try {
      sessionStorage.setItem('tourTabAuthenticated', 'true');
      sessionStorage.setItem('tourRole', role);
    } catch {
      // Safe fallback if sessionStorage is unavailable in strict sandbox
    }

    // Graceful fade out and reveal the tour intro
    this.element.classList.add('auth-fade-out');

    setTimeout(() => {
      this.destroy();
      this.onSuccess(role);
    }, 500);
  }

  public destroy(): void {
    this.element.remove();
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

