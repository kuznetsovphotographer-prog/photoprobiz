import { createElement, type CSSProperties } from 'react';
import { LeadForm } from './LeadForm';
import assets from '../data/assets.json';
import heroAvif from '../data/hero-avif.json';
import desktopHero from '../data/desktop-hero.json';
import { galleryImageCounts } from '../data/galleryCounts';

export type DesignNode = {
  tag: string; className: string; attrs: Record<string, string>;
  html?: string; widget?: string; children: DesignNode[];
  image?: { src: string; srcSet?: string; sizes?: string; width: number; height: number; alt: string; background?: boolean; critical?: boolean; original?:string };
};
export type SectionData = { id: string; source: string; anchor?: string; nodes: DesignNode[] };

const imageMap = assets as Record<string, {src:string;srcSet?:string;width:number;height:number}>;
const before = imageMap['https://static.tildacdn.com/tild6664-6164-4430-b764-366339393434/2298.jpg'];
const after = imageMap['https://static.tildacdn.com/tild3339-6633-4434-a337-303539336537/2298_1.JPG'];
const teamCardClasses = new Set(['n731', 'n757', 'n787', 'n811', 'n835', 'n859']);
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const desktopHeroSlides = [
  { src: 'images/desktop-slideshow/biznes-portret-rukovoditelnitsy-v-kostyume.avif', width: 3732, height: 2100, position: '58% 50%' },
  { src: 'images/desktop-slideshow/imidzhevaya-syemka-muzhchiny-s-tenyami-ot-palm.avif', width: 3732, height: 2100, position: '48% 50%' },
  { src: 'images/desktop-slideshow/biznes-portret-muzhchiny-v-zhilete-interier-moskva.avif', width: 3734, height: 2100, position: '60% 50%' },
  { src: 'images/desktop-slideshow/zhenskiy-portret-rukovoditelya-u-okna-moskva.avif', width: 3736, height: 2100, position: '70% 50%' },
  { src: 'images/desktop-slideshow/3968.avif', width: 3150, height: 2100, position: '52% 50%' },
  { src: 'images/desktop-slideshow/zhenskiy-portret-v-dizaynerskom-interiere.avif', width: 3734, height: 2100, position: '58% 50%' },
  { src: 'images/desktop-slideshow/imidzhevaya-syemka-muzhchiny-v-ofise.avif', width: 3732, height: 2100, position: '63% 50%' },
  { src: 'images/desktop-slideshow/imidzhevyy-portret-muzhchiny-v-bordovom-pidiake-v-restorane.avif', width: 3732, height: 2100, position: '58% 50%' },
  { src: 'images/desktop-slideshow/klassicheskiy-muzhskoy-biznes-portret-na-temnom-fone.avif', width: 3732, height: 2100, position: '62% 50%' },
  { src: 'images/desktop-slideshow/kreativnyy-muzhskoy-portret-na-skamyie-moskva.avif', width: 3734, height: 2100, position: '50% 50%' },
  { src: 'images/desktop-slideshow/muzhskoy-delovoy-portret-rukovoditelya-v-lofte.avif', width: 3319, height: 2100, position: '48% 50%' },
  { src: 'images/desktop-slideshow/muzhskoy-portret-v-biblioteke-moskva.avif', width: 3734, height: 2100, position: '58% 50%' },
  { src: 'images/desktop-slideshow/stilniy-muzhskoy-portret-u-studiynoy-dekoratsii.avif', width: 3728, height: 2100, position: '62% 50%' },
  { src: 'images/desktop-slideshow/yurist-v-ochkakh-za-noutbukom-v-serom-pidiake-interyernyy-portret.avif', width: 3734, height: 2100, position: '60% 50%' },
] as const;
const imageGalleryLinks: Record<string, { href: string; label: string }> = {
  n188: { href: '#popup:office-setup', label: 'Подробнее о мобильной фотостудии в офисе' },
  n52: { href: '#popup:person3', label: 'Открыть галерею Натальи Лебедевой' },
  n54: { href: '#popup:person6', label: 'Открыть галерею Константина Анисимова' },
  n70: { href: '#popup:employees', label: 'Открыть галерею корпоративных портретов сотрудников' },
  n124: { href: '#popup:digital-specialists', label: 'Открыть галерею портретов специалистов для сайта и соцсетей' },
  n128: { href: '#popup:resume-interiors', label: 'Открыть галерею деловых портретов в интерьере' },
  n182: { href: '#popup:doctors', label: 'Открыть галерею врачей и клиник' },
  n215: { href: '#popup:dark-business', label: 'Открыть галерею деловых портретов на тёмном фоне' },
  n378: { href: '#popup:anna-business-portrait', label: 'Открыть серию женских бизнес-портретов в интерьере' },
  n635: { href: '#popup:wardrobe-guide', label: 'Подробнее о подготовке образов к фотосъёмке' },
  n698: { href: '#popup:lighting-setup', label: 'Подробнее о профессиональном студийном освещении' },
};

