import * as THREE from 'three';
import { TourState } from '../state/TourState';

export interface CameraControlOptions {
  dampingFactor?: number;
  autoRotateSpeed?: number;
  autoRotateInactivityDelay?: number;
  minPitch?: number;
  maxPitch?: number;
  minFov?: number;
  maxFov?: number;
}

export class CameraControl {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private tourState: TourState;

  // Spherical coordinates (degrees)
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;

  // FOV
  private targetFov = 75;
  private currentFov = 75;

  // Centralized Configurable Zoom Limits (Section 8)
  public static readonly DEFAULT_MIN_FOV = 52; // Max zoom-in boundary (prevents image pixelation)
  public static readonly DEFAULT_MAX_FOV = 88; // Max zoom-out boundary (prevents fish-eye)

  // Damping & options
  private dampingFactor = 0.08;
  private autoRotateSpeed = -0.015; // subtle slow rotation
  private autoRotateInactivityDelay = 3500; // ms
  private lastInteractionTime = Date.now();
  private isAutoRotateEnabled = true;

  // Limits
  private minPitch = -85;
  private maxPitch = 85;
  private minFov = CameraControl.DEFAULT_MIN_FOV;
  private maxFov = CameraControl.DEFAULT_MAX_FOV;

  // Drag interaction state
  private isDragging = false;
  private isTouchDrag = false;
  private activePointerId: number | null = null;
  private isPinching = false;
  private previousMousePosition = { x: 0, y: 0 };
  private touchStartDistance = 0;
  private touchStartFov = 75;

  // Velocity & tuned inertia tracking for responsive touch
  private velocityX = 0;
  private velocityY = 0;
  private inertiaVx = 0;
  private inertiaVy = 0;
  private lastMoveTime = 0;
  private isAndroid = false;
  private isIOS = false;

  // Bound event handlers for clean lifecycle and pointer capture
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onPointerCancelBound: (e: PointerEvent) => void;
  private onLostPointerCaptureBound: (e: PointerEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onTouchStartBound: (e: TouchEvent) => void;
  private onTouchMoveBound: (e: TouchEvent) => void;
  private onTouchEndBound: (e: TouchEvent) => void;

  // Smooth room transition orientation lerp
  private isTransitioning = false;
  private transitionStartTime = 0;
  private transitionDuration = 1000;
  private transitionFromYaw = 0;
  private transitionFromPitch = 0;
  private transitionToYaw = 0;
  private transitionToPitch = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, options?: CameraControlOptions) {
    this.camera = camera;
    this.domElement = domElement;
    this.tourState = TourState.get();

    // Enforce touch-action none on the container to prevent Android Chrome scroll interruption
    this.domElement.style.touchAction = 'none';
    this.domElement.style.userSelect = 'none';
    (this.domElement.style as any).webkitUserSelect = 'none';
    (this.domElement.style as any).webkitTouchCallout = 'none';

    if (options) {
      if (options.dampingFactor !== undefined) this.dampingFactor = options.dampingFactor;
      if (options.autoRotateSpeed !== undefined) this.autoRotateSpeed = options.autoRotateSpeed;
      if (options.autoRotateInactivityDelay !== undefined) this.autoRotateInactivityDelay = options.autoRotateInactivityDelay;
      if (options.minPitch !== undefined) this.minPitch = options.minPitch;
      if (options.maxPitch !== undefined) this.maxPitch = options.maxPitch;
      if (options.minFov !== undefined) this.minFov = options.minFov;
      if (options.maxFov !== undefined) this.maxFov = options.maxFov;
    }

    // Platform detection for mobile touch sensitivity tuning
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      this.isAndroid = /Android/i.test(ua);
      this.isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    // Bind event handler references once
    this.onPointerDownBound = this.onPointerDown.bind(this);
    this.onPointerMoveBound = this.onPointerMove.bind(this);
    this.onPointerUpBound = this.onPointerUp.bind(this);
    this.onPointerCancelBound = this.onPointerCancel.bind(this);
    this.onLostPointerCaptureBound = this.onLostPointerCapture.bind(this);
    this.onWheelBound = this.onWheel.bind(this);
    this.onTouchStartBound = this.onTouchStart.bind(this);
    this.onTouchMoveBound = this.onTouchMove.bind(this);
    this.onTouchEndBound = this.onTouchEnd.bind(this);

    this.initEvents();
  }

