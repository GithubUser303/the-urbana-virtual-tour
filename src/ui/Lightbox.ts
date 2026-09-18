import { GalleryItem } from '../config/types';
import { TourState } from '../state/TourState';

export class Lightbox {
  private element: HTMLElement;
  private tourState: TourState;
  private imgElement!: HTMLImageElement;
  private counterElement!: HTMLElement;
  private captionElement!: HTMLElement;
  private titleElement!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private currentItem: GalleryItem | null = null;
  private currentIndex = 0;
  private isOpen = false;

  // Touch swipe tracking
  private touchStartX = 0;
  private touchStartY = 0;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('gallerySelect', (state) => {
      if (state.selectedGalleryItemId) {
        this.loadItem(state.selectedGalleryItemId, state.selectedPhotoIndex);
      }
    });

    this.tourState.on('modalChange', (state) => {
      if (state.activeModal === 'lightbox') {
        this.show();
      } else if (this.isOpen) {
        this.hide();
      }
    });

    this.initKeyboardAndTouch();
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'lightbox-modal';
    backdrop.className = 'lightbox-modal';
    backdrop.style.display = 'none';

    // Header info & close
    const header = document.createElement('div');
    header.className = 'lightbox-header glass-panel';

    this.titleElement = document.createElement('span');
    this.titleElement.className = 'lightbox-title';

    this.counterElement = document.createElement('span');
    this.counterElement.className = 'lightbox-counter';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close-btn glass-interactive';
    closeBtn.setAttribute('aria-label', 'Close slideshow');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => {
      this.tourState.openGallery(); // return to scattered gallery
    });

    header.appendChild(this.titleElement);
    header.appendChild(this.counterElement);
    header.appendChild(closeBtn);

    // Main image stage
    const stage = document.createElement('div');
    stage.className = 'lightbox-stage';

    this.imgElement = document.createElement('img');
    this.imgElement.className = 'lightbox-img';
    this.imgElement.alt = 'High-resolution property view';

    // Prev / Next arrow buttons
    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'lightbox-arrow-btn prev glass-panel glass-interactive';
    this.prevBtn.setAttribute('aria-label', 'Previous photo');
    this.prevBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    this.prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prev();
    });

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'lightbox-arrow-btn next glass-panel glass-interactive';
    this.nextBtn.setAttribute('aria-label', 'Next photo');
    this.nextBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    this.nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.next();
    });

    stage.appendChild(this.prevBtn);
    stage.appendChild(this.imgElement);
    stage.appendChild(this.nextBtn);

    // Caption footer
    this.captionElement = document.createElement('div');
    this.captionElement.className = 'lightbox-caption glass-panel';

    backdrop.appendChild(header);
    backdrop.appendChild(stage);
    backdrop.appendChild(this.captionElement);

    // Click on stage outside image closes or advances
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target === stage) {
        this.tourState.openGallery();
      }
    });

    return backdrop;
  }

  private initKeyboardAndTouch(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'ArrowLeft') {
        this.prev();
      } else if (e.key === 'ArrowRight') {
        this.next();
      } else if (e.key === 'Escape') {
        this.tourState.openGallery();
      }
    });

    // Touch swipe gestures
    this.element.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    this.element.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length === 1) {
          const deltaX = e.changedTouches[0].clientX - this.touchStartX;
          const deltaY = e.changedTouches[0].clientY - this.touchStartY;

          // Horizontal swipe detection
          if (Math.abs(deltaX) > 40 && Math.abs(deltaY) < 60) {
            if (deltaX < 0) {
              this.next();
            } else {
              this.prev();
            }
          }
        }
      },
      { passive: true }
    );
  }

  public loadItem(itemId: string, photoIndex = 0): void {
    const item = this.tourState.getConfig().gallery.find((g) => g.id === itemId);
    if (!item || item.photos.length === 0) return;

    this.currentItem = item;
    this.currentIndex = Math.max(0, Math.min(item.photos.length - 1, photoIndex));
    this.renderCurrentPhoto();
  }

  private renderCurrentPhoto(): void {
    if (!this.currentItem) return;

    const photo = this.currentItem.photos[this.currentIndex];
    const total = this.currentItem.photos.length;

    this.titleElement.textContent = this.currentItem.title;
    this.counterElement.textContent = total > 1 ? `${this.currentIndex + 1} / ${total}` : '';
    this.captionElement.textContent = photo.caption || this.currentItem.title;

    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.style.display = total > 1 ? 'flex' : 'none';
      this.nextBtn.style.display = total > 1 ? 'flex' : 'none';
    }

    // Smooth image crossfade
    this.imgElement.style.opacity = '0';
    this.imgElement.style.transform = 'scale(0.97)';

    const newImg = new Image();
    newImg.src = photo.url;
    newImg.onload = () => {
      this.imgElement.src = photo.url;
      this.imgElement.style.opacity = '1';
      this.imgElement.style.transform = 'scale(1)';
    };
  }

  public next(): void {
    if (!this.currentItem || this.currentItem.photos.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.currentItem.photos.length;
    this.tourState.setLightboxPhotoIndex(this.currentIndex);
    this.renderCurrentPhoto();
  }

  public prev(): void {
    if (!this.currentItem || this.currentItem.photos.length <= 1) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.currentItem.photos.length) % this.currentItem.photos.length;
    this.tourState.setLightboxPhotoIndex(this.currentIndex);
    this.renderCurrentPhoto();
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
    }, 400);
  }
}

