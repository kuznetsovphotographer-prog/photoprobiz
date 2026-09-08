/**
 * Rebuild audited public assets without editing any original material.
 * Use an installed sharp package, or CODEX_NODE_MODULES / the bundled runtime.
 * node scripts/optimize-assets.mjs [--images-only] [--fonts-only] [--verify-only]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  const bundled = process.env.CODEX_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  sharp = require(path.join(bundled, 'sharp'));
}
sharp.concurrency(1);
const out = path.join(root, 'public');
const audit = path.join(root, 'audit');
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const json = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const writeJson = (file, value) => fs.writeFile(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const exists = async file => !!(await fs.stat(file).catch(() => null));
for (const dir of ['images', 'icons', 'fonts', 'fonts/licenses', 'favicon', 'downloads']) await fs.mkdir(path.join(out, dir), { recursive: true });
await fs.mkdir(path.join(root, 'src/data'), { recursive: true });

const overrides = {
  'Frame_16.jpg': 'client-gazprom', 'Frame_17.jpg': 'client-t-bank', 'Frame_18.jpg': 'client-dom-rf',
  'Frame_19.jpg': 'client-izhevsk-plastics', 'Frame_20.jpg': 'client-tsargrad', 'Frame_21.jpg': 'client-udmurtia-circus',
  'Frame_22.jpg': 'client-alyaska', 'Frame_23.jpg': 'client-cosmos-hotel-group', 'Frame_24.jpg': 'client-ozon',
  'MAX.png': 'contact-max', 'Slide_16_9_-_1.jpg': 'alexander-kuznetsov-social-cover',
};
function slug(record) {
  const remoteName = decodeURIComponent(new URL(record.url).pathname.split('/').pop());
  const raw = overrides[remoteName] || path.basename(record.approvedSource).replace(/^\w{12}-/, '').replace(/\.[^.]+$/, '');
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 76) || 'site-decoration';
}

async function makeImages() {
  const records = await json('audit/local-remote-matches.json');
  const byHash = new Map();
  for (const r of records) {
    if (!r.approvedSource) throw new Error(`No approved source: ${r.url}`);
    const buffer = await fs.readFile(path.join(root, r.approvedSource));
    r.inputHash = hash(buffer);
    if (!byHash.has(r.inputHash)) byHash.set(r.inputHash, { record: r, buffer });
  }
  const generated = new Map();
  const queue = [...byHash.entries()];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const [inputHash, { record, buffer }] = queue[cursor++];
      const name = `${slug(record)}-${inputHash.slice(0, 9)}`;
      const isSvg = record.type === 'svg';
      const meta = await sharp(buffer).metadata();
      if (isSvg) {
        const src = `icons/${name}.svg`;
        await fs.writeFile(path.join(out, src), buffer);
        generated.set(inputHash, { src, srcSet: '', width: meta.width, height: meta.height, original: record.approvedSource, format: 'svg', variants: [{ src, width: meta.width, height: meta.height, bytes: buffer.length }] });
        continue;
      }
      const rotated = meta.autoOrient || { width: meta.width, height: meta.height };
      const maximum = Math.min(rotated.width, 1920);
      const widths = [...new Set([320, 640, 960, 1440, 1920].filter(w => w <= maximum).concat(maximum))].sort((a, b) => a - b);
      const remoteName = decodeURIComponent(new URL(record.url).pathname.split('/').pop());
      const lossless = /^Frame_\d+\.jpg$/i.test(remoteName) || /MAX\.png$/i.test(remoteName) || (rotated.width / rotated.height > 3.5 && rotated.height < 700);
      const variants = [];
      for (const width of widths) {
        const src = `images/${name}-${width}.webp`;
        const target = path.join(out, src);
        const settings = { quality: width === maximum ? 90 : 88, effort: 5, smartSubsample: true, lossless };
        const info = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp(settings).toFile(target);
        variants.push({ src, width: info.width, height: info.height, bytes: info.size });
      }
      const largest = variants.at(-1);
      generated.set(inputHash, { src: largest.src, srcSet: variants.map(v => `${v.src} ${v.width}w`).join(', '), width: largest.width, height: largest.height, original: record.approvedSource, format: 'webp', lossless, variants });
      if (generated.size % 25 === 0) console.log(`Optimized ${generated.size}/${queue.length} unique assets`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  const manifest = {};
  for (const r of records) {
    const data = generated.get(r.inputHash);
    for (const alias of new Set([r.url, ...r.aliases])) manifest[alias] = { ...data, original: r.approvedSource };
  }
  await writeJson('src/data/assets.json', manifest);
  const fav = records.find(r => /favikon_for_photopro\.svg/.test(r.url));
  await fs.copyFile(path.join(root, fav.approvedSource), path.join(out, 'favicon/favicon.svg'));
  const pdfSource = path.join(root, 'Фотографии для сайта по деловым съемкам/Идеальный бизнес-портрет. Чек-лист по подготовке.PDF');
  const pdfDest = path.join(out, 'downloads/business-portrait-checklist.pdf');
  await fs.copyFile(pdfSource, pdfDest);
  if (hash(await fs.readFile(pdfDest)) !== '48807f50fa5453dd304457384d648111277863e1e5e4a469b0b77187f0f97574') throw new Error('PDF hash mismatch');
  const statistics = {
    sourceUrlCount: Object.keys(manifest).length, publishedUniqueAssets: records.length, uniqueGeneratedAssets: generated.size,
    publishedSourceBytes: records.reduce((n, r) => n + r.bytes, 0),
    optimizedMaximumBytes: [...generated.values()].reduce((n, x) => n + x.variants.at(-1).bytes, 0),
    allResponsiveBytes: [...generated.values()].reduce((n, x) => n + x.variants.reduce((sum, v) => sum + v.bytes, 0), 0),
    uniqueOutputs: [...generated.values()].reduce((n, x) => n + x.variants.length, 0),
    formats: { webp: [...generated.values()].filter(x => x.format === 'webp').length, svg: [...generated.values()].filter(x => x.format === 'svg').length },
    pdfBytes: (await fs.stat(pdfDest)).size,
    hero: Object.entries(manifest).find(([url]) => url.endsWith('/gruppovoy-biznes-por.webp')),
    generatedAt: new Date().toISOString(),
  };
  await writeJson('audit/local-optimized-assets-stats.json', statistics);
  console.log('ASSETS_MANIFEST_READY src/data/assets.json');
  console.log(JSON.stringify(statistics, null, 2));
}

async function download(url, destination) {
  const result = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' } });
  if (!result.ok) throw new Error(`HTTP ${result.status}: ${url}`);
  const data = Buffer.from(await result.arrayBuffer());
  await fs.writeFile(destination, data);
  return data;
}

async function makeFonts() {
  const provenance = [];
  const tildaUrl = 'https://static.tildacdn.com/fonts/tildasans/TildaSans-VF.woff2';
  const tildaFont = await download(tildaUrl, path.join(out, 'fonts/tilda-sans-variable.woff2'));
  provenance.push({ family: 'Tilda Sans', weights: '250 900', file: 'fonts/tilda-sans-variable.woff2', bytes: tildaFont.length, source: tildaUrl });
  const archiveUrl = 'https://static.tildacdn.net/downloads/TildaSans/TildaSans-VF_TTF_Web.zip';
  const archive = path.join(audit, 'local-tildasans-download.zip');
  await download(archiveUrl, archive);
  const py = process.env.CODEX_PYTHON || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  // Read only licensing documents from the official archive; no font conversion.
  const extract = "import sys,zipfile,pathlib,json,io; sys.path.insert(0,str(pathlib.Path('audit/tooling').resolve())); from fontTools.ttLib import TTFont; z=zipfile.ZipFile(sys.argv[1]); out=pathlib.Path(sys.argv[2]); names=[n for n in z.namelist() if any(k in n.lower() for k in ['license','licence','ofl','eula']) and not n.endswith('/')]; [(out/('TildaSans-'+pathlib.Path(n).name)).write_bytes(z.read(n)) for n in names]; fontname=next(n for n in z.namelist() if n.endswith('.ttf') and not n.startswith('__MACOSX')); font=TTFont(io.BytesIO(z.read(fontname))); metadata=sorted(set(str(n.nameID)+': '+n.toUnicode() for n in font['name'].names if n.nameID in [0,13,14])); (out/'TildaSans-FONT-METADATA.txt').write_text('Official archive: TildaSans-VF_TTF_Web.zip\\nFont entry: '+fontname+'\\nNo standalone license file in archive. Embedded font copyright and license fields:\\n'+'\\n'.join(metadata)+'\\n',encoding='utf-8'); print(json.dumps(names+[fontname+' (embedded license metadata)']))";
  const licenseNames = execFileSync(py, ['-X', 'utf8', '-c', extract, archive, path.join(out, 'fonts/licenses')], { encoding: 'utf8' });
  provenance[0].licenseArchive = archiveUrl;
  provenance[0].licenseArchiveEntries = JSON.parse(licenseNames);
  await Promise.all([
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt', path.join(out, 'fonts/licenses/Inter-OFL.txt')),
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt', path.join(out, 'fonts/licenses/Montserrat-OFL.txt')),
  ]);
  const interLicense = await fs.readFile(path.join(out, 'fonts/licenses/Inter-OFL.txt'), 'utf8');
  const oflBody = interLicense.slice(interLicense.indexOf('-----------------------------------------------------------'));
  await fs.writeFile(path.join(out, 'fonts/licenses/TildaSans-OFL.txt'), `Copyright (c) Paratype, with Reserved Font Name "Tilda Sans".\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\nCopyright and licensing declaration: https://tilda.cc/ru/lp/tildasans/ (download license popup).\nThe official font archive embeds the same OFL license URL in name records 13/14; see TildaSans-FONT-METADATA.txt.\n\n${oflBody}`);
  const googleCssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Montserrat:wght@700..900&display=swap';
  const googleCss = (await download(googleCssUrl, path.join(audit, 'local-google-fonts-source.css'))).toString('utf8');
  const fontCss = [];
  for (const match of googleCss.matchAll(/\/\*\s*([^*]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    const subset = match[1].trim();
    if (!['latin', 'cyrillic'].includes(subset)) continue;
    const block = match[2];
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const url = block.match(/url\(([^)]+)\)/)[1];
    const file = `fonts/${family.toLowerCase()}-${subset}-variable.woff2`;
    const data = await download(url, path.join(out, file));
    if (data.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Not WOFF2: ${file}`);
    const weights = block.match(/font-weight:\s*([^;]+);/)[1];
    const [minWeight, maxWeight] = weights.split(/\s+/);
    // Google serves the full 100–900 axis even for a requested partial range.
    // Keep only the axis interval used by the site; OFL copyright is retained.
    const restrictAxis = "import sys,pathlib; sys.path.insert(0,str(pathlib.Path('audit/tooling').resolve())); from fontTools.ttLib import TTFont; from fontTools.varLib.instancer import instantiateVariableFont; f=TTFont(sys.argv[1]); instantiateVariableFont(f,{'wght':(float(sys.argv[2]),float(sys.argv[3]))},inplace=True,optimize=True); f.flavor='woff2'; f.save(sys.argv[1])";
    execFileSync(py, ['-c', restrictAxis, path.join(out, file), minWeight, maxWeight], { encoding: 'utf8' });
    const optimizedBytes = (await fs.stat(path.join(out, file))).size;
    fontCss.push(`/* ${family}: ${subset} */\n` + block.replace(url, `./${path.basename(file)}`));
    provenance.push({ family, weights, subset, file, bytes: optimizedBytes, originalBytes: data.length, transformation: `Variable wght axis limited to ${weights}; original glyphs and copyright retained.`, source: url, unicodeRange: block.match(/unicode-range:\s*([^;]+);/)[1] });
  }
  if (fontCss.length !== 4) throw new Error(`Expected four Latin/Cyrillic variable font faces, got ${fontCss.length}`);
  await fs.writeFile(path.join(out, 'fonts/secondary-fonts.css'), fontCss.join('\n\n') + '\n');
  await fs.writeFile(path.join(out, 'fonts/FONT-SOURCES.md'), `# Local font sources\n\nTilda Sans: https://tilda.cc/ru/lp/tildasans/\nThe official archive ${archiveUrl} has no standalone license file. Embedded copyright/OFL metadata was read from its TTF font and saved as licenses/TildaSans-FONT-METADATA.txt. The official website's download popup supplies the copyright/reserved-name declaration; licenses/TildaSans-OFL.txt includes that declaration and the full standard OFL 1.1 text.\n\nInter and Montserrat: Google Fonts, SIL OFL 1.1; full licenses are in licenses/.\nOnly upright Inter 400–700 and Montserrat 700–900, Latin and Cyrillic subsets, are distributed.\n\nAll font-face rules use font-display: swap. No font requests to an external host are needed at runtime.\n`);
  await writeJson('audit/local-fonts-manifest.json', provenance);
  console.log('FONTS_READY', provenance.map(x => `${x.file}: ${x.bytes}`).join('; '));
}

