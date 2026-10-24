import type { GraphPoint } from './graph';

export function parseCoordinates(text: string, xKey = 'x', yKey = 'y'): GraphPoint[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      'Enter coordinate data as a JSON array, for example [[0, 1], [2, 3]] or [{"x": 0, "y": 1}].',
    );
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Enter at least one coordinate pair or data object in a JSON array.');
  }

  let xPath: string[] | undefined;
  let yPath: string[] | undefined;

  return value.map((entry: unknown, index: number) => {
    if (Array.isArray(entry)) {
      if (
        entry.length !== 2 ||
        typeof entry[0] !== 'number' ||
        typeof entry[1] !== 'number' ||
        !Number.isFinite(entry[0]) ||
        !Number.isFinite(entry[1])
      ) {
        throw new Error(`Coordinate ${index + 1} must be a pair of finite numbers: [x, y].`);
      }
      return { x: entry[0], y: entry[1] };
    }

    if (!isObject(entry)) {
      throw new Error(`Coordinate ${index + 1} must be a pair or a data object.`);
    }

    xPath ??= splitKeyPath(xKey, 'X');
    yPath ??= splitKeyPath(yKey, 'Y');
    const x = readPath(entry, xPath);
    const y = readPath(entry, yPath);
    if (typeof x !== 'number' || !Number.isFinite(x)) {
      throw new Error(`Coordinate ${index + 1} must have a finite number at X key "${xKey}".`);
    }
    if (typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error(`Coordinate ${index + 1} must have a finite number at Y key "${yKey}".`);
    }
    return { x, y };
  });
}

function splitKeyPath(key: string, axis: string): string[] {
  const path = key.trim();
  if (!path || path.split('.').some((part) => !part.trim())) {
    throw new Error(`Enter a valid ${axis} key path, for example "${axis.toLowerCase()}".`);
  }
  return path.split('.').map((part) => part.trim());
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isObject(current) || !Object.hasOwn(current, key)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
