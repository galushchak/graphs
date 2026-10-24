import type { EditableSeries } from './series';
import type { GraphDomain } from './graph';
import { loadSeriesState, type SeriesState } from './series-state';

export interface GraphSnapshot {
  series: EditableSeries[];
  nextId: number;
  domain?: GraphDomain;
}

export class GraphModel {
  private history: GraphSnapshot[] = [];
  private index = 0;

  constructor(initial: GraphSnapshot = loadSeriesState()) {
    this.history = [cloneSnapshot(initial)];
    this.index = 0;
  }

  getSnapshot(): GraphSnapshot {
    return cloneSnapshot(this.history[this.index]);
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.history.length - 1;
  }

  commit(snapshot: GraphSnapshot): GraphSnapshot {
    const next = cloneSnapshot(snapshot);
    const current = this.history[this.index];
    if (JSON.stringify(current) === JSON.stringify(next)) {
      return this.getSnapshot();
    }

    this.history = this.history.slice(0, this.index + 1);
    this.history.push(next);
    this.index = this.history.length - 1;
    return this.getSnapshot();
  }

  undo(): GraphSnapshot {
    if (!this.canUndo()) {
      return this.getSnapshot();
    }

    this.index -= 1;
    return this.getSnapshot();
  }

  redo(): GraphSnapshot {
    if (!this.canRedo()) {
      return this.getSnapshot();
    }

    this.index += 1;
    return this.getSnapshot();
  }

  exportState(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  importState(json: string): GraphSnapshot {
    return this.commit(importGraphSnapshot(json));
  }
}

export function exportGraphSnapshot(state: GraphSnapshot): string {
  return JSON.stringify(state, null, 2);
}

export function importGraphSnapshot(json: string): GraphSnapshot {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('series' in parsed) ||
    !Array.isArray(parsed.series)
  ) {
    throw new Error('Import data must contain a series array.');
  }
  if (!parsed.series.every(isEditableSeries)) {
    throw new Error('Import data contains an invalid series.');
  }
  const series = parsed.series;
  const largestId = series.reduce((largest, item) => {
    const id = Number(item.id);
    return Number.isFinite(id) ? Math.max(largest, id) : largest;
  }, 0);
  const nextId =
    'nextId' in parsed && typeof parsed.nextId === 'number' && Number.isFinite(parsed.nextId)
      ? Math.max(Math.floor(parsed.nextId), largestId + 1, 1)
      : Math.max(largestId + 1, series.length + 1, 1);
  const domain = 'domain' in parsed ? parseGraphDomain(parsed.domain) : undefined;
  return { series, nextId, ...(domain ? { domain } : {}) };
}

function cloneSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    series: snapshot.series.map((item) => ({ ...item })),
    nextId: snapshot.nextId,
    ...(snapshot.domain ? { domain: { ...snapshot.domain } } : {}),
  };
}

function parseGraphDomain(value: unknown): GraphDomain | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'min' in value &&
    'max' in value &&
    typeof value.min === 'number' &&
    typeof value.max === 'number' &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min < value.max &&
    Number.isFinite(value.max - value.min)
  ) {
    return { min: value.min, max: value.max };
  }
  throw new Error('Import data contains an invalid horizontal range.');
}

export function toSeriesState(snapshot: GraphSnapshot): SeriesState {
  return {
    series: snapshot.series,
    nextId: snapshot.nextId,
    ...(snapshot.domain ? { domain: snapshot.domain } : {}),
  };
}

function isEditableSeries(value: unknown): value is EditableSeries {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const series = value as Record<string, unknown>;
  const hasBaseFields =
    typeof series.id === 'string' &&
    series.id.length > 0 &&
    (series.type === 'line' ||
      series.type === 'spline' ||
      series.type === 'dots' ||
      series.type === 'bars') &&
    typeof series.color === 'string' &&
    (!('name' in series) || typeof series.name === 'string') &&
    typeof series.visible === 'boolean' &&
    typeof series.dashed === 'boolean' &&
    typeof series.markers === 'boolean';
  if (!hasBaseFields) {
    return false;
  }
  return series.kind === 'function'
    ? typeof series.expression === 'string'
    : series.kind === 'coordinates' &&
        typeof series.dataText === 'string' &&
        typeof series.xKey === 'string' &&
        typeof series.yKey === 'string';
}