// The imported cover was split into several heading elements for layout. Keep
// the same class-based composition while exposing one meaningful page heading.
const heroHeadingInlineClasses = new Set([
  'n37', 'n38', 'n39', 'n40', 'n41', 'n42', 'n43', 'n44', 'n45', 'n46', 'n47', 'n48',
]);

function firstDescendantHref(node: DesignNode): string | undefined {
  if (node.attrs.href) return node.attrs.href;
  for (const child of node.children) {
    const href = firstDescendantHref(child);
    if (href) return href;
  }
}

function firstDescendantText(node: DesignNode): string | undefined {
  if (node.html) {
    const text = node.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  for (const child of node.children) {
    const text = firstDescendantText(child);
    if (text) return text;
  }
}

function descendantPlainTexts(node: DesignNode): string[] {
  const ownText = node.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return [
    ...(ownText ? [ownText] : []),
    ...node.children.flatMap(descendantPlainTexts),
  ];
}

function descendantContainsSvg(node: DesignNode): boolean {
  return Boolean(node.html?.includes('<svg')) || node.children.some(descendantContainsSvg);
}

function isLegacySeriesCta(node: DesignNode): boolean {
  if (node.children.length !== 1 || !node.children[0].className.includes('reveal-layer')) return false;
  const texts = descendantPlainTexts(node);
  return texts.length === 1 && texts[0].toLocaleLowerCase('ru') === 'смотреть серию';
}

function isLegacyGalleryCount(node: DesignNode): boolean {
  if (node.children.length !== 1 || node.children[0].children.length !== 2) return false;
  const texts = descendantPlainTexts(node);
  return texts.length === 1 && /^\d{1,3}$/.test(texts[0]) && descendantContainsSvg(node);
}

function GalleryCountBadge({ count, alwaysVisible = false }: { count: number; alwaysVisible?: boolean }) {
  return <span className={`gallery-count-badge${alwaysVisible ? ' gallery-count-badge--always' : ''}`} aria-hidden="true">
    <span>{count}</span>
    <svg viewBox="0 0 18 15" aria-hidden="true">
      <rect x="3.5" y="1.5" width="13" height="10" rx="1.2" />
      <path d="M1.5 4v8.2c0 .72.58 1.3 1.3 1.3h10.7" />
      <circle cx="7" cy="5" r="1" />
      <path d="m5 9 2.5-2.2 2 1.6 1.7-1.4 3.3 2.8" />
    </svg>
  </span>;
}

function Photo({ image, basePath }: {image: NonNullable<DesignNode['image']>;basePath:string}) {
  const srcSet = image.srcSet?.replace(/(^|,\s*)([^\s,]+)/g, (_m, separator, src) => separator + basePath + src);
  const isHero = image.original === heroAvif.original;
  const localize = (value:string) => value.replace(/(^|,\s*)([^\s,]+)/g,(_m,sep,src)=>sep+basePath+src);
  const staticPhoto = <picture className={`photo${isHero ? ' hero-photo-static' : ''}`}>
    {isHero && <source media="(min-width: 1200px)" type="image/avif" srcSet={localize(desktopHero.formats.avif.srcSet)} sizes={desktopHero.sizes}/>} 
    {isHero && <source media="(min-width: 1200px)" type="image/webp" srcSet={localize(desktopHero.formats.webp.srcSet)} sizes={desktopHero.sizes}/>} 
    {isHero && <source type="image/avif" srcSet={localize(heroAvif.srcSet)} sizes={image.sizes}/>} 
    <img src={basePath + image.src} srcSet={srcSet} sizes={image.sizes ?? '(max-width: 479px) 90vw, (max-width: 959px) 600px, 650px'} width={image.width} height={image.height} alt={isHero ? desktopHero.alt : image.alt} loading={image.critical ? 'eager' : 'lazy'} fetchPriority={image.critical ? 'high' : 'low'} decoding="async" />
  </picture>;
  if (!isHero) return staticPhoto;
  return <>
    {staticPhoto}
    <div className="desktop-hero-slideshow" data-desktop-hero-slideshow role="img" aria-label={desktopHero.alt}>
      <picture className="desktop-hero-slide is-active" aria-hidden="true">
        <source media="(min-width: 1200px)" type="image/avif" srcSet={localize(desktopHero.formats.avif.srcSet)} sizes={desktopHero.sizes}/>
        <source media="(min-width: 1200px)" type="image/webp" srcSet={localize(desktopHero.formats.webp.srcSet)} sizes={desktopHero.sizes}/>
        <img src={transparentPixel} width={desktopHero.width} height={desktopHero.height} alt="" loading="eager" fetchPriority="high" decoding="async" />
      </picture>
      {desktopHeroSlides.map((slide) => <picture key={slide.src} className="desktop-hero-slide" aria-hidden="true">
        <source media="(min-width: 1200px)" type="image/avif" data-srcset={basePath + slide.src}/>
        <img src={transparentPixel} width={slide.width} height={slide.height} alt="" loading="lazy" fetchPriority="low" decoding="async" style={{objectPosition: slide.position}} />
      </picture>)}
    </div>
  </>;
}

function RetouchComparison({basePath}:{basePath:string}) {
  return <div className="retouch-comparison" style={{'--split':'50%'} as CSSProperties}>
    <img src={basePath+after.src} srcSet={after.srcSet?.replace(/(^|,\s*)([^\s,]+)/g, (_m, sep, src)=>sep+basePath+src)} sizes="(max-width:639px) 90vw, 520px" alt="После ретуши" width={after.width} height={after.height} loading="lazy" />
    <img className="retouch-before" src={basePath+before.src} srcSet={before.srcSet?.replace(/(^|,\s*)([^\s,]+)/g, (_m, sep, src)=>sep+basePath+src)} sizes="(max-width:639px) 90vw, 520px" alt="До ретуши" width={before.width} height={before.height} loading="lazy" />
    <input type="range" min="0" max="100" defaultValue="50" aria-label="Сравнить исходник и ретушь" />
    <span className="retouch-line"/><span className="retouch-handle" aria-hidden="true">↔</span>
    <span className="retouch-label before-label">Исходник</span><span className="retouch-label after-label">Ретушь</span>
  </div>;
}

function YandexReviewLink() {
  return <a
    className="yandex-review-link"
    href="https://yandex.ru/profile/174489408846?add-review=true"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Написать отзыв в Яндексе"
    title="Оставить отзыв в Яндексе"
  >
    <span className="yandex-review-link__mark" aria-hidden="true">Я</span>
    <span className="yandex-review-link__label">Написать отзыв</span>
    <svg className="yandex-review-link__arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 9 9 3M4 3h5v5" />
    </svg>
  </a>;
}

function Node({node, basePath, galleryHref}:{node:DesignNode;basePath:string;galleryHref?:string}) {
  const attributes: Record<string, unknown> = {...node.attrs, className:'design-node '+node.className};
  const imageGalleryLink = imageGalleryLinks[node.className];
  const declaredHref = imageGalleryLink?.href ?? node.attrs.href;
  const ownGalleryHref = declaredHref && galleryImageCounts[declaredHref] ? declaredHref : undefined;
  const activeGalleryHref = ownGalleryHref ?? galleryHref;
  const galleryCount = activeGalleryHref ? galleryImageCounts[activeGalleryHref] : undefined;
  const tag = imageGalleryLink ? 'a' : node.className === 'n36' ? 'h1' : heroHeadingInlineClasses.has(node.className) ? 'span' : node.tag;
  if (imageGalleryLink) {
    attributes.className += ' image-gallery-link';
    attributes.href = imageGalleryLink.href;
    attributes['aria-label'] = imageGalleryLink.label;
    attributes['aria-haspopup'] = 'dialog';
  }
  if (ownGalleryHref) attributes['aria-haspopup'] = 'dialog';
  if (isLegacySeriesCta(node)) attributes.className += ' legacy-series-cta';
  if (isLegacyGalleryCount(node)) attributes.className += ' legacy-gallery-count';
  if (node.image && galleryCount) attributes.className += ' gallery-badge-host';
  if (teamCardClasses.has(node.className)) {
    const href = firstDescendantHref(node);
    const name = firstDescendantText(node);
    if (href) {
      attributes.className += ' team-card-interactive';
      attributes.role = 'link';
      attributes.tabIndex = 0;
      attributes['aria-label'] = `Открыть Instagram${name ? `: ${name}` : ''}`;
      attributes['data-instagram-href'] = href;
    }
  }
  if (attributes.tabindex) {attributes.tabIndex=attributes.tabindex;delete attributes.tabindex;}
  if (attributes.href === 'https://photoprobiz.ru/' || attributes.href === 'https://photoprobiz.ru') attributes.href=basePath;
  if (attributes.target === '_blank') attributes.rel='noopener noreferrer';
  if (node.widget === 'inline-form') return createElement('div',attributes,<div data-form-root="inline"><LeadForm variant="inline" basePath={basePath}/></div>);
  if (node.widget === 'retouch') return createElement('div',attributes,<RetouchComparison basePath={basePath}/>);
  if (node.image) return createElement(tag,attributes,<Photo image={node.image} basePath={basePath}/>,galleryCount && <GalleryCountBadge count={galleryCount} alwaysVisible={activeGalleryHref === '#popup:anna-business-portrait'}/>,node.children.map(child=><Node key={child.className} node={child} basePath={basePath} galleryHref={activeGalleryHref}/>));
  if (node.html !== undefined) {
    attributes.dangerouslySetInnerHTML={__html:node.html};
    return createElement(tag,attributes);
  }
  return createElement(tag,attributes,node.children.map((child)=><Node key={child.className} node={child} basePath={basePath} galleryHref={activeGalleryHref}/>));
}

export function DesignSection({section,basePath='./'}:{section:SectionData;basePath?:string}) {
  const tag=section.id==='header'?'header':section.id==='footer'?'footer':'section';
  return createElement(tag,{id:section.anchor ?? section.id,className:'page-section section-'+section.id,'data-section':section.id},
    <div className="canvas">
      {section.nodes.map(n=><Node key={n.className} node={n} basePath={basePath}/>)}
      {section.id === 'footer' && <YandexReviewLink/>}
    </div>);
}
