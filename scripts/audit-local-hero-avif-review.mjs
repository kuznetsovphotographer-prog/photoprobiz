import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const assets=JSON.parse(await fs.readFile('src/data/assets.json','utf8'));
const hero=Object.values(assets).find(value=>value.src.includes('83b9eaad2'));
const files=[hero.original,`public/${hero.src}`,'audit/local-hero-avif/hero-1852-q70.avif'];
const labels=['Approved original','Current WebP Q90','AVIF Q70, 4:4:4'];
for(const [name,box] of Object.entries({faces:{left:1000,top:320,width:500,height:400},clothes:{left:1350,top:370,width:450,height:500},table:{left:1050,top:820,width:500,height:300}})) {
 const composites=[];
 for(let i=0;i<files.length;i++) {
  composites.push({input:await sharp(files[i]).extract(box).png().toBuffer(),left:i*box.width,top:44});
  const label=`<svg width="${box.width}" height="44"><rect width="100%" height="100%" fill="#f3f3f3"/><text x="16" y="28" font-size="20" font-family="Arial">${labels[i]}</text></svg>`;
  composites.push({input:Buffer.from(label),left:i*box.width,top:0});
 }
 await sharp({create:{width:box.width*3,height:box.height+44,channels:3,background:'#ffffff'}}).composite(composites).png().toFile(`audit/local-hero-avif/review-${name}.png`);
}
