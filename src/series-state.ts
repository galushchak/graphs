import { parse } from 'mathjs/number';
import { parseCoordinates } from './coordinates';
import { createSeries, createInitialSeries, type EditableSeries } from './series';
import type { GraphDomain } from './graph';

export const STORAGE_KEY = 'plotter-series-state-v1';
export const PRESET_STORAGE_KEY = 'plotter-series-presets-v1';

export interface SeriesState {
  series: EditableSeries[];
  nextId: number;
  domain?: GraphDomain;
}

export interface SeriesPreset {
  name: string;
  series: EditableSeries[];
  nextId: number;
  domain?: GraphDomain;
  savedAt: string;
}

export type SeriesAction =
  | { type: 'add'; kind: 'function' | 'coordinates' }
  | { type: 'remove'; id: string }
  | { type: 'replace'; series: EditableSeries[] }
  | { type: 'reorder'; fromId: string; toId: string };

export function seriesStateReducer(state: SeriesState, action: SeriesAction): SeriesState {
  switch (action.type) {
    case 'add': {
      const id = String(state.nextId);
      const item = createSeries(id, action.kind);
      return {
        series: [...state.series, item],
        nextId: state.nextId + 1,
      };
    }
    case 'remove': {
      return {
        series: state.series.filter((item) => item.id !== action.id),
        nextId: state.nextId,
      };
    }
    case 'replace': {
      return {
        series: normalizeSeriesState(action.series).series,
        nextId: Math.max(state.nextId, nextSeriesId(action.series) + 1),
      };
    }
    case 'reorder': {
      return {
        series: reorderSeries(state.series, action.fromId, action.toId),
        nextId: state.nextId,
      };
    }
    default: {
      return state;
    }
  }
}

export function validateExpressionText(value: string): string | undefined {
  const expression = value.trim();
  if (!expression) {
    return 'Enter an expression before plotting a function.';
  }

  try {
    parse(expression);
    return undefined;
  } catch {
    return 'Expression is incomplete or invalid.';
  }
}

export function validateCoordinateInput(
  value: string,
  xKey: string,
  yKey: string,
): string | undefined {
  if (!value.trim()) {
    return 'Enter coordinate data as a JSON array, for example [[0, 1], [2, 3]] or [{"x": 0, "y": 1}].';
  }

  try {
    parseCoordinates(value, xKey, yKey);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unable to parse coordinate data.';
  }
}

export function loadSeriesState(): SeriesState {
  const fallback = { series: createInitialSeries(), nextId: 3 };

  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<SeriesState>;
    const series = normalizeSeriesState(parsed.series ?? fallback.series).series;
    const nextId = Number.isFinite(parsed.nextId)
      ? Math.max(Number(parsed.nextId), nextSeriesId(series) + 1)
      : nextSeriesId(series) + 1;

    return {
      series,
      nextId,
      ...(isGraphDomain(parsed.domain) ? { domain: parsed.domain } : {}),
    };
  } catch {
    return fallback;
  }
}

export function saveSeriesState(state: SeriesState): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadPresets(): SeriesPreset[] {
  try {
    const raw = globalThis.localStorage?.getItem(PRESET_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isPresetRecord).map((preset) => {
      const presetData = preset as {
        name: string;
        series?: unknown;
        nextId?: number;
        domain?: unknown;
        savedAt?: string;
      };
      const series = normalizeSeriesState(presetData.series).series;
      return {
        name: presetData.name,
        series,
        nextId:
          typeof presetData.nextId === 'number' ? presetData.nextId : nextSeriesId(series) + 1,
        ...(isGraphDomain(presetData.domain) ? { domain: presetData.domain } : {}),
        savedAt:
          typeof presetData.savedAt === 'string' ? presetData.savedAt : new Date().toISOString(),
      } satisfies SeriesPreset;
    });
  } catch {
    return [];
  }
}

