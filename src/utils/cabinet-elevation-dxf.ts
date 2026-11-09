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
export function cabinetElevationDxf(config: CabinetConfig, customMaterials: Material[] = []): string {
  const { width, height, depth } = config;
  const thickness = getMaterial(config.carcassMaterial, customMaterials).thickness;
  const count = config.shelfCentreSupports ?? 0;
  const inside = width - 2 * thickness;
  const side = width + 240;
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
    return entity('LINE', layer, 'AcDbLine') + tags(10, x, 20, y, 30, 0, 11, u, 21, v, 31, 0);
  }
  function label(layer: string, [x, y]: Point, value: string, angle = 0): string {
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
  return template
    .replace(/@RECORDS@|@BLOCKS@|@ENTITIES@|@NEXT@|@CX@|@CY@|@HEIGHT@/g, (token) => {
      switch (token) {
        case '@CX@':
          return String((side + depth - 70) / 2);
        case '@CY@':
          return String((height - 40) / 2);
        case '@HEIGHT@':
          return String(1.15 * Math.max(height + 200, (side + depth + 140) / 1.75));
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
