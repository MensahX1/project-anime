import fs from 'node:fs/promises';

const dbPath=process.argv[2];
if(!dbPath) throw new Error('Usage: node scripts/sync-metadata.mjs <anime-offline-database.json>');
const animePath='src/anime.json';
const reportPath='src/metadataSyncReport.json';
const coverSourcesPath='src/coverSources.json';
const anime=JSON.parse(await fs.readFile(animePath,'utf8'));
const database=JSON.parse(await fs.readFile(dbPath,'utf8'));
const entries=database.data||[];
let coverSources={};
try{coverSources=JSON.parse(await fs.readFile(coverSourcesPath,'utf8'))}catch{}

const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const compact=s=>norm(s).replace(/\s+/g,'');
const tokens=s=>new Set(norm(s).split(' ').filter(Boolean));
const dice=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size)};
const namesFor=e=>[e.title,...(e.synonyms||[])].filter(Boolean);
const entryKey=e=>e.sources?.[0]||`${e.title}|${e.type}|${e.animeSeason?.year||''}`;

const exact=new Map(),compactMap=new Map(),sourceMap=new Map();
for(const entry of entries){
  for(const url of entry.sources||[]) sourceMap.set(url,entry);
  for(const name of namesFor(entry)){
    const n=norm(name),c=compact(name);
    if(n){if(!exact.has(n))exact.set(n,[]);exact.get(n).push(entry)}
    if(c){if(!compactMap.has(c))compactMap.set(c,[]);compactMap.get(c).push(entry)}
  }
}

function scoreEntry(item,entry){
  const n=norm(item.title),c=compact(item.title);let score=0;
  const names=namesFor(entry);
  if(names.some(v=>norm(v)===n))score+=1000;
  else if(names.some(v=>compact(v)===c))score+=900;
  else score+=Math.max(...names.map(v=>dice(item.title,v)),0)*300;
  const ey=entry.animeSeason?.year;
  if(item.year&&ey===item.year)score+=120;
  else if(item.year&&ey&&Math.abs(ey-item.year)===1)score+=35;
  else if(item.year&&ey)score-=Math.min(80,Math.abs(ey-item.year)*12);
  if(item.episodes&&entry.episodes===item.episodes)score+=35;
  const looksMovie=/movie|film|infinity castle|reze arc|suzume|dreaming girl|sister venturing out|knapsack kid/i.test(item.title)||item.episodes===1;
  if(looksMovie&&entry.type==='MOVIE')score+=45;
  if(!looksMovie&&entry.type==='TV')score+=25;
  if(/recap|summary/i.test(entry.title||''))score-=100;
  return score;
}

function choose(item){
  const providers=coverSources[item.title]?.providers||[];
  for(const url of providers){const found=sourceMap.get(url);if(found)return{entry:found,score:2000,via:'cover-source'}}
  const n=norm(item.title),c=compact(item.title);
  let pool=[...(exact.get(n)||[])];
  if(!pool.length)pool=[...(compactMap.get(c)||[])];
  if(!pool.length)pool=entries.filter(e=>Math.max(...namesFor(e).map(v=>dice(item.title,v)),0)>=0.6);
  const best=pool.map(e=>({entry:e,score:scoreEntry(item,e),via:'title-match'})).sort((a,b)=>b.score-a.score)[0];
  return best&&best.score>=220?best:null;
}

const matches=anime.map(item=>({item,...(choose(item)||{entry:null,score:0,via:'unmatched'})}));
const ownerByKey=new Map(matches.filter(x=>x.entry).map(x=>[entryKey(x.entry),x.item.id]));
const SERIES_TYPES=new Set(['TV','ONA']);

function relatedEntries(entry){
  const out=new Map();
  for(const url of entry.relatedAnime||[]){const e=sourceMap.get(url);if(e)out.set(entryKey(e),e)}
  return [...out.values()];
}

function titleSimilarity(a,b){
  let best=0;
  for(const x of namesFor(a))for(const y of namesFor(b))best=Math.max(best,dice(x,y));
  return best;
}

function chainFor(match){
  const root=match.entry;
  if(!root)return[];
  if(!SERIES_TYPES.has(root.type))return[root];
  const out=[],seen=new Set(),q=[root];
  while(q.length&&out.length<30){
    const current=q.shift(),key=entryKey(current);
    if(seen.has(key))continue;
    seen.add(key);
    const otherOwner=ownerByKey.get(key);
    if(key!==entryKey(root)&&otherOwner&&otherOwner!==match.item.id)continue;
    if(SERIES_TYPES.has(current.type))out.push(current);
    for(const related of relatedEntries(current)){
      if(!SERIES_TYPES.has(related.type))continue;
      const rkey=entryKey(related);
      const boundaryOwner=ownerByKey.get(rkey);
      if(boundaryOwner&&boundaryOwner!==match.item.id)continue;
      if(titleSimilarity(root,related)<0.45)continue;
      if(!seen.has(rkey))q.push(related);
    }
  }
  return out.sort((a,b)=>(a.animeSeason?.year||9999)-(b.animeSeason?.year||9999));
}

const report={generatedAt:new Date().toISOString(),datasetLastUpdate:database.lastUpdate||null,source:'manami-project/anime-offline-database 2026-27',updated:[],unchanged:[],unmatched:[],review:[]};
for(const match of matches){
  const a=match.item;
  if(!match.entry){report.unmatched.push({id:a.id,title:a.title});continue;}
  const root=match.entry,chain=chainFor(match),isSeries=SERIES_TYPES.has(root.type);
  const knownEpisodes=chain.map(x=>x.episodes).filter(n=>Number.isFinite(n)&&n>0);
  const computedEpisodes=isSeries&&chain.length&&knownEpisodes.length===chain.length?knownEpisodes.reduce((s,n)=>s+n,0):(root.episodes>0?root.episodes:null);
  const seasons=isSeries?Math.max(1,chain.length):null;
  const years=chain.map(x=>x.animeSeason?.year).filter(Number.isFinite);
  const latestSeasonYear=years.length?Math.max(...years):(root.animeSeason?.year??null);
  const firstYear=root.animeSeason?.year??a.year??null;
  const before={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  if(computedEpisodes!=null)a.episodes=computedEpisodes;
  a.seasons=seasons;
  a.latestSeasonYear=latestSeasonYear;
  if(a.year==null&&firstYear!=null)a.year=firstYear;
  a.metadataSource='manami-project/anime-offline-database 2026-27';
  const after={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  const row={id:a.id,title:a.title,matchedTitle:root.title,matchScore:match.score,via:match.via,before,after,chain:chain.map(x=>({title:x.title,type:x.type,episodes:x.episodes,year:x.animeSeason?.year??null,similarity:Number(titleSimilarity(root,x).toFixed(2))}))};
  (JSON.stringify(before)!==JSON.stringify(after)?report.updated:report.unchanged).push(row);
  if(chain.length>1&&chain.some(x=>titleSimilarity(root,x)<0.6))report.review.push(row);
}

await fs.writeFile(animePath,JSON.stringify(anime,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`Offline metadata sync: ${report.updated.length} updated, ${report.unchanged.length} unchanged, ${report.unmatched.length} unmatched, ${report.review.length} review.`);
if(report.unmatched.length)console.log('Unmatched:',report.unmatched.map(x=>x.title).join(' | '));
