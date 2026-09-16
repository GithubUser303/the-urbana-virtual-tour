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
  private startThumbX = 0;
  private currentThumbX = 0;
  private trackWidth = 0;
  private itemWidths: number[] = [];
  private snapPoints: number[] = [];
  private candidateIndex = 0;

  constructor() {
    this.tourState = TourState.get();

    // Create DOM hierarchy
    this.container = document.createElement('div');
    this.container.className = 'iphone-slider-wrapper';

    this.track = document.createElement('nav');
    this.track.className = 'iphone-slider-track glass-panel';
    this.track.setAttribute('aria-label', 'Page navigation slider');

    // Draggable Glass Lens Thumb (Minimalist, Transparent)
    this.thumb = document.createElement('div');
    this.thumb.className = 'iphone-slider-thumb';
    this.thumb.innerHTML = `<div class="iphone-lens-specular"></div>`;

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

    // Separator before location
    const divider = document.createElement('div');
    divider.className = 'iphone-slider-divider';
    this.itemsContainer.appendChild(divider);

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

    // Compute geometry on layout readiness & resize
    requestAnimationFrame(() => {
      this.recalculateSnapPoints();
      this.snapToIndex(0, false);
    });

    window.addEventListener('resize', () => {
      this.recalculateSnapPoints();
      this.snapToIndex(this.activeIndex, false);
    });
  }

  private recalculateSnapPoints(): void {
    const trackRect = this.track.getBoundingClientRect();
    this.trackWidth = trackRect.width;

    this.snapPoints = [];
    this.itemWidths = [];

    this.itemElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const relativeCenter = rect.left - trackRect.left + rect.width / 2;
      this.snapPoints.push(relativeCenter);
      this.itemWidths.push(rect.width);
    });

    // Size the thumb to match the active item
    if (this.itemWidths[this.activeIndex]) {
      const w = Math.max(this.itemWidths[this.activeIndex] + 8, 48);
      this.thumb.style.width = `${w}px`;
    }
  }

  private initDragHandlers(): void {
    const onPointerDown = (e: PointerEvent) => {
      // Ignore right click
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      // Do not initiate slider drag if interacting with the map button or divider
      const target = e.target as HTMLElement | null;
      if (target?.closest('.iphone-location-btn, .iphone-slider-divider')) {
        return;
      }

      this.isDragging = true;
      this.startPointerX = e.clientX;
      this.startThumbX = this.currentThumbX;
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
      let targetX = this.startThumbX + deltaX;

      // Strict constraints: cannot drag further left than Living Room (index 0)
      // or further right than Bathroom (last room index)
      const minX = this.snapPoints[0] ?? 30;
      const maxX = this.snapPoints[this.snapPoints.length - 1] ?? (this.trackWidth - 30);

      // Clamp strictly to [minX, maxX]
      targetX = Math.max(minX, Math.min(maxX, targetX));

      this.currentThumbX = targetX;
      this.updateThumbPosition(targetX, false);

      // Find nearest snap point candidate as thumb glides
      let closestIdx = 0;
      let minDistance = Infinity;

      this.snapPoints.forEach((pt, i) => {
        const dist = Math.abs(pt - targetX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });

      if (closestIdx !== this.candidateIndex) {
        this.candidateIndex = closestIdx;
        this.highlightCandidate(closestIdx);
      }
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

  private updateThumbPosition(centerX: number, animated = true): void {
    if (animated) {
      this.thumb.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25), width 0.3s ease';
    } else {
      this.thumb.style.transition = 'none';
    }
    this.thumb.style.transform = `translateX(${centerX}px) translateX(-50%)`;
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

    if (this.snapPoints.length === 0) {
      this.recalculateSnapPoints();
    }

    const snapX = this.snapPoints[index] ?? 40;
    this.currentThumbX = snapX;

    // Adjust thumb width to match item snugly
    const itemWidth = this.itemWidths[index] ?? 48;
    this.thumb.style.width = `${Math.max(itemWidth + 10, 52)}px`;

    this.updateThumbPosition(snapX, true);

    // Update active class on items
    this.itemElements.forEach((el, i) => {
      el.classList.remove('candidate');
      if (i === index) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // ONLY load the page at the current snap position when requested
    if (notifyState) {
      const selectedItem = this.items[index];
      if (selectedItem && selectedItem.type === 'room') {
        this.tourState.setRoom(selectedItem.id);
      }
    }
  }
}

