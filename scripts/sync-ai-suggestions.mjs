import fs from 'node:fs/promises';

const dbPath=process.argv[2];
if(!dbPath) throw new Error('Usage: node scripts/sync-ai-suggestions.mjs <anime-offline-database.json>');

const anime=JSON.parse(await fs.readFile('src/anime.json','utf8'));
const previous=JSON.parse(await fs.readFile('src/aiSuggestions.json','utf8').catch(()=>Buffer.from('[]')));
const database=JSON.parse(await fs.readFile(dbPath,'utf8'));
const entries=database.data||[];
const generated=JSON.parse(await fs.readFile('src/generatedCovers.json','utf8').catch(()=>Buffer.from('{}')));
const coverDir='public/covers';
await fs.mkdir(coverDir,{recursive:true});

const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const slug=s=>norm(s).replace(/\s+/g,'-');
const namesFor=e=>[e.title,...(e.synonyms||[])].filter(Boolean);
const splitGenres=s=>String(s||'').split(/[,/;|]+/).map(norm).filter(Boolean);
const favoriteGenres=new Map();
for(const a of anime.filter(x=>x.score===5)) for(const g of splitGenres(a.genre)) favoriteGenres.set(g,(favoriteGenres.get(g)||0)+1);
const libraryNames=new Set(anime.flatMap(a=>[a.title]).map(norm));
const previousNames=new Set(previous.map(a=>norm(a.title)));
const now=new Date();
const currentYear=now.getUTCFullYear();
const tasteWords=['psychological','thriller','mystery','strategy','survival','crime','gambling','mind game','suspense','death game','supernatural','drama','school'];
const sequelish=/\b(season\s*\d+|\d+(st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+|final season|ii|iii|iv)\b/i;

function score(entry){
  const tags=(entry.tags||[]).map(norm);
  let s=0;
  for(const [g,w] of favoriteGenres){
    if(tags.some(t=>t===g||t.includes(g)||g.includes(t))) s+=w*5;
  }
  const hay=`${norm(entry.title)} ${tags.join(' ')}`;
  for(const word of tasteWords) if(hay.includes(word)) s+=4;
  if(entry.type==='TV') s+=3;
  if((entry.sources||[]).length>=4) s+=2;
  return s;
}

const candidates=entries.filter(e=>{
  const y=e.animeSeason?.year;
  if(!['TV','ONA'].includes(e.type)) return false;
  if(String(e.status||'').toUpperCase()==='UPCOMING') return false;
  if(!Number.isFinite(e.episodes)||e.episodes<=0) return false;
  if(Number.isFinite(y)&&y>currentYear) return false;
  if(sequelish.test(e.title||'')) return false;
  return !namesFor(e).some(n=>libraryNames.has(norm(n)));
}).map(e=>({e,score:score(e)})).filter(x=>x.score>=8).sort((a,b)=>b.score-a.score||String(a.e.title).localeCompare(String(b.e.title)));

const pool=candidates.slice(0,60);
const fresh=pool.filter(x=>!previousNames.has(norm(x.e.title)));
const week=Math.floor(Date.now()/(7*24*60*60*1000));
const rotated=(fresh.length>=5?fresh:pool);
const start=rotated.length?((week*5)%rotated.length):0;
const selected=[];
for(let i=0;i<rotated.length&&selected.length<5;i++){
  const x=rotated[(start+i)%rotated.length];
  if(!selected.some(y=>norm(y.e.title)===norm(x.e.title))) selected.push(x);
}
if(selected.length<5) throw new Error(`Only ${selected.length} recommendation candidates available`);

const detectExt=bytes=>{
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return'.png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'.jpg';
  if(bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return'.webp';
  return'.jpg';
};

for(const old of previous){
  delete generated[old.title];
  const base=slug(old.title);
  for(const ext of ['.jpg','.png','.webp']) await fs.unlink(`${coverDir}/${base}${ext}`).catch(()=>{});
}

const suggestions=[];
for(const {e} of selected){
  const title=e.title;
  let image='';
  if(e.picture){
    try{
      const r=await fetch(e.picture,{headers:{'User-Agent':'the-watchlist-ai-suggestions/1.0'},signal:AbortSignal.timeout(20000)});
      if(r.ok){
        const bytes=Buffer.from(await r.arrayBuffer());
        if(bytes.length>1000){
          const ext=detectExt(bytes),name=`${slug(title)}${ext}`;
          await fs.writeFile(`${coverDir}/${name}`,bytes);
          image=`/project-anime/covers/${name}`;
          generated[title]=image;
        }
      }
    }catch(e){console.warn(`Cover failed for ${title}: ${e.message}`)}
  }
  const tags=(e.tags||[]).slice(0,4).map(t=>String(t).replace(/(^|\s)\S/g,m=>m.toUpperCase())).join(', ');
  const year=Number.isFinite(e.animeSeason?.year)?e.animeSeason.year:null;
  suggestions.push({
    id:`ai-${slug(title)}`,
    title,
    status:'AI Suggested',
    episodes:e.episodes||null,
    score:null,
    genre:tags,
    studio:'',
    year,
    latestEpisodeYear:year,
    synopsis:'',
    image:''
  });
}

await fs.writeFile('src/aiSuggestions.json',JSON.stringify(suggestions,null,2)+'\n');
await fs.writeFile('src/generatedCovers.json',JSON.stringify(generated,null,2)+'\n');
console.log('AI Suggested:',suggestions.map(x=>x.title).join(' | '));