  public setOrientation(yaw: number, pitch: number, fov?: number, immediate = false): void {
    if (immediate) {
      this.currentYaw = yaw;
      this.targetYaw = yaw;
      this.currentPitch = pitch;
      this.targetPitch = pitch;
      if (fov !== undefined) {
        this.currentFov = fov;
        this.targetFov = fov;
      }
      this.isTransitioning = false;
    } else {
      // Smooth cinematic camera transition
      this.isTransitioning = true;
      this.transitionStartTime = performance.now();
      this.transitionFromYaw = this.currentYaw;
      this.transitionFromPitch = this.currentPitch;
      
      // Calculate shortest angle path for yaw
      let deltaYaw = ((yaw - this.currentYaw + 180) % 360) - 180;
      if (deltaYaw < -180) deltaYaw += 360;
      this.transitionToYaw = this.currentYaw + deltaYaw;
      this.transitionToPitch = Math.max(this.minPitch, Math.min(this.maxPitch, pitch));

      if (fov !== undefined) {
        this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, fov));
      }
    }
  }

  private initEvents(): void {
    const el = this.domElement;

    // Pointer events for unified mouse and single touch dragging
    el.addEventListener('pointerdown', this.onPointerDownBound, { passive: false });
    window.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerCancelBound);
    el.addEventListener('lostpointercapture', this.onLostPointerCaptureBound);

    // Wheel zoom
    el.addEventListener('wheel', this.onWheelBound, { passive: false });

    // Touch pinch-to-zoom (two fingers)
    el.addEventListener('touchstart', this.onTouchStartBound, { passive: false });
    el.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    el.addEventListener('touchend', this.onTouchEndBound, { passive: true });
    el.addEventListener('touchcancel', this.onTouchEndBound, { passive: true });
  }

  private onPointerDown(e: PointerEvent): void {
    // Only respond to primary button for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // If already in pinch gesture, do not begin single-pointer drag
    if (this.isPinching) return;

    // If an existing pointer is already dragging, do not interrupt it
    if (this.activePointerId !== null && this.isDragging) return;

    this.activePointerId = e.pointerId;
    this.isDragging = true;
    this.isTouchDrag = e.pointerType === 'touch' || e.pointerType === 'pen';
    this.isTransitioning = false;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
    this.lastInteractionTime = Date.now();
    this.lastMoveTime = performance.now();

    // Kill active inertia upon new touch/pointer contact
    this.inertiaVx = 0;
    this.inertiaVy = 0;
    this.velocityX = 0;
    this.velocityY = 0;

    // Request pointer capture so all continuous moves are routed reliably
    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {}

    // Prevent default touch actions (e.g. text selection, synthetic scroll)
    if (e.cancelable) {
      e.preventDefault();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    if (this.isPinching) return;

    // Only process moves from the captured active pointer
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }

    const now = performance.now();
    this.lastInteractionTime = Date.now();

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    // Always update previous pointer position for every movement event
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    if (deltaX === 0 && deltaY === 0) return;

    // Differentiate touch vs mouse sensitivity
    let baseSensitivity = 0.16; // default desktop mouse sensitivity
    if (e.pointerType === 'touch' || e.pointerType === 'pen' || this.isTouchDrag) {
      if (this.isAndroid) {
        baseSensitivity = 0.38; // highly responsive for Android touchscreens
      } else if (this.isIOS) {
        baseSensitivity = 0.32; // smooth and responsive on iOS Safari
      } else {
        baseSensitivity = 0.35;
      }
    }

    // Scale sensitivity by current FOV
    const sensitivity = (this.currentFov / 75) * baseSensitivity;

    const moveYaw = deltaX * sensitivity;
    const movePitch = deltaY * sensitivity;

    // Natural drag interaction: finger moves left -> view pans left, finger moves right -> view pans right
    this.targetYaw += moveYaw;
    this.targetPitch += movePitch;
    this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

    // Track movement velocity for inertia calculation upon release
    const dt = Math.max(1, now - this.lastMoveTime);
    this.lastMoveTime = now;

    if (this.isTouchDrag) {
      const instVx = moveYaw / dt;
      const instVy = movePitch / dt;
      this.velocityX = this.velocityX * 0.35 + instVx * 0.65;
      this.velocityY = this.velocityY * 0.35 + instVy * 0.65;
    }

    if (e.cancelable) {
      e.preventDefault();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }

    // Release pointer capture cleanly
    try {
      if (this.domElement.hasPointerCapture(e.pointerId)) {
        this.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {}

    this.activePointerId = null;
    this.isDragging = false;
    this.lastInteractionTime = Date.now();

    if (this.isTouchDrag) {
      const timeSinceLastMove = performance.now() - this.lastMoveTime;
      // Only apply inertia if finger was released during active motion
      if (timeSinceLastMove < 80) {
        // Clamp maximum impulse per frame to avoid uncontrolled spinning
        const maxImpulse = this.isAndroid ? 2.8 : 2.4;
        this.inertiaVx = Math.max(-maxImpulse, Math.min(maxImpulse, this.velocityX * 16));
        this.inertiaVy = Math.max(-maxImpulse, Math.min(maxImpulse, this.velocityY * 16));
      } else {
        this.inertiaVx = 0;
        this.inertiaVy = 0;
      }
    } else {
      this.inertiaVx = 0;
      this.inertiaVy = 0;
    }
  }

  private onPointerCancel(e: PointerEvent): void {
    if (this.activePointerId === null || e.pointerId === this.activePointerId) {
      try {
        if (this.domElement.hasPointerCapture(e.pointerId)) {
          this.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {}
      this.activePointerId = null;
      this.isDragging = false;
      this.inertiaVx = 0;
      this.inertiaVy = 0;
    }
  }

  private onLostPointerCapture(e: PointerEvent): void {
    if (this.activePointerId === e.pointerId) {
      this.activePointerId = null;
      this.isDragging = false;
      this.inertiaVx = 0;
      this.inertiaVy = 0;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.lastInteractionTime = Date.now();
    const zoomStep = e.deltaY * 0.05;
    this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.targetFov + zoomStep));
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length >= 2) {
      // Two-finger pinch gesture: cancel active single-finger dragging
      this.isPinching = true;
      this.isDragging = false;
      this.inertiaVx = 0;
      this.inertiaVy = 0;

      if (this.activePointerId !== null) {
        try {
          if (this.domElement.hasPointerCapture(this.activePointerId)) {
            this.domElement.releasePointerCapture(this.activePointerId);
          }
        } catch {}
        this.activePointerId = null;
      }

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.touchStartDistance = Math.hypot(dx, dy);
      this.touchStartFov = this.targetFov;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length >= 2) {
      if (e.cancelable) e.preventDefault();
      this.lastInteractionTime = Date.now();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && this.touchStartDistance > 0) {
        const ratio = this.touchStartDistance / dist;
        this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.touchStartFov * ratio));
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.touchStartDistance = 0;
      this.isPinching = false;
      // Do not jump-drag with the remaining finger; require fresh touch down to rotate
      this.isDragging = false;
      this.activePointerId = null;
    }
  }

  public update(): void {
    const now = performance.now();

    // Smooth transition interpolation
    if (this.isTransitioning) {
      const progress = Math.min(1, (now - this.transitionStartTime) / this.transitionDuration);
      // Smooth cubic ease-out curve
      const t = 1 - Math.pow(1 - progress, 3);

      this.currentYaw = this.transitionFromYaw + (this.transitionToYaw - this.transitionFromYaw) * t;
      this.currentPitch = this.transitionFromPitch + (this.transitionToPitch - this.transitionFromPitch) * t;
      this.targetYaw = this.currentYaw;
      this.targetPitch = this.currentPitch;

      if (progress >= 1) {
        this.isTransitioning = false;
      }
    } else {
      // Gentle auto-rotation after inactivity
      if (
        this.isAutoRotateEnabled &&
        !this.isDragging &&
        Math.abs(this.inertiaVx) < 0.01 &&
        Math.abs(this.inertiaVy) < 0.01 &&
        Date.now() - this.lastInteractionTime > this.autoRotateInactivityDelay &&
        this.tourState.getState().activeModal === 'none'
      ) {
        this.targetYaw += this.autoRotateSpeed;
      }

      // Apply decaying touch inertia when released
      if (Math.abs(this.inertiaVx) > 0.005 || Math.abs(this.inertiaVy) > 0.005) {
        this.targetYaw += this.inertiaVx;
        this.targetPitch += this.inertiaVy;
        this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

        // Tuned exponential decay (~350ms settle to full stop)
        this.inertiaVx *= 0.91;
        this.inertiaVy *= 0.91;
      }

      // Damping: during active touch drag, use higher factor for immediate finger tracking;
      // during mouse drag or settle, use standard smooth damping factor
      const activeDamping = this.isDragging && this.isTouchDrag ? 0.42 : this.dampingFactor;
      this.currentYaw += (this.targetYaw - this.currentYaw) * activeDamping;
      this.currentPitch += (this.targetPitch - this.currentPitch) * activeDamping;
    }

    // FOV damping
    this.currentFov += (this.targetFov - this.currentFov) * this.dampingFactor;
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Normalize yaw between -180 and 180 for telemetry
    let normalizedYaw = this.currentYaw % 360;
    if (normalizedYaw > 180) normalizedYaw -= 360;
    if (normalizedYaw < -180) normalizedYaw += 360;

    // Convert yaw and pitch to spherical direction vector
    const phi = THREE.MathUtils.degToRad(90 - this.currentPitch);
    const theta = THREE.MathUtils.degToRad(this.currentYaw);

    const targetVector = new THREE.Vector3(
      500 * Math.sin(phi) * Math.sin(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.cos(theta)
    );

    this.camera.lookAt(targetVector);

    // Notify state of updated coordinates (e.g. radar cone and hotspot projections)
    this.tourState.updateCamera(normalizedYaw, this.currentPitch, this.currentFov);
  }

  public getYaw(): number {
    return this.currentYaw;
  }

  public getPitch(): number {
    return this.currentPitch;
  }

  public getFov(): number {
    return this.currentFov;
  }

  public setAutoRotate(enabled: boolean): void {
    this.isAutoRotateEnabled = enabled;
  }
}

