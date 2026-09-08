import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import '../styles/dialog.css';

export interface GalleryImage {
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  alt: string;
}

export interface GalleryData {
  title?: string;
  images: GalleryImage[];
}

export interface GalleryProps {
  gallery: GalleryData;
  basePath?: string;
}

function assetUrl(src: string, basePath: string) {
  if (/^(?:[a-z]+:|\/\/)/i.test(src)) return src;
  return `${basePath.replace(/\/?$/, '/')}${src.replace(/^\/+/, '')}`;
}

function assetSrcSet(srcSet: string | undefined, basePath: string) {
  return srcSet?.split(',').map((candidate) => {
    const [src, ...descriptor] = candidate.trim().split(/\s+/);
    return `${assetUrl(src, basePath)} ${descriptor.join(' ')}`.trim();
  }).join(', ');
}

function FullscreenIcon({ active }: { active: boolean }) {
  return active
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></svg>;
}

function ThumbnailsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect className="pp-gallery__tile pp-gallery__tile--top-left" x="4" y="4" width="6" height="6" rx=".6" />
    <rect className="pp-gallery__tile pp-gallery__tile--top-right" x="14" y="4" width="6" height="6" rx=".6" />
    <rect className="pp-gallery__tile pp-gallery__tile--bottom-left" x="4" y="14" width="6" height="6" rx=".6" />
    <rect className="pp-gallery__tile pp-gallery__tile--bottom-right" x="14" y="14" width="6" height="6" rx=".6" />
  </svg>;
}

export function Gallery({ gallery, basePath = '/' }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const total = gallery.images.length;
  const selected = total ? index % total : 0;
  const image = gallery.images[selected];
  const aspectRatio = image ? image.width / image.height : 1;
  const aspectClass = aspectRatio >= 1.12 ? 'is-landscape' : aspectRatio >= .88 ? 'is-square' : 'is-portrait';
  const imageSizes = isFullscreen && aspectClass !== 'is-portrait'
    ? thumbnailsVisible
      ? '(max-width: 720px) 100vw, calc(100vw - 370px)'
      : '(max-width: 720px) 100vw, calc(100vw - 184px)'
    : '(max-width: 720px) 100vw, (max-width: 1100px) calc(100vw - 220px), 1040px';
  const move = useCallback((direction: number) => {
    if (total > 1) setIndex((current) => (current + direction + total) % total);
  }, [total]);
  const toggleFullscreen = useCallback(async () => {
    const fullscreenTarget = galleryRef.current?.closest<HTMLElement>('[role="dialog"]') || galleryRef.current;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (fullscreenTarget?.requestFullscreen) await fullscreenTarget.requestFullscreen({ navigationUI: 'hide' });
      else setIsFullscreen((active) => !active);
    } catch {
      // Browser automation and embedded webviews can block the native API. The viewer still expands within its modal.
      setIsFullscreen((active) => !active);
    }
  }, []);

  useEffect(() => {
    setIndex(0);
    setThumbnailsVisible(true);
  }, [gallery]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === (galleryRef.current?.closest<HTMLElement>('[role="dialog"]') || galleryRef.current));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    galleryRef.current?.closest('[role="dialog"]')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [selected, gallery]);

  useEffect(() => {
    if (!thumbnailsVisible) return;
    galleryRef.current?.querySelector<HTMLButtonElement>('.pp-gallery__thumbnail.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selected, thumbnailsVisible]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || galleryRef.current?.closest('[inert]')) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'F' || event.key === 'f' || (event.altKey && event.key === 'Enter')) {
        event.preventDefault();
        void toggleFullscreen();
      } else if (!event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [move, toggleFullscreen]);

  const beginSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || (event.target instanceof Element && event.target.closest('button'))) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx > 0 ? -1 : 1);
  };

  if (!image) return <p className="pp-gallery__empty">В этой серии пока нет фотографий.</p>;

  return (
    <div ref={galleryRef} className={`pp-gallery ${aspectClass}${thumbnailsVisible ? '' : ' is-thumbnails-hidden'}${isFullscreen ? ' is-fullscreen' : ''}`} role="region" aria-roledescription="карусель" aria-label={gallery.title || 'Фотографии серии'}>
      <div className="pp-gallery__stage" onPointerDown={beginSwipe} onPointerUp={endSwipe} onPointerCancel={() => { pointerStart.current = null; }}>
        <p className="pp-gallery__count" aria-hidden="true">{selected + 1} / {total}</p>
        <img
          key={image.src}
          className="pp-gallery__image"
          src={assetUrl(image.src, basePath)}
          srcSet={assetSrcSet(image.srcSet, basePath)}
          sizes={imageSizes}
          width={image.width}
          height={image.height}
          alt={image.alt}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        {total > 1 && <>
          <button className="pp-gallery__arrow pp-gallery__arrow--previous" type="button" onClick={() => move(-1)} aria-label="Предыдущая фотография">
            <svg viewBox="0 0 20 36" aria-hidden="true"><path d="M18 2 2 18l16 16" /></svg>
          </button>
          <button className="pp-gallery__arrow pp-gallery__arrow--next" type="button" onClick={() => move(1)} aria-label="Следующая фотография">
            <svg viewBox="0 0 20 36" aria-hidden="true"><path d="m2 2 16 16L2 34" /></svg>
          </button>
        </>}
      </div>
      {total > 1 && <aside className="pp-gallery__sidebar" aria-label="Миниатюры фотографий">
        <div className="pp-gallery__thumbnails">
          {gallery.images.map((item, position) => <button
            key={`${item.src}-${position}`}
            className={`pp-gallery__thumbnail${position === selected ? ' is-current' : ''}`}
            type="button"
            aria-label={`Показать фотографию ${position + 1} из ${total}`}
            aria-current={position === selected ? 'true' : undefined}
            onClick={() => setIndex(position)}
          >
            <img
              src={assetUrl(item.src, basePath)}
              srcSet={assetSrcSet(item.srcSet, basePath)}
              sizes="(max-width: 720px) 68px, 80px"
              width={item.width}
              height={item.height}
              alt=""
              loading={Math.abs(position - selected) < 6 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </button>)}
        </div>
      </aside>}
      <div className="pp-gallery__toolbar" aria-label="Управление просмотром">
        <button className="pp-gallery__control pp-gallery__control--fullscreen" type="button" onClick={() => { void toggleFullscreen(); }} aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Открыть на весь экран'} aria-pressed={isFullscreen}>
          <FullscreenIcon active={isFullscreen} />
        </button>
        {total > 1 && <button className="pp-gallery__control pp-gallery__control--thumbnails" type="button" onClick={() => setThumbnailsVisible((visible) => !visible)} aria-label={thumbnailsVisible ? 'Скрыть миниатюры' : 'Показать миниатюры'} aria-pressed={thumbnailsVisible}>
          <ThumbnailsIcon />
        </button>}
      </div>
      <p className="pp-visually-hidden" aria-live="polite" aria-atomic="true">Фотография {selected + 1} из {total}</p>
    </div>
  );
}
