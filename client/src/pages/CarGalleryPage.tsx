import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModel } from '@shared/catalog';
import { useCarPhotos } from '../components/CarPhotos';
import { PhotoViewer } from '../components/PhotoViewer';
import { PaintSwatches } from '../components/Swatches';
import { CarView } from '../components/CarView';
import { galleryPhotos, useModelGallery, type GalleryPhoto } from '../lib/modelPhotos';

const Scene3D = lazy(() => import('../three/Scene3D'));
type Tab = 'exterior' | 'interior' | 'colours' | '3d';

/** Sections in the order they first appear (CarDekho order: Looks, Details, Lights, Badges …). */
function sections(photos: GalleryPhoto[]) {
  const order: string[] = [];
  for (const p of photos) if (p.section && !order.includes(p.section)) order.push(p.section);
  return order;
}

/** Portal-style model gallery: Exterior / Interior / Colours / 3D View. */
export function CarGalleryPage() {
  const { modelId } = useParams();
  const model = getModel(modelId ?? '');
  const { photos: wiki } = useCarPhotos(model ?? getModel('hyundai-i20')!);
  const own = useModelGallery(model ?? getModel('hyundai-i20')!);
  const all = useMemo(() => (model ? galleryPhotos(model, wiki, own) : []), [model, wiki, own]);
  const [tab, setTab] = useState<Tab>('exterior');
  const [section, setSection] = useState<Record<string, string>>({});
  const [colourIdx, setColourIdx] = useState(0);
  const [paintId, setPaintId] = useState(model?.paints[0].id ?? '');
  if (!model) return <div className="empty">Unknown car. <Link to="/showroom">Back to showroom</Link></div>;

  const groupTab = (group: 'exterior' | 'interior') => {
    const photos = all.filter((p) => p.group === group);
    const secs = sections(photos);
    const active = section[group] && secs.includes(section[group]) ? section[group] : secs[0];
    const shown = photos.filter((p) => p.section === active);
    if (!photos.length) return own === null ? <div className="empty">Loading photos…</div> : <NoPhotos model={model} />;
    return (
      <>
        <div className="gchips">
          {secs.map((s) => (
            <button key={s} className={s === active ? 'on' : ''} onClick={() => setSection({ ...section, [group]: s })}>
              {s} ({photos.filter((p) => p.section === s).length})
            </button>
          ))}
        </div>
        <PhotoViewer photos={shown} />
      </>
    );
  };

  const colours = all.filter((p) => p.group === 'colour');
  const colour = colours[Math.min(colourIdx, colours.length - 1)];
  const paint = model.paints.find((p) => p.id === paintId) ?? model.paints[0];
  const tabs: [Tab, string][] = [['exterior', 'Exterior'], ['interior', 'Interior'], ['colours', 'Colours'], ['3d', '3D View']];

  return (
    <div className="gallery-page">
      <div className="gallery-page__head">
        <Link to="/showroom" className="btn btn--ghost btn--sm">←</Link>
        <h1>{model.make} {model.model}</h1>
      </div>
      <div className="gtabs" role="tablist">
        {tabs.map(([t, label]) => (
          <button key={t} role="tab" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'exterior' && groupTab('exterior')}
      {tab === 'interior' && groupTab('interior')}

      {tab === 'colours' && (colours.length ? (
        <div>
          <div className="viewer__frame"><img key={colour.url} src={colour.url} alt={colour.caption} /></div>
          <div className="viewer__caption">
            <span>{colour.caption.replace(`${model.make} ${model.model}`, '').trim()}</span>
            <span className="muted">{Math.min(colourIdx, colours.length - 1) + 1}/{colours.length}</span>
          </div>
          <div className="colour-dots">
            {colours.map((c, i) => (
              <button key={c.url} className={c === colour ? 'on' : ''} title={c.caption} onClick={() => setColourIdx(i)}>
                <span style={{ background: c.hex ?? '#888' }} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="viewer__frame viewer__frame--paint">
            <CarView model={model} paint={paint} interior={model.interiors[0]} mode="exterior" orientation="horizontal" />
          </div>
          <div className="viewer__caption"><span>{paint.name}</span><span className="muted">{paint.finish}{paint.roof ? ' · dual-tone' : ''}</span></div>
          <PaintSwatches paints={model.paints} value={paint.id} onChange={setPaintId} />
        </div>
      ))}

      {tab === '3d' && (
        <div className="viewer__frame viewer__frame--3d">
          <Suspense fallback={<div className="stage__loading">Opening the showroom…</div>}>
            <Scene3D model={model} paint={paint} interior={model.interiors[0]} seats={{}} cabin={false} night={false} preset="front" autoRotate />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function NoPhotos({ model }: { model: { make: string; model: string } }) {
  return (
    <div className="empty">
      No photos of the {model.make} {model.model} in this section yet — see the <b>3D View</b> tab.
    </div>
  );
}
