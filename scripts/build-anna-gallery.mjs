import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'Фотографии для сайта по деловым съемкам', 'Анна Будь собой');
const outputDirectory = path.join(root, 'public', 'images');
const galleriesPath = path.join(root, 'src', 'data', 'galleries.json');
const sectionsPath = path.join(root, 'src', 'data', 'sections.json');
const bundledModules = path.join(process.env.USERPROFILE ?? '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules');

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require(path.join(bundledModules, 'sharp')); }
sharp.concurrency(1);

const slides = [
  { file: 'CSD01332.jpg', slug: 'zhenskiy-delovoy-portret-v-chernom-kozhanom-pidzhake', alt: 'Женский деловой портрет блондинки в чёрном кожаном пиджаке на тёмном фоне. Имиджевая фотосессия в Москве.' },
  { file: 'CSD00731.jpg', slug: 'zhenskiy-biznes-portret-v-serom-kostyume', alt: 'Женский бизнес-портрет блондинки в сером костюме. Современная имиджевая фотосессия в интерьере, Москва.' },
  { file: 'CSD01779.jpg', slug: 'zhenskiy-portret-v-chernom-polosatom-kostyume', alt: 'Стильный женский портрет в чёрном полосатом костюме. Деловая фотосессия для личного бренда в Москве.' },
  { file: 'CSD00855.jpg', slug: 'delovoy-portret-v-serom-bryuchnom-kostyume', alt: 'Ростовой женский деловой портрет в сером брючном костюме. Имиджевая съёмка в дизайнерском интерьере, Москва.' },
  { file: 'CSD01123.jpg', slug: 'zhenskiy-imidzhevyy-portret-v-chernom-obraze', alt: 'Ростовой женский имиджевый портрет в чёрном образе. Креативная бизнес-фотосессия в интерьерной студии, Москва.' },
  { file: 'CSD00926.jpg', slug: 'zhenskiy-biznes-portret-v-ochkah-i-serom-kostyume', alt: 'Женский бизнес-портрет в очках и сером костюме рядом с дизайнерским светильником. Деловая фотосессия, Москва.' },
  { file: 'CSD01413.jpg', slug: 'zhenskiy-portret-v-belom-delovom-obraze', alt: 'Женский портрет в белом деловом образе на фоне современного интерьера. Фотосессия для личного бренда в Москве.' },
  { file: 'CSD00898.jpg', slug: 'krupnyy-zhenskiy-portret-v-serom-pidzhake', alt: 'Крупный женский деловой портрет в сером пиджаке на фоне тёплой интерьерной подсветки. Бизнес-фотосессия, Москва.' },
  { file: 'CSD01260.jpg', slug: 'zhenskiy-portret-v-kozhanom-pidzhake-v-interiere', alt: 'Женский имиджевый портрет в чёрном кожаном пиджаке за столом. Интерьерная фотосессия для эксперта, Москва.' },
  { file: 'CSD00790.jpg', slug: 'zhenskiy-delovoy-portret-v-serom-pidzhake-v-interiere', alt: 'Женский деловой портрет в сером пиджаке на фоне деревянных панелей. Имиджевая фотосессия в студии, Москва.' },
];

function findNode(nodes, className) {
  for (const node of nodes) {
    if (node.className === className) return node;
    const nested = findNode(node.children ?? [], className);
    if (nested) return nested;
  }
}

async function buildImage({ file, slug, alt }) {
  const input = path.join(sourceDirectory, file);
  const buffer = await fs.readFile(input);
  const digest = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 9);
  const metadata = await sharp(buffer).rotate().metadata();
  const naturalWidth = metadata.width;
  if (!naturalWidth) throw new Error(`Cannot read width for ${file}`);
  const widths = [...new Set([320, 640, 960, 1440, naturalWidth].filter((width) => width <= naturalWidth))].sort((a, b) => a - b);
  const variants = [];

  for (const width of widths) {
    const filename = `${slug}-${digest}-${width}.webp`;
    const target = path.join(outputDirectory, filename);
    const info = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width === naturalWidth ? 90 : 88 }).toFile(target);
    variants.push({ src: `images/${filename}`, width: info.width, height: info.height });
  }

  const maximum = variants.at(-1);
  return {
    src: maximum.src,
    width: maximum.width,
    height: maximum.height,
    srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    alt,
  };
}

await fs.mkdir(outputDirectory, { recursive: true });
const [sections, galleries] = await Promise.all([
  fs.readFile(sectionsPath, 'utf8').then(JSON.parse),
  fs.readFile(galleriesPath, 'utf8').then(JSON.parse),
]);
const cover = findNode(sections.flatMap((section) => section.nodes ?? []), 'n379')?.image;
if (!cover) throw new Error('The existing n379 cover image was not found.');

const generated = [];
for (const slide of slides) generated.push(await buildImage(slide));

galleries['#popup:anna-business-portrait'] = {
  title: 'Женский бизнес-портрет в интерьере',
  images: [{ src: cover.src, width: cover.width, height: cover.height, srcSet: cover.srcSet, alt: cover.alt }, ...generated],
};
await fs.writeFile(galleriesPath, `${JSON.stringify(galleries, null, 2)}\n`, 'utf8');
console.log(`Built Anna gallery with ${galleries['#popup:anna-business-portrait'].images.length} images.`);
