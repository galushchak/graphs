import { parse } from 'mathjs/number';
import { parseCoordinates } from './coordinates';
import { getSeriesName, type EditableSeries } from './series';

export interface HoverSample {
  label: string;
  value: number;
}

export function inspectSeriesAt(series: EditableSeries[], x: number): HoverSample[] {
  return series
    .filter((item) => item.visible)
    .map((item) => {
      if (item.kind === 'coordinates') {
        try {
          const points = parseCoordinates(item.dataText, item.xKey, item.yKey);
          if (points.length === 0) {
            return undefined;
          }
          let nearest = points[0];
          let closestDistance = Number.POSITIVE_INFINITY;
          for (const point of points) {
            const distance = Math.abs(point.x - x);
            if (distance < closestDistance) {
              closestDistance = distance;
              nearest = point;
            }
          }
          return {
            label: getSeriesName(item),
            value: nearest.y,
          };
        } catch {
          return undefined;
        }
      }

      const trimmed = item.expression.trim();
      if (!trimmed) {
        return undefined;
      }

      try {
        const compiled = parse(trimmed).compile();
        const value = compiled.evaluate({ x });
        if (typeof value === 'number' && Number.isFinite(value)) {
          return {
            label: getSeriesName(item),
            value,
          };
        }
      } catch {
        // Ignore invalid expressions while hovering.
      }

      return undefined;
    })
    .filter((item): item is HoverSample => Boolean(item));
}

export function formatHoverX(value: number): string {
  return Number(value.toPrecision(4)).toString();
}

export function formatHoverY(value: number): string {
  return Number(value.toPrecision(5)).toString();
}
