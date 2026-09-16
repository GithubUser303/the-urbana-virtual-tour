/**
 * Subtle cursor-responsive parallax for floating glass elements and gallery items.
 * Displaces target elements by 1-3px based on cursor position relative to screen center.
 */
export class Parallax {
  private static instance: Parallax;
  private mouseNormX = 0; // -1 to 1
  private mouseNormY = 0; // -1 to 1
  private currentX = 0;
  private currentY = 0;
  private rafId: number | null = null;
  private smoothing = 0.08;

  private constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    this.tick();
  }

  public static init(): Parallax {
    if (!Parallax.instance) {
      Parallax.instance = new Parallax();
    }
    return Parallax.instance;
  }

  private handleMouseMove(e: MouseEvent): void {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    this.mouseNormX = (e.clientX - halfW) / halfW;
    this.mouseNormY = (e.clientY - halfH) / halfH;
  }

  private tick(): void {
    this.currentX += (this.mouseNormX - this.currentX) * this.smoothing;
    this.currentY += (this.mouseNormY - this.currentY) * this.smoothing;

    document.documentElement.style.setProperty('--parallax-x', `${(this.currentX * 2.5).toFixed(2)}px`);
    document.documentElement.style.setProperty('--parallax-y', `${(this.currentY * 2.5).toFixed(2)}px`);

    this.rafId = requestAnimationFrame(this.tick);
  }

  public destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('mousemove', this.handleMouseMove);
  }
}

