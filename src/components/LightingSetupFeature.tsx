import '../styles/dialog.css';

const image = {
  src: 'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-1777.webp',
  srcSet: [
    'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-320.webp 320w',
    'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-640.webp 640w',
    'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-960.webp 960w',
    'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-1440.webp 1440w',
    'images/backstage-professionalnoy-fotosemki-v-studii-518ba7dcf-1777.webp 1777w',
  ],
  alt: 'Бэкстейдж профессиональной фотосессии с импульсным освещением, софтбоксами и студийным оборудованием',
};

function assetUrl(src: string, basePath: string) {
  return `${basePath.replace(/\/?$/, '/')}${src.replace(/^\/+/, '')}`;
}

export function LightingSetupFeature({ basePath = '/' }: { basePath?: string }) {
  return <article className="office-setup-feature lighting-setup-feature">
    <figure className="office-setup-feature__media">
      <img
        src={assetUrl(image.src, basePath)}
        srcSet={image.srcSet.map((item) => {
          const [src, descriptor] = item.split(' ');
          return `${assetUrl(src, basePath)} ${descriptor}`;
        }).join(', ')}
        sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1200px) 52vw, 820px"
        width="1777"
        height="1000"
        alt={image.alt}
        decoding="async"
        fetchPriority="high"
      />
    </figure>
    <div className="office-setup-feature__copy">
      <p className="office-setup-feature__eyebrow">Свет и оборудование</p>
      <h2>Техническое совершенство</h2>
      <div className="office-setup-feature__body">
        <p>Грамотный светотеневой рисунок — основа дорогой картинки. Он способен скрыть усталость, правильно очертить овал лица и подчеркнуть премиальную ткань делового костюма.</p>
        <p>Я использую передовое импульсное освещение и разнообразные модификаторы, чтобы добиться голливудского качества даже в стеснённых условиях стандартного офиса или фотостудии.</p>
      </div>
    </div>
  </article>;
}
