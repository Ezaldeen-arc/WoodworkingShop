import { Document, Page, View, Text, Svg, Line, Text as PdfText, pdf } from '@react-pdf/renderer';
import { getMaterial } from '../../engine/materials/materials';
import { generateParts } from '../../engine/geometry/parts';
import type { CabinetConfig, Material } from '../../engine/core/types';
import { cabinetElevationDxf, type DrawingView } from '../../utils/cabinet-elevation-dxf';

const pt = 72 / 25.4;
export async function wardrobeReviewPdf(
  config: CabinetConfig,
  materials: Material[],
  project: string,
  unit: string,
  revision: string,
  paper: 'A3' | 'A2',
) {
  const views: DrawingView[] = [];
  cabinetElevationDxf(config, materials, views);
  const parts = generateParts(config, materials).filter((p) => p.name.en !== 'Hanging Rail');
  const width = paper === 'A3' ? 420 : 594,
    height = paper === 'A3' ? 297 : 420;
  const innerW = width - 32,
    innerH = height - 66;
  const pages = views.length + Math.ceil(parts.length / 16);
  function footer(i: number, title: string, scale: string) {
    return (
      <View
        fixed
        style={{
          position: 'absolute',
          left: 16 * pt,
          right: 16 * pt,
          bottom: 12 * pt,
          borderTopWidth: 1,
          paddingTop: 6,
        }}
      >
        <Text style={{ fontSize: 13 }}>
          {project || 'Untitled project'} / {unit} / {title}
        </Text>
        <Text style={{ fontSize: 9, marginTop: 3 }}>
          ArcCabinet Studio | Revision {revision} | {paper} landscape | {scale} | Dimensions in mm | Sheet {i + 1} /{' '}
          {pages}
        </Text>
      </View>
    );
  }
  const document = (
    <Document title={unit + ' - Wardrobe review'}>
      {views.map((v, i) => {
        const extentW = Math.max(v.width + 300, 850),
          extentH = v.height + 330;
        const scale =
          [5, 10, 15, 20, 25, 50, 100].find((n) => extentW / n <= innerW && extentH / n <= innerH) ??
          Math.ceil(Math.max(extentW / innerW, extentH / innerH));
        const tx = extentW / 2 - v.width / 2,
          ty = v.height + 110;
        return (
          <Page key={v.title} size={paper} orientation="landscape" style={{ padding: 16 * pt }}>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>{v.title}</Text>
            <Svg width={(extentW * pt) / scale} height={(extentH * pt) / scale} viewBox={`0 0 ${extentW} ${extentH}`}>
              {v.marks.map((m, k) =>
                m.kind === 'line' ? (
                  <Line
                    key={k}
                    x1={tx + m.a[0]}
                    y1={ty - m.a[1]}
                    x2={tx + m.b[0]}
                    y2={ty - m.b[1]}
                    stroke="#263843"
                    strokeWidth={scale * 0.2}
                  />
                ) : (
                  <PdfText
                    key={k}
                    x={tx + m.at[0]}
                    y={ty - m.at[1]}
                    transform={`rotate(${-m.angle} ${tx + m.at[0]} ${ty - m.at[1]})`}
                    textAnchor="middle"
                    style={{ fontSize: 18, fill: '#173747' }}
                  >
                    {m.value}
                  </PdfText>
                ),
              )}
            </Svg>
            {footer(i, v.title, 'Scale 1:' + scale)}
          </Page>
        );
      })}
      {Array.from({ length: Math.ceil(parts.length / 16) }, (_, i) => (
        <Page key={i} size={paper} orientation="landscape" style={{ padding: 16 * pt }}>
          <Text style={{ fontSize: 18, marginBottom: 12 }}>Panel schedule</Text>
          {[
            ['ID', 'Panel', 'L × W × T (mm)', 'Qty', 'Material', 'Edge banding', 'Grain'],
            ...parts.slice(i * 16, i * 16 + 16).map((p) => {
              const material = getMaterial(p.material, materials);
              return [
                unit + '-' + p.id,
                p.name.en,
                [p.length, p.width, p.thickness].join(' × '),
                String(p.qty),
                material.name.en,
                p.edgeBanding.en,
                p.grainConstraint ?? (material.hasGrain ? 'along-length' : 'unrestricted'),
              ];
            }),
          ].map((row, n) => (
            <View
              key={n}
              style={{
                flexDirection: 'row',
                borderBottomWidth: 0.4,
                paddingVertical: 5,
                backgroundColor: n === 0 ? '#e4ebee' : 'white',
              }}
            >
              {row.map((c, j) => (
                <Text key={j} style={{ width: [16, 19, 15, 5, 21, 12, 12][j] + '%', fontSize: 9 }}>
                  {c}
                </Text>
              ))}
            </View>
          ))}
          {footer(views.length + i, 'Panel schedule', 'Cut sizes')}
        </Page>
      ))}
    </Document>
  );
  return pdf(document).toBlob();
}
