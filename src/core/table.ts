import type { Column } from './model';

export function columnPercentages(columns: Column[]): number[] {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  return columns.map(column => column.width / total * 100);
}

// Move a boundary between adjacent columns; preserve the table's outer width.
export function resizeColumnBoundary(columns: Column[], index: number, deltaPercent: number, minimumPercent = 1): Column[] {
  if (index < 0 || index >= columns.length - 1 || !Number.isFinite(deltaPercent)) return columns;
  const widths = columnPercentages(columns);
  const pair = widths[index] + widths[index + 1];
  const minimum = Math.min(Math.max(1, minimumPercent), pair / 2);
  const left = Math.min(pair - minimum, Math.max(minimum, widths[index] + deltaPercent));
  widths[index] = left;
  widths[index + 1] = pair - left;
  return columns.map((column, i) => ({ ...column, width: widths[i] }));
}
