import { describe, expect, it } from 'vitest';
import { cabinetElevationDxf } from '../../src/utils/cabinet-elevation-dxf';
import { cfg } from '../helpers';

describe('cabinet elevation DXF', () => {
  it.each([
    [1800, 2, [579, 570, 579]],
    [2100, 2, [679, 670, 679]],
    [1800, 0, [1764]],
  ] as const)('measures the openings at width %i with %i dividers', (width, shelfCentreSupports, bays) => {
    const file = cabinetElevationDxf(
      cfg({
        furnitureType: 'wardrobe',
        width,
        height: 2400,
        depth: 600,
        carcassMaterial: 'melamine-18',
        shelfCentreSupports,
      }),
    );
    const pairs = file.trimEnd().split('\r\n');
    const dims: Map<number, string>[] = [];
    let current: Map<number, string> | undefined;
    for (let i = 0; i < pairs.length; i += 2) {
      const code = Number(pairs[i]);
      const value = pairs[i + 1];
      if (code === 0) {
        current = value === 'DIMENSION' ? new Map() : undefined;
        if (current) dims.push(current);
      } else current?.set(code, value);
    }
    expect(
      dims.map((d) => Math.hypot(Number(d.get(14)) - Number(d.get(13)), Number(d.get(24)) - Number(d.get(23)))),
    ).toEqual([...bays, width, 600, 2400, 2364]);
    for (const d of dims) {
      expect(d.get(8)).toBe('DIMENSIONS');
      expect(file).toContain('BLOCK\r\n8\r\n0\r\n2\r\n' + d.get(2) + '\r\n');
    }
  });
});
