import galleries from '../data/galleries.json';
import { servicePages } from '../data/servicePages';
import { CookieBanner } from '../components/CookieBanner';

type GalleryImage = { src: string; srcSet?: string; width: number; height: number; alt: string };
type GalleryData = { images: GalleryImage[] };

const serviceLinks = [
  ['biznes-portret', 'Бизнес-портрет'],
  ['korporativnaya-fotosessiya', 'Корпоративная съёмка'],
  ['fotosessiya-sotrudnikov-v-ofise', 'Сотрудники в офисе'],
  ['delovaya-fotosessiya-dlya-vrachey', 'Врачи и клиники'],
] as const;

function localSrcSet(srcSet: string | undefined, basePath: string) {
  return srcSet?.replace(/(^|,\s*)([^\s,]+)/g, (_match, separator, src) => separator + basePath + src);
}

export function ServicePage({ serviceKey, basePath = '../' }: { serviceKey: string; basePath?: string }) {
  const page = servicePages[serviceKey];
  const gallery = (galleries as Record<string, GalleryData>)[page.galleryKey];
  const images = gallery.images.slice(0, 6);
  const hero = images[0];

  return <>
    <a className="skip-link" href="#service-content">Перейти к содержимому</a>
    <header className="service-header">
      <a className="service-logo" href={basePath} aria-label="Александр Кузнецов — главная">
        <span>АЛЕКСАНДР</span><span>КУЗНЕЦОВ</span>
      </a>
      <nav aria-label="Услуги">
        {serviceLinks.map(([slug, label]) => <a key={slug} aria-current={slug === serviceKey ? 'page' : undefined} href={`${basePath}${slug}/`}>{label}</a>)}
      </nav>
      <a className="service-header-cta" href={`${basePath}#inquiry`}>Заказать съёмку</a>
    </header>
    <main id="service-content" className="service-page">
      <section className="service-hero">
        <div className="service-hero-copy">
          <p className="service-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="service-lead">{page.lead}</p>
          <a className="service-primary-cta" href={`${basePath}#inquiry`}>Обсудить съёмку</a>
        </div>
        <picture className="service-hero-photo">
          <img src={basePath + hero.src} srcSet={localSrcSet(hero.srcSet, basePath)} sizes="(max-width: 799px) 100vw, 50vw" width={hero.width} height={hero.height} alt={hero.alt} loading="eager" fetchPriority="high" decoding="async" />
        </picture>
      </section>
      <section className="service-copy" aria-label={`О съёмке: ${page.title}`}>
        <div><p className="service-section-label">Как проходит работа</p><h2>Фотографии под конкретную задачу</h2></div>
        <div>{page.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
      </section>
      <section className="service-benefits" aria-labelledby={`${serviceKey}-benefits`}>
        <h2 id={`${serviceKey}-benefits`}>Что входит в подготовку и съёмку</h2>
        <ul>{page.benefits.map(item => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="service-gallery" aria-labelledby={`${serviceKey}-gallery`}>
        <p className="service-section-label">Портфолио</p>
        <h2 id={`${serviceKey}-gallery`}>{page.galleryTitle}</h2>
        <div>{images.slice(1).map((image, index) => <picture key={image.src} className={index === 0 ? 'service-gallery-wide' : undefined}>
          <img src={basePath + image.src} srcSet={localSrcSet(image.srcSet, basePath)} sizes="(max-width: 679px) 100vw, 33vw" width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" />
        </picture>)}</div>
      </section>
      <section className="service-contact">
        <div><p className="service-section-label">Съёмка в Москве</p><h2>Расскажите, какие фотографии вам нужны</h2></div>
        <a className="service-primary-cta" href={`${basePath}#inquiry`}>Оставить заявку</a>
      </section>
    </main>
    <footer className="service-footer">
      <span>© 2026 Александр Кузнецов</span>
      <nav aria-label="Юридические документы"><a href={`${basePath}privacy/`}>Политика обработки данных</a><a href={`${basePath}consent/`}>Согласие на обработку данных</a></nav>
      <a href={basePath}>Вернуться на главную</a>
    </footer>
    <div id="cookie-root"><CookieBanner basePath={basePath} /></div><div id="ui-root" />
  </>;
}
