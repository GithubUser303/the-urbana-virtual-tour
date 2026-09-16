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
  private previousMousePosition = { x: 0, y: 0 };
  private touchStartDistance = 0;
  private touchStartFov = 75;

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

    if (options) {
      if (options.dampingFactor !== undefined) this.dampingFactor = options.dampingFactor;
      if (options.autoRotateSpeed !== undefined) this.autoRotateSpeed = options.autoRotateSpeed;
      if (options.autoRotateInactivityDelay !== undefined) this.autoRotateInactivityDelay = options.autoRotateInactivityDelay;
      if (options.minPitch !== undefined) this.minPitch = options.minPitch;
      if (options.maxPitch !== undefined) this.maxPitch = options.maxPitch;
      if (options.minFov !== undefined) this.minFov = options.minFov;
      if (options.maxFov !== undefined) this.maxFov = options.maxFov;
    }

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

    // Pointer events for unified mouse and single touch
    el.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('pointercancel', this.onPointerUp.bind(this));

    // Wheel zoom
    el.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Touch pinch-to-zoom
    el.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    el.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
  }

  private onPointerDown(e: PointerEvent): void {
    // Only respond to primary button
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.isDragging = true;
    this.isTransitioning = false;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
    this.lastInteractionTime = Date.now();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    this.lastInteractionTime = Date.now();

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    // Scale sensitivity by current FOV
    const sensitivity = (this.currentFov / 75) * 0.16;

    // Drag 360 view screen: goes right when dragging left and vice versa; goes down when dragging up and vice versa
    this.targetYaw += deltaX * sensitivity;
    this.targetPitch += deltaY * sensitivity;
    this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
  }

  private onPointerUp(): void {
    this.isDragging = false;
    this.lastInteractionTime = Date.now();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.lastInteractionTime = Date.now();
    const zoomStep = e.deltaY * 0.05;
    this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.targetFov + zoomStep));
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      this.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.touchStartDistance = Math.hypot(dx, dy);
      this.touchStartFov = this.targetFov;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.lastInteractionTime = Date.now();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = this.touchStartDistance / dist;
      this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.touchStartFov * ratio));
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.touchStartDistance = 0;
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
        Date.now() - this.lastInteractionTime > this.autoRotateInactivityDelay &&
        this.tourState.getState().activeModal === 'none'
      ) {
        this.targetYaw += this.autoRotateSpeed;
      }

      // Smooth inertia damping
      this.currentYaw += (this.targetYaw - this.currentYaw) * this.dampingFactor;
      this.currentPitch += (this.targetPitch - this.currentPitch) * this.dampingFactor;
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

