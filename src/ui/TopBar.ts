import { TourState } from '../state/TourState';
import { AdminLoginModal } from './AdminLoginModal';

export class TopBar {
  private element: HTMLElement;
  private tourState: TourState;
  private adminBtn!: HTMLButtonElement;
  private adminBadge!: HTMLElement;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('uiVisibilityChange', (state) => {
      if (state.isUiHidden) {
        this.element.classList.add('ui-hidden-top');
      } else {
        this.element.classList.remove('ui-hidden-top');
      }
    });

    this.tourState.on('authRoleChange', () => {
      this.updateAdminControl();
    });

    this.updateAdminControl();
  }

  private updateAdminControl(): void {
    const isAdmin = this.tourState.getRole() === 'admin';
    if (isAdmin) {
      this.adminBtn.style.display = 'none';
      this.adminBadge.style.display = 'inline-flex';
    } else {
      this.adminBtn.style.display = 'inline-flex';
      this.adminBadge.style.display = 'none';
    }
  }

  private createElement(): HTMLElement {
    const nav = document.createElement('header');
    nav.id = 'top-bar';
    nav.className = 'top-bar glass-panel';

    // Left button: Contact Us
    const contactBtn = document.createElement('button');
    contactBtn.className = 'nav-action-btn glass-interactive';
    contactBtn.textContent = 'Contact Us';
    contactBtn.setAttribute('aria-label', 'Open contact information');
    contactBtn.addEventListener('click', () => {
      this.tourState.openModal('contact');
    });

    // Center brand: The Urbana
    const brand = document.createElement('div');
    brand.className = 'top-brand project-font-branding';
    brand.textContent = this.tourState.getConfig().projectName; // "The Urbana"

    // Right group: Gallery + Admin Login / Admin Badge
    const rightGroup = document.createElement('div');
    rightGroup.className = 'top-bar-right-group';

    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'nav-action-btn glass-interactive';
    galleryBtn.textContent = 'Gallery';
    galleryBtn.setAttribute('aria-label', 'Open photo gallery');
    galleryBtn.addEventListener('click', () => {
      this.tourState.openGallery();
    });

    this.adminBtn = document.createElement('button');
    this.adminBtn.className = 'nav-action-btn nav-admin-btn glass-interactive';
    this.adminBtn.textContent = 'Admin Login';
    this.adminBtn.setAttribute('aria-label', 'Open administrator login');
    this.adminBtn.addEventListener('click', () => {
      AdminLoginModal.open(() => {
        this.tourState.setRole('admin');
      });
    });

    this.adminBadge = document.createElement('span');
    this.adminBadge.className = 'top-bar-admin-badge';
    this.adminBadge.textContent = 'ADMIN';
    this.adminBadge.style.display = 'none';

    rightGroup.appendChild(galleryBtn);
    rightGroup.appendChild(this.adminBtn);
    rightGroup.appendChild(this.adminBadge);

    nav.appendChild(contactBtn);
    nav.appendChild(brand);
    nav.appendChild(rightGroup);

    return nav;
  }
}
