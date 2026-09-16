/**
 * GlassLight tracks pointer movements over tinted-glass elements
 * and computes smoothed coordinates using requestAnimationFrame lerp
 * to produce physical cursor lag, reflection depth, and diffuse lighting.
 * 
 * Target-specific glow ensures that only the element directly under the cursor
 * is illuminated, eliminating phantom/secondary glows on distant panels.
 */
export class GlassLight {
  private static instance: GlassLight;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private hoveredElement: HTMLElement | null = null;
  private rafId: number | null = null;
  private smoothing = 0.16; // Subtle physical lag

  private constructor() {
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.tick = this.tick.bind(this);

    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
    this.tick();
  }

  public static init(): GlassLight {
    if (!GlassLight.instance) {
      GlassLight.instance = new GlassLight();
    }
    return GlassLight.instance;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.targetX = e.clientX;
    this.targetY = e.clientY;

    // Detect the topmost glass container under cursor
    const target = e.target as HTMLElement | null;
    const glass = target?.closest<HTMLElement>('.glass-panel, .scatter-card');

    if (glass !== this.hoveredElement) {
      if (this.hoveredElement) {
        this.hoveredElement.style.setProperty('--glow-opacity', '0');
      }
      this.hoveredElement = glass || null;
    }
  }

  private handlePointerLeave(): void {
    if (this.hoveredElement) {
      this.hoveredElement.style.setProperty('--glow-opacity', '0');
      this.hoveredElement = null;
    }
  }

  private tick(): void {
    // Linear interpolation for smooth physical lag
    this.currentX += (this.targetX - this.currentX) * this.smoothing;
    this.currentY += (this.targetY - this.currentY) * this.smoothing;

    if (this.hoveredElement && document.body.contains(this.hoveredElement)) {
      const rect = this.hoveredElement.getBoundingClientRect();
      const relX = this.currentX - rect.left;
      const relY = this.currentY - rect.top;

      // Ensure cursor is within or immediately adjacent to element bounds
      if (
        relX >= -40 &&
        relX <= rect.width + 40 &&
        relY >= -40 &&
        relY <= rect.height + 40
      ) {
        this.hoveredElement.style.setProperty('--mouse-x', `${relX.toFixed(1)}px`);
        this.hoveredElement.style.setProperty('--mouse-y', `${relY.toFixed(1)}px`);
        this.hoveredElement.style.setProperty('--glow-opacity', '1');
      } else {
        this.hoveredElement.style.setProperty('--glow-opacity', '0');
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  public destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerleave', this.handlePointerLeave);
  }
}
