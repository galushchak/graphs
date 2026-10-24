import { parse } from 'mathjs/number';
import { DashedLineDecorator, PointMarkerDecorator, type SeriesRenderer } from './graph-decorators';

export interface FunctionSeries {
  expression?: string;
  points?: GraphPoint[];
  type?: GraphType;
  color: string;
  visible: boolean;
  dashed?: boolean;
  markers?: boolean;
}

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphDomain {
  min: number;
  max: number;
}

export type GraphType = 'line' | 'spline' | 'dots' | 'bars';

interface CompiledSeries extends FunctionSeries {
  evaluate?: (x: number) => number | undefined;
  expression?: string;
  id: string;
}

type Point = GraphPoint;

interface ScreenPoint {
  x: number;
  y: number;
}

interface Selection {
  start: ScreenPoint;
  end: ScreenPoint;
}

const plotPadding = { top: 24, right: 24, bottom: 36, left: 52 };
const sampleCount = 1000;
const gridColor = '#e8eaf0';
const axisColor = '#9aa1b2';
const labelColor = '#8b91a2';
const invalidNumericRangeMessage = 'The plotted values are too large to display safely.';

class GraphRenderingError extends Error {}

export class GraphPlotter {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly canvas: HTMLCanvasElement;
  private series: CompiledSeries[] = [];
  private domain: GraphDomain = { min: -10, max: 10 };
  private yDomainOverride: GraphDomain | undefined;
  private currentYDomain: GraphDomain = { min: -1, max: 1 };
  private selection: Selection | undefined;
  private onZoom: ((domain: GraphDomain) => void) | undefined;
  private onError: ((message: string) => void) | undefined;
  private renderRequest: number | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is not available in this browser.');
    }
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
  }

  setDomain(domain: GraphDomain): void {
    if (
      !Number.isFinite(domain.min) ||
      !Number.isFinite(domain.max) ||
      domain.min >= domain.max ||
      !Number.isFinite(domain.max - domain.min)
    ) {
      throw new Error('The graph domain must have a finite minimum less than its maximum.');
    }
    this.domain = domain;
    this.yDomainOverride = undefined;
    this.scheduleRender();
  }

  setOnZoom(callback: (domain: GraphDomain) => void): void {
    this.onZoom = callback;
  }

  setOnError(callback: (message: string) => void): void {
    this.onError = callback;
  }

  resetYDomain(): void {
    this.yDomainOverride = undefined;
    this.scheduleRender();
  }

  setSeries(series: FunctionSeries[]): void {
    const previousById = new Map(this.series.map((item) => [item.id, item]));
    const compiled = series.map((item, index): CompiledSeries => {
      const id = 'id' in item && typeof item.id === 'string' ? item.id : `series-${index}`;
      if (item.points) {
        if (item.points.length === 0) {
          throw new Error('Enter at least one coordinate or data object to plot a dataset.');
        }
        if (item.points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
          throw new Error('Coordinate datasets can only contain finite x and y values.');
        }
        return { ...item, id, points: [...item.points] };
      }

      const expression = item.expression?.trim() ?? '';
      if (!expression) {
        throw new Error('Enter an expression before plotting a function.');
      }

      const previous = previousById.get(id);
      const evaluate =
        previous?.expression === expression ? previous.evaluate : createEvaluator(expression);
      return {
        ...item,
        id,
        expression,
        evaluate: (x) => {
          return evaluate?.(x);
        },
      };
    });

    this.series = compiled;
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderRequest !== undefined) {
      return;
    }
    this.renderRequest = requestAnimationFrame(() => {
      this.renderRequest = undefined;
      try {
        this.render();
      } catch (error) {
        if (error instanceof GraphRenderingError) {
          this.onError?.(error.message);
          return;
        }
        throw error;
      }
    });
  }

  private render(): void {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(bounds.width * pixelRatio);
    this.canvas.height = Math.round(bounds.height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.context.clearRect(0, 0, bounds.width, bounds.height);

    const plot = {
      left: plotPadding.left,
      top: plotPadding.top,
      right: bounds.width - plotPadding.right,
      bottom: bounds.height - plotPadding.bottom,
    };
    if (plot.right <= plot.left || plot.bottom <= plot.top) {
      return;
    }

    const points = this.series.map((item) => ({
      item,
      points: this.sample(item),
    }));
    const automaticYDomain = this.getYDomain(
      points.flatMap(({ points: values }) =>
        values.filter(
          (point): point is Point =>
            point !== undefined && point.x >= this.domain.min && point.x <= this.domain.max,
        ),
      ),
      points.some(({ item }) => item.type === 'bars'),
    );
    const yDomain = this.yDomainOverride ?? automaticYDomain;
    this.currentYDomain = yDomain;

    this.drawGrid(plot, yDomain);
    const barSeriesCount = points.filter(({ item }) => item.type === 'bars').length;
    let barSeriesIndex = 0;
    for (const [index, { item, points: values }] of points.entries()) {
      const type = item.type ?? 'line';
      const seriesIndex = type === 'bars' ? barSeriesIndex++ : index;
      this.drawSeries(
        values,
        item.color,
        type,
        seriesIndex,
        barSeriesCount,
        plot,
        yDomain,
        item.dashed ?? false,
        item.markers ?? false,
      );
    }
    this.drawSelection(plot);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const point = this.getPlotPoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.selection = { start: point, end: point };
    this.canvas.classList.add('is-selecting');
    this.scheduleRender();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.selection) {
      return;
    }
    this.selection.end = this.getPlotPoint(event, true) ?? this.selection.end;
    this.scheduleRender();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.selection) {
      return;
    }
    this.selection.end = this.getPlotPoint(event, true) ?? this.selection.end;
    const selection = this.selection;
    this.selection = undefined;
    this.canvas.classList.remove('is-selecting');

    const left = Math.min(selection.start.x, selection.end.x);
    const right = Math.max(selection.start.x, selection.end.x);
    const top = Math.min(selection.start.y, selection.end.y);
    const bottom = Math.max(selection.start.y, selection.end.y);
    if (right - left < 12 || bottom - top < 12) {
      this.scheduleRender();
      return;
    }

    const bounds = this.canvas.getBoundingClientRect();
    const plot = this.getPlotBounds(bounds.width, bounds.height);
    const nextDomain = {
      min:
        this.domain.min +
        ((left - plot.left) / (plot.right - plot.left)) * (this.domain.max - this.domain.min),
      max:
        this.domain.min +
        ((right - plot.left) / (plot.right - plot.left)) * (this.domain.max - this.domain.min),
    };
    const nextYDomain = {
      min:
        this.currentYDomain.max -
        ((bottom - plot.top) / (plot.bottom - plot.top)) *
          (this.currentYDomain.max - this.currentYDomain.min),
      max:
        this.currentYDomain.max -
        ((top - plot.top) / (plot.bottom - plot.top)) *
          (this.currentYDomain.max - this.currentYDomain.min),
    };

    if (
      !Number.isFinite(nextDomain.min) ||
      !Number.isFinite(nextDomain.max) ||
      !Number.isFinite(nextYDomain.min) ||
      !Number.isFinite(nextYDomain.max)
    ) {
      this.scheduleRender();
      return;
    }

    this.domain = nextDomain;
    this.yDomainOverride = nextYDomain;
    this.onZoom?.(nextDomain);
    this.scheduleRender();
  };

  private handlePointerCancel = (): void => {
    this.selection = undefined;
    this.canvas.classList.remove('is-selecting');
    this.scheduleRender();
  };

  private getPlotPoint(event: PointerEvent, clampToPlot = false): ScreenPoint | undefined {
    const bounds = this.canvas.getBoundingClientRect();
    const plot = this.getPlotBounds(bounds.width, bounds.height);
    const x = Math.max(plot.left, Math.min(plot.right, event.clientX - bounds.left));
    const y = Math.max(plot.top, Math.min(plot.bottom, event.clientY - bounds.top));
    if (
      !clampToPlot &&
      (event.clientX < bounds.left + plot.left ||
        event.clientX > bounds.left + plot.right ||
        event.clientY < bounds.top + plot.top ||
        event.clientY > bounds.top + plot.bottom)
    ) {
      return undefined;
    }
    return { x, y };
  }

  private getPlotBounds(
    width: number,
    height: number,
  ): { left: number; top: number; right: number; bottom: number } {
    return {
      left: plotPadding.left,
      top: plotPadding.top,
      right: width - plotPadding.right,
      bottom: height - plotPadding.bottom,
    };
  }

  private drawSelection(plot: { left: number; top: number; right: number; bottom: number }): void {
    if (!this.selection) {
      return;
    }

    const left = Math.max(plot.left, Math.min(this.selection.start.x, this.selection.end.x));
    const right = Math.min(plot.right, Math.max(this.selection.start.x, this.selection.end.x));
    const top = Math.max(plot.top, Math.min(this.selection.start.y, this.selection.end.y));
    const bottom = Math.min(plot.bottom, Math.max(this.selection.start.y, this.selection.end.y));

    this.context.save();
    this.context.fillStyle = 'rgb(91 101 232 / 14%)';
    this.context.strokeStyle = '#5b65e8';
    this.context.lineWidth = 1;
    this.context.setLineDash([5, 4]);
    this.context.fillRect(left, top, right - left, bottom - top);
    this.context.strokeRect(left, top, right - left, bottom - top);
    this.context.restore();
  }

  private sample(series: CompiledSeries): Array<Point | undefined> {
    if (series.points) {
      return series.points;
    }

    if (!series.evaluate) {
      return [];
    }

    const points: Array<Point | undefined> = [];
    const step = (this.domain.max - this.domain.min) / (sampleCount - 1);

    for (let index = 0; index < sampleCount; index += 1) {
      const x = this.domain.min + step * index;
      const y = series.evaluate(x);
      if (y !== undefined) {
        points.push({ x, y });
      } else {
        points.push(undefined);
      }
    }
    return points;
  }

  private getYDomain(points: Point[], includeZero: boolean): GraphDomain {
    if (points.length === 0) {
      return { min: -1, max: 1 };
    }

    let min = points[0].y;
    let max = points[0].y;
    for (const point of points) {
      min = Math.min(min, point.y);
      max = Math.max(max, point.y);
    }

    if (includeZero) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.1, 1);
      const domain = { min: min - padding, max: max + padding };
      if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max)) {
        throw new GraphRenderingError(invalidNumericRangeMessage);
      }
      return domain;
    }
    const spread = max - min;
    const padding = spread * 0.08;
    const domain = { min: min - padding, max: max + padding };
    if (!Number.isFinite(spread) || !Number.isFinite(domain.min) || !Number.isFinite(domain.max)) {
      throw new GraphRenderingError(invalidNumericRangeMessage);
    }
    return domain;
  }

  private drawGrid(
    plot: { left: number; top: number; right: number; bottom: number },
    yDomain: GraphDomain,
  ): void {
    const { context } = this;
    const xTicks = createTicks(this.domain);
    const yTicks = createTicks(yDomain);

    context.save();
    context.font = '12px Inter, ui-sans-serif, system-ui, sans-serif';
    context.lineWidth = 1;
    context.strokeStyle = gridColor;
    context.fillStyle = labelColor;
    context.textAlign = 'center';
    context.textBaseline = 'top';

    for (const value of xTicks) {
      const x = this.mapX(value, plot);
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
      context.fillText(formatTick(value), x, plot.bottom + 10);
    }

    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (const value of yTicks) {
      const y = this.mapY(value, plot, yDomain);
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
      context.fillText(formatTick(value), plot.left - 10, y);
    }

    context.strokeStyle = axisColor;
    context.lineWidth = 1.25;
    if (this.domain.min <= 0 && this.domain.max >= 0) {
      const x = this.mapX(0, plot);
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
    }
    if (yDomain.min <= 0 && yDomain.max >= 0) {
      const y = this.mapY(0, plot, yDomain);
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
    }
    context.restore();
  }

  private drawSeries(
    points: Array<Point | undefined>,
    color: string,
    type: GraphType,
    seriesIndex: number,
    seriesCount: number,
    plot: { left: number; top: number; right: number; bottom: number },
    yDomain: GraphDomain,
    dashed: boolean,
    markers: boolean,
  ): void {
    const { context } = this;
    const plotHeight = plot.bottom - plot.top;
    const mappedPoints = points.map((point): ScreenPoint | undefined => {
      if (!point) {
        return undefined;
      }
      const y = this.mapY(point.y, plot, yDomain);
      if (
        !Number.isFinite(y) ||
        y < plot.top - 2 * plotHeight ||
        y > plot.bottom + 2 * plotHeight
      ) {
        return undefined;
      }
      return { x: this.mapX(point.x, plot), y };
    });

    context.save();
    context.beginPath();
    context.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
    context.clip();

    if (type === 'dots') {
      this.drawDots(mappedPoints, color, plot);
    } else if (type === 'bars') {
      this.drawBars(mappedPoints, color, seriesIndex, seriesCount, plot, yDomain);
    } else {
      let renderer: SeriesRenderer = {
        render: () => this.drawCurve(mappedPoints, color, type),
      };
      if (dashed) {
        renderer = new DashedLineDecorator(renderer, context);
      }
      if (markers) {
        renderer = new PointMarkerDecorator(
          renderer,
          context,
          mappedPoints,
          color,
          plot.right - plot.left,
        );
      }
      renderer.render();
    }

    context.restore();
  }

  private drawCurve(
    points: Array<ScreenPoint | undefined>,
    color: string,
    type: Exclude<GraphType, 'dots' | 'bars'>,
  ): void {
    const { context } = this;
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
    context.lineCap = 'round';

    for (const segment of splitSegments(points)) {
      if (segment.length === 0) {
        continue;
      }
      context.moveTo(segment[0].x, segment[0].y);
      for (let index = 0; index < segment.length - 1; index += 1) {
        const current = segment[index];
        const next = segment[index + 1];

        if (type === 'spline') {
          const previous = segment[Math.max(index - 1, 0)];
          const after = segment[Math.min(index + 2, segment.length - 1)];
          context.bezierCurveTo(
            current.x + (next.x - previous.x) / 6,
            current.y + (next.y - previous.y) / 6,
            next.x - (after.x - current.x) / 6,
            next.y - (after.y - current.y) / 6,
            next.x,
            next.y,
          );
        } else {
          context.lineTo(next.x, next.y);
        }
      }
    }

    context.stroke();
  }

  private drawDots(
    points: Array<ScreenPoint | undefined>,
    color: string,
    plot: { left: number; right: number },
  ): void {
    const { context } = this;
    const maxDots = Math.max(12, Math.floor((plot.right - plot.left) / 18));
    const stride = Math.max(1, Math.ceil(points.length / maxDots));
    context.fillStyle = color;

    for (let index = 0; index < points.length; index += stride) {
      const point = points[index];
      if (!point) {
        continue;
      }
      context.beginPath();
      context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawBars(
    points: Array<ScreenPoint | undefined>,
    color: string,
    seriesIndex: number,
    seriesCount: number,
    plot: { left: number; right: number; top: number; bottom: number },
    yDomain: GraphDomain,
  ): void {
    const { context } = this;
    const plotWidth = plot.right - plot.left;
    const maxBars = Math.max(12, Math.floor(plotWidth / 18));
    const stride = Math.max(1, Math.ceil(points.length / maxBars));
    const slotWidth = plotWidth / Math.ceil(points.length / stride);
    const groupWidth = slotWidth * 0.72;
    const barWidth = groupWidth / seriesCount;
    const offset = -groupWidth / 2 + seriesIndex * barWidth;
    const zeroY = this.mapY(0, { top: plot.top, bottom: plot.bottom }, yDomain);

    context.fillStyle = color;
    context.globalAlpha = 0.78;
    for (let index = 0; index < points.length; index += stride) {
      const point = points[index];
      if (!point) {
        continue;
      }
      context.fillRect(
        point.x + offset,
        Math.min(point.y, zeroY),
        Math.max(barWidth - 1, 1),
        Math.max(Math.abs(zeroY - point.y), 1),
      );
    }
    context.globalAlpha = 1;
  }

  private mapX(value: number, plot: { left: number; right: number }): number {
    return (
      plot.left +
      ((value - this.domain.min) / (this.domain.max - this.domain.min)) * (plot.right - plot.left)
    );
  }

  private mapY(value: number, plot: { top: number; bottom: number }, domain: GraphDomain): number {
    return (
      plot.bottom - ((value - domain.min) / (domain.max - domain.min)) * (plot.bottom - plot.top)
    );
  }
}

function splitSegments(points: Array<ScreenPoint | undefined>): ScreenPoint[][] {
  const segments: ScreenPoint[][] = [];
  let segment: ScreenPoint[] = [];

  for (const point of points) {
    if (point) {
      segment.push(point);
    } else if (segment.length > 0) {
      segments.push(segment);
      segment = [];
    }
  }
  if (segment.length > 0) {
    segments.push(segment);
  }
  return segments;
}

function createEvaluator(expression: string): (x: number) => number | undefined {
  const evaluate = parse(expression).compile();
  return (x) => {
    try {
      const value: unknown = evaluate.evaluate({ x });
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    } catch {
      return undefined;
    }
  };
}

function createTicks(domain: GraphDomain): number[] {
  const roughStep = (domain.max - domain.min) / 8;
  if (!Number.isFinite(roughStep) || roughStep <= 0) {
    return [];
  }
  const power = 10 ** Math.floor(Math.log10(roughStep));
  if (!Number.isFinite(power) || power <= 0) {
    return [];
  }
  const fraction = roughStep / power;
  const step = (fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10) * power;
  if (!Number.isFinite(step) || step <= 0) {
    return [];
  }
  const first = Math.ceil(domain.min / step) * step;
  if (!Number.isFinite(first)) {
    return [];
  }
  const ticks: number[] = [];

  for (let value = first; value <= domain.max && ticks.length < 100; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function formatTick(value: number): string {
  return Number(value.toPrecision(4)).toString();
}
