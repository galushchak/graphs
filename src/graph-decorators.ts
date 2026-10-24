export interface SeriesRenderer {
  render(): void;
}

export abstract class SeriesRendererDecorator implements SeriesRenderer {
  constructor(protected readonly renderer: SeriesRenderer) {}

  render(): void {
    this.renderer.render();
  }
}

export class DashedLineDecorator extends SeriesRendererDecorator {
  constructor(
    renderer: SeriesRenderer,
    private readonly context: CanvasRenderingContext2D,
  ) {
    super(renderer);
  }

  override render(): void {
    this.context.save();
    try {
      this.context.setLineDash([6, 4]);
      super.render();
    } finally {
      this.context.restore();
    }
  }
}

export class PointMarkerDecorator extends SeriesRendererDecorator {
  constructor(
    renderer: SeriesRenderer,
    private readonly context: CanvasRenderingContext2D,
    private readonly points: Array<{ x: number; y: number } | undefined>,
    private readonly color: string,
    private readonly plotWidth: number,
  ) {
    super(renderer);
  }

  override render(): void {
    super.render();

    const maxMarkers = Math.max(12, Math.floor(this.plotWidth / 18));
    const stride = Math.max(1, Math.ceil(this.points.length / maxMarkers));
    this.context.save();
    try {
      this.context.fillStyle = this.color;
      for (let index = 0; index < this.points.length; index += stride) {
        const point = this.points[index];
        if (!point) {
          continue;
        }
        this.context.beginPath();
        this.context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        this.context.fill();
      }
    } finally {
      this.context.restore();
    }
  }
}
