import { TourState } from '../state/TourState';

interface SliderItemData {
  id: string;
  name: string;
  shortName: string;
  iconSvg: string;
  type: 'room' | 'action';
}

export class iPhoneSliderNav {
  private container: HTMLElement;
  private track: HTMLElement;
  private thumb: HTMLElement;
  private itemsContainer: HTMLElement;
  private tourState: TourState;

  private items: SliderItemData[] = [
    {
      id: 'living',
      name: 'Living Room',
      shortName: 'Living',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 11v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>
          <path d="M6 18v2M18 18v2"/>
          <path d="M3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3v-2z"/>
          <path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>
        </svg>
      `
    },
    {
      id: 'dining',
      name: 'Dining Room',
      shortName: 'Dining',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      `
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      shortName: 'Kitchen',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
          <circle cx="8" cy="9" r="2.5"/>
          <circle cx="16" cy="9" r="2.5"/>
          <path d="M6 16h12"/>
        </svg>
      `
    },
    {
      id: 'master',
      name: 'Master Bedroom',
      shortName: 'Master',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 4v16"/>
          <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
          <path d="M2 17h20"/>
          <path d="M6 8v4h5V8"/>
          <path d="M13 8v4h5V8"/>
        </svg>
      `
    },
    {
      id: 'guest',
      name: 'Guest Bedroom',
      shortName: 'Guest',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 4v16"/>
          <path d="M2 9h18a2 2 0 0 1 2 2v9"/>
          <path d="M2 17h20"/>
          <path d="M6 9v3h6V9"/>
        </svg>
      `
    },
    {
      id: 'bathroom',
      name: 'Bathroom',
      shortName: 'Bath',
      type: 'room',
      iconSvg: `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h7a4 4 0 0 1 4 4v12"/>
          <path d="M11 13l4-3 4 3"/>
          <circle cx="12" cy="18" r="1"/>
          <circle cx="15" cy="18" r="1"/>
          <circle cx="18" cy="18" r="1"/>
        </svg>
      `
    }
  ];

  private itemElements: HTMLElement[] = [];
  private activeIndex = 0;
  private isDragging = false;
  private startPointerX = 0;
  private startThumbLeft = 0;
  private currentThumbLeft = 0;
  private candidateIndex = 0;
  private resizeObserver?: ResizeObserver;

  constructor() {
    this.tourState = TourState.get();

    // Create DOM hierarchy
    this.container = document.createElement('div');
    this.container.className = 'iphone-slider-wrapper';

    this.track = document.createElement('nav');
    this.track.className = 'iphone-slider-track glass-panel';
    this.track.setAttribute('aria-label', 'Page navigation slider');

    // Draggable Glass Lens Thumb (Clean, seamless highlight)
    this.thumb = document.createElement('div');
    this.thumb.className = 'iphone-slider-thumb';

    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'iphone-slider-items';

    // Populate room items
    this.items.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.className = `iphone-slider-item ${index === 0 ? 'active' : ''}`;
      btn.setAttribute('data-id', item.id);
      btn.setAttribute('data-index', String(index));
      btn.setAttribute('aria-label', item.name);

      btn.innerHTML = `
        <span class="iphone-slider-icon">${item.iconSvg}</span>
        <span class="iphone-slider-label">${item.shortName}</span>
      `;

      // Direct click / tap immediately snaps to page
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.snapToIndex(index, true);
      });

      this.itemsContainer.appendChild(btn);
      this.itemElements.push(btn);
    });

    // Location button matching reference design
    const locationBtn = document.createElement('button');
    locationBtn.className = 'iphone-slider-item iphone-location-btn glass-interactive';
    locationBtn.setAttribute('aria-label', 'Open Property Location');
    locationBtn.innerHTML = `
      <span class="iphone-slider-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </span>
      <span class="iphone-slider-label">Map</span>
    `;

    const openMapModal = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      this.tourState.openModal('location');
    };

    locationBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    locationBtn.addEventListener('click', openMapModal);
    locationBtn.addEventListener('touchend', openMapModal);
    this.itemsContainer.appendChild(locationBtn);

    // Assemble track
    this.track.appendChild(this.thumb);
    this.track.appendChild(this.itemsContainer);

    // Credits directly underneath
    const credits = document.createElement('div');
    credits.className = 'credits-text';
    credits.textContent = 'Experience by Lost in Renders';

    this.container.appendChild(this.track);
    this.container.appendChild(credits);
    document.body.appendChild(this.container);

    // Bind Drag & Touch interactions
    this.initDragHandlers();

    // Listen to TourState room changes (e.g. from FloorPlan or initial load)
    this.tourState.on('roomChange', (state) => {
      const idx = this.items.findIndex((it) => it.id === state.currentRoomId);
      if (idx !== -1 && idx !== this.activeIndex && !this.isDragging) {
        this.snapToIndex(idx, false);
      }
    });

    // Listen to UI visibility toggle (cinematic mode)
    this.tourState.on('uiVisibilityChange', (state) => {
      if (state.isUiHidden) {
        this.container.classList.add('ui-hidden');
      } else {
        this.container.classList.remove('ui-hidden');
      }
    });

    // Real-time responsive layout tracking
    this.initResponsiveObservers();
  }

  private initResponsiveObservers(): void {
    const realign = () => {
      if (!this.isDragging) {
        this.realignActiveThumb(false);
      }
    };

    // 1. Check layout once fonts are loaded
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(realign);
      });
    }

    // 2. Continuous ResizeObserver on track container
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        realign();
      });
      this.resizeObserver.observe(this.track);
    }

    // 3. Window resize and orientation changes
    window.addEventListener('resize', realign);
    window.addEventListener('orientationchange', realign);

    // Initial frame alignment
    requestAnimationFrame(() => {
      this.realignActiveThumb(false);
    });
  }

  /**
   * Re-aligns the thumb to the current active item based on live DOM coordinates
   */
  private realignActiveThumb(animated = false): void {
    const targetEl = this.itemElements[this.activeIndex];
    if (!targetEl) return;

    const trackRect = this.track.getBoundingClientRect();
    const itemRect = targetEl.getBoundingClientRect();

    if (trackRect.width === 0 || itemRect.width === 0) return;

    const targetLeft = itemRect.left - trackRect.left;
    const targetWidth = itemRect.width;

    this.currentThumbLeft = targetLeft;
    this.setThumbGeometry(targetLeft, targetWidth, animated);
  }

  private setThumbGeometry(left: number, width: number, animated = true): void {
    if (animated) {
      this.thumb.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25), width 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.25)';
    } else {
      this.thumb.style.transition = 'none';
    }
    this.thumb.style.width = `${width}px`;
    this.thumb.style.transform = `translateX(${left}px)`;
  }

  private getItemBounds(): { minLeft: number; maxLeft: number; centers: number[]; widths: number[] } {
    const trackRect = this.track.getBoundingClientRect();
    const centers: number[] = [];
    const widths: number[] = [];
    let minLeft = 0;
    let maxLeft = 0;

    this.itemElements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const left = rect.left - trackRect.left;
      const center = left + rect.width / 2;
      centers.push(center);
      widths.push(rect.width);

      if (i === 0) {
        minLeft = left;
      }
      // Constraint: bathroom is index 5 (last room)
      if (i === this.itemElements.length - 1) {
        maxLeft = left;
      }
    });

    return { minLeft, maxLeft, centers, widths };
  }

  private initDragHandlers(): void {
    let bounds = this.getItemBounds();

    const onPointerDown = (e: PointerEvent) => {
      // Ignore non-primary click
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      // Do not initiate slider drag if interacting with the map button
      const target = e.target as HTMLElement | null;
      if (target?.closest('.iphone-location-btn')) {
        return;
      }

      bounds = this.getItemBounds();
      this.isDragging = true;
      this.startPointerX = e.clientX;
      this.startThumbLeft = this.currentThumbLeft;
      this.candidateIndex = this.activeIndex;

      this.thumb.classList.add('dragging');
      this.track.classList.add('dragging');

      try {
        this.track.setPointerCapture(e.pointerId);
      } catch (_) {}

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.startPointerX;
      let targetLeft = this.startThumbLeft + deltaX;

      // Strict constraints: cannot drag further left than Living Room (index 0)
      // or further right than Bathroom (index 5)
      targetLeft = Math.max(bounds.minLeft, Math.min(bounds.maxLeft, targetLeft));
      this.currentThumbLeft = targetLeft;

      // Calculate center of thumb at current position
      const activeWidth = bounds.widths[this.candidateIndex] || 48;
      const thumbCenter = targetLeft + activeWidth / 2;

      // Find nearest snap candidate
      let closestIdx = 0;
      let minDistance = Infinity;

      bounds.centers.forEach((center, i) => {
        const dist = Math.abs(center - thumbCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });

      if (closestIdx !== this.candidateIndex) {
        this.candidateIndex = closestIdx;
        this.highlightCandidate(closestIdx);
      }

      // Smoothly interpolate thumb width to match current candidate item snugly
      const candidateWidth = bounds.widths[closestIdx] || 48;
      this.setThumbGeometry(targetLeft, candidateWidth, false);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      this.thumb.classList.remove('dragging');
      this.track.classList.remove('dragging');

      try {
        this.track.releasePointerCapture(e.pointerId);
      } catch (_) {}

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      // Snap cleanly to the nearest defined page position
      this.snapToIndex(this.candidateIndex, true);
    };

    this.track.addEventListener('pointerdown', onPointerDown);
  }

  private highlightCandidate(index: number): void {
    this.itemElements.forEach((el, i) => {
      if (i === index) {
        el.classList.add('candidate');
      } else {
        el.classList.remove('candidate');
      }
    });
  }

  public snapToIndex(index: number, notifyState = true): void {
    if (index < 0 || index >= this.items.length) return;

    this.activeIndex = index;
    this.candidateIndex = index;

    // Update active class on items
    this.itemElements.forEach((el, i) => {
      el.classList.remove('candidate');
      if (i === index) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Re-align thumb smoothly to live position of the activated element
    requestAnimationFrame(() => {
      this.realignActiveThumb(true);
    });

    // ONLY load the page at the current snap position when requested
    if (notifyState) {
      const selectedItem = this.items[index];
      if (selectedItem && selectedItem.type === 'room') {
        this.tourState.setRoom(selectedItem.id);
      }
    }
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
