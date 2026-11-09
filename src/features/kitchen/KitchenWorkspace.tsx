import { generateParts } from '../../engine/geometry/parts';
import { DEFAULT_CONFIG, panelMaterials, getMaterial } from '../../engine/materials/materials';
import { triggerDownload } from '../../utils/download';
import { useState, type ReactNode } from 'react';
import { KitchenScene } from './KitchenScene';
import { layoutKitchen, newKitchen, rows, walls, type Kitchen, type Row, type Wall } from './kitchen-model';
function Metric({
  label,
  value,
  min = 0,
  max = 20000,
  change,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  change: (n: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      {label}
      <input
        className="w-24 rounded border p-1"
        key={value}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isInteger(n) && n >= min && n <= max) {
            if (n !== value) change(n);
          } else {
            e.currentTarget.reportValidity();
            e.currentTarget.value = String(value);
          }
        }}
      />
    </label>
  );
}
export function KitchenWorkspace({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).get('mode') === 'kitchen');
  const [k, set] = useState<Kitchen>(() => {
      try {
        const raw = sessionStorage.getItem('arccabinet.kitchen.draft.v1');
        if (raw) {
          const draft: Kitchen = JSON.parse(raw);
          layoutKitchen(draft);
          return draft;
        }
      } catch {
        /* Start with a fresh layout if the draft cannot be loaded. */
      }
      return newKitchen();
    }),
    [wall, choose] = useState<Wall>('B'),
    [row, setRow] = useState<Row>('base');
  const [unit, setUnit] = useState('');
  const [history, setHistory] = useState<Kitchen[]>([]),
    [future, setFuture] = useState<Kitchen[]>([]);
  const [message, setMessage] = useState('');
  const storageKey = 'arccabinet.kitchens.v1';
  function projects(): Record<string, Kitchen> {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  }
  const [names, setNames] = useState<string[]>(() => {
    try {
      return Object.keys(projects());
    } catch {
      return [];
    }
  });
  function remember(d: Kitchen) {
    set(d);
    try {
      sessionStorage.setItem('arccabinet.kitchen.draft.v1', JSON.stringify(d));
    } catch {
      setMessage('Draft storage unavailable.');
    }
  }
  function apply(d: Kitchen) {
    setHistory((h) => [...h.slice(-49), k]);
    setFuture([]);
    remember(d);
  }
  function save(copy = false) {
    try {
      const all = new Map(Object.entries(projects()));
      let name = k.name.trim();
      if (!name) {
        setMessage('Enter a kitchen name.');
        return;
      }
      if (copy) {
        let n = 1;
        while (all.has(name + ' copy ' + n)) n++;
        name += ' copy ' + n;
      }
      const snapshot = { ...k, name };
      all.set(name, snapshot);
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(all)));
      if (copy) apply(snapshot);
      setNames([...all.keys()]);
      setMessage('Saved ' + name);
    } catch {
      setMessage('Could not save kitchen in this browser.');
    }
  }
  const update = (fn: (draft: Kitchen) => void) => {
    const draft = structuredClone(k);
    fn(draft);
    apply(draft);
  };
  const scene = layoutKitchen(k),
    run = k.runs[wall][row];
  const selected = scene.boxes.find((b) => b.id === unit);
  function patchUnit(patch: Partial<Kitchen['units'][string]>) {
    update((d) => {
      d.units[unit] = { ...d.units[unit], ...patch };
    });
  }
  function cutList() {
    const lines = [
      [
        'Unit',
        'Panel ID',
        'Part',
        'Quantity',
        'Length mm',
        'Width mm',
        'Thickness mm',
        'Material',
        'Edge banding',
        'Grain',
      ],
    ];
    for (const b of scene.boxes) {
      const cfg = {
        ...DEFAULT_CONFIG,
        width: b.width,
        height: b.dy,
        depth: b.wall === 'B' ? b.dz : b.dx,
        shelfCount: b.shelves,
        carcassMaterial: b.material,
        kickHeight: 0,
        drawerCount: 0,
      };
      for (const p of generateParts(cfg))
        lines.push([
          b.id,
          b.id + '-' + p.id,
          p.name.en,
          String(p.qty),
          p.length.toFixed(3),
          p.width.toFixed(3),
          String(p.thickness),
          p.material,
          p.edgeBanding.en,
          p.grainConstraint ?? (getMaterial(p.material).hasGrain ? 'along-length' : 'unrestricted'),
        ]);
    }
    triggerDownload(
      lines.map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
      'kitchen-panels.csv',
    );
  }
  return (
    <>
      <div className="flex gap-2">
        <button aria-pressed={!mode} onClick={() => setMode(false)}>
          Individual cabinet
        </button>
        <button aria-pressed={mode} onClick={() => setMode(true)}>
          Full Kitchen Designer
        </button>
      </div>
      {mode ? (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-xl font-semibold">U-shaped kitchen</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              Kitchen name{' '}
              <input
                className="border p-1"
                value={k.name}
                onChange={(e) =>
                  update((d) => {
                    d.name = e.target.value;
                  })
                }
              />
            </label>
            <button disabled={!!scene.errors.length} onClick={() => save()}>
              Save kitchen
            </button>
            <button disabled={!!scene.errors.length} onClick={() => save(true)}>
              Duplicate kitchen
            </button>
            <select
              aria-label="Open kitchen"
              value=""
              onChange={(e) => {
                try {
                  const saved = projects()[e.target.value];
                  if (saved) {
                    apply(saved);
                    setUnit('');
                    setMessage('Opened ' + saved.name);
                  }
                } catch {
                  setMessage('Cannot open kitchen');
                }
              }}
            >
              <option value="">Open kitchen…</option>
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <button
              disabled={!history.length}
              onClick={() => {
                setFuture([...future, k]);
                remember(history[history.length - 1]);
                setHistory(history.slice(0, -1));
              }}
            >
              Undo kitchen edit
            </button>
            <button
              disabled={!future.length}
              onClick={() => {
                setHistory([...history, k]);
                remember(future[future.length - 1]);
                setFuture(future.slice(0, -1));
              }}
            >
              Redo kitchen edit
            </button>
            <span role="status">{message}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {walls.map((w) => (
              <Metric
                key={w}
                label={'Wall ' + w + ' length (mm)'}
                min={100}
                value={k.lengths[w]}
                change={(v) =>
                  update((d) => {
                    d.lengths[w] = v;
                  })
                }
              />
            ))}
            {(
              [
                ['ceiling', 'Ceiling'],
                ['cornerGap', 'Corner clearance'],
                ['kick', 'Toe kick'],
                ['top', 'Countertop thickness'],
                ['gap', 'Countertop to uppers'],
              ] as const
            ).map(([key, label]) => (
              <Metric
                key={key}
                label={label + ' (mm)'}
                value={k[key]}
                change={(v) =>
                  update((d) => {
                    d[key] = v;
                  })
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Wall{' '}
              <select
                aria-label="Active wall"
                value={wall}
                onChange={(e) => {
                  choose(e.target.value as Wall);
                  setUnit('');
                }}
              >
                {walls.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
            <label>
              Row{' '}
              <select
                aria-label="Active row"
                value={row}
                onChange={(e) => {
                  setRow(e.target.value as Row);
                  setUnit('');
                }}
              >
                {rows.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {(['count', 'height', 'depth', 'start', 'end'] as const).map((key) => (
              <Metric
                key={wall + row + key}
                label={key === 'count' ? 'Cabinet count' : key + ' (mm)'}
                value={run[key]}
                max={key === 'count' ? 40 : 10000}
                change={(v) =>
                  update((d) => {
                    d.runs[wall][row][key] = v;
                  })
                }
              />
            ))}
          </div>
          {scene.totals
            .filter((t) => t.wall === wall && t.row === row)
            .map((t) => (
              <p key={t.wall}>
                Countertop level {k.kick + k.runs[wall].base.height + k.top} mm · Inside wall {k.lengths[wall]} mm ·
                Corners {t.corner} mm · End allowances {t.fillers} mm · Cabinets {Math.round(t.used * 100) / 100} mm ·
                Unallocated {t.remaining} mm
              </p>
            ))}
          {scene.errors.length > 0 && <p role="alert">{scene.errors.join(' ')}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Unit{' '}
              <select aria-label="Kitchen unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">Choose unit…</option>
                {Array.from({ length: run.count }, (_, i) => wall + '-' + row + '-' + (i + 1)).map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </label>
            {unit && (
              <>
                <Metric
                  label="Unit width (locks mm)"
                  value={k.units[unit]?.lockedWidth ?? Number(selected?.width.toFixed(3) ?? 0)}
                  min={37}
                  change={(v) => patchUnit({ lockedWidth: v })}
                />
                <button
                  onClick={() =>
                    patchUnit({ lockedWidth: k.units[unit]?.lockedWidth === undefined ? selected?.width : undefined })
                  }
                >
                  {k.units[unit]?.lockedWidth === undefined ? 'Lock width' : 'Unlock width'}
                </button>
                <Metric
                  label="Unit depth (mm)"
                  min={21}
                  value={k.units[unit]?.depth ?? run.depth}
                  change={(depth) => patchUnit({ depth })}
                />
                <Metric
                  label="Unit height (mm)"
                  min={37}
                  value={k.units[unit]?.height ?? run.height}
                  change={(height) => patchUnit({ height })}
                />
                <button onClick={() => patchUnit({ depth: undefined, height: undefined })}>Use row dimensions</button>
                <Metric
                  label="Unit shelves"
                  value={k.units[unit]?.shelves ?? 1}
                  max={12}
                  change={(v) => patchUnit({ shelves: v })}
                />
                <label>
                  Unit material{' '}
                  <select
                    value={k.units[unit]?.material ?? 'melamine-18'}
                    onChange={(e) => patchUnit({ material: e.target.value })}
                  >
                    {panelMaterials().map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name.en}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <button disabled={!scene.boxes.length} onClick={cutList}>
            Export kitchen cut list
          </button>
          <KitchenScene
            selected={unit}
            model={k}
            boxes={scene.boxes}
            wall={wall}
            select={(b) => {
              choose(b.wall);
              setRow(b.row);
              setUnit(b.id);
            }}
          />
          <p>
            {scene.boxes.length} cabinets{unit ? ' · Selected ' + unit : ''}
          </p>
        </section>
      ) : (
        children
      )}
    </>
  );
}
