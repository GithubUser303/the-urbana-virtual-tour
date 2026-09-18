import { GalleryItem } from '../config/types';
import { TourState } from '../state/TourState';

export class ScatteredGallery {
  private element: HTMLElement;
  private tourState: TourState;
  private itemsContainer!: HTMLElement;
  private cardElements: Map<string, HTMLElement> = new Map();
  private isOpen = false;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('modalChange', (state) => {
      if (state.activeModal === 'gallery') {
        this.open();
      } else if (this.isOpen && state.activeModal !== 'lightbox') {
        this.close();
      }
    });

    // Keyboard ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen && this.tourState.getState().activeModal === 'gallery') {
        this.tourState.closeModal();
      }
    });
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'scattered-gallery-modal';
    backdrop.className = 'scattered-gallery-modal';
    backdrop.style.display = 'none';

    // Dismiss when clicking outer backdrop
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.tourState.closeModal();
      }
    });

    // Header with title and close button
    const header = document.createElement('div');
    header.className = 'gallery-modal-header glass-panel';

    const title = document.createElement('h2');
    title.className = 'gallery-modal-title project-font-branding';
    title.textContent = 'Gallery Collection';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'gallery-close-btn glass-interactive';
    closeBtn.setAttribute('aria-label', 'Close gallery');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tourState.closeModal();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    backdrop.appendChild(header);

    // Scattered stage
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'gallery-scatter-stage';
    backdrop.appendChild(this.itemsContainer);

    // Build cards from configuration
    const galleryItems = this.tourState.getConfig().gallery;
    galleryItems.forEach((item, index) => {
      const card = this.createCard(item, index);
      this.itemsContainer.appendChild(card);
      this.cardElements.set(item.id, card);
    });

    return backdrop;
  }

  private createCard(item: GalleryItem, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'scatter-card glass-panel glass-interactive';
    card.setAttribute('data-id', item.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `View photos of ${item.title}`);

    // Set custom CSS variables for scatter animation and organic wind sway
    const p = item.scatterPreset;
    card.style.setProperty('--scatter-x', `${p.x}vw`);
    card.style.setProperty('--scatter-y', `${p.y}vh`);
    card.style.setProperty('--base-rot', `${p.rotate}deg`);
    card.style.setProperty('--card-w', `${p.width}px`);
    card.style.setProperty('--card-h', `${p.height}px`);
    card.style.setProperty('--z-index', `${p.zIndex}`);
    card.style.setProperty('--wind-period', `${p.windPeriod}s`);
    card.style.setProperty('--wind-phase', `${p.windPhase}rad`);
    card.style.setProperty('--stagger-delay', `${index * 80}ms`);

    // Dedicated mobile landscape presets: 2-row organic staggered layout
    const mobilePresets: Record<string, { x: number; y: number; rotate: number; width: string; height: string; zIndex: number }> = {
      living: {
        x: -27,
        y: -12,
        rotate: -1.6,
        width: 'clamp(115px, 15.5vw, 142px)',
        height: 'clamp(80px, 21.5vh, 98px)',
        zIndex: 4
      },
      master: {
        x: 0,
        y: -14,
        rotate: 1.2,
        width: 'clamp(120px, 16vw, 148px)',
        height: 'clamp(82px, 22vh, 102px)',
        zIndex: 5
      },
      guest: {
        x: 27,
        y: -11,
        rotate: -1.4,
        width: 'clamp(115px, 15.5vw, 142px)',
        height: 'clamp(80px, 21.5vh, 98px)',
        zIndex: 4
      },
      dining: {
        x: -28,
        y: 15,
        rotate: 1.4,
        width: 'clamp(112px, 15vw, 140px)',
        height: 'clamp(78px, 21vh, 96px)',
        zIndex: 3
      },
      kitchen: {
        x: -1,
        y: 17,
        rotate: -1.2,
        width: 'clamp(118px, 15.8vw, 145px)',
        height: 'clamp(80px, 21.5vh, 98px)',
        zIndex: 4
      },
      bathroom: {
        x: 27,
        y: 14,
        rotate: 1.8,
        width: 'clamp(110px, 14.5vw, 136px)',
        height: 'clamp(76px, 20.5vh, 94px)',
        zIndex: 2
      }
    };

    const mp = mobilePresets[item.id] || {
      x: p.x * 0.7,
      y: p.y * 0.7,
      rotate: p.rotate * 0.5,
      width: '130px',
      height: '90px',
      zIndex: p.zIndex
    };

    card.style.setProperty('--m-scatter-x', `${mp.x}vw`);
    card.style.setProperty('--m-scatter-y', `${mp.y}vh`);
    card.style.setProperty('--m-rot', `${mp.rotate}deg`);
    card.style.setProperty('--m-card-w', mp.width);
    card.style.setProperty('--m-card-h', mp.height);
    card.style.setProperty('--m-z-index', `${mp.zIndex}`);

    // Card visual content
    if (item.isPlaceholder || item.photos.length === 0) {
      // Graceful placeholder for Guest Bedroom (Section 4A & 23)
      const placeholderContent = document.createElement('div');
      placeholderContent.className = 'scatter-card-placeholder';
      placeholderContent.innerHTML = `
        <div class="placeholder-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        <span class="placeholder-title">${item.title}</span>
        <span class="placeholder-sub">Photograph to be supplied</span>
      `;
      card.appendChild(placeholderContent);
    } else {
      const img = document.createElement('img');
      const thumbUrl = item.photos[0].thumbnailUrl || item.photos[0].url;
      img.dataset.src = thumbUrl;
      img.alt = item.title;
      img.className = 'scatter-card-img';

      const infoPill = document.createElement('div');
      infoPill.className = 'scatter-card-info';

      const title = document.createElement('span');
      title.className = 'scatter-card-title';
      title.textContent = item.title;

      infoPill.appendChild(title);

      if (item.photos.length > 1) {
        const countBadge = document.createElement('span');
        countBadge.className = 'scatter-card-badge';
        countBadge.textContent = `${item.photos.length} photos`;
        infoPill.appendChild(countBadge);
      }

      card.appendChild(img);
      card.appendChild(infoPill);
    }

    // Click handler to launch slideshow
    const activate = () => {
      if (!item.isPlaceholder && item.photos.length > 0) {
        this.tourState.openLightbox(item.id, 0);
      }
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        activate();
      }
    });

    return card;
  }

  public open(): void {
    this.isOpen = true;
    this.element.style.display = 'flex';

    // On-demand lazy load thumbnail assets only when gallery is opened
    const pendingImages = this.itemsContainer.querySelectorAll<HTMLImageElement>('img[data-src]');
    pendingImages.forEach((img) => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    });

    requestAnimationFrame(() => {
      this.element.classList.add('active');
    });
  }

  public close(): void {
    this.isOpen = false;
    this.element.classList.remove('active');
    setTimeout(() => {
      if (!this.isOpen) {
        this.element.style.display = 'none';
      }
    }, 500);
  }
}
