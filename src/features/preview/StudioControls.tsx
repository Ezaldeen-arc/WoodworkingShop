import { useEffect, useState } from 'react';
import { useCabinetStore } from '../../store/cabinet-store';
import { useCustomMaterialsStore } from '../../store/custom-materials-store';
import {
  DEFAULT_CONFIG,
  HARD_LIMITS,
  panelMaterials,
  backMaterials,
  getMaterial,
} from '../../engine/materials/materials';
import { compartmentWidths } from '../../engine/geometry/dimensions';
import { generateParts } from '../../engine/geometry/parts';
import { duplicateProject, listProjects, saveProject, type SavedProject } from '../../utils/project-storage';
import { triggerDownload } from '../../utils/download';

function NumberField({
  label,
  value,
  min,
  max,
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  change: (v: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      {label}
      <input
        key={value}
        className="w-24 rounded border px-2 py-1"
        type="number"
        step="any"
        min={min}
        max={max}
        defaultValue={Number(value.toFixed(3))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n) && n >= min && n <= max) {
            if (Math.abs(n - value) > 0.00051) change(n);
          } else {
            e.currentTarget.reportValidity();
            e.currentTarget.value = String(value);
          }
        }}
      />
    </label>
  );
}
export function StudioControls() {
  const { config, setConfig, cabinets, activeCabinetIndex, projectName, setProjectName, loadProject, renameCabinet } =
    useCabinetStore();
  const materials = useCustomMaterialsStore((s) => s.materials);
  const t = getMaterial(config.carcassMaterial, materials).thickness;
  const widths = compartmentWidths(config, t);
  const [saved, setSaved] = useState<SavedProject[]>([]);
  const [message, status] = useState('');
  useEffect(() => {
    void listProjects()
      .then(setSaved)
      .catch(() => status('Local project storage unavailable'));
  }, []);
  const unit = cabinets[activeCabinetIndex].name;
  const supports = config.furnitureType === 'wardrobe' || config.furnitureType === 'cabinet';
  function open(p: SavedProject) {
    loadProject(structuredClone(p.cabinets));
    setProjectName(p.name);
    status('Opened ' + p.name);
  }
  async function save(copy: boolean) {
    try {
      if (!projectName.trim()) {
        status('Enter a project name');
        return;
      }
      if (copy) {
        const current = saved.find((p) => p.name === projectName);
        if (!current) {
          status('Save the project before duplicating');
          return;
        }
        open(await duplicateProject(current.id));
      } else {
        await saveProject(projectName, cabinets);
        status('Saved ' + projectName);
      }
      setSaved(await listProjects());
    } catch {
      status('Could not save project');
    }
  }
  function cutList() {
    const rows = [
      [
        'Cabinet',
        'Panel ID',
        'Component',
        'Qty',
        'Length mm',
        'Width mm',
        'Thickness mm',
        'Material',
        'Edges',
        'Grain',
      ],
    ];
    for (const p of generateParts(config, materials).filter((p) => p.name.en !== 'Hanging Rail')) {
      const m = getMaterial(p.material, materials);
      rows.push([
        unit,
        p.id,
        p.name.en,
        String(p.qty),
        String(p.length),
        String(p.width),
        String(p.thickness),
        m.name.en,
        p.edgeBanding.en,
        p.grainConstraint ?? (m.hasGrain ? 'along-length' : 'unrestricted'),
      ]);
    }
    triggerDownload(
      '\uFEFF' +
        rows
          .map((r) => r.map((v) => '"' + (/^[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"').join(','))
          .join('\r\n'),
      'text/csv;charset=utf-8',
      'cabinet-cut-list.csv',
    );
  }
  return (
    <section aria-label="ArcCabinet Studio" className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">ArcCabinet Studio</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Project{' '}
          <input
            aria-label="Project name"
            className="rounded border p-1"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            if (window.confirm('Start a new design? Save any changes first.')) {
              loadProject([{ name: 'Cabinet 1', config: { ...DEFAULT_CONFIG, furnitureType: 'wardrobe' } }]);
              setProjectName('');
              status('New project');
            }
          }}
        >
          New Project
        </button>
        <button
          onClick={() => {
            if (window.confirm('Reset the working project to one cabinet? Saved projects remain available.')) {
              loadProject([{ name: 'Cabinet 1', config: structuredClone(DEFAULT_CONFIG) }]);
              status('Working project reset');
            }
          }}
        >
          Reset Project
        </button>
        <button onClick={() => void save(false)}>Save Project</button>
        <button onClick={() => void save(true)}>Duplicate saved project</button>
        <select
          aria-label="Open Project"
          value=""
          onChange={(e) => {
            const p = saved.find((v) => v.id === e.target.value);
            if (p) open(p);
          }}
        >
          <option value="">Open Project…</option>
          {saved.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span role="status">{message}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Cabinet{' '}
          <input
            aria-label="Cabinet identification"
            value={unit}
            onChange={(e) => renameCabinet(activeCabinetIndex, e.target.value)}
          />
        </label>
        <label>
          Category{' '}
          <select
            aria-label="Cabinet category"
            value={config.furnitureType}
            onChange={(e) => setConfig({ furnitureType: e.target.value as typeof config.furnitureType })}
          >
            {['wardrobe', 'cabinet', 'bookshelf', 'desk', 'panel'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {(['width', 'height', 'depth'] as const).map((k) => (
          <NumberField
            key={k}
            label={k + ' (mm)'}
            value={config[k]}
            min={k === 'width' ? Math.max(HARD_LIMITS.minWidth, (widths.length + 1) * t + widths.length * 10) : 100}
            max={HARD_LIMITS.maxWidth}
            change={(v) => setConfig({ [k]: v })}
          />
        ))}
      </div>
      {supports && (
        <div className="flex flex-wrap items-end gap-3">
          <label>
            Compartments{' '}
            <select
              aria-label="Compartments"
              value={widths.length}
              onChange={(e) => {
                const n = Number(e.target.value);
                setConfig({ shelfCentreSupports: n - 1, compartmentWeights: Array(n).fill(1) });
              }}
            >
              {[1, 2, 3, 4, 5, 6]
                .filter((n) => config.width > (n + 1) * t + n * 10)
                .map((n) => (
                  <option key={n}>{n}</option>
                ))}
            </select>
          </label>
          {widths.map((v, i) => {
            const j = i === widths.length - 1 ? i - 1 : i + 1;
            return (
              j >= 0 && (
                <div key={i} className="flex items-end gap-1">
                  <NumberField
                    label={'Opening ' + (i + 1) + ' (mm)'}
                    value={v}
                    min={10}
                    max={v + widths[j] - 10}
                    change={(n) => {
                      const a = [...widths];
                      a[j] += v - n;
                      a[i] = n;
                      setConfig({ compartmentWeights: a });
                    }}
                  />
                  {i > 0 && (
                    <button
                      aria-label={'Move opening ' + (i + 1) + ' left'}
                      onClick={() => {
                        const a = [...widths];
                        [a[i - 1], a[i]] = [a[i], a[i - 1]];
                        setConfig({ compartmentWeights: a });
                      }}
                    >
                      ←
                    </button>
                  )}
                </div>
              )
            );
          })}
        </div>
      )}
      {supports && (
        <details className="rounded border p-3">
          <summary>Components and materials</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {(['carcassMaterial', 'backPanelMaterial'] as const).map((key) => (
              <label key={key}>
                {key === 'carcassMaterial' ? 'Panel material' : 'Back material'}{' '}
                <select
                  aria-label={key === 'carcassMaterial' ? 'Panel material' : 'Back material'}
                  value={config[key]}
                  onChange={(e) => setConfig({ [key]: e.target.value })}
                >
                  {[...(key === 'carcassMaterial' ? panelMaterials() : backMaterials()), ...materials].map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name.en} ({m.thickness} mm)
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Doors{' '}
              <select
                aria-label="Door quantity"
                value={config.doorStyle === 'none' ? 0 : config.doorCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setConfig(
                    n
                      ? {
                          doorCount: n === 1 ? 1 : 2,
                          doorStyle: config.doorStyle === 'none' ? 'flat' : config.doorStyle,
                        }
                      : { doorStyle: 'none' },
                  );
                }}
              >
                {[0, 1, 2].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <NumberField
              label="Door reveal (mm)"
              value={config.doorReveal}
              min={0}
              max={10}
              change={(v) => setConfig({ doorReveal: v })}
            />
            <NumberField
              label="Toe kick (mm)"
              value={config.kickHeight ?? 0}
              min={0}
              max={Math.min(300, config.height / 3)}
              change={(v) => setConfig({ kickHeight: v })}
            />
            <label>
              Shelves{' '}
              <select
                aria-label="Shelves"
                value={config.shelfCount}
                onChange={(e) =>
                  setConfig({ shelfCount: Number(e.target.value), shelfSpacing: 'equal', customShelfPositions: [] })
                }
              >
                {Array.from({ length: Math.max(12, config.shelfCount) + 1 }, (_, n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Drawers{' '}
              <select
                aria-label="Drawers"
                value={config.drawerCount}
                onChange={(e) => setConfig({ drawerCount: Number(e.target.value) })}
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {Array.from({ length: config.drawerCount }, (_, i) => (
              <NumberField
                key={i}
                label={'Drawer ' + (i + 1) + ' height (mm)'}
                value={config.drawerHeights?.[i] ?? 150}
                min={30}
                max={config.height - 2 * t}
                change={(v) =>
                  setConfig({
                    drawerHeights: Array.from({ length: config.drawerCount }, (_, j) =>
                      j === i ? v : (config.drawerHeights?.[j] ?? 150),
                    ),
                  })
                }
              />
            ))}
          </div>
        </details>
      )}{' '}
      <label className="block">
        Drawing notes{' '}
        <input
          maxLength={150}
          value={cabinets[activeCabinetIndex].notes ?? ''}
          onChange={(e) => useCabinetStore.getState().setNotes(activeCabinetIndex, e.target.value)}
        />
      </label>
      <button className="rounded border px-3 py-1" onClick={cutList}>
        Export Cut List
      </button>
    </section>
  );
}
