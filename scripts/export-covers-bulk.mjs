import fs from 'node:fs/promises';

const dbPath = process.argv[2];
if (!dbPath) throw new Error('Usage: node scripts/export-covers-bulk.mjs <anime-offline-database.json>');

const titles = JSON.parse(await fs.readFile(new URL('../src/allTitles.json', import.meta.url), 'utf8'));
const seedFiles = ['seed1.json','seed2.json','seed3.json','seed4.json'];
const seeds = (await Promise.all(seedFiles.map(f => fs.readFile(new URL(`../src/${f}`, import.meta.url), 'utf8').then(JSON.parse)))).flat();
const meta = new Map(seeds.map(x => [x.title, x]));
const database = JSON.parse(await fs.readFile(dbPath, 'utf8'));
const entries = database.data || [];

const coverDir = new URL('../public/covers/', import.meta.url);
await fs.mkdir(coverDir, { recursive: true });

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const compact = s => norm(s).replace(/\s+/g, '');
const slug = s => norm(s).replace(/ /g, '-');
const tokens = s => new Set(norm(s).split(' ').filter(Boolean));
const dice = (a,b) => {
  const A=tokens(a),B=tokens(b); if(!A.size||!B.size) return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  return (2*hit)/(A.size+B.size);
};
const namesFor = x => [x.title, ...(x.synonyms || [])].filter(Boolean);

const exact = new Map(), compactMap = new Map();
for (const entry of entries) {
  for (const name of namesFor(entry)) {
    const n=norm(name), c=compact(name);
    if(n){if(!exact.has(n)) exact.set(n,[]); exact.get(n).push(entry)}
    if(c){if(!compactMap.has(c)) compactMap.set(c,[]); compactMap.get(c).push(entry)}
  }
}

function scoreEntry(title, entry) {
  const m=meta.get(title) || {};
  const year=m.year;
  const ep=m.episodes;
  const n=norm(title), c=compact(title);
  let score=0;
  const names=namesFor(entry);
  if(names.some(v=>norm(v)===n)) score+=1000;
  else if(names.some(v=>compact(v)===c)) score+=900;
  else score+=Math.max(...names.map(v=>dice(title,v)),0)*300;
  const ey=entry.animeSeason?.year;
  if(year && ey===year) score+=120;
  else if(year && ey && Math.abs(ey-year)===1) score+=35;
  else if(year && ey) score-=Math.min(80,Math.abs(ey-year)*12);
  const looksMovie=/movie|film|infinity castle|reze arc|suzume|dreaming girl|sister venturing out|knapsack kid/i.test(title) || ep===1;
  if(looksMovie && entry.type==='MOVIE') score+=45;
  if(!looksMovie && entry.type==='TV') score+=25;
  if(ep && entry.episodes===ep) score+=35;
  if(/recap|summary/i.test(entry.title||'')) score-=100;
  return score;
}

function choose(title) {
  const n=norm(title), c=compact(title);
  let pool=[...(exact.get(n)||[])];
  if(!pool.length) pool=[...(compactMap.get(c)||[])];
  if(!pool.length) {
    // Fallback: score every entry by title/synonym token overlap. 41k × 183 is cheap locally.
    pool=entries.filter(e=>Math.max(...namesFor(e).map(v=>dice(title,v)),0)>=0.55);
  }
  const ranked=pool.map(e=>({e,score:scoreEntry(title,e)})).sort((a,b)=>b.score-a.score);
  return ranked[0];
}

const matches={};
const unresolved=[];
for(const title of titles){
  const best=choose(title);
  if(!best || best.score<150 || !best.e.picture){
    unresolved.push({title,best:best?.e?.title||null,score:best?.score||0});
    continue;
  }
  matches[title]={entry:best.e,score:best.score};
}

console.log(`Matched ${Object.keys(matches).length}/${titles.length} titles from offline database.`);
if(unresolved.length){
  console.error('Unresolved:', JSON.stringify(unresolved,null,2));
  process.exit(2);
}

const generated={};
const sources={};
let cursor=0;
const workers=Array.from({length:12},async()=>{
  while(true){
    const i=cursor++; if(i>=titles.length) return;
    const title=titles[i], {entry,score}=matches[title];
    const url=entry.picture;
    const name=`${slug(title)}.jpg`;
    const file=new URL(name,coverDir);
    let ok=false,last;
    for(let attempt=1;attempt<=4 && !ok;attempt++){
      try{
        const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'le-anime-cover-export/2.0'}});
        if(!r.ok) throw new Error(`${r.status} ${url}`);
        const bytes=Buffer.from(await r.arrayBuffer());
        if(bytes.length<1000) throw new Error(`image too small (${bytes.length} bytes)`);
        await fs.writeFile(file,bytes);
        ok=true;
      }catch(e){last=e; await new Promise(r=>setTimeout(r,800*attempt));}
    }
    if(!ok) throw new Error(`${title}: ${last?.message||last}`);
    generated[title]=`/project-anime/covers/${name}`;
    sources[title]={
      url,
      matchedTitle:entry.title,
      type:entry.type||null,
      year:entry.animeSeason?.year||null,
      matchScore:score,
      providers:entry.sources||[],
      dataset:'manami-project/anime-offline-database 2026-27'
    };
    console.log(`${i+1}/${titles.length} ✓ ${title} -> ${entry.title}`);
  }
});
await Promise.all(workers);

await fs.writeFile(new URL('../src/generatedCovers.json',import.meta.url),JSON.stringify(generated,null,2)+'\n');
await fs.writeFile(new URL('../src/coverSources.json',import.meta.url),JSON.stringify(sources,null,2)+'\n');

const files=await fs.readdir(coverDir);
const jpgs=files.filter(x=>x.endsWith('.jpg'));
if(jpgs.length!==titles.length || Object.keys(generated).length!==titles.length) throw new Error(`Verification failed: ${jpgs.length} JPGs, ${Object.keys(generated).length} mappings, expected ${titles.length}`);
console.log(`Verified ${titles.length}/${titles.length} covers.`);
