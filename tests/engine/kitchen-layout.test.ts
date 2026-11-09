import { expect, it } from 'vitest';
import { layoutKitchen, newKitchen } from '../../src/features/kitchen/kitchen-model';
it('fits all 21 requested cabinets and reserves both shared corners', () => {
  const k = newKitchen();
  const s = layoutKitchen(k);
  expect(s.errors).toEqual([]);
  expect(s.boxes).toHaveLength(21);
  const b = s.boxes.filter((v) => v.wall === 'B' && v.row === 'base');
  expect(b[0].x).toBe(630);
  expect(b.at(-1)!.x + b.at(-1)!.dx).toBe(3470);
  expect(b.every((v) => v.width === 568)).toBe(true);
  k.lengths.B = 900;
  expect(layoutKitchen(k).boxes).toEqual([]);
});

it('keeps a locked unit fixed through redistribution and reports overflow', () => {
  const k = newKitchen();
  k.runs.B.base.count = 6;
  k.units['B-base-2'] = { lockedWidth: 620, shelves: 3 };
  const before = layoutKitchen(k);
  expect(before.errors).toEqual([]);
  const units = before.boxes.filter((b) => b.wall === 'B' && b.row === 'base');
  expect(units.map((b) => b.width)).toEqual([444, 620, 444, 444, 444, 444]);
  k.gap += 80;
  const after = layoutKitchen(k);
  expect(after.boxes.find((b) => b.id === 'B-upper-1')!.y - before.boxes.find((b) => b.id === 'B-upper-1')!.y).toBe(80);
  expect(layoutKitchen(JSON.parse(JSON.stringify(k)))).toEqual(after);
  k.units['B-base-2'].lockedWidth = 3000;
  expect(layoutKitchen(k).boxes).toEqual([]);
});
