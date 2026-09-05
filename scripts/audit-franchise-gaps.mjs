import fs from 'node:fs/promises';

const dbPath=process.argv[2];
if(!dbPath) throw new Error('Usage: node scripts/audit-franchise-gaps.mjs <anime-offline-database.json>');

const anime=JSON.parse(await fs.readFile('src/anime.json','utf8'));
const db=JSON.parse(await fs.readFile(dbPath,'utf8'));
const entries=db.data||[];
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const namesFor=e=>[e.title,...(e.synonyms||[])].filter(Boolean);
const libraryNames=new Set(anime.flatMap(a=>[a.title]).map(norm));
const sourceIndex=new Map();
const nameIndex=new Map();
for(const e of entries){
  for(const s of e.sources||[]) sourceIndex.set(s,e);
  for(const n of namesFor(e)) if(!nameIndex.has(norm(n))) nameIndex.set(norm(n),e);
}
const stop=new Set(['the','a','an','of','and','in','to','no','season','part','movie','film','ova','special','tv']);
const toks=s=>new Set(norm(s).split(' ').filter(x=>x&&!stop.has(x)));
const overlap=(a,b)=>{const A=toks(a),B=toks(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.min(A.size,B.size)};
const classify=e=>e.type==='MOVIE'?'movie':(['OVA','SPECIAL'].includes(e.type)?'special/ova':(['TV','ONA'].includes(e.type)?'series/continuation':'other'));
const out=[];
for(const item of anime){
  const src=nameIndex.get(norm(item.title));
  if(!src) continue;
  for(const rel of src.relatedAnime||[]){
    const e=sourceIndex.get(rel);
    if(!e) continue;
    if(namesFor(e).some(n=>libraryNames.has(norm(n)))) continue;
    const kind=classify(e);
    if(kind==='other') continue;
    out.push({
      from:item.title,
      title:e.title,
      type:e.type||null,
      kind,
      episodes:e.episodes??null,
      year:e.animeSeason?.year??null,
      overlap:Number(overlap(item.title,e.title).toFixed(2)),
      sources:e.sources||[]
    });
  }
}
const dedup=new Map();
for(const r of out){
  const k=norm(r.title);
  const prev=dedup.get(k);
  if(!prev||r.overlap>prev.overlap) dedup.set(k,r);
}
const report=[...dedup.values()].sort((a,b)=>({movie:0,'series/continuation':1,'special/ova':2}[a.kind]-({movie:0,'series/continuation':1,'special/ova':2}[b.kind]))||b.overlap-a.overlap||String(a.title).localeCompare(String(b.title)));
await fs.writeFile('franchise-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(`Found ${report.length} direct related entries missing from library.`);
for(const r of report) console.log(`${r.kind}\t${r.from}\t=>\t${r.title}\t${r.year??''}\t${r.episodes??''}\toverlap=${r.overlap}`);
