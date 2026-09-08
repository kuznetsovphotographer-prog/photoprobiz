import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const assets=JSON.parse(await fs.readFile('src/data/assets.json','utf8'));
const entries=Object.entries(assets).filter(([,value])=>value.src.includes('83b9eaad2'));
const hero=entries[0][1];
const comparison=JSON.parse(await fs.readFile('audit/local-hero-avif/comparison.json','utf8'));
const variants=[];
for(const old of hero.variants) {
 const candidate=comparison.candidates.find(row=>row.width===old.width && row.quality===70);
 if(!candidate || candidate.savingPercent<20) throw Error(`Insufficient saving at ${old.width}`);
 const buffer=await fs.readFile(candidate.output);
 const {info}=await sharp(buffer).raw().toBuffer({resolveWithObject:true});
 if(info.width!==old.width || info.height!==old.height || buffer.length!==candidate.avifBytes) throw Error(`Invalid candidate ${candidate.output}`);
 const src=old.src.replace(/\.webp$/,'.avif');
 await fs.writeFile(`public/${src}`,buffer);
 variants.push({src,width:info.width,height:info.height,bytes:buffer.length});
}
const last=variants.at(-1);
const manifest={src:last.src,srcSet:variants.map(v=>`${v.src} ${v.width}w`).join(', '),width:last.width,height:last.height,format:'avif',quality:70,effort:6,chromaSubsampling:'4:4:4',original:hero.original,sourceUrls:entries.map(([url])=>url),variants};
await fs.writeFile('src/data/hero-avif.json',JSON.stringify(manifest,null,2)+'\n');
const webpBytes=hero.variants.reduce((sum,v)=>sum+v.bytes,0),avifBytes=variants.reduce((sum,v)=>sum+v.bytes,0);
console.log(JSON.stringify({manifest:'src/data/hero-avif.json',files:variants.length,webpBytes,avifBytes,savingPercent:100*(1-avifBytes/webpBytes),variants},null,2));
