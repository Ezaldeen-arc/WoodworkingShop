import { generateParts } from '../../src/engine/geometry/parts';
import { describe, expect, it } from 'vitest';
import { cabinetElevationDxf, type DrawingView } from '../../src/utils/cabinet-elevation-dxf';
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
    expect(file).toContain('9\r\n$INSUNITS\r\n70\r\n4\r\n');
    expect(file.match(/\r\nSOLID\r\n/g)).toHaveLength(2 * dims.length);
    for (const d of dims) {
      expect(d.get(8)).toBe('DIMENSIONS');
      expect(d.get(3)).toBe('CABINET_MM');
      expect(file).toContain('AcDbBlockBegin\r\n2\r\n' + d.get(2) + '\r\n');
    }
  });
});

it.each([1800, 2100])('exports wardrobe panel details at their cut sizes for width %i', (width) => {
  const views: DrawingView[] = [];
  cabinetElevationDxf(
    cfg({
      width,
      height: 2400,
      depth: 600,
      furnitureType: 'wardrobe',
      carcassMaterial: 'melamine-18',
      shelfCount: 3,
      shelfCentreSupports: 2,
      drawerCount: 2,
      doorCount: 2,
      doorStyle: 'flat',
      doorReveal: 3,
    }),
    [],
    views,
  );
  function size(name: string) {
    const v = views.find((view) => view.title.endsWith(' / ' + name));
    return [v?.height, v?.width];
  }
  expect(size('Adjustable Shelf')).toEqual([width - 38, 580]);
  expect(size('Centre Support')).toEqual([2364, 580]);
  expect(size('Door')).toEqual([2394, (width - 8) / 2]);
  expect(size('Drawer 1 Front')).toEqual([180, width - 36]);
  expect(views.map((v) => v.title)).toContain('Horizontal section through dividers');
});

it('keeps a resized bay consistent in the panel schedule and the editable drawing', () => {
  const config = cfg({
    width: 1275,
    height: 2100,
    depth: 450,
    carcassMaterial: 'melamine-18',
    shelfCount: 3,
    shelfCentreSupports: 1,
    compartmentWeights: [831, 390],
  });
  const parts = generateParts(config);
  expect(parts.filter((p) => p.name.en.startsWith('Adjustable Shelf')).map((p) => [p.qty, p.length])).toEqual([
    [3, 829],
    [3, 388],
  ]);
  const views: DrawingView[] = [];
  cabinetElevationDxf(config, [], views);
  expect(views[0].marks.filter((m) => m.kind === 'text').map((m) => m.value)).toContain('390');
  expect(views.find((v) => v.title.endsWith('Adjustable Shelf / Bay 2'))?.height).toBe(388);
});
