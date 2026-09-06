import fs from 'node:fs';

const path='public/anime-index.json';
if(!fs.existsSync(path)) throw new Error(`${path} is missing`);
const raw=fs.readFileSync(path,'utf8').trim();
if(!raw) throw new Error(`${path} is empty`);
const data=JSON.parse(raw);
if(!Array.isArray(data)) throw new Error('anime index must be an array');
if(data.length<10000) throw new Error(`anime index unexpectedly small: ${data.length} entries`);
for(const [i,item] of data.slice(0,100).entries()){
 if(!item||typeof item.title!=='string'||!item.title.trim()) throw new Error(`invalid title at index ${i}`);
 if(!Array.isArray(item.synonyms)||!Array.isArray(item.genres)||!Array.isArray(item.studios)) throw new Error(`invalid metadata arrays at index ${i}`);
}
console.log(`Anime index OK: ${data.length} entries`);
