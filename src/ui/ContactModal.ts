import { TourState } from '../state/TourState';

export class ContactModal {
  private element: HTMLElement;
  private tourState: TourState;
  private isOpen = false;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('modalChange', (state) => {
      if (state.activeModal === 'contact') {
        this.show();
      } else if (this.isOpen) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.tourState.closeModal();
      }
    });
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'contact-modal-backdrop';
    backdrop.className = 'modal-backdrop contact-backdrop';
    backdrop.style.display = 'none';

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.tourState.closeModal();
      }
    });

    const modal = document.createElement('div');
    modal.className = 'contact-modal-card glass-panel';

    const header = document.createElement('div');
    header.className = 'modal-card-header';

    const title = document.createElement('h3');
    title.className = 'modal-card-title';
    title.textContent = 'Contact Concierge';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-card-close glass-interactive';
    closeBtn.setAttribute('aria-label', 'Close contact modal');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => {
      this.tourState.closeModal();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-card-body';

    const contact = this.tourState.getConfig().contact;

    body.innerHTML = `
      <div class="contact-brand-row">
        <span class="contact-company">${contact.company}</span>
        <span class="contact-project-tag">the Urbana</span>
      </div>

      <div class="contact-items">
        <div class="contact-item">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div class="contact-details">
            <span class="contact-label">Direct Inquiries</span>
            <a href="mailto:${contact.email}" class="contact-val email-link">${contact.email}</a>
          </div>
        </div>

        <div class="contact-item">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <div class="contact-details">
            <span class="contact-label">Private Client Advisory</span>
            <a href="tel:${contact.phone}" class="contact-val phone-link">${contact.phone}</a>
          </div>
        </div>

        <div class="contact-item">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div class="contact-details">
            <span class="contact-label">Development Address</span>
            <span class="contact-val">${contact.address || 'Architectural District'}</span>
          </div>
        </div>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    return backdrop;
  }

  public show(): void {
    this.isOpen = true;
    this.element.style.display = 'flex';
    requestAnimationFrame(() => {
      this.element.classList.add('active');
    });
  }

  public hide(): void {
    this.isOpen = false;
    this.element.classList.remove('active');
    setTimeout(() => {
      if (!this.isOpen) {
        this.element.style.display = 'none';
      }
    }, 350);
  }
}

