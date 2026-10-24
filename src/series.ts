import type { GraphType } from './graph';

interface SeriesBase {
  id: string;
  name?: string;
  type: GraphType;
  color: string;
  visible: boolean;
  dashed: boolean;
  markers: boolean;
}

export interface FunctionEditableSeries extends SeriesBase {
  kind: 'function';
  expression: string;
}

export interface CoordinateEditableSeries extends SeriesBase {
  kind: 'coordinates';
  dataText: string;
  xKey: string;
  yKey: string;
}

export type EditableSeries = FunctionEditableSeries | CoordinateEditableSeries;

export const graphTypeOptions = [
  { value: 'line', label: 'Line' },
  { value: 'spline', label: 'Spline' },
  { value: 'dots', label: 'Dots' },
  { value: 'bars', label: 'Bars' },
] as const satisfies readonly { value: GraphType; label: string }[];

const palette = ['#5b65e8', '#e18a4b', '#24a487', '#c45b9b', '#d1a52e'];

export function isGraphType(value: string): value is GraphType {
  return graphTypeOptions.some((option) => option.value === value);
}

export function getSeriesName(item: EditableSeries): string {
  return item.name?.trim() || (item.kind === 'function' ? `f${item.id}(x)` : `Points ${item.id}`);
}

export function createSeries(id: string, kind: 'function'): FunctionEditableSeries;
export function createSeries(id: string, kind: 'coordinates'): CoordinateEditableSeries;
export function createSeries(id: string, kind: 'function' | 'coordinates'): EditableSeries;
export function createSeries(id: string, kind: 'function' | 'coordinates'): EditableSeries {
  const common = {
    id,
    type: 'line' as const,
    color: palette[(Number(id) - 1) % palette.length],
    visible: true,
    dashed: false,
    markers: false,
  };

  if (kind === 'coordinates') {
    return {
      ...common,
      kind,
      dataText: '[[-4, 3], [-2, -1], [0, 2], [2, 1], [4, 4]]',
      xKey: 'x',
      yKey: 'y',
    };
  }

  return {
    ...common,
    kind,
    expression: 'cos(x)',
  };
}

export function createInitialSeries(): EditableSeries[] {
  return [
    { ...createSeries('1', 'function'), expression: 'sin(x)' },
    { ...createSeries('2', 'function'), expression: '0.25 * x^2 - 2' },
  ];
}
