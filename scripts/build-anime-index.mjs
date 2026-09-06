import fs from 'node:fs/promises';

const dbPath=process.argv[2];
if(!dbPath) throw new Error('Usage: node scripts/build-anime-index.mjs <anime-offline-database.json>');

const database=JSON.parse(await fs.readFile(dbPath,'utf8'));
const entries=Array.isArray(database.data)?database.data:[];

const cleanStrings=value=>Array.from(new Set((Array.isArray(value)?value:[]).map(x=>String(x||'').trim()).filter(Boolean)));
const mediaType=type=>{
  const t=String(type||'').toUpperCase();
  if(t==='MOVIE') return 'Movie';
  if(['OVA','SPECIAL'].includes(t)) return 'OVA / Special';
  return 'Series';
};

const index=entries
  .filter(e=>e&&typeof e.title==='string'&&e.title.trim())
  .map(e=>({
    title:e.title.trim(),
    synonyms:cleanStrings(e.synonyms).slice(0,8),
    mediaType:mediaType(e.type),
    episodes:Number.isFinite(e.episodes)?e.episodes:null,
    year:Number.isFinite(e.animeSeason?.year)?e.animeSeason.year:null,
    genres:cleanStrings(e.tags).slice(0,12),
    studios:cleanStrings(e.studios).slice(0,6),
    picture:typeof e.picture==='string'?e.picture:''
  }))
  .sort((a,b)=>a.title.localeCompare(b.title));

await fs.writeFile('src/animeIndex.json',JSON.stringify(index)+'\n');
console.log(`Wrote ${index.length} anime to src/animeIndex.json`);
