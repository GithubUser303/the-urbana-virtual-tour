/**
 * The Urbana — Admin Access Modal.
 * Renders an architectural tinted-glass modal allowing administrators
 * to authenticate with username and password, bypassing TOTP and granting
 * a 4-hour session.
 */
export class AdminLoginModal {
  private static activeInstance: AdminLoginModal | null = null;
  private element: HTMLElement;
  private form!: HTMLFormElement;
  private usernameInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private errorElement!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private btnTextElement!: HTMLElement;
  private spinnerElement!: HTMLElement;
  private isSubmitting = false;
  private onSuccess: () => void;
  private onClose?: () => void;

  constructor(onSuccess: () => void, onClose?: () => void, initialMessage?: string) {
    if (AdminLoginModal.activeInstance) {
      AdminLoginModal.activeInstance.destroy();
    }
    AdminLoginModal.activeInstance = this;

    this.onSuccess = onSuccess;
    this.onClose = onClose;
    this.element = this.createElement();
    document.body.appendChild(this.element);

    if (initialMessage) {
      this.showError(initialMessage);
    }

    this.bindEvents();

    // Auto-focus username input on desktop
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (!isMobile) {
      setTimeout(() => {
        this.usernameInput.focus();
      }, 150);
    }
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'admin-login-modal';
    backdrop.className = 'admin-login-backdrop';

    const card = document.createElement('div');
    card.className = 'admin-login-card glass-panel';

    card.innerHTML = `
      <div class="auth-glow"></div>
      <button type="button" class="admin-modal-close-btn glass-interactive" aria-label="Close admin login">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="auth-header">
        <h1 class="auth-title project-font-branding">The Urbana</h1>
        <div class="auth-badge">ADMIN ACCESS</div>
        <p class="auth-instruction">Enter administrator credentials</p>
      </div>

      <form class="admin-login-form" autocomplete="on" novalidate>
        <div class="admin-field-group">
          <label for="admin-username-input" class="admin-field-label">Username</label>
          <div class="admin-input-wrapper">
            <input
              id="admin-username-input"
              type="text"
              name="username"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              class="admin-text-input"
              placeholder="Enter username"
            />
          </div>
        </div>

        <div class="admin-field-group">
          <label for="admin-password-input" class="admin-field-label">Password</label>
          <div class="admin-input-wrapper">
            <input
              id="admin-password-input"
              type="password"
              name="password"
              autocomplete="current-password"
              required
              class="admin-text-input"
              placeholder="Enter password"
            />
          </div>
        </div>

        <div class="admin-error-msg" aria-live="polite"></div>

        <button type="submit" class="admin-submit-btn glass-interactive" aria-label="Log in as Administrator">
          <span class="admin-btn-text">LOGIN</span>
          <div class="admin-btn-spinner" style="display: none;"></div>
        </button>
      </form>
    `;

    backdrop.appendChild(card);

    this.form = card.querySelector('.admin-login-form')!;
    this.usernameInput = card.querySelector('#admin-username-input')!;
    this.passwordInput = card.querySelector('#admin-password-input')!;
    this.errorElement = card.querySelector('.admin-error-msg')!;
    this.submitBtn = card.querySelector('.admin-submit-btn')!;
    this.btnTextElement = card.querySelector('.admin-btn-text')!;
    this.spinnerElement = card.querySelector('.admin-btn-spinner')!;

    return backdrop;
  }

  private bindEvents(): void {
    // Close button
    const closeBtn = this.element.querySelector('.admin-modal-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    // Backdrop click outside card closes modal
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    // Escape key closes modal
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', onKeydown);
    this.element.dataset.cleanupKey = 'true';

    // Clear error on input
    this.usernameInput.addEventListener('input', () => this.clearError());
    this.passwordInput.addEventListener('input', () => this.clearError());

    // Submit handler
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.isSubmitting) return;

      const username = this.usernameInput.value.trim();
      const password = this.passwordInput.value;

      if (!username) {
        this.showError('Please enter your administrator username.');
        this.usernameInput.focus();
        return;
      }
      if (!password) {
        this.showError('Please enter your password.');
        this.passwordInput.focus();
        return;
      }

      this.submitLogin(username, password);
    });
  }

  private async submitLogin(username: string, password: string): Promise<void> {
    this.isSubmitting = true;
    this.setLoading(true);
    this.clearError();

    const endpoint = '/api/auth/admin-login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      let data: any = null;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (response.ok && data?.success) {
        this.handleSuccess();
        return;
      }

      // Handle Rate Limit (429) or Bad Credentials (401)
      const errorMsg =
        data?.error ||
        (response.status === 429
          ? 'Too many failed login attempts. Please wait a moment.'
          : 'Invalid username or password.');

      this.showError(errorMsg);
      this.triggerCardShake();
      this.passwordInput.value = '';
      this.passwordInput.focus();
    } catch {
      this.showError('Unable to connect to authentication service. Please try again.');
      this.triggerCardShake();
    } finally {
      this.isSubmitting = false;
      this.setLoading(false);
    }
  }

  private handleSuccess(): void {
    try {
      sessionStorage.setItem('tourTabAuthenticated', 'true');
      sessionStorage.setItem('tourRole', 'admin');
    } catch {}

    this.element.classList.add('admin-modal-fade-out');

    setTimeout(() => {
      this.destroy();
      this.onSuccess();
    }, 400);
  }

  public close(): void {
    this.element.classList.add('admin-modal-fade-out');
    setTimeout(() => {
      this.destroy();
      if (this.onClose) {
        this.onClose();
      }
    }, 350);
  }

  public destroy(): void {
    if (AdminLoginModal.activeInstance === this) {
      AdminLoginModal.activeInstance = null;
    }
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
    const card = this.element.querySelector('.admin-login-card');
    if (card) {
      card.classList.remove('shake');
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

  public static open(
    onSuccess: () => void,
    onClose?: () => void,
    initialMessage?: string
  ): AdminLoginModal {
    return new AdminLoginModal(onSuccess, onClose, initialMessage);
  }
}
