import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModel } from '@shared/catalog';
import { CATEGORY_LABEL, INTERIOR_CATEGORIES, type PhotoCategory } from '@shared/photos';
import { useCarPhotos } from '../components/CarPhotos';
import { PhotoViewer } from '../components/PhotoViewer';
import { PaintSwatches } from '../components/Swatches';
import { CarView } from '../components/CarView';
import { galleryPhotos } from '../lib/modelPhotos';

const Scene3D = lazy(() => import('../three/Scene3D'));
type Tab = 'exterior' | 'interior' | 'colours' | '3d';

/** Portal-style model gallery: Exterior / Interior / Colours / 3D View. */
export function CarGalleryPage() {
  const { modelId } = useParams();
  const model = getModel(modelId ?? '');
  const { photos: wiki } = useCarPhotos(model ?? getModel('hyundai-i20')!);
  const all = useMemo(() => (model ? galleryPhotos(model, wiki) : []), [model, wiki]);
  const [tab, setTab] = useState<Tab>('exterior');
  const [sub, setSub] = useState<PhotoCategory | null>(null);
  const [paintId, setPaintId] = useState(model?.paints[0].id ?? '');
  if (!model) return <div className="empty">Unknown car. <Link to="/showroom">Back to showroom</Link></div>;

  const exterior = all.filter((p) => p.category === 'exterior');
  const interiorCats = INTERIOR_CATEGORIES.filter((c) => all.some((p) => p.category === c));
  const activeSub = sub && interiorCats.includes(sub) ? sub : interiorCats[0];
  const interior = all.filter((p) => p.category === activeSub);
  const paint = model.paints.find((p) => p.id === paintId) ?? model.paints[0];
  const colourPhoto = all.find((p) => p.category === 'colour' && p.paintId === paint.id);
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

      {tab === 'exterior' && (exterior.length
        ? <PhotoViewer photos={exterior} />
        : <NoPhotos model={model} />)}

      {tab === 'interior' && (
        <>
          {interiorCats.length > 0 && (
            <div className="gchips">
              {interiorCats.map((c) => (
                <button key={c} className={c === activeSub ? 'on' : ''} onClick={() => setSub(c)}>
                  {CATEGORY_LABEL[c]} ({all.filter((p) => p.category === c).length})
                </button>
              ))}
            </div>
          )}
          {interior.length ? <PhotoViewer photos={interior} /> : <NoPhotos model={model} />}
        </>
      )}

      {tab === 'colours' && (
        <div>
          <div className="viewer__frame viewer__frame--paint">
            {colourPhoto
              ? <img src={colourPhoto.url} alt={`${model.model} in ${paint.name}`} />
              : <CarView model={model} paint={paint} interior={model.interiors[0]} mode="exterior" orientation="horizontal" />}
          </div>
          <div className="viewer__caption"><span>{paint.name}</span><span className="muted">{paint.finish}{paint.roof ? ' · dual-tone' : ''}</span></div>
          <PaintSwatches paints={model.paints} value={paint.id} onChange={setPaintId} />
        </div>
      )}

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
      Real photos of the {model.make} {model.model} aren't loaded yet — see the <b>3D View</b> tab meanwhile.
    </div>
  );
}
