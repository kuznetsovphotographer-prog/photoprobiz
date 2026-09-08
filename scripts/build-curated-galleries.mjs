import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  const bundled = process.env.CODEX_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  sharp = require(path.join(bundled, 'sharp'));
}
sharp.concurrency(1);

const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
const galleriesPath = path.join(root, 'src/data/galleries.json');
const sectionsPath = path.join(root, 'src/data/sections.json');
const sections = await readJson('src/data/sections.json');
const galleries = await readJson('src/data/galleries.json');
const imageOutput = path.join(root, 'public/images');
await fs.mkdir(imageOutput, { recursive: true });

function findNode(value, className) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findNode(item, className);
      if (match) return match;
    }
  } else if (value && typeof value === 'object') {
    if (value.className === className) return value;
    for (const child of Object.values(value)) {
      const match = findNode(child, className);
      if (match) return match;
    }
  }
}

function sectionImage(className) {
  const image = findNode(sections, className)?.image;
  if (!image) throw new Error(`Image node ${className} was not found`);
  const { src, srcSet, width, height, alt } = image;
  return { src, srcSet, width, height, alt };
}

function select(galleryKey, indices) {
  const source = galleries[galleryKey]?.images;
  if (!source) throw new Error(`Gallery ${galleryKey} was not found`);
  return indices.map((index) => {
    if (!source[index]) throw new Error(`Image ${index} was not found in ${galleryKey}`);
    return source[index];
  });
}

const doctors = [
  ['DSC07126.jpg', 'portret-vracha-blondinki-v-klinike', 'Портрет врача-блондинки в чёрной медицинской форме на светлом фоне стоматологической клиники.'],
  ['DSC07161.jpg', 'portret-vracha-bryunetki-v-klinike', 'Портрет врача-брюнетки в чёрной медицинской форме в светлом кабинете клиники.'],
  ['DSC07171.jpg', 'portret-vracha-s-korotkoy-strizhkoy', 'Портрет врача с короткой стрижкой в медицинской форме на фоне оборудования клиники.'],
  ['CSD00597.jpg', 'vrach-ortoped-v-kabinete', 'Портрет врача-ортопеда за рабочим столом в медицинском кабинете.'],
  ['1963.jpg', 'vrach-s-mikroskopom', 'Портрет врача рядом с медицинским микроскопом в стоматологическом кабинете.'],
  ['2105.jpg', 'komanda-kliniki-za-kompyuterom', 'Два врача клиники позируют у рабочего компьютера в светлом кабинете.'],
  ['DSC07754.jpg', 'vrach-stomatolog-s-instrumentami', 'Стоматолог позирует с медицинскими инструментами в руках на светлом фоне клиники.'],
  ['DSC07925.jpg', 'vrach-stomatolog-s-modelyu-chelyusti', 'Врач-стоматолог показывает модель челюсти в медицинском кабинете.'],
  ['4108.jpg', 'pacientka-na-stomatologicheskoy-procedure', 'Портрет улыбающейся пациентки во время процедуры в стоматологическом кресле.'],
  ['1824.jpg', 'komanda-vrachey-na-prieme', 'Команда врачей консультирует пациентку в современном стоматологическом кабинете.'],
  ['1885.jpg', 'vrachi-stomatologi-za-rabotoy', 'Команда стоматологов обсуждает лечение во время приёма пациента.'],
  ['DSC07739.jpg', 'konsultaciya-pacientki-v-klinike', 'Врачи проводят консультацию пациентки у стоматологического кресла.'],
  ['DSC07678.jpg', 'stomatologicheskaya-procedura-pacientke', 'Врач проводит стоматологическую процедуру улыбающейся пациентке.'],
  ['DSC07904.jpg', 'vrach-za-mikroskopom', 'Врач работает с медицинским микроскопом в стоматологическом кабинете.'],
];

