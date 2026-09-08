import '../styles/dialog.css';

const image = {
  src: 'images/fotostudiya-v-ofise-professionalnaya-fotosessiya-biznesmena-909184a89-1000.webp',
  srcSet: [
    'images/fotostudiya-v-ofise-professionalnaya-fotosessiya-biznesmena-909184a89-320.webp 320w',
    'images/fotostudiya-v-ofise-professionalnaya-fotosessiya-biznesmena-909184a89-640.webp 640w',
    'images/fotostudiya-v-ofise-professionalnaya-fotosessiya-biznesmena-909184a89-960.webp 960w',
    'images/fotostudiya-v-ofise-professionalnaya-fotosessiya-biznesmena-909184a89-1000.webp 1000w',
  ],
  alt: 'Профессиональная фотосъёмка в офисе: фотограф снимает мужчину в деловом костюме на белом фоне со студийным светом',
};

function assetUrl(src: string, basePath: string) {
  return `${basePath.replace(/\/?$/, '/')}${src.replace(/^\/+/, '')}`;
}

export function OfficeSetupFeature({ basePath = '/' }: { basePath?: string }) {
  return <article className="office-setup-feature">
    <div className="office-setup-feature__copy">
      <p className="office-setup-feature__eyebrow">Съёмка в офисе</p>
      <h2>Полноценная студия в вашем пространстве</h2>
      <div className="office-setup-feature__body">
        <p>Я полностью беру на себя техническую сторону. Даже если в кабинетах не хватает естественного света, мои импульсные приборы обеспечат премиальную картинку журнального уровня.</p>
        <p>Моё оборудование абсолютно автономно: вспышки работают от аккумуляторов, поэтому нам не понадобятся розетки и мешающие провода на полу.</p>
        <p>Если подходящей стены для съёмки не найдётся, я привезу и установлю переносную систему с профессиональным бумажным или тканевым фоном нужного корпоративного оттенка.</p>
      </div>
    </div>
    <figure className="office-setup-feature__media">
      <img
        src={assetUrl(image.src, basePath)}
        srcSet={image.srcSet.map((item) => {
          const [src, descriptor] = item.split(' ');
          return `${assetUrl(src, basePath)} ${descriptor}`;
        }).join(', ')}
        sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1200px) 48vw, 760px"
        width="1000"
        height="1340"
        alt={image.alt}
        decoding="async"
        fetchPriority="high"
      />
    </figure>
  </article>;
}
