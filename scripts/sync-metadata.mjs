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

const now=new Date();
const CURRENT_YEAR=now.getUTCFullYear();
const month=now.getUTCMonth()+1;
const CURRENT_SEASON=month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL';
const SEASON_ORDER={WINTER:1,SPRING:2,SUMMER:3,FALL:4};

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
function titleSimilarity(a,b){let best=0;for(const x of namesFor(a))for(const y of namesFor(b))best=Math.max(best,dice(x,y));return best}

function hasStarted(entry){
  if(String(entry.status||'').toUpperCase()==='UPCOMING') return false;
  const y=entry.animeSeason?.year;
  if(!Number.isFinite(y)) return true;
  if(y<CURRENT_YEAR) return true;
  if(y>CURRENT_YEAR) return false;
  const s=String(entry.animeSeason?.season||'').toUpperCase();
  if(!SEASON_ORDER[s]) return true;
  return SEASON_ORDER[s]<=SEASON_ORDER[CURRENT_SEASON];
}

function explicitContinuation(root,entry){
  if(entryKey(root)===entryKey(entry)) return true;
  if(titleSimilarity(root,entry)<0.72) return false;
  const roots=namesFor(root).map(norm).sort((a,b)=>b.length-a.length);
  const names=namesFor(entry).map(norm);
  for(const r of roots){for(const n of names){
    if(!r||!n.startsWith(r)||n===r) continue;
    const suffix=n.slice(r.length).trim();
    if(/^(season\s*\d+|\d+(st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+|ii|iii|iv|v|vi|2|3|4|5|6|second season|third season|fourth season|final season)(\b|$)/i.test(suffix)) return true;
  }}
  return false;
}

function episodeChain(match){
  const root=match.entry;
  if(!root)return[];
  if(!SERIES_TYPES.has(root.type))return hasStarted(root)?[root]:[];
  const out=[],seen=new Set(),q=[root];
  while(q.length&&out.length<8){
    const current=q.shift(),key=entryKey(current);
    if(seen.has(key))continue;
    seen.add(key);
    const otherOwner=ownerByKey.get(key);
    if(key!==entryKey(root)&&otherOwner&&otherOwner!==match.item.id)continue;
    if(SERIES_TYPES.has(current.type)&&hasStarted(current)&&explicitContinuation(root,current))out.push(current);
    for(const related of relatedEntries(current)){
      if(!SERIES_TYPES.has(related.type)||!hasStarted(related))continue;
      const rkey=entryKey(related),boundaryOwner=ownerByKey.get(rkey);
      if(boundaryOwner&&boundaryOwner!==match.item.id)continue;
      if(!explicitContinuation(root,related))continue;
      if(!seen.has(rkey))q.push(related);
    }
  }
  return out.sort((a,b)=>(a.animeSeason?.year||9999)-(b.animeSeason?.year||9999));
}

const report={generatedAt:new Date().toISOString(),datasetLastUpdate:database.lastUpdate||null,source:'manami-project/anime-offline-database',currentSeason:`${CURRENT_SEASON} ${CURRENT_YEAR}`,updated:[],unchanged:[],unmatched:[],review:[]};
for(const match of matches){
  const a=match.item;
  const previousEpisodes=Number.isFinite(a.episodes)?a.episodes:null;
  if(a.watchedEpisodes==null&&a.status==='Completed'&&previousEpisodes!=null)a.watchedEpisodes=previousEpisodes;
  a.newEpisodes=Number.isInteger(a.newEpisodes)&&a.newEpisodes>0?a.newEpisodes:0;
  const oldLatest=a.latestEpisodeYear??a.latestSeasonYear??null;
  delete a.seasons;
  delete a.latestSeasonYear;

  if(!match.entry){
    a.latestEpisodeYear=(Number.isFinite(oldLatest)&&oldLatest<=CURRENT_YEAR)?oldLatest:(Number.isFinite(a.year)&&a.year<=CURRENT_YEAR?a.year:null);
    if(a.episodes!=null&&a.watchedEpisodes!=null&&a.watchedEpisodes>a.episodes)a.watchedEpisodes=a.episodes;
    report.unmatched.push({id:a.id,title:a.title});
    continue;
  }

  const root=match.entry;
  const chain=episodeChain(match);
  const rootStarted=hasStarted(root);
  const knownEpisodes=chain.map(x=>x.episodes).filter(n=>Number.isFinite(n)&&n>0);
  const totalEpisodes=SERIES_TYPES.has(root.type)&&knownEpisodes.length?knownEpisodes.reduce((s,n)=>s+n,0):(rootStarted&&root.episodes>0?root.episodes:(previousEpisodes??null));
  const years=chain.map(x=>x.animeSeason?.year).filter(y=>Number.isFinite(y)&&y<=CURRENT_YEAR);
  let latestEpisodeYear=years.length?Math.max(...years):null;
  if(latestEpisodeYear==null&&rootStarted&&Number.isFinite(root.animeSeason?.year)&&root.animeSeason.year<=CURRENT_YEAR)latestEpisodeYear=root.animeSeason.year;
  if(latestEpisodeYear==null&&Number.isFinite(a.year)&&a.year<=CURRENT_YEAR)latestEpisodeYear=a.year;
  const firstYear=root.animeSeason?.year??a.year??null;
  const before={episodes:previousEpisodes,latestEpisodeYear:oldLatest,year:a.year??null,watchedEpisodes:a.watchedEpisodes??null,newEpisodes:a.newEpisodes};

  if(totalEpisodes!=null){
    // Correct stale inflated progress before deciding whether an increase is genuinely new.
    if(a.watchedEpisodes!=null&&a.watchedEpisodes>totalEpisodes)a.watchedEpisodes=totalEpisodes;
    if(previousEpisodes!=null&&totalEpisodes>previousEpisodes&&previousEpisodes>0){
      a.newEpisodes+=(totalEpisodes-previousEpisodes);
      a.newEpisodeDetectedAt=new Date().toISOString();
    }
    a.episodes=totalEpisodes;
  }
  a.latestEpisodeYear=latestEpisodeYear;
  if(a.year==null&&firstYear!=null)a.year=firstYear;
  if(a.episodes!=null&&a.watchedEpisodes!=null&&a.watchedEpisodes>=a.episodes){
    a.newEpisodes=0;
    delete a.newEpisodeDetectedAt;
  }
  a.metadataSource='manami-project/anime-offline-database';

  const after={episodes:a.episodes??null,latestEpisodeYear:a.latestEpisodeYear??null,year:a.year??null,watchedEpisodes:a.watchedEpisodes??null,newEpisodes:a.newEpisodes};
  const row={id:a.id,title:a.title,matchedTitle:root.title,matchScore:match.score,via:match.via,before,after,chain:chain.map(x=>({title:x.title,type:x.type,status:x.status||null,episodes:x.episodes,year:x.animeSeason?.year??null,season:x.animeSeason?.season??null}))};
  (JSON.stringify(before)!==JSON.stringify(after)?report.updated:report.unchanged).push(row);
  if(!rootStarted||chain.length===0)report.review.push(row);
}

await fs.writeFile(animePath,JSON.stringify(anime,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`Episode metadata sync: ${report.updated.length} updated, ${report.unchanged.length} unchanged, ${report.unmatched.length} unmatched, ${report.review.length} review.`);
if(report.unmatched.length)console.log('Unmatched:',report.unmatched.map(x=>x.title).join(' | '));
