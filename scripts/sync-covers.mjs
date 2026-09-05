import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const dbPath = args.find(x => !x.startsWith('--'));

const titles = JSON.parse(await fs.readFile(new URL('../src/allTitles.json', import.meta.url), 'utf8'));
const seedFiles = ['seed1.json','seed2.json','seed3.json','seed4.json'];
const seeds = (await Promise.all(seedFiles.map(f => fs.readFile(new URL(`../src/${f}`, import.meta.url), 'utf8').then(JSON.parse)))).flat();
const meta = new Map(seeds.map(x => [x.title, x]));
const coverDir = new URL('../public/covers/', import.meta.url);
const generatedFile = new URL('../src/generatedCovers.json', import.meta.url);
const sourcesFile = new URL('../src/coverSources.json', import.meta.url);
await fs.mkdir(coverDir, { recursive: true });

const readJson = async (url, fallback = {}) => { try { return JSON.parse(await fs.readFile(url, 'utf8')); } catch { return fallback; } };
const generated = await readJson(generatedFile, {});
const sources = await readJson(sourcesFile, {});

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const compact = s => norm(s).replace(/\s+/g, '');
const slug = s => norm(s).replace(/ /g, '-');
const tokens = s => new Set(norm(s).split(' ').filter(Boolean));
const dice = (a,b) => {
  const A=tokens(a),B=tokens(b); if(!A.size||!B.size) return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  return (2*hit)/(A.size+B.size);
};
const fileIsGood = async url => { try { return (await fs.stat(url)).size > 1000; } catch { return false; } };

const missing=[];
for(const title of titles){
  const name=`${slug(title)}.jpg`;
  const file=new URL(name,coverDir);
  const expected=`/project-anime/covers/${name}`;
  if(await fileIsGood(file)) {
    generated[title]=expected;
  } else {
    missing.push(title);
  }
}

for(const title of Object.keys(generated)) if(!titles.includes(title)) delete generated[title];
for(const title of Object.keys(sources)) if(!titles.includes(title)) delete sources[title];

console.log(`Missing covers: ${missing.length}/${titles.length}`);
if(checkOnly){
  if(missing.length) console.log(missing.join('\n'));
  process.exit(missing.length ? 10 : 0);
}

if(!missing.length){
  await fs.writeFile(generatedFile,JSON.stringify(generated,null,2)+'\n');
  await fs.writeFile(sourcesFile,JSON.stringify(sources,null,2)+'\n');
  console.log(`Nothing to download. Verified ${titles.length}/${titles.length} covers.`);
  process.exit(0);
}

if(!dbPath) throw new Error('Usage: node scripts/sync-covers.mjs <anime-offline-database.json>');
const database = JSON.parse(await fs.readFile(dbPath, 'utf8'));
const entries = database.data || [];
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
  if(!pool.length) pool=entries.filter(e=>Math.max(...namesFor(e).map(v=>dice(title,v)),0)>=0.55);
  return pool.map(e=>({e,score:scoreEntry(title,e)})).sort((a,b)=>b.score-a.score)[0];
}

const matches={};
const unresolved=[];
for(const title of missing){
  const best=choose(title);
  if(!best || best.score<150 || !best.e.picture){
    unresolved.push({title,best:best?.e?.title||null,score:best?.score||0});
    continue;
  }
  matches[title]={entry:best.e,score:best.score};
}

console.log(`Matched ${Object.keys(matches).length}/${missing.length} missing titles from offline database.`);
if(unresolved.length){
  console.error('Unresolved:', JSON.stringify(unresolved,null,2));
  process.exit(2);
}

let cursor=0;
const workers=Array.from({length:Math.min(12,missing.length)},async()=>{
  while(true){
    const i=cursor++; if(i>=missing.length) return;
    const title=missing[i], {entry,score}=matches[title];
    const url=entry.picture;
    const name=`${slug(title)}.jpg`;
    const file=new URL(name,coverDir);
    let ok=false,last;
    for(let attempt=1;attempt<=4 && !ok;attempt++){
      try{
        const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'le-anime-cover-sync/1.0'}});
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
    console.log(`${i+1}/${missing.length} ✓ ${title} -> ${entry.title}`);
  }
});
await Promise.all(workers);

await fs.writeFile(generatedFile,JSON.stringify(generated,null,2)+'\n');
await fs.writeFile(sourcesFile,JSON.stringify(sources,null,2)+'\n');

const stillMissing=[];
for(const title of titles){
  const file=new URL(`${slug(title)}.jpg`,coverDir);
  if(!(await fileIsGood(file)) || !generated[title]) stillMissing.push(title);
}
if(stillMissing.length) throw new Error(`Verification failed; still missing ${stillMissing.length}: ${stillMissing.join(' | ')}`);
console.log(`Verified ${titles.length}/${titles.length} covers. Downloaded only ${missing.length} missing cover(s).`);