const leadDoctor = [
  'audit/remote-images/711468245628-confident-male-denti.jpg',
  'portret-vracha-stomatologa-v-klinike',
  'Деловой портрет улыбающегося врача-стоматолога в чёрной медицинской форме в современной клинике.',
];

// Square crops are applied only to the published variants. Original JPEG files
// stay untouched. The third crop matches the user's supplied framing reference.
const doctorSquareCrops = {
  'DSC07126.jpg': { left: 400, top: 0, width: 1000, height: 1000 },
  'DSC07161.jpg': { left: 266, top: 0, width: 989, height: 989 },
  'DSC07171.jpg': { left: 325, top: 0, width: 997, height: 997 },
};

async function optimizeDoctorImage([fileName, slug, alt]) {
  const source = fileName.includes('/')
    ? path.join(root, fileName)
    : path.join(root, 'Фотографии для сайта по деловым съемкам', 'Врачи', fileName);
  const buffer = await fs.readFile(source);
  const crop = doctorSquareCrops[fileName];
  const digest = crypto.createHash('sha256').update(buffer).update(JSON.stringify(crop || {})).digest('hex').slice(0, 9);
  const metadata = await sharp(buffer).metadata();
  const oriented = metadata.autoOrient || { width: metadata.width, height: metadata.height };
  const maximum = Math.min(crop?.width || oriented.width, 1920);
  const widths = [...new Set([320, 640, 960, 1440, 1920].filter((width) => width <= maximum).concat(maximum))].sort((a, b) => a - b);
  const variants = [];

  for (const width of widths) {
    const relative = `images/${slug}-${digest}-${width}.webp`;
    let pipeline = sharp(buffer).rotate();
    if (crop) pipeline = pipeline.extract(crop);
    const result = await pipeline
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: width === maximum ? 90 : 88, effort: 5, smartSubsample: true })
      .toFile(path.join(root, 'public', relative));
    variants.push({ src: relative, width: result.width, height: result.height, bytes: result.size });
  }

  const largest = variants.at(-1);
  return {
    src: largest.src,
    width: largest.width,
    height: largest.height,
    srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    alt,
    original: path.relative(root, source),
    format: 'webp',
    lossless: false,
    variants,
  };
}

const leadDoctorImage = await optimizeDoctorImage(leadDoctor);
const doctorImages = [];
for (const item of doctors) doctorImages.push(await optimizeDoctorImage(item));

const leadDoctorNode = findNode(sections, 'n182');
leadDoctorNode.image = { ...leadDoctorNode.image, ...leadDoctorImage };
await fs.writeFile(sectionsPath, JSON.stringify(sections, null, 2) + '\n', 'utf8');

galleries['#popup:doctors'] = {
  title: 'Врачи и клиники',
  images: [sectionImage('n182'), ...doctorImages].map(({ src, srcSet, width, height, alt }) => ({ src, srcSet, width, height, alt })),
};

galleries['#popup:digital-specialists'] = {
  title: 'Специалисты для сайта и соцсетей',
  images: [sectionImage('n124'), ...select('#popup:savina', [0, 1, 2, 4, 5, 6, 7, 8, 9])],
};

galleries['#popup:resume-interiors'] = {
  title: 'Деловой портрет в интерьере',
  images: [sectionImage('n128'), ...select('#popup:office2', [0, 1, 7, 8, 3, 10, 13, 14, 17])],
};

galleries['#popup:dark-business'] = {
  title: 'Деловой портрет на тёмном фоне',
  images: [sectionImage('n215'), ...select('#popup:studio1', [1, 7, 8, 9, 10, 12, 22, 6, 17])],
};

await fs.writeFile(galleriesPath, JSON.stringify(galleries, null, 2) + '\n', 'utf8');
console.log(`Built four curated galleries: doctors=${galleries['#popup:doctors'].images.length}, digital=${galleries['#popup:digital-specialists'].images.length}, resume=${galleries['#popup:resume-interiors'].images.length}, dark=${galleries['#popup:dark-business'].images.length}`);
