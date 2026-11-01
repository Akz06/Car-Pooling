import { useEffect, useState } from 'react';
import type { CarModel } from '@shared/catalog';
import { loadCarPhotos, type CarPhoto, type CarPhotos } from '../lib/carPhotos';

export function useCarPhotos(model: CarModel) {
  const [state, setState] = useState<{ id: string; photos: CarPhotos | null; failed: boolean }>({ id: model.id, photos: null, failed: false });
  useEffect(() => {
    let live = true;
    setState({ id: model.id, photos: null, failed: false });
    loadCarPhotos(model)
      .then((photos) => live && setState({ id: model.id, photos, failed: false }))
      .catch(() => live && setState({ id: model.id, photos: null, failed: true }));
    return () => { live = false; };
  }, [model]);
  return state.id === model.id ? state : { photos: null, failed: false };
}

function Credit({ photo }: { photo: CarPhoto }) {
  return (
    <a className="photo-credit" href={photo.page} target="_blank" rel="noreferrer" title={photo.title}>
      📷 {photo.artist} · {photo.license} · Wikimedia Commons
    </a>
  );
}

type Tab = 'owner' | 'exterior' | 'interior';

/** Real photos of the model (plus the owner's own photo when they uploaded one). */
export function CarGallery({ model, ownPhoto, ownLabel = "Owner's photo" }: { model: CarModel; ownPhoto?: string; ownLabel?: string }) {
  const { photos, failed } = useCarPhotos(model);
  const tabs: { id: Tab; label: string }[] = [
    ...(ownPhoto ? [{ id: 'owner' as const, label: ownLabel }] : []),
    ...(photos?.exterior ? [{ id: 'exterior' as const, label: 'Exterior' }] : []),
    ...(photos?.interior ? [{ id: 'interior' as const, label: 'Interior' }] : []),
  ];
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  if (!tabs.length) {
    if (photos === null && !failed) return <div className="gallery gallery--loading" aria-busy="true"><span>Loading real photos…</span></div>;
    return <p className="muted gallery-note">{import.meta.env.VITE_PHOTOS_OFF
      ? 'Real Wikimedia photos load in the full app (this preview blocks outside images) — the drawing is to scale.'
      : "Real photos couldn't be loaded right now — the drawing above is to scale."}</p>;
  }
  const photo = active === 'exterior' ? photos?.exterior : active === 'interior' ? photos?.interior : undefined;
  const src = active === 'owner' ? ownPhoto! : photo!.src;
  return (
    <div className="gallery">
      <div className="gallery__frame">
        {broken[src]
          ? <div className="gallery__broken">Photo unavailable</div>
          : <img key={src} src={src} alt={`${model.make} ${model.model} ${active}`} loading="lazy" onError={() => setBroken((b) => ({ ...b, [src]: true }))} />}
        {tabs.length > 1 && (
          <div className="seg gallery__tabs">
            {tabs.map((t) => <button key={t.id} type="button" className={t.id === active ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>
        )}
      </div>
      {photo && <Credit photo={photo} />}
    </div>
  );
}

/** Small real exterior photo for cards; renders nothing until/unless a photo exists. */
export function CarPhotoThumb({ model, ownPhoto, className = '' }: { model: CarModel; ownPhoto?: string; className?: string }) {
  const { photos } = useCarPhotos(model);
  const [broken, setBroken] = useState(false);
  const src = ownPhoto ?? photos?.exterior?.src;
  if (!src || broken) return null;
  return (
    <img
      className={`photo-thumb ${className}`}
      src={src}
      alt={`${model.make} ${model.model}`}
      loading="lazy"
      onError={() => setBroken(true)}
      title={ownPhoto ? "Owner's photo" : `${photos?.exterior?.artist} · ${photos?.exterior?.license} · Wikimedia Commons`}
    />
  );
}
