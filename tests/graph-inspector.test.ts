import { describe, expect, it } from 'vitest';
import { inspectSeriesAt } from '../src/graph-inspector';
import { createSeries } from '../src/series';

describe('graph inspector', () => {
  it('reads the nearest visible value for a function at a given x', () => {
    const series = [
      { ...createSeries('1', 'function'), expression: 'sin(x)', visible: true },
      { ...createSeries('2', 'function'), expression: 'x^2', visible: false },
    ];

    const values = inspectSeriesAt(series, 0);
    expect(values).toEqual([{ label: 'f1(x)', value: 0 }]);
  });

  it('reads the nearest coordinate value even when the x value falls between points', () => {
    const series = [
      {
        ...createSeries('1', 'coordinates'),
        visible: true,
        dataText: '[[0, 2], [2, 4], [4, 8]]',
        xKey: 'x',
        yKey: 'y',
      },
    ];

    const values = inspectSeriesAt(series, 1.2);
    expect(values[0]).toMatchObject({ label: 'Points 1', value: 4 });
  });
});
