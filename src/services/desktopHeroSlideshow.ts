// Change to 'fade' to restore the original transition.
const DEFAULT_TRANSITION: 'tiles' | 'fade' = 'tiles';
const HOLD_MS = 4000;
const TRANSITION_MS = 4020;
const MIN_FLIP_MS = 1700;
const MAX_FLIP_MS = 2950;
const SEAM_DISSOLVE_MS = 900;

export function initDesktopHeroSlideshow(container: HTMLElement) {
  const slides = Array.from(container.querySelectorAll<HTMLElement>('.desktop-hero-slide'));
  const desktop = matchMedia('(min-width: 1200px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const requested = new URLSearchParams(location.search).get('heroTransition');
  const mode = requested === 'fade' || requested === 'tiles' ? requested : DEFAULT_TRANSITION;
  container.dataset.heroTransition = mode;
  const loading = new Map<number, Promise<boolean>>();
  const failed = new Set<number>();
  let activeIndex = 0;
  let visible = false;
  let generation = 0;
  let preloadTimer: number | undefined;
  let transitionTimer: number | undefined;
  let overlay: HTMLElement | undefined;
  let animations: Animation[] = [];

  const canRun = () => desktop.matches && !reducedMotion.matches && !document.hidden && visible && slides.length > 1;
  const clearTransition = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
    overlay?.remove();
    overlay = undefined;
  };
  const stop = () => {
    generation++;
    clearTimeout(preloadTimer);
    clearTimeout(transitionTimer);
    clearTransition();
  };
  const preload = (index: number) => {
    const pending = loading.get(index);
    if (pending) return pending;
    const slide = slides[index];
    const source = slide.querySelector<HTMLSourceElement>('source[data-srcset]');
    const image = slide.querySelector<HTMLImageElement>('img')!;
    const url = source?.dataset.srcset || image.currentSrc || image.src;
    const promise = (async () => {
      try {
        // Do not enable the picture source until the actual file is decoded.
        const loader = new Image();
        loader.src = url;
        await loader.decode();
        if (source?.dataset.srcset) source.srcset = source.dataset.srcset;
        await image.decode();
        return true;
      } catch {
        failed.add(index);
        return false;
      }
    })();
    loading.set(index, promise);
    return promise;
  };
  const activate = (index: number) => {
    slides[activeIndex].classList.remove('is-active');
    activeIndex = index;
    slides[activeIndex].classList.add('is-active');
  };

  const flip = async (nextIndex: number) => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const columns = Math.min(22, Math.max(10, Math.round(width / 112)));
    const rows = Math.max(1, Math.round(height / (width / columns)));
    const layer = document.createElement('div');
    layer.className = 'hero-flip-grid';
    layer.setAttribute('aria-hidden', 'true');
    const oldImage = slides[activeIndex].querySelector<HTMLImageElement>('img')!;
    const nextImage = slides[nextIndex].querySelector<HTMLImageElement>('img')!;
    // Calculate each full-image crop once, not once for every tile face.
    // Both painters keep exactly the same crop and subpixel coordinates.
    const createFacePainter = (image: HTMLImageElement) => {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      const position = getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
      const backgroundImage = `url(${JSON.stringify(image.currentSrc || image.src)})`;
      const backgroundSize = `${imageWidth}px ${imageHeight}px`;
      const offsetX = (width - imageWidth) * position[0] / 100;
      const offsetY = (height - imageHeight) * position[1] / 100;
      return (face: HTMLElement, x: number, y: number) => {
        face.style.backgroundImage = backgroundImage;
        face.style.backgroundSize = backgroundSize;
        face.style.backgroundPosition = `${offsetX - x}px ${offsetY - y}px`;
      };
    };
    const facePainters = [
      ['front', createFacePainter(oldImage)],
      ['back', createFacePainter(nextImage)],
    ] as const;
    const rotors: { element: HTMLElement; delay: number; duration: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        // Shared rounded boundaries prevent fractional cracks at any zoom/DPR.
        const x = Math.round(column * width / columns);
        const y = Math.round(row * height / rows);
        const cell = document.createElement('div');
        cell.className = 'hero-flip-cell';
        Object.assign(cell.style, {
          left: `${x}px`, top: `${y}px`,
          width: `${Math.round((column + 1) * width / columns) - x}px`,
          height: `${Math.round((row + 1) * height / rows) - y}px`,
        });
        const rotor = document.createElement('div');
        rotor.className = 'hero-flip-card';
        for (const [side, paint] of facePainters) {
          const face = document.createElement('div');
          face.className = `hero-flip-face hero-flip-face--${side}`;
          paint(face, x, y);
          rotor.append(face);
        }
        cell.append(rotor);
        layer.append(cell);
        // Fresh independent timings per card and per photo: no spatial wave.
        // Bound the whole mosaic to roughly three times the original 1.34 s.
        const duration = MIN_FLIP_MS + Math.random() * (MAX_FLIP_MS - MIN_FLIP_MS);
        const delay = Math.random() * (TRANSITION_MS - duration);
        rotors.push({ element: rotor, delay, duration });
      }
    }
    overlay = layer;
    container.append(layer);
    activate(nextIndex);
    animations = rotors.map(({ element, delay, duration }) => element.animate(
      [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }],
      { duration, delay, easing: 'cubic-bezier(.35,0,.2,1)', fill: 'both' },
    ));
    // Cancellation (scroll, resize, hidden tab) must never leave half-turned cards.
    await Promise.allSettled(animations.map(animation => animation.finished));
    if (overlay !== layer) return;
    // The completed backs already match the full image underneath. Dissolve the
    // tile layer (including hairline shadows/raster edges) before removing it.
    layer.dataset.phase = 'settling';
    const dissolve = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: SEAM_DISSOLVE_MS, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards',
    });
    animations.push(dissolve);
    await Promise.allSettled([dissolve.finished]);
    if (overlay === layer) clearTransition();
  };

  const schedule = () => {
    stop();
    if (!canRun()) return;
    let nextIndex = (activeIndex + 1) % slides.length;
    while (failed.has(nextIndex) && nextIndex !== activeIndex) nextIndex = (nextIndex + 1) % slides.length;
    if (nextIndex === activeIndex) return;
    const ticket = generation;
    preloadTimer = window.setTimeout(() => void preload(nextIndex), 2500);
    transitionTimer = window.setTimeout(async () => {
      const ready = await preload(nextIndex);
      if (ticket !== generation || !canRun()) return;
      if (ready) {
        // The initial responsive cover also needs decoding before becoming tiles.
        if (mode === 'tiles') {
          try { await slides[activeIndex].querySelector<HTMLImageElement>('img')!.decode(); }
          catch { schedule(); return; }
          if (ticket !== generation || !canRun()) return;
          await flip(nextIndex);
        } else activate(nextIndex);
      }
      if (ticket === generation) schedule();
    }, HOLD_MS);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .15;
    schedule();
  }, { threshold: .15 }).observe(container);
  // Rebuild only on a real size change, never keep crops from the old viewport.
  let lastSize = '';
  new ResizeObserver(([entry]) => {
    const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
    if (size !== lastSize) { lastSize = size; schedule(); }
  }).observe(container);
  desktop.addEventListener('change', schedule);
  reducedMotion.addEventListener('change', () => {
    stop();
    if (reducedMotion.matches) activate(0);
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
}
