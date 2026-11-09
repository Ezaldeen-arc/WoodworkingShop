import { getMaterial } from '../../engine/materials/materials';
export const walls = ['A', 'B', 'C'] as const;
export const rows = ['base', 'upper'] as const;
export type Wall = (typeof walls)[number];
export type Row = (typeof rows)[number];
export interface Run {
  count: number;
  depth: number;
  height: number;
  start: number;
  end: number;
}
export interface UnitSettings {
  lockedWidth?: number;
  depth?: number;
  height?: number;
  shelves?: number;
  material?: string;
}
export interface Kitchen {
  units: Record<string, UnitSettings>;
  name: string;
  lengths: Record<Wall, number>;
  cornerGap: number;
  ceiling: number;
  kick: number;
  top: number;
  gap: number;
  runs: Record<Wall, Record<Row, Run>>;
}
export interface Box {
  id: string;
  wall: Wall;
  row: Row;
  width: number;
  x: number;
  z: number;
  y: number;
  dx: number;
  dz: number;
  dy: number;
  shelves: number;
  material: string;
}
export function newKitchen(): Kitchen {
  const run = (count: number, upper: boolean): Run => ({
    count,
    depth: upper ? 330 : 600,
    height: upper ? 700 : 720,
    start: 0,
    end: 0,
  });
  const pair = (b: number, u: number) => ({ base: run(b, false), upper: run(u, true) });
  return {
    units: {},
    name: 'U kitchen',
    lengths: { A: 2800, B: 4100, C: 3000 },
    cornerGap: 30,
    ceiling: 2600,
    kick: 100,
    top: 38,
    gap: 550,
    runs: { A: pair(3, 2), B: pair(5, 4), C: pair(4, 3) },
  };
}
export function layoutKitchen(k: Kitchen) {
  const boxes: Box[] = [],
    errors: string[] = [];
  const totals: { wall: Wall; row: Row; corner: number; fillers: number; used: number; remaining: number }[] = [];
  for (const wall of walls)
    for (const row of rows) {
      const r = k.runs[wall][row];
      // Reserve rectangular void corners in both directions. Use the larger adjacent
      // row depth so independently positioned rows cannot cross a corner in height.
      const reserve = (w: Wall) =>
        Math.max(
          0,
          ...rows.flatMap((v) =>
            Array.from(
              { length: k.runs[w][v].count },
              (_, i) => k.units[w + '-' + v + '-' + (i + 1)]?.depth ?? k.runs[w][v].depth,
            ),
          ),
        ) + (k.cornerGap ?? 30);
      const lead = wall === 'B' ? reserve('A') : reserve('B');
      const tail = wall === 'B' ? reserve('C') : 0;
      const available = k.lengths[wall] - lead - tail - r.start - r.end;
      const y = row === 'base' ? k.kick : k.kick + k.runs[wall].base.height + k.top + k.gap;
      const keys = Array.from({ length: r.count }, (_, i) => wall + '-' + row + '-' + (i + 1));
      const locked = keys.flatMap((id) => (k.units[id]?.lockedWidth === undefined ? [] : [k.units[id].lockedWidth!]));
      const fixed = locked.reduce((a, b) => a + b, 0),
        free = r.count - locked.length;
      const width = free ? (available - fixed) / free : 0;
      if (fixed > available + 0.00001 || locked.some((w) => w <= 36)) {
        errors.push(wall + ' ' + row + ': locked widths exceed usable space or are too narrow.');
        continue;
      }
      if (r.count && ((free > 0 && width <= 36) || y + r.height > k.ceiling || r.depth <= 20 || r.height <= 36)) {
        errors.push(wall + ' ' + row + ': insufficient space for this row.');
        continue;
      }
      if (available < 0) {
        errors.push(wall + ' ' + row + ': reservations exceed wall length.');
        continue;
      }
      totals.push({
        wall,
        row,
        corner: lead + tail,
        fillers: r.start + r.end,
        used: fixed + width * free,
        remaining: free ? 0 : available - fixed,
      });
      let pos = lead + r.start;
      for (let i = 0; i < r.count; i++) {
        const options = k.units[keys[i]];
        const unitWidth = options?.lockedWidth ?? width;
        const depth = options?.depth ?? r.depth,
          height = options?.height ?? r.height;
        const t = getMaterial(options?.material ?? 'melamine-18').thickness;
        if (
          y + height > k.ceiling ||
          height <= 2 * t ||
          unitWidth <= 2 * t + 2 ||
          depth <= 20 ||
          (options?.shelves ?? 1) * t >= height - 2 * t ||
          (row === 'base' && y + height + k.top > k.ceiling)
        ) {
          errors.push(keys[i] + ': check panel, shelf and ceiling clearances.');
        }
        boxes.push({
          id: keys[i],
          wall,
          row,
          width: unitWidth,
          shelves: options?.shelves ?? 1,
          material: options?.material ?? 'melamine-18',
          y,
          dy: height,
          x: wall === 'B' ? pos : wall === 'A' ? 0 : k.lengths.B - depth,
          z: wall === 'B' ? 0 : pos,
          dx: wall === 'B' ? unitWidth : depth,
          dz: wall === 'B' ? depth : unitWidth,
        });
        pos += unitWidth;
      }
    }
  for (let i = 0; i < boxes.length; i++)
    for (const b of boxes.slice(i + 1)) {
      const a = boxes[i];
      if (
        Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x) > 0.001 &&
        Math.min(a.y + a.dy, b.y + b.dy) - Math.max(a.y, b.y) > 0.001 &&
        Math.min(a.z + a.dz, b.z + b.dz) - Math.max(a.z, b.z) > 0.001
      )
        errors.push(a.id + ' overlaps ' + b.id);
    }
  return { boxes: errors.length ? [] : boxes, errors, totals };
}
