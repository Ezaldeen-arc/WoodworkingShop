import { computeEqualShelfPositions } from '../engine/geometry/dimensions';
import { generateParts } from '../engine/geometry/parts';
import template from './cabinet-elevation-template.dxf?raw';
import type { CabinetConfig, Material } from '../engine/core/types';
import { getMaterial } from '../engine/materials/materials';

// R2000 scaffold contains metric tables, model/paper space and the CABINET_MM style.
const textHeight = 18;
const arrowSize = 8;
type Point = readonly [number, number];
function tags(...values: (string | number)[]): string {
  return values.join('\r\n') + '\r\n';
}
export type SheetMark =
  { kind: 'line'; a: Point; b: Point } | { kind: 'text'; at: Point; value: string; angle: number };
export interface DrawingView {
  title: string;
  origin: number;
  width: number;
  height: number;
  marks: SheetMark[];
}
export function cabinetElevationDxf(
  config: CabinetConfig,
  customMaterials: Material[] = [],
  views?: DrawingView[],
): string {
  const { width, height, depth } = config;
  const thickness = getMaterial(config.carcassMaterial, customMaterials).thickness;
  const count = config.shelfCentreSupports ?? 0;
  const inside = width - 2 * thickness;
  const side = width + 240;
  let active: DrawingView = { title: 'Front and side elevations', origin: 0, width: side + depth, height, marks: [] };
  views?.push(active);
  let rightEdge = side + depth;
  function nextView(title: string, w: number, h: number) {
    const origin = rightEdge + 500;
    active = { title, origin, width: w, height: h, marks: [] };
    views?.push(active);
    rightEdge = origin + w;
    return origin;
  }
  let nextHandle = 0x100;
  const handle = () => (nextHandle++).toString(16).toUpperCase();
  const modelSpace = '17'; // BLOCK_RECORD handles from the bundled template.
  const blockTable = '9';
  let owner = modelSpace;
  const records: string[] = [];
  function entity(type: string, layer: string, subclass: string) {
    return tags(0, type, 5, handle(), 330, owner, 100, 'AcDbEntity', 8, layer, 100, subclass);
  }
  function line(layer: string, [x, y]: Point, [u, v]: Point): string {
    if (views) active.marks.push({ kind: 'line', a: [x - active.origin, y], b: [u - active.origin, v] });
    return entity('LINE', layer, 'AcDbLine') + tags(10, x, 20, y, 30, 0, 11, u, 21, v, 31, 0);
  }
  function label(layer: string, [x, y]: Point, value: string, angle = 0): string {
    if (views) active.marks.push({ kind: 'text', at: [x - active.origin, y], value, angle });
    return (
      entity('TEXT', layer, 'AcDbText') +
      tags(10, x, 20, y, 30, 0, 40, textHeight, 1, value, 50, angle, 72, 1, 11, x, 21, y, 31, 0, 100, 'AcDbText')
    );
  }
  function outline(layer: string, x: number, width: number, height: number): string {
    return (
      line(layer, [x, 0], [x + width, 0]) +
      line(layer, [x + width, 0], [x + width, height]) +
      line(layer, [x + width, height], [x, height]) +
      line(layer, [x, height], [x, 0])
    );
  }

  let geometry = outline('FRONT', 0, width, height) + outline('SIDE', side, depth, height);
  const blocks: string[] = [];
  function dimension(start: Point, end: Point, offset: number, vertical = false) {
    const project = ([x, y]: Point): Point => (vertical ? [x + offset, y] : [x, y + offset]);
    const a = project(start);
    const b = project(end);
    const text: Point = [(a[0] + b[0]) / 2 - (vertical ? 13 : 0), (a[1] + b[1]) / 2 + (vertical ? 0 : 13)];
    const name = '*D' + (blocks.length + 1);
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
    owner = handle();
    records.push(
      tags(
        0,
        'BLOCK_RECORD',
        5,
        owner,
        330,
        blockTable,
        100,
        'AcDbSymbolTableRecord',
        100,
        'AcDbBlockTableRecord',
        2,
        name,
      ),
    );
    const begin = entity('BLOCK', '0', 'AcDbBlockBegin') + tags(2, name, 70, 1, 10, 0, 20, 0, 30, 0, 3, name, 1, '');
    let picture = line('0', a, b);
    for (const [index, tip] of [a, b].entries()) {
      const dir = index === 0 ? 1 : -1;
      const [x, y] = tip;
      const baseX = x + (vertical ? 0 : dir * arrowSize);
      const baseY = y + (vertical ? dir * arrowSize : 0);
      const dx = vertical ? 2 : 0;
      const dy = vertical ? 0 : 2;
      if (views)
        for (const sign of [-1, 1])
          active.marks.push({
            kind: 'line',
            a: [x - active.origin, y],
            b: [baseX + sign * dx - active.origin, baseY + sign * dy],
          });
      picture +=
        entity('SOLID', '0', 'AcDbTrace') +
        tags(
          10,
          x,
          20,
          y,
          30,
          0,
          11,
          baseX - dx,
          21,
          baseY - dy,
          31,
          0,
          12,
          baseX + dx,
          22,
          baseY + dy,
          32,
          0,
          13,
          baseX + dx,
          23,
          baseY + dy,
          33,
          0,
        );
      const origin = index === 0 ? start : end;
      const sign = Math.sign(offset);
      const advance = (p: Point, delta: number): Point =>
        vertical ? [p[0] + sign * delta, p[1]] : [p[0], p[1] + sign * delta];
      picture += line('0', advance(origin, 2), advance(tip, 4));
    }
    picture += label('0', text, String(Number(distance.toFixed(3))), vertical ? 90 : 0);
    blocks.push(begin + picture + entity('ENDBLK', '0', 'AcDbBlockEnd'));
    owner = modelSpace;
    geometry +=
      entity('DIMENSION', 'DIMENSIONS', 'AcDbDimension') +
      tags(
        2,
        name,
        10,
        b[0],
        20,
        b[1],
        30,
        0,
        11,
        text[0],
        21,
        text[1],
        31,
        0,
        70,
        32,
        1,
        '<>',
        3,
        'CABINET_MM',
        100,
        'AcDbAlignedDimension',
        13,
        start[0],
        23,
        start[1],
        33,
        0,
        14,
        end[0],
        24,
        end[1],
        34,
        0,
        50,
        vertical ? 90 : 0,
        100,
        'AcDbRotatedDimension',
      );
  }

  for (const x of [thickness, width - thickness]) geometry += line('FRONT', [x, 0], [x, height]);
  for (const y of [thickness, height - thickness]) geometry += line('FRONT', [thickness, y], [width - thickness, y]);
  let left = thickness;
  for (let i = 1; i <= count; i++) {
    // The preview spaces divider centre lines evenly across the inside width.
    const centre = thickness + (inside * i) / (count + 1);
    const right = centre - thickness / 2;
    dimension([left, height - thickness], [right, height - thickness], 65);
    left = centre + thickness / 2;
    for (const x of [right, left]) geometry += line('FRONT', [x, thickness], [x, height - thickness]);
  }
  dimension([left, height - thickness], [width - thickness, height - thickness], 65);
  dimension([0, 0], [width, 0], -50);
  dimension([side, 0], [side + depth, 0], -50);
  dimension([0, 0], [0, height], -55, true);
  dimension([width - thickness, thickness], [width - thickness, height - thickness], 75, true);
  geometry +=
    label('LABELS', [width / 2, -100], 'FRONT - CARCASS (mm)') + label('LABELS', [side + depth / 2, -100], 'SIDE (mm)');
  if (views) {
    const parts = generateParts(config, customMaterials);
    const positions =
      config.shelfSpacing === 'custom' && config.customShelfPositions.length
        ? config.customShelfPositions
        : computeEqualShelfPositions(height - 2 * thickness, config.shelfCount);
    const shelf = parts.find((p) => p.name.en === 'Adjustable Shelf');
    if (shelf)
      for (const pos of positions) {
        const left = (width - shelf.length) / 2;
        for (const y of [thickness + pos - shelf.thickness / 2, thickness + pos + shelf.thickness / 2])
          geometry += line('FRONT', [left, y], [left + shelf.length, y]);
      }
    const x = nextView('Vertical section through shelf bay', depth, height);
    geometry += outline('SIDE', x, depth, height);
    for (const y of [thickness, height - thickness]) geometry += line('SIDE', [x, y], [x + depth, y]);
    if (shelf) {
      for (const pos of positions) {
        const y = thickness + pos;
        for (const edge of [y - thickness / 2, y + thickness / 2])
          geometry += line('SIDE', [x, edge], [x + shelf.width, edge]);
      }
      const levels = [thickness, ...positions.map((p) => p + thickness).sort((a, b) => a - b), height - thickness];
      for (let i = 1; i < levels.length; i++) dimension([x, levels[i - 1]], [x, levels[i]], -90, true);
    }
    dimension([x, 0], [x + depth, 0], -50);
    geometry += label('LABELS', [x + depth / 2, -105], 'SHELF SECTION - CENTRE LEVELS');
    const plan = nextView('Top plan', width, depth);
    geometry += outline('FRONT', plan, width, depth);
    for (const xx of [plan + thickness, plan + width - thickness]) geometry += line('FRONT', [xx, 0], [xx, depth]);
    dimension([plan, 0], [plan + width, 0], -55);
    dimension([plan + width, 0], [plan + width, depth], 75, true);
    geometry += label('LABELS', [plan + width / 2, -105], 'TOP PLAN');
    const support = parts.find((p) => p.name.en === 'Centre Support');
    if (support) {
      const hx = nextView('Horizontal section through dividers', width, depth);
      geometry += outline('FRONT', hx, width, depth);
      for (const offset of [thickness, width - thickness])
        geometry += line('FRONT', [hx + offset, 0], [hx + offset, depth]);
      for (let n = 1; n <= count; n++) {
        const cx = hx + thickness + (inside * n) / (count + 1);
        geometry += outline('FRONT', cx - support.thickness / 2, support.thickness, support.width);
      }
      dimension([hx, 0], [hx + thickness, 0], -60);
      dimension([hx + width, 0], [hx + width, depth], 75, true);
      geometry += label('LABELS', [hx + width / 2, -115], 'HORIZONTAL SECTION - UPRIGHTS');
    }
    for (const p of parts.filter((p) => p.name.en !== 'Hanging Rail')) {
      const px = nextView(p.id + ' / ' + p.name.en, p.width, p.length);
      geometry += outline('FRONT', px, p.width, p.length);
      dimension([px, 0], [px + p.width, 0], -60);
      dimension([px, 0], [px, p.length], -60, true);
      geometry += label(
        'LABELS',
        [px + p.width / 2, -115],
        p.id + ' ' + p.name.en.toUpperCase() + ' / T ' + p.thickness + ' / QTY ' + p.qty,
      );
    }
  }
  return template
    .replace(/@RECORDS@|@BLOCKS@|@ENTITIES@|@NEXT@|@CX@|@CY@|@HEIGHT@/g, (token) => {
      switch (token) {
        case '@CX@':
          return String((rightEdge - 70) / 2);
        case '@CY@':
          return String((height - 40) / 2);
        case '@HEIGHT@':
          return String(1.15 * Math.max(height + 200, (rightEdge + 140) / 1.75));
        case '@RECORDS@':
          return records.join('').trimEnd();
        case '@BLOCKS@':
          return blocks.join('').trimEnd();
        case '@ENTITIES@':
          return geometry.trimEnd();
        default:
          return handle();
      }
    })
    .replace(/\r?\n/g, '\r\n');
}
