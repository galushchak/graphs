import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphPlotter } from '../src/graph.ts';

let animationFrames = [];

function flushAnimationFrames() {
  const frames = animationFrames;
  animationFrames = [];
  frames.forEach((callback) => callback(0));
}

function createPlotter() {
  const calls = new Map();
  const listeners = new Map();
  const context = new Proxy(
    {},
    {
      get(_target, property) {
        if (!calls.has(property)) {
          calls.set(property, vi.fn());
        }
        return calls.get(property);
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 640, height: 480, left: 0, top: 0 }),
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    setPointerCapture: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn() },
  };

  globalThis.window = { devicePixelRatio: 1 };
  globalThis.requestAnimationFrame = vi.fn((callback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  globalThis.ResizeObserver = class {
    observe = vi.fn();
  };

  return { plotter: new GraphPlotter(canvas), canvas, calls, listeners };
}

afterEach(() => {
  delete globalThis.window;
  delete globalThis.requestAnimationFrame;
  delete globalThis.ResizeObserver;
  animationFrames = [];
});

describe('GraphPlotter', () => {
  it('rejects invalid horizontal domains', () => {
    const { plotter } = createPlotter();

    expect(() => plotter.setDomain({ min: 2, max: 2 })).toThrow(
      'The graph domain must have a finite minimum less than its maximum.',
    );
    expect(() => plotter.setDomain({ min: -Infinity, max: 2 })).toThrow(
      'The graph domain must have a finite minimum less than its maximum.',
    );
  });

  it('renders a compiled mathematical expression', () => {
    const { plotter, canvas, calls } = createPlotter();
    plotter.setDomain({ min: -2, max: 2 });
    plotter.setSeries([{ expression: 'x^2', color: '#123456', visible: true }]);
    flushAnimationFrames();

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(calls.get('lineTo')).toHaveBeenCalled();
    expect(calls.get('stroke')).toHaveBeenCalled();
  });

  it('rejects invalid expressions and empty coordinate datasets', () => {
    const { plotter } = createPlotter();

    expect(() =>
      plotter.setSeries([{ expression: 'x +', color: '#123456', visible: true }]),
    ).toThrow();
    expect(() => plotter.setSeries([{ points: [], color: '#123456', visible: true }])).toThrow(
      'Enter at least one coordinate or data object to plot a dataset.',
    );
  });

  it('renders mixed series using their individual graph types', () => {
    const { plotter, calls } = createPlotter();
    plotter.setDomain({ min: -2, max: 2 });
    plotter.setSeries([
      {
        expression: 'x^2',
        type: 'spline',
        color: '#123456',
        visible: true,
      },
      {
        expression: 'sin(x)',
        type: 'dots',
        color: '#123456',
        visible: true,
      },
      {
        points: [
          { x: -1, y: 2 },
          { x: 1, y: -1 },
        ],
        type: 'bars',
        color: '#123456',
        visible: true,
      },
    ]);
    flushAnimationFrames();

    expect(calls.get('bezierCurveTo')).toHaveBeenCalled();
    expect(calls.get('arc')).toHaveBeenCalled();
    expect(calls.get('fillRect')).toHaveBeenCalled();
  });

  it('composes dashed-line and point-marker decorators on curves', () => {
    const { plotter, calls } = createPlotter();
    plotter.setDomain({ min: -2, max: 2 });
    plotter.setSeries([
      {
        expression: 'x^2',
        type: 'line',
        color: '#123456',
        visible: true,
        dashed: true,
        markers: true,
      },
    ]);
    flushAnimationFrames();

    expect(calls.get('setLineDash')).toHaveBeenCalledWith([6, 4]);
    expect(calls.get('arc')).toHaveBeenCalled();
    expect(calls.get('stroke')).toHaveBeenCalled();
  });

  it('coalesces redraws requested within the same animation frame', () => {
    const { plotter, calls } = createPlotter();
    plotter.setDomain({ min: -2, max: 2 });
    plotter.setSeries([{ expression: 'x^2', color: '#123456', visible: true }]);

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushAnimationFrames();
    expect(calls.get('stroke')).toHaveBeenCalled();
  });

  it('reports finite values that overflow the automatic vertical range', () => {
    const { plotter } = createPlotter();
    const onError = vi.fn();
    plotter.setOnError(onError);
    plotter.setSeries([
      { points: [{ x: 0, y: Number.MAX_VALUE }], color: '#123456', visible: true },
    ]);

    flushAnimationFrames();

    expect(onError).toHaveBeenCalledWith('The plotted values are too large to display safely.');
  });

  it('clamps a zoom drag that ends outside the plot to the plot edge', () => {
    const { plotter, listeners } = createPlotter();
    const onZoom = vi.fn();
    plotter.setOnZoom(onZoom);
    plotter.setDomain({ min: -10, max: 10 });
    flushAnimationFrames();

    listeners.get('pointerdown')({
      button: 0,
      clientX: 100,
      clientY: 80,
      pointerId: 1,
      preventDefault: vi.fn(),
    });
    listeners.get('pointermove')({ clientX: 635, clientY: 180 });
    listeners.get('pointerup')({ clientX: 635, clientY: 180 });

    expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ max: 10 }));
  });
});
