import fs from 'node:fs/promises';

const API='https://graphql.anilist.co';
const animePath='src/anime.json';
const reportPath='src/metadataSyncReport.json';
const anime=JSON.parse(await fs.readFile(animePath,'utf8'));

const norm=s=>String(s||'').normalize('NFKD').replace(/[’‘`]/g,"'").replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function gql(query,variables={}){
  for(let attempt=0;attempt<5;attempt++){
    const res=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables})});
    if(res.ok){
      const json=await res.json();
      if(json.errors) throw new Error(JSON.stringify(json.errors));
      return json.data;
    }
    if(res.status===429||res.status>=500){await sleep(1500*(attempt+1));continue;}
    throw new Error(`AniList HTTP ${res.status}: ${await res.text()}`);
  }
  throw new Error('AniList request failed after retries');
}

const mediaFields=`
  id
  title { romaji english native }
  synonyms
  format
  episodes
  seasonYear
  status
  relations { edges { relationType node { id } } }
`;

function scoreCandidate(item,m){
  const target=norm(item.title);
  const names=[m.title?.english,m.title?.romaji,m.title?.native,...(m.synonyms||[])].filter(Boolean);
  const normalized=names.map(norm);
  if(normalized.includes(target)) return 100;
  const targetWords=new Set(target.split(' '));
  let best=0;
  for(const name of normalized){
    const words=new Set(name.split(' '));
    const common=[...targetWords].filter(x=>words.has(x)).length;
    const union=new Set([...targetWords,...words]).size||1;
    best=Math.max(best,Math.round(common/union*80));
    if(name.includes(target)||target.includes(name)) best=Math.max(best,72);
  }
  return best;
}

async function searchBatch(items){
  const vars={}; const defs=[]; const fields=[];
  items.forEach((item,i)=>{vars[`q${i}`]=item.title;defs.push(`$q${i}: String!`);fields.push(`q${i}: Page(perPage: 6) { media(search: $q${i}, type: ANIME) { ${mediaFields} } }`)});
  const data=await gql(`query(${defs.join(',')}) { ${fields.join('\n')} }`,vars);
  return items.map((item,i)=>{
    const candidates=data[`q${i}`]?.media||[];
    const ranked=candidates.map(m=>({m,score:scoreCandidate(item,m)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    return best&&best.score>=70?{item,media:best.m,confidence:best.score,candidates:ranked.slice(0,3).map(x=>({id:x.m.id,title:x.m.title?.english||x.m.title?.romaji,score:x.score}))}:{item,media:null,confidence:best?.score||0,candidates:ranked.slice(0,3).map(x=>({id:x.m.id,title:x.m.title?.english||x.m.title?.romaji,score:x.score}))};
  });
}

const matches=[];
for(let i=0;i<anime.length;i+=10){
  matches.push(...await searchBatch(anime.slice(i,i+10)));
  await sleep(250);
}

const details=new Map();
for(const x of matches) if(x.media) details.set(x.media.id,x.media);

async function fetchIds(ids){
  const fields=ids.map(id=>`m${id}: Media(id: ${id}, type: ANIME) { ${mediaFields} }`).join('\n');
  const data=await gql(`query { ${fields} }`);
  return ids.map(id=>data[`m${id}`]).filter(Boolean);
}

// Expand prequel/sequel graph so multi-season shows can be counted even when AniList stores seasons separately.
let frontier=[...new Set([...details.values()].flatMap(m=>(m.relations?.edges||[]).filter(e=>e.relationType==='PREQUEL'||e.relationType==='SEQUEL').map(e=>e.node.id)).filter(id=>!details.has(id)))];
for(let depth=0;depth<10&&frontier.length;depth++){
  const batchIds=frontier.slice(0,120);
  frontier=frontier.slice(120);
  for(let i=0;i<batchIds.length;i+=25){
    const got=await fetchIds(batchIds.slice(i,i+25));
    for(const m of got) details.set(m.id,m);
    for(const m of got){
      for(const e of m.relations?.edges||[]){
        if((e.relationType==='PREQUEL'||e.relationType==='SEQUEL')&&!details.has(e.node.id)&&!frontier.includes(e.node.id)) frontier.push(e.node.id);
      }
    }
    await sleep(250);
  }
}

const ownerByAniId=new Map(matches.filter(x=>x.media).map(x=>[x.media.id,x.item.id]));
const TV_FORMATS=new Set(['TV','TV_SHORT','ONA']);

function chainFor(match){
  const root=match.media;
  if(!root) return [];
  // Movies/OVAs are not treated as seasons; they still get their own episode/year metadata.
  if(!TV_FORMATS.has(root.format)) return [root];
  const seen=new Set(); const q=[root.id]; const out=[];
  while(q.length){
    const id=q.shift();
    if(seen.has(id)) continue;
    seen.add(id);
    const m=details.get(id); if(!m) continue;
    const otherOwner=ownerByAniId.get(id);
    if(id!==root.id&&otherOwner&&otherOwner!==match.item.id) continue;
    if(TV_FORMATS.has(m.format)) out.push(m);
    for(const e of m.relations?.edges||[]){
      if(e.relationType!=='PREQUEL'&&e.relationType!=='SEQUEL') continue;
      const related=details.get(e.node.id);
      if(!related||!TV_FORMATS.has(related.format)) continue;
      const boundaryOwner=ownerByAniId.get(related.id);
      if(boundaryOwner&&boundaryOwner!==match.item.id) continue;
      q.push(related.id);
    }
  }
  return out;
}

const report={generatedAt:new Date().toISOString(),source:'AniList',updated:[],unchanged:[],unmatched:[]};
for(const match of matches){
  const a=match.item;
  if(!match.media){report.unmatched.push({id:a.id,title:a.title,confidence:match.confidence,candidates:match.candidates});continue;}
  const root=match.media;
  const chain=chainFor(match);
  const isSeries=TV_FORMATS.has(root.format);
  const knownEpisodes=chain.map(x=>x.episodes).filter(Number.isFinite);
  const computedEpisodes=isSeries&&knownEpisodes.length===chain.length?knownEpisodes.reduce((s,n)=>s+n,0):(Number.isFinite(root.episodes)?root.episodes:null);
  const seasons=isSeries?chain.length:null;
  const years=chain.map(x=>x.seasonYear).filter(Number.isFinite);
  const latestSeasonYear=years.length?Math.max(...years):(Number.isFinite(root.seasonYear)?root.seasonYear:null);
  const firstYear=Number.isFinite(root.seasonYear)?root.seasonYear:a.year??null;
  const before={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  if(computedEpisodes!=null) a.episodes=computedEpisodes;
  a.seasons=seasons;
  a.latestSeasonYear=latestSeasonYear;
  if(a.year==null&&firstYear!=null) a.year=firstYear;
  a.metadataSource='AniList';
  a.anilistId=root.id;
  const after={episodes:a.episodes??null,seasons:a.seasons??null,latestSeasonYear:a.latestSeasonYear??null,year:a.year??null};
  const changed=JSON.stringify(before)!==JSON.stringify(after);
  (changed?report.updated:report.unchanged).push({id:a.id,title:a.title,anilistId:root.id,confidence:match.confidence,before,after,chain:chain.map(x=>({id:x.id,title:x.title?.english||x.title?.romaji,episodes:x.episodes,year:x.seasonYear,format:x.format}))});
}

await fs.writeFile(animePath,JSON.stringify(anime,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`AniList metadata sync: ${report.updated.length} updated, ${report.unchanged.length} unchanged, ${report.unmatched.length} unmatched.`);
if(report.unmatched.length) console.log('Unmatched:',report.unmatched.map(x=>x.title).join(' | '));
