import '../styles/dialog.css';

const image = {
  src: 'images/harizmatichnyy-muzhskoy-biznes-portret-v-kostyume-dfb3a44da-1000.webp',
  srcSet: [
    'images/harizmatichnyy-muzhskoy-biznes-portret-v-kostyume-dfb3a44da-320.webp 320w',
    'images/harizmatichnyy-muzhskoy-biznes-portret-v-kostyume-dfb3a44da-640.webp 640w',
    'images/harizmatichnyy-muzhskoy-biznes-portret-v-kostyume-dfb3a44da-960.webp 960w',
    'images/harizmatichnyy-muzhskoy-biznes-portret-v-kostyume-dfb3a44da-1000.webp 1000w',
  ],
  alt: 'Харизматичный мужской бизнес-портрет: улыбающийся мужчина в чёрном пиджаке и белой рубашке',
};

function assetUrl(src: string, basePath: string) {
  return `${basePath.replace(/\/?$/, '/')}${src.replace(/^\/+/, '')}`;
}

export function WardrobeGuideFeature({ basePath = '/' }: { basePath?: string }) {
  return <article className="office-setup-feature wardrobe-guide-feature">
    <div className="office-setup-feature__copy">
      <p className="office-setup-feature__eyebrow">Подготовка к съёмке</p>
      <h2>Детальный разбор образов</h2>
      <div className="office-setup-feature__body">
        <p>Грамотный гардероб — половина успеха делового портрета. До начала съёмок мы детально проговорим ваши образы, чтобы одежда подчёркивала ваш профессиональный статус.</p>
        <p>Я отправлю понятный чек-лист подготовки: какие силуэты и фактуры смотрятся выигрышно, а от каких узоров, например мелкой рябящей клетки, лучше отказаться перед камерой.</p>
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
        height="999"
        alt={image.alt}
        decoding="async"
      />
    </figure>
  </article>;
}