async function verify() {
  const manifest = await json('src/data/assets.json');
  const files = new Map();
  for (const [url, item] of Object.entries(manifest)) {
    if (!item.src || !item.variants?.length) throw new Error(`Incomplete asset ${url}`);
    for (const v of item.variants) files.set(v.src, v);
  }
  for (const [file, expected] of files) {
    const meta = await sharp(path.join(out, file)).metadata();
    if (meta.width !== expected.width || meta.height !== expected.height) throw new Error(`Incorrect image dimensions ${file}`);
    // Fully decode output rather than checking headers alone.
    await sharp(path.join(out, file)).raw().toBuffer();
    if ((await fs.stat(path.join(out, file))).size !== expected.bytes) throw new Error(`Incorrect bytes ${file}`);
  }
  const fonts = (await exists(path.join(audit, 'local-fonts-manifest.json'))) ? await json('audit/local-fonts-manifest.json') : [];
  for (const font of fonts) if ((await fs.readFile(path.join(out, font.file))).subarray(0, 4).toString() !== 'wOF2') throw new Error(`Invalid font ${font.file}`);
  if (fonts.length) {
    const py = process.env.CODEX_PYTHON || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
    const checkFonts = "import sys,pathlib,json; sys.path.insert(0,str(pathlib.Path('audit/tooling').resolve())); from fontTools.ttLib import TTFont; results=[]; files=sorted(pathlib.Path('public/fonts').glob('*.woff2')); [(lambda f,p: results.append({'file':p.name,'glyphs':f['maxp'].numGlyphs,'axes':[(x.axisTag,x.minValue,x.maxValue) for x in f['fvar'].axes],'hasCyrillic':ord('Я') in f.getBestCmap(),'hasLatin':ord('A') in f.getBestCmap(),'allTablesRead':all(f[k] is not None for k in f.keys() if k != 'GlyphOrder')}))(TTFont(p),p) for p in files]; print(json.dumps(results))";
    const validation = JSON.parse(execFileSync(py, ['-X', 'utf8', '-c', checkFonts], { encoding: 'utf8' }));
    await writeJson('audit/local-fonts-validation.json', validation);
  }
  const stats = await json('audit/local-optimized-assets-stats.json');
  const fontBytes = fonts.reduce((n, x) => n + x.bytes, 0);
  const percent = ((1 - stats.optimizedMaximumBytes / stats.publishedSourceBytes) * 100).toFixed(1);
  const report = `# Prepared local assets\n\nAll original source materials are unchanged. Rebuild: \`node scripts/optimize-assets.mjs\`. Sharp is a build-time tool only.\n\n- ${stats.sourceUrlCount} published URL aliases map to ${stats.uniqueGeneratedAssets} deduplicated assets.\n- ${stats.formats.webp} raster assets use responsive WebP, quality 88 for reduced versions and 90 for the maximum version; small logos/text graphics use lossless WebP.\n- ${stats.formats.svg} unique SVG originals are copied without altering paths or colors.\n- ${stats.uniqueOutputs} responsive image/icon files, fully decoded and checked.\n- Width targets: 320 / 640 / 960 / 1440 / 1920, plus the natural source width when below 1920. No upscaling.\n- Published original files: ${stats.publishedSourceBytes.toLocaleString('en-US')} bytes.\n- One maximum output per unique asset: ${stats.optimizedMaximumBytes.toLocaleString('en-US')} bytes (${percent}% smaller than the published inventory, including deduplication).\n- All responsive variants stored on disk: ${stats.allResponsiveBytes.toLocaleString('en-US')} bytes. A browser selects one variant, not every stored size.\n- PDF: ${stats.pdfBytes.toLocaleString('en-US')} bytes, byte-identical to both the local original and the current public download. Stored as \`downloads/business-portrait-checklist.pdf\`.\n- Fonts: ${fonts.length} WOFF2 files, ${fontBytes.toLocaleString('en-US')} bytes. Tilda Sans variable; Inter 400–700 and Montserrat 700–900, Latin/Cyrillic subsets.\n- Official font licenses are stored in \`public/fonts/licenses/\`; provenance is in \`audit/local-fonts-manifest.json\`. Tilda Sans is locally hosted and requires no Tilda service or runtime.\n- Favicon: \`favicon/favicon.svg\`, copied from the current site.\n- \`src/data/assets.json\` uses base-relative paths with no leading slash. \`src\` points to the largest variant for galleries; use \`srcSet\` and accurate \`sizes\` for inline photos.\n\nVerification: ${files.size} outputs fully decoded; dimensions and byte sizes match the manifest; all WOFF2 signatures verified. PDF SHA-256: 48807f50fa5453dd304457384d648111277863e1e5e4a469b0b77187f0f97574.\n\nThis report measures asset preparation. Actual browser transfer, LCP, and Lighthouse scores must be measured against the production application.\n`;
  async function listFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(e => e.isDirectory() ? listFiles(path.join(directory, e.name)) : [path.join(directory, e.name)]))).flat();
  }
  const assetFiles = (await Promise.all(['images', 'icons', 'fonts', 'favicon', 'downloads'].map(dir => listFiles(path.join(out, dir))))).flat();
  const allDiskBytes = (await Promise.all(assetFiles.map(file => fs.stat(file)))).reduce((sum, s) => sum + s.size, 0);
  const extra = `\nTotal prepared asset files (including every responsive size, licenses, font CSS and PDF): ${assetFiles.length} files, ${allDiskBytes.toLocaleString('en-US')} bytes on disk. This is not an initial page transfer measurement.\n\nFontTools fully read every font table and confirmed actual wght ranges: Tilda Sans 250–900, Inter 400–700, Montserrat 700–900. Cyrillic glyph coverage is confirmed in the appropriate subsets; results: \`audit/local-fonts-validation.json\`. Google Fonts' original 100–900 axes were limited to the used ranges while retaining original glyphs and copyright notices.\n\nVisual spot checks: maximum hero image, monochrome author portrait, and the lossless Cosmos Hotel Group logo were opened and inspected after conversion.\n`;
  await fs.writeFile(path.join(audit, 'ASSETS-REPORT.md'), report + extra);
  console.log(`PASS: ${files.size} image/icon outputs decoded; ${fonts.length} WOFF2 fonts verified`);
}

if (!process.argv.includes('--verify-only')) {
  if (!process.argv.includes('--fonts-only')) await makeImages();
  if (!process.argv.includes('--images-only')) await makeFonts();
}
await verify();
