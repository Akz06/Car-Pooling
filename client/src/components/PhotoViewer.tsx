import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ViewerPhoto {
  url: string;
  thumb?: string;
  caption: string;
  credit?: { text: string; href?: string };
}

/** Portal-style photo viewer: big image, arrows, swipe, counter, thumbnail strip. */
export function PhotoViewer({ photos, start = 0, overlay }: { photos: ViewerPhoto[]; start?: number; overlay?: (p: ViewerPhoto, i: number) => ReactNode }) {
  const [i, setI] = useState(start);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const strip = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const n = photos.length;
  useEffect(() => setI(Math.min(start, Math.max(0, n - 1))), [photos, start, n]);
  useEffect(() => {
    const el = strip.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [i]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => (v + 1) % n);
      if (e.key === 'ArrowLeft') setI((v) => (v - 1 + n) % n);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [n]);
  if (!n) return null;
  const p = photos[i];
  return (
    <div className="viewer">
      <div
        className="viewer__frame"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) setI((v) => (v + (dx < 0 ? 1 : -1) + n) % n);
          touch.current = null;
        }}
      >
        {broken[p.url]
          ? <div className="viewer__broken">Photo unavailable</div>
          : <img key={p.url} src={p.url} alt={p.caption} onError={() => setBroken((b) => ({ ...b, [p.url]: true }))} />}
        {overlay?.(p, i)}
        {n > 1 && (
          <>
            <button className="viewer__nav viewer__nav--prev" onClick={() => setI((i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="viewer__nav viewer__nav--next" onClick={() => setI((i + 1) % n)} aria-label="Next photo">›</button>
          </>
        )}
      </div>
      <div className="viewer__caption">
        <span>{p.caption}</span>
        <span className="muted">{i + 1}/{n}</span>
      </div>
      {p.credit && (
        <a className="photo-credit" href={p.credit.href} target="_blank" rel="noreferrer">{p.credit.text}</a>
      )}
      {n > 1 && (
        <div className="viewer__strip" ref={strip}>
          {photos.map((ph, k) => (
            <button key={ph.url + k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={ph.caption}>
              <img src={ph.thumb ?? ph.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