export function savePresets(presets: SeriesPreset[]): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export function savePreset(name: string, state: SeriesState): SeriesPreset[] {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Enter a preset name before saving.');
  }

  const presets = loadPresets();
  const nextPreset = {
    name: trimmedName,
    series: state.series,
    nextId: state.nextId,
    ...(isGraphDomain(state.domain) ? { domain: state.domain } : {}),
    savedAt: new Date().toISOString(),
  };

  const updated = [
    ...presets.filter((preset) => preset.name.toLowerCase() !== trimmedName.toLowerCase()),
    nextPreset,
  ];
  if (!savePresets(updated)) {
    throw new Error('Could not save presets in this browser.');
  }
  return updated;
}

export function deletePreset(name: string): SeriesPreset[] {
  const presets = loadPresets().filter(
    (preset) => preset.name.toLowerCase() !== name.trim().toLowerCase(),
  );
  if (!savePresets(presets)) {
    throw new Error('Could not update presets in this browser.');
  }
  return presets;
}

function normalizeSeriesState(series: unknown): { series: EditableSeries[] } {
  if (!Array.isArray(series)) {
    return { series: createInitialSeries() };
  }

  const normalized = series.map((item, index) => {
    if (!isSeriesRecord(item)) {
      return createSeries(String(index + 1), 'function');
    }

    const raw = item as Record<string, unknown>;
    const itemId = typeof raw.id === 'string' && raw.id ? raw.id : String(index + 1);
    const kind = raw.kind === 'coordinates' ? 'coordinates' : 'function';

    if (kind === 'coordinates') {
      const base = createSeries(itemId, 'coordinates');
      return {
        ...base,
        ...raw,
        id: itemId,
        kind: 'coordinates',
        name: typeof raw.name === 'string' ? raw.name : undefined,
        type:
          raw.type === 'line' || raw.type === 'spline' || raw.type === 'dots' || raw.type === 'bars'
            ? raw.type
            : 'line',
        color: typeof raw.color === 'string' ? raw.color : base.color,
        visible: typeof raw.visible === 'boolean' ? raw.visible : true,
        dashed: typeof raw.dashed === 'boolean' ? raw.dashed : false,
        markers: typeof raw.markers === 'boolean' ? raw.markers : false,
        dataText: typeof raw.dataText === 'string' ? raw.dataText : base.dataText,
        xKey: typeof raw.xKey === 'string' ? raw.xKey : base.xKey,
        yKey: typeof raw.yKey === 'string' ? raw.yKey : base.yKey,
      } satisfies EditableSeries;
    }

    const base = createSeries(itemId, 'function');
    return {
      ...base,
      ...raw,
      id: itemId,
      kind: 'function',
      name: typeof raw.name === 'string' ? raw.name : undefined,
      type:
        raw.type === 'line' || raw.type === 'spline' || raw.type === 'dots' || raw.type === 'bars'
          ? raw.type
          : 'line',
      color: typeof raw.color === 'string' ? raw.color : base.color,
      visible: typeof raw.visible === 'boolean' ? raw.visible : true,
      dashed: typeof raw.dashed === 'boolean' ? raw.dashed : false,
      markers: typeof raw.markers === 'boolean' ? raw.markers : false,
      expression: typeof raw.expression === 'string' ? raw.expression : base.expression,
    } satisfies EditableSeries;
  });

  return { series: normalized.length > 0 ? normalized : createInitialSeries() };
}

function nextSeriesId(series: EditableSeries[]): number {
  return series.reduce((largest, item) => {
    const value = Number(item.id);
    return Number.isFinite(value) ? Math.max(largest, value) : largest;
  }, 0);
}

export function reorderSeries(
  series: EditableSeries[],
  fromId: string,
  toId: string,
): EditableSeries[] {
  if (fromId === toId) {
    return series;
  }

  const next = [...series];
  const fromIndex = next.findIndex((item) => item.id === fromId);
  const toIndex = next.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return series;
  }

  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function isSeriesRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPresetRecord(value: unknown): value is {
  name: string;
  series?: unknown;
  nextId?: number;
  domain?: unknown;
  savedAt?: string;
} {
  return (
    typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string'
  );
}

function isGraphDomain(value: unknown): value is GraphDomain {
  if (typeof value !== 'object' || value === null || !('min' in value) || !('max' in value)) {
    return false;
  }
  const { min, max } = value;
  return (
    typeof min === 'number' &&
    typeof max === 'number' &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min < max &&
    Number.isFinite(max - min)
  );
}
