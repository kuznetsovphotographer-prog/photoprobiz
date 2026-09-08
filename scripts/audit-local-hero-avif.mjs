import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
sharp.concurrency(1);
const assets = JSON.parse(await fs.readFile('src/data/assets.json', 'utf8'));
const [url, hero] = Object.entries(assets).find(([,value]) => value.src.includes('83b9eaad2'));
const dir = 'audit/local-hero-avif';
await fs.mkdir(dir, {recursive:true});
const source = await fs.readFile(hero.original);
const candidates = [];
for (const quality of [70,75]) {
  for (const old of hero.variants) {
    const output = `${dir}/hero-${old.width}-q${quality}.avif`;
    const result = await sharp(source).rotate().resize({width:old.width,withoutEnlargement:true}).avif({quality,effort:6,chromaSubsampling:'4:4:4'}).toFile(output);
    const decoded = await sharp(output).raw().toBuffer({resolveWithObject:true});
    if(decoded.info.width !== old.width || decoded.info.height !== old.height) throw Error(`Invalid output ${output}`);
    const entry = {quality,output,width:old.width,height:old.height,webpBytes:old.bytes,avifBytes:result.size,savingPercent:100*(1-result.size/old.bytes)};
    candidates.push(entry);
    console.log(JSON.stringify(entry));
  }
}
await fs.writeFile(`${dir}/comparison.json`,JSON.stringify({url,source:hero.original,candidates},null,2)+'\n');
