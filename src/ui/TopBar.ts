import { TourState } from '../state/TourState';

export class TopBar {
  private element: HTMLElement;
  private tourState: TourState;

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

    // Right button: Gallery
    const galleryBtn = document.createElement('button');
    galleryBtn.className = 'nav-action-btn glass-interactive';
    galleryBtn.textContent = 'Gallery';
    galleryBtn.setAttribute('aria-label', 'Open photo gallery');
    galleryBtn.addEventListener('click', () => {
      this.tourState.openGallery();
    });

    nav.appendChild(contactBtn);
    nav.appendChild(brand);
    nav.appendChild(galleryBtn);

    return nav;
  }
}
