/**
 * Build responsive desktop hero variants from the user-owned source image.
 * The original JPEG is never modified.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRelative = 'Фотографии для сайта по деловым съемкам/gruppovoy-biznes-portret-komandy-muzhchin-moskva.avif';
const source = path.join(root, sourceRelative);
const outputDirectory = path.join(root, 'public/images');
const manifestPath = path.join(root, 'src/data/desktop-hero.json');
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require('sharp');
} catch {
  const bundled = process.env.CODEX_NODE_MODULES
    || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  sharp = require(path.join(bundled, 'sharp'));
}

const input = await fs.readFile(source);
const metadata = await sharp(input).metadata();
const autoOriented = metadata.autoOrient || { width: metadata.width, height: metadata.height };
const maximum = autoOriented.width;
const widths = [...new Set([1200, 1440, 1920, 2560, maximum].filter(width => width <= maximum))].sort((a, b) => a - b);
const digest = crypto.createHash('sha256').update(input).digest('hex').slice(0, 9);
const basename = `gruppovoy-biznes-portret-komandy-muzhchin-v-interiere-desktop-${digest}`;

await fs.mkdir(outputDirectory, { recursive: true });

// Remove only variants previously produced by this dedicated builder.
for (const filename of await fs.readdir(outputDirectory)) {
  if (filename.startsWith('gruppovoy-biznes-portret-komandy-muzhchin-v-interiere-desktop-')) {
    await fs.rm(path.join(outputDirectory, filename));
  }
}

const formats = {};
for (const format of ['avif', 'webp']) {
  const variants = [];
  for (const width of widths) {
    const filename = `${basename}-${width}.${format}`;
    const destination = path.join(outputDirectory, filename);
    if (format === 'avif' && width === maximum) {
      await fs.writeFile(destination, input);
      variants.push({ src: `images/${filename}`, width: maximum, height: autoOriented.height, bytes: input.length });
    } else {
      const pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true });
      const result = format === 'avif'
        ? await pipeline.avif({ quality: 72, effort: 6, chromaSubsampling: '4:4:4' }).toFile(destination)
        : await pipeline.webp({ quality: 88, effort: 5, smartSubsample: true }).toFile(destination);
      variants.push({ src: `images/${filename}`, width: result.width, height: result.height, bytes: result.size });
    }
  }
  formats[format] = {
    src: variants.at(-1).src,
    srcSet: variants.map(variant => `${variant.src} ${variant.width}w`).join(', '),
    variants,
  };
}

const manifest = {
  original: sourceRelative.replaceAll('/', '\\'),
  width: maximum,
  height: autoOriented.height,
  sizes: '100vw',
  alt: 'Групповой бизнес-портрет команды мужчин в костюмах в интерьере кабинета в Москве',
  formats,
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`DESKTOP_HERO_READY ${widths.join(', ')} px; ${manifestPath}`);
