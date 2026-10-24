import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSeries, createSeries } from '../src/series';
import {
  loadSeriesState,
  loadPresets,
  savePreset,
  saveSeriesState,
  seriesStateReducer,
  STORAGE_KEY,
  validateCoordinateInput,
  validateExpressionText,
} from '../src/series-state';

function createLocalStorage() {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
}

describe('series state management', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorage(),
      configurable: true,
    });
  });

  it('adds and removes series through the reducer', () => {
    const initial = { series: createInitialSeries(), nextId: 3 };

    const added = seriesStateReducer(initial, { type: 'add', kind: 'coordinates' });
    expect(added.series).toHaveLength(3);
    expect(added.nextId).toBe(4);

    const removed = seriesStateReducer(added, { type: 'remove', id: '3' });
    expect(removed.series.some((item) => item.id === '3')).toBe(false);
    expect(removed.nextId).toBe(4);
  });

  it('persists and restores saved graph state', () => {
    const state = {
      series: [
        ...createInitialSeries(),
        { ...createSeries('3', 'function'), expression: 'x^2', name: 'Square' },
      ],
      nextId: 4,
      domain: { min: -25, max: 25 },
    };

    saveSeriesState(state);

    expect(loadSeriesState()).toEqual(state);
  });

  it('saves and loads named presets', () => {
    const state = {
      series: createInitialSeries(),
      nextId: 3,
      domain: { min: -8, max: 12 },
    };

    const presets = savePreset('Demo graph', state);
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Demo graph');
    expect(loadPresets()[0].series).toEqual(state.series);
    expect(loadPresets()[0].domain).toEqual(state.domain);
  });

  it('reorders series by dragging one card onto another', () => {
    const state = {
      series: [
        { ...createSeries('1', 'function'), expression: 'sin(x)' },
        { ...createSeries('2', 'function'), expression: 'cos(x)' },
        { ...createSeries('3', 'function'), expression: 'x^2' },
      ],
      nextId: 4,
    };

    const reordered = seriesStateReducer(state, { type: 'reorder', fromId: '1', toId: '3' });
    expect(reordered.series.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('falls back to the default state when persisted state is invalid', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{not-valid-json}');

    const state = loadSeriesState();
    expect(state.series).toHaveLength(2);
    expect(state.nextId).toBe(3);
  });

  it('validates expression syntax and coordinate input inline', () => {
    expect(validateExpressionText('sin(x) + 1')).toBeUndefined();
    expect(validateExpressionText('sin(x +')).toBe('Expression is incomplete or invalid.');

    expect(validateCoordinateInput('[[0, 1], [2, 3]]', 'x', 'y')).toBeUndefined();
    expect(validateCoordinateInput('not-json', 'x', 'y')).toContain('Enter coordinate data');
    expect(validateCoordinateInput('[{"x": 0}]', 'x', 'y')).toContain('Y key "y"');
  });
});
