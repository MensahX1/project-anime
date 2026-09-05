import fs from 'node:fs/promises';

const API='https://api.jikan.moe/v4';
const animePath='src/anime.json';
const reportPath='src/metadataSyncReport.json';
const anime=JSON.parse(await fs.readFile(animePath,'utf8'));

const norm=s=>String(s||'').normalize('NFKD').replace(/[’‘`]/g,"'").replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let lastRequest=0;

async function get(path){
  for(let attempt=0;attempt<6;attempt++){
    const elapsed=Date.now()-lastRequest;
    if(elapsed<420) await sleep(420-elapsed);
    lastRequest=Date.now();
    const res=await fetch(`${API}${path}`,{headers:{accept:'application/json','user-agent':'The-Watchlist-Metadata-Sync/1.0'}});
    if(res.ok) return await res.json();
    if(res.status===429||res.status>=500){await sleep(1500*(attempt+1));continue;}
    throw new Error(`Jikan HTTP ${res.status}: ${await res.text()}`);
  }
  throw new Error(`Jikan request failed after retries: ${path}`);
}

function scoreCandidate(item,m){
  const target=norm(item.title);
  const names=[m.title,m.title_english,m.title_japanese,...(m.title_synonyms||[]),...(m.titles||[]).map(x=>x.title)].filter(Boolean).map(norm);
  if(names.includes(target)) return 100;
  const targetWords=new Set(target.split(' '));
  let best=0;
  for(const name of names){
    const words=new Set(name.split(' '));
    const common=[...targetWords].filter(x=>words.has(x)).length;
    const union=new Set([...targetWords,...words]).size||1;
    best=Math.max(best,Math.round(common/union*80));
    if(name.includes(target)||target.includes(name)) best=Math.max(best,72);
  }
  return best;
}

const matches=[];
for(const item of anime){
  const result=await get(`/anime?q=${encodeURIComponent(item.title)}&limit=6&sfw=false`);
  const ranked=(result.data||[]).map(m=>({m,score:scoreCandidate(item,m)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  matches.push(best&&best.score>=70?{
    item,malId:best.m.mal_id,confidence:best.score,
    candidates:ranked.slice(0,3).map(x=>({id:x.m.mal_id,title:x.m.title_english||x.m.title,score:x.score}))
  }:{item,malId:null,confidence:best?.score||0,candidates:ranked.slice(0,3).map(x=>({id:x.m.mal_id,title:x.m.title_english||x.m.title,score:x.score}))});
}

const details=new Map();
async function full(id){
  if(details.has(id)) return details.get(id);
  const result=await get(`/anime/${id}/full`);
  const m=result.data;
  details.set(id,m);
  return m;
}

for(const m of matches) if(m.malId) await full(m.malId);

const SERIES_TYPES=new Set(['TV','ONA']);
const ownerByMalId=new Map(matches.filter(x=>x.malId).map(x=>[x.malId,x.item.id]));

function relatedIds(m){
  const ids=[];
  for(const rel of m.relations||[]){
    if(rel.relation!=='Prequel'&&rel.relation!=='Sequel') continue;
    for(const entry of rel.entry||[]) if(entry.type==='anime'&&Number.isFinite(entry.mal_id)) ids.push(entry.mal_id);
  }
  return ids;
}

// Fetch the sequel/prequel graph once, reusing cached entries between library titles.
let frontier=[...new Set([...details.values()].flatMap(relatedIds).filter(id=>!details.has(id)))];
const attempted=new Set();
while(frontier.length&&attempted.size<600){
  const id=frontier.shift();
  if(details.has(id)||attempted.has(id)) continue;
  attempted.add(id);
  try{
    const m=await full(id);
    for(const next of relatedIds(m)) if(!details.has(next)&&!attempted.has(next)&&!frontier.includes(next)) frontier.push(next);
  }catch(err){console.warn(`Skipping related MAL ${id}:`,err.message)}
}

function releaseYear(m){return m.year??m.aired?.prop?.from?.year??null}

function chainFor(match){
  const root=details.get(match.malId);
  if(!root) return [];
  if(!SERIES_TYPES.has(root.type)) return [root];
  const seen=new Set(); const q=[root.mal_id]; const out=[];
  while(q.length&&out.length<30){
    const id=q.shift();
    if(seen.has(id)) continue;
    seen.add(id);
    const m=details.get(id); if(!m) continue;
    const otherOwner=ownerByMalId.get(id);
    if(id!==root.mal_id&&otherOwner&&otherOwner!==match.item.id) continue;
    if(SERIES_TYPES.has(m.type)) out.push(m);
    for(const next of relatedIds(m)){
      const related=details.get(next);
      if(!related||!SERIES_TYPES.has(related.type)) continue;
      const boundaryOwner=ownerByMalId.get(next);
      if(boundaryOwner&&boundaryOwner!==match.item.id) continue;
      q.push(next);
    }
  }
  return out;
}

const report={generatedAt:new Date().toISOString(),source:'Jikan / MyAnimeList',updated:[],unchanged:[],unmatched:[]};
for(const match of matches){
  const a=match.item;
  if(!match.malId){report.unmatched.push({id:a.id,title:a.title,confidence:match.confidence,candidates:match.candidates});continue;}
  const root=details.get(match.malId);
  if(!root){report.unmatched.push({id:a.id,title:a.title,confidence:match.confidence,candidates:match.candidates});continue;}
  const chain=chainFor(match);
  const isSeries=SERIES_TYPES.has(root.type);
  const knownEpisodes=chain.map(x=>x.episodes).filter(Number.isFinite);
  const computedEpisodes=isSeries&&chain.length&&knownEpisodes.length===chain.length?knownEpisodes.reduce((s,n)=>s+n,0):(Number.isFinite(root.episodes)?root.episodes:null);
  const seasons=isSeries?chain.length:null;
  const years=chain.map(releaseYear).filter(Number.isFinite);
  const latestSeasonYear=years.length?Math.max(...years):releaseYear(root);
  const firstYear=releaseYear(root)??a.year??null;
  const before={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  if(computedEpisodes!=null) a.episodes=computedEpisodes;
  a.seasons=seasons;
  a.latestSeasonYear=latestSeasonYear;
  if(a.year==null&&firstYear!=null) a.year=firstYear;
  a.metadataSource='Jikan / MyAnimeList';
  a.malId=root.mal_id;
  const after={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  const row={id:a.id,title:a.title,malId:root.mal_id,confidence:match.confidence,before,after,chain:chain.map(x=>({id:x.mal_id,title:x.title_english||x.title,episodes:x.episodes,year:releaseYear(x),type:x.type}))};
  (JSON.stringify(before)!==JSON.stringify(after)?report.updated:report.unchanged).push(row);
}

await fs.writeFile(animePath,JSON.stringify(anime,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`Jikan metadata sync: ${report.updated.length} updated, ${report.unchanged.length} unchanged, ${report.unmatched.length} unmatched.`);
if(report.unmatched.length) console.log('Unmatched:',report.unmatched.map(x=>x.title).join(' | '));
