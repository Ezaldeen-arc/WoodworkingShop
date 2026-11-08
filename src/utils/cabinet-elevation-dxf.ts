import type { CabinetConfig, Material } from '../engine/core/types';
import { getMaterial } from '../engine/materials/materials';

// R12 ASCII uses simple entities and anonymous picture blocks for editable dimensions.
// Model space is drawn 1:1 in millimetres. Each view has its own geometry layer.
type Point = readonly [number, number];
function tags(...values: (string | number)[]): string {
  return values.join('\r\n') + '\r\n';
}
function section(name: string, body: string): string {
  return tags(0, 'SECTION', 2, name) + body + tags(0, 'ENDSEC');
}
function line(layer: string, [x, y]: Point, [u, v]: Point): string {
  return tags(0, 'LINE', 8, layer, 10, x, 20, y, 30, 0, 11, u, 21, v, 31, 0);
}
function label(layer: string, [x, y]: Point, value: string, angle = 0): string {
  return tags(0, 'TEXT', 8, layer, 10, x, 20, y, 30, 0, 40, 12, 1, value, 50, angle);
}
function outline(layer: string, x: number, width: number, height: number): string {
  return (
    line(layer, [x, 0], [x + width, 0]) +
    line(layer, [x + width, 0], [x + width, height]) +
    line(layer, [x + width, height], [x, height]) +
    line(layer, [x, height], [x, 0])
  );
}

export function cabinetElevationDxf(config: CabinetConfig, customMaterials: Material[] = []): string {
  const { width, height, depth } = config;
  const thickness = getMaterial(config.carcassMaterial, customMaterials).thickness;
  const count = config.shelfCentreSupports ?? 0;
  const inside = width - 2 * thickness;
  const side = width + 240;
  let geometry = outline('FRONT', 0, width, height) + outline('SIDE', side, depth, height);
  const blocks: string[] = [];
  function dimension(start: Point, end: Point, offset: number, vertical = false) {
    const project = ([x, y]: Point): Point => (vertical ? [x + offset, y] : [x, y + offset]);
    const a = project(start);
    const b = project(end);
    const text: Point = [(a[0] + b[0]) / 2 - (vertical ? 4 : 0), (a[1] + b[1]) / 2 + (vertical ? 0 : 4)];
    const name = '*D' + (blocks.length + 1);
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
    let picture = line('0', start, a) + line('0', end, b) + line('0', a, b);
    for (const [x, y] of [a, b]) picture += line('0', [x - 4, y - 4], [x + 4, y + 4]);
    picture += label('0', text, String(Number(distance.toFixed(3))), vertical ? 90 : 0);
    blocks.push(
      tags(0, 'BLOCK', 8, '0', 2, name, 70, 1, 10, 0, 20, 0, 30, 0, 3, name, 1, '') +
        picture +
        tags(0, 'ENDBLK', 8, '0'),
    );
    geometry += tags(
      0,
      'DIMENSION',
      8,
      'DIMENSIONS',
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
      'STANDARD',
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
  geometry += label('LABELS', [0, -90], 'FRONT - CARCASS (mm)') + label('LABELS', [side, -90], 'SIDE (mm)');
  const layers = ['0', 'FRONT', 'SIDE', 'DIMENSIONS', 'LABELS'];
  const table =
    tags(0, 'TABLE', 2, 'LAYER', 70, layers.length) +
    layers.map((layer, i) => tags(0, 'LAYER', 2, layer, 70, 0, 62, [7, 7, 7, 4, 7][i], 6, 'CONTINUOUS')).join('') +
    tags(0, 'ENDTAB');
  return (
    section(
      'HEADER',
      tags(9, '$ACADVER', 1, 'AC1009', 9, '$LUNITS', 70, 2, 9, '$DIMTXT', 40, 12, 9, '$DIMASZ', 40, 4),
    ) +
    section('TABLES', table) +
    section('BLOCKS', blocks.join('')) +
    section('ENTITIES', geometry) +
    tags(0, 'EOF')
  );
}
