import { describe, expect, it } from 'vitest';
import { GraphModel, exportGraphSnapshot, importGraphSnapshot } from '../src/graph-model';
import { createSeries } from '../src/series';

describe('graph model history', () => {
  it('tracks state changes with undo and redo', () => {
    const model = new GraphModel({
      series: [createSeries('1', 'function')],
      nextId: 2,
    });

    const added = model.commit({
      series: [createSeries('1', 'function'), createSeries('2', 'function')],
      nextId: 3,
    });

    expect(model.canUndo()).toBe(true);
    expect(added.series).toHaveLength(2);

    const undone = model.undo();
    expect(undone.series).toHaveLength(1);
    expect(undone.series[0].id).toBe('1');
    expect(model.canRedo()).toBe(true);

    const redone = model.redo();
    expect(redone.series).toHaveLength(2);
    expect(redone.nextId).toBe(3);
  });

  it('round-trips state through JSON export and import', () => {
    const state = {
      series: [
        { ...createSeries('1', 'function'), expression: 'sin(x)' },
        { ...createSeries('2', 'coordinates'), dataText: '[[0, 1], [2, 3]]' },
      ],
      nextId: 3,
      domain: { min: -4, max: 8 },
    };

    const json = exportGraphSnapshot(state);
    expect(importGraphSnapshot(json)).toEqual(state);
  });

  it('rejects JSON imports without a series array or with an invalid range', () => {
    expect(() => importGraphSnapshot('{}')).toThrow('Import data must contain a series array.');
    expect(() =>
      importGraphSnapshot(JSON.stringify({ series: [], domain: { min: 4, max: 1 } })),
    ).toThrow('Import data contains an invalid horizontal range.');
    expect(() => importGraphSnapshot(JSON.stringify({ series: [null] }))).toThrow(
      'Import data contains an invalid series.',
    );
  });

  it('keeps imported identifiers from colliding with the next series', () => {
    const snapshot = importGraphSnapshot(
      JSON.stringify({ series: [createSeries('8', 'function')], nextId: 2 }),
    );
    expect(snapshot.nextId).toBe(9);
  });
});
