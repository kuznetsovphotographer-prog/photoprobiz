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
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" /></svg>;
}

function ThumbnailsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect className="pp-gallery__tile pp-gallery__tile--top-left" x="3" y="3" width="7" height="7" rx=".7" />
    <rect className="pp-gallery__tile pp-gallery__tile--top-right" x="14" y="3" width="7" height="7" rx=".7" />
    <rect className="pp-gallery__tile pp-gallery__tile--bottom-left" x="3" y="14" width="7" height="7" rx=".7" />
    <rect className="pp-gallery__tile pp-gallery__tile--bottom-right" x="14" y="14" width="7" height="7" rx=".7" />
  </svg>;
}

export function Gallery({ gallery, basePath = '/' }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [settlingDirection, setSettlingDirection] = useState<-1 | 0 | 1 | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    horizontal: boolean;
  } | null>(null);
  const settlingDirectionRef = useRef<-1 | 0 | 1 | null>(null);
  const suppressStageClick = useRef(false);
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
  const finishMove = useCallback(() => {
    const direction = settlingDirectionRef.current;
    if (direction === null) return;
    settlingDirectionRef.current = null;
    if (direction !== 0 && total > 1) setIndex((current) => (current + direction + total) % total);
    setSettlingDirection(null);
    setDragOffset(0);
  }, [total]);
  const move = useCallback((direction: number) => {
    if (total <= 1 || settlingDirectionRef.current !== null) return;
    const normalizedDirection = direction > 0 ? 1 : -1;
    settlingDirectionRef.current = normalizedDirection;
    setDragOffset(0);
    setSettlingDirection(normalizedDirection);
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
    pointerStart.current = null;
    settlingDirectionRef.current = null;
    setSettlingDirection(null);
    setDragOffset(0);
  }, [gallery]);

  useEffect(() => {
    if (settlingDirection === null) return;
    const fallback = window.setTimeout(finishMove, 460);
    return () => window.clearTimeout(fallback);
  }, [finishMove, settlingDirection]);

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
    if (event.pointerType === 'mouse' || settlingDirectionRef.current !== null || (event.target instanceof Element && event.target.closest('button'))) return;
    const now = performance.now();
    pointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastTime: now,
      velocityX: 0,
      horizontal: false,
    };
    suppressStageClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const continueSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        pointerStart.current = null;
        return;
      }
      start.horizontal = true;
      suppressStageClick.current = true;
    }
    event.preventDefault();
    const now = performance.now();
    const elapsed = Math.max(1, now - start.lastTime);
    const instantVelocity = (event.clientX - start.lastX) / elapsed;
    start.velocityX = start.velocityX * .68 + instantVelocity * .32;
    start.lastX = event.clientX;
    start.lastTime = now;
    const stageWidth = event.currentTarget.clientWidth || 1;
    setDragOffset(Math.max(-stageWidth, Math.min(stageWidth, dx)));
  };
  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal || total <= 1) {
      setDragOffset(0);
      return;
    }
    suppressStageClick.current = true;
    const stageWidth = event.currentTarget.clientWidth || 1;
    const distanceThreshold = Math.min(96, stageWidth * .18);
    const shouldMove = Math.abs(dx) >= distanceThreshold || Math.abs(start.velocityX) >= .42;
    const direction: -1 | 0 | 1 = shouldMove ? (dx > 0 ? -1 : 1) : 0;
    settlingDirectionRef.current = direction;
    setSettlingDirection(direction);
  };
  const cancelSwipe = () => {
    const wasHorizontal = pointerStart.current?.horizontal;
    pointerStart.current = null;
    if (!wasHorizontal) {
      setDragOffset(0);
      return;
    }
    settlingDirectionRef.current = 0;
    setSettlingDirection(0);
  };

  const slideIndexes = total > 1
    ? [(selected - 1 + total) % total, selected, (selected + 1) % total]
    : [selected];
  const trackTransform = total <= 1
    ? 'translate3d(0, 0, 0)'
    : settlingDirection === null
      ? `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`
      : `translate3d(${-100 * (1 + settlingDirection)}%, 0, 0)`;

  if (!image) return <p className="pp-gallery__empty">В этой серии пока нет фотографий.</p>;

  return (
    <div ref={galleryRef} className={`pp-gallery ${aspectClass}${thumbnailsVisible ? '' : ' is-thumbnails-hidden'}${isFullscreen ? ' is-fullscreen' : ''}`} role="region" aria-roledescription="карусель" aria-label={gallery.title || 'Фотографии серии'}>
      <div
        className={`pp-gallery__stage${dragOffset !== 0 && settlingDirection === null ? ' is-dragging' : ''}`}
        onPointerDown={beginSwipe}
        onPointerMove={continueSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={cancelSwipe}
        onClick={(event) => {
          if (!suppressStageClick.current) return;
          suppressStageClick.current = false;
          event.stopPropagation();
        }}
      >
        <p className="pp-gallery__count" aria-hidden="true">{selected + 1} / {total}</p>
        <div
          className={`pp-gallery__track${settlingDirection !== null ? ' is-settling' : ''}`}
          style={{ transform: trackTransform }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') finishMove();
          }}
        >
          {slideIndexes.map((position, slidePosition) => {
            const item = gallery.images[position];
            const currentSlide = total <= 1 || slidePosition === 1;
            return <div className="pp-gallery__slide" key={`${item.src}-${slidePosition}`} aria-hidden={!currentSlide}>
              <img
                className="pp-gallery__image"
                src={assetUrl(item.src, basePath)}
                srcSet={assetSrcSet(item.srcSet, basePath)}
                sizes={imageSizes}
                width={item.width}
                height={item.height}
                alt={currentSlide ? item.alt : ''}
                loading="eager"
                decoding="async"
                fetchPriority={currentSlide ? 'high' : 'low'}
                draggable={false}
              />
            </div>;
          })}
        </div>
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
              loading={position === selected ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority="low"
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
