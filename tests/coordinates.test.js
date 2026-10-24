import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '../src/coordinates.ts';

describe('parseCoordinates', () => {
  it('converts valid coordinate pairs to graph points', () => {
    expect(parseCoordinates('[[-2, 3], [0, 1.5]]')).toEqual([
      { x: -2, y: 3 },
      { x: 0, y: 1.5 },
    ]);
  });

  it('reads values from configured nested object paths', () => {
    expect(
      parseCoordinates(
        '[{"metrics":{"time":-2},"measurements":{"temperature":3}},{"metrics":{"time":0},"measurements":{"temperature":1.5}}]',
        'metrics.time',
        'measurements.temperature',
      ),
    ).toEqual([
      { x: -2, y: 3 },
      { x: 0, y: 1.5 },
    ]);
  });

  it('reads top-level values from object datasets using default keys', () => {
    expect(parseCoordinates('[{"x":1,"y":2},{"x":3,"y":4}]')).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('supports custom top-level paths after trimming whitespace', () => {
    expect(parseCoordinates('[{"elapsed":1,"height":2}]', ' elapsed ', ' height ')).toEqual([
      { x: 1, y: 2 },
    ]);
  });

  it('supports mixed tuple and object entries', () => {
    expect(parseCoordinates('[[1, 2], {"value":{"x":3,"y":4}}]', 'value.x', 'value.y')).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('rejects invalid JSON with a helpful message', () => {
    expect(() => parseCoordinates('[[0, 1]')).toThrow('Enter coordinate data as a JSON array');
  });

  it.each(['null', '{}', '[]'])('rejects non-array or empty data: %s', (input) => {
    expect(() => parseCoordinates(input)).toThrow('Enter at least one coordinate pair');
  });

  it.each(['[1, 2]', '[[1]]', '[[1, 2, 3]]', '[[1, "2"]]', '[[1e999, 2]]'])(
    'rejects malformed or non-finite coordinate pairs: %s',
    (input) => {
      expect(() => parseCoordinates(input)).toThrow('Coordinate 1 must be a pair');
    },
  );

  it('reports missing nested values using the configured path', () => {
    expect(() => parseCoordinates('[{"metrics":{"time":2}}]', 'metrics.time', 'reading')).toThrow(
      'Coordinate 1 must have a finite number at Y key "reading".',
    );
  });

  it.each([
    ['X', '[{"x":null,"y":2}]', 'x', 'y'],
    ['X', '[{"x":"1","y":2}]', 'x', 'y'],
    ['Y', '[{"x":1,"y":1e999}]', 'x', 'y'],
  ])('rejects invalid object values for the %s axis', (axis, input, xKey, yKey) => {
    expect(() => parseCoordinates(input, xKey, yKey)).toThrow(
      `Coordinate 1 must have a finite number at ${axis} key "${axis === 'X' ? xKey : yKey}".`,
    );
  });

  it.each([
    ['', 'y', 'X'],
    ['x', '', 'Y'],
    ['x..value', 'y', 'X'],
    ['x', '.y', 'Y'],
  ])('rejects malformed property paths: %s, %s', (xKey, yKey, axis) => {
    expect(() => parseCoordinates('[{"x":1,"y":2}]', xKey, yKey)).toThrow(
      `Enter a valid ${axis} key path`,
    );
  });

  it('rejects invalid paths for object datasets but leaves tuple datasets compatible', () => {
    expect(parseCoordinates('[[1, 2]]', '', '')).toEqual([{ x: 1, y: 2 }]);
    expect(() => parseCoordinates('[{"x":1,"y":2}]', 'metrics..time', 'y')).toThrow(
      'Enter a valid X key path',
    );
  });
});
