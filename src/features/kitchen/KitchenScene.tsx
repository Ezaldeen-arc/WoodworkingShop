import { getMaterial } from '../../engine/materials/materials';
import { useState, useRef } from 'react';
import type { Box, Kitchen, Wall } from './kitchen-model';
type P = [number, number, number];
export function KitchenScene({
  model,
  selected,
  boxes,
  wall,
  select,
}: {
  model: Kitchen;
  selected: string;
  boxes: Box[];
  wall: Wall;
  select: (b: Box) => void;
}) {
  const [angle, rotate] = useState(32),
    [plan, setPlan] = useState(false),
    [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const rad = (angle * Math.PI) / 180,
    c = plan ? 1 : Math.cos(rad),
    s = plan ? 0 : Math.sin(rad),
    pitch = plan ? Math.PI / 2 : 0.52;
  function project([x, y, z]: P) {
    return [x * c + z * s, (z * c - x * s) * Math.sin(pitch) - y * Math.cos(pitch)];
  }
  const path = (pts: P[]) => pts.map((p) => project(p).join(',')).join(' ');
  const { A, B, C } = model.lengths;
  const room: P[] = [
    [0, 0, A],
    [0, 0, 0],
    [B, 0, 0],
    [B, 0, C],
  ];
  const bounds = [...room, ...room.map(([x, , z]): P => [x, model.ceiling, z])].map(project);
  const xs = bounds.map((p) => p[0]),
    ys = bounds.map((p) => p[1]);
  const width = (Math.max(...xs) - Math.min(...xs) + 400) / zoom,
    height = (Math.max(...ys) - Math.min(...ys) + 400) / zoom;
  const [showBase, baseVisible] = useState(true),
    [showUpper, upperVisible] = useState(true);
  const faces = boxes
    .filter((b) => (b.row === 'base' ? showBase : showUpper))
    .flatMap((b) => {
      const { x, y, z, dx, dy, dz } = b,
        X = x + dx,
        Y = y + dy,
        Z = z + dz;
      const top: P[] = [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ];
      const sideX = s > 0 ? x : X,
        sideZ = c > 0 ? Z : z;
      const side: P[] = [
        [sideX, y, z],
        [sideX, Y, z],
        [sideX, Y, Z],
        [sideX, y, Z],
      ];
      const front: P[] = [
        [x, y, sideZ],
        [X, y, sideZ],
        [X, Y, sideZ],
        [x, Y, sideZ],
      ];
      return (plan ? [top] : [side, front, top]).map((pts, i) => ({
        b,
        pts,
        i,
        order:
          pts.reduce((sum, [px, py, pz]) => sum + (-px * s + pz * c) * Math.cos(pitch) + py * Math.sin(pitch), 0) / 4,
      }));
    })
    .sort((a, b) => a.order - b.order);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label>
          <input type="checkbox" checked={showBase} onChange={(e) => baseVisible(e.target.checked)} /> Base
        </label>
        <label>
          <input type="checkbox" checked={showUpper} onChange={(e) => upperVisible(e.target.checked)} /> Upper
        </label>
        <button onClick={() => setPlan(!plan)}>{plan ? 'Show 3D' : 'Floor plan'}</button>
        <label>
          Orbit <input type="range" min="-180" max="180" value={angle} onChange={(e) => rotate(+e.target.value)} />
        </label>
        <label>
          Zoom{' '}
          <input type="range" min=".55" max="2" step=".05" value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
            rotate(32);
          }}
        >
          Fit view
        </button>
      </div>
      <svg
        className="w-full rounded-lg border bg-white"
        style={{ height: 420, touchAction: 'none' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = drag.current;
          drag.current = { x: e.clientX, y: e.clientY };
          const rect = e.currentTarget.getBoundingClientRect();
          const scale = Math.max(width / rect.width, height / rect.height);
          setPan((v) => ({ x: v.x - (e.clientX - p.x) * scale, y: v.y - (e.clientY - p.y) * scale }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        viewBox={[
          (Math.max(...xs) + Math.min(...xs) - width) / 2 + pan.x,
          (Math.max(...ys) + Math.min(...ys) - height) / 2 + pan.y,
          width,
          height,
        ].join(' ')}
        aria-label="Complete kitchen scene"
      >
        {(['A', 'B', 'C'] as const).map((w, i) => (
          <polyline
            key={w}
            points={path(room.slice(i, i + 2))}
            fill="none"
            stroke={wall === w ? '#246c76' : '#8e9590'}
            strokeWidth="20"
          />
        ))}
        {faces.map(({ b, pts, i }) => {
          const showShelves =
            !plan &&
            ((b.wall === 'B' && i === 1 && c > 0) ||
              (b.wall === 'A' && i === 0 && s < 0) ||
              (b.wall === 'C' && i === 0 && s > 0));
          const color = getMaterial(b.material).color;
          return (
            <g key={b.id + i} onClick={() => select(b)}>
              <polygon
                data-unit={b.id}
                points={path(pts)}
                fill={showShelves ? '#615343' : color}
                stroke={b.id === selected ? '#b55c23' : b.wall === wall ? '#217380' : '#454843'}
                strokeWidth={b.wall === wall ? 9 : 4}
              >
                <title>{b.id + ' / ' + b.width.toFixed(1) + ' mm'}</title>
              </polygon>
              {showShelves &&
                Array.from({ length: b.shelves }, (_, n) => {
                  const t = getMaterial(b.material).thickness,
                    y = b.y + t + Math.round(((b.dy - 2 * t) * (n + 1)) / (b.shelves + 1));
                  const ends: P[] =
                    b.wall === 'B'
                      ? [
                          [b.x + t, y, b.z + b.dz],
                          [b.x + b.dx - t, y, b.z + b.dz],
                        ]
                      : [
                          [b.wall === 'A' ? b.x + b.dx : b.x, y, b.z + t],
                          [b.wall === 'A' ? b.x + b.dx : b.x, y, b.z + b.dz - t],
                        ];
                  return <polyline key={n} data-shelf={b.id} points={path(ends)} stroke={color} strokeWidth={t} />;
                })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
