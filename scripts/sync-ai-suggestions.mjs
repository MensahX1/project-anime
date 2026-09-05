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
const libraryNames=new Set(anime.map(a=>norm(a.title)));
const previousNames=new Set(previous.map(a=>norm(a.title)));
const currentYear=new Date().getUTCFullYear();

// Curated around the strongest patterns in the user's 5-star library:
// psychological pressure, manipulation, mysteries, strategy, dark stakes and unusual premises.
const curated=[
  {title:'Kaiji: Ultimate Survivor',aliases:['Kaiji: Ultimate Survivor','Gyakkyou Burai Kaiji: Ultimate Survivor']},
  {title:'One Outs',aliases:['One Outs']},
  {title:'Monster',aliases:['Monster']},
  {title:'ID: INVADED',aliases:['ID: INVADED','Id:Invaded']},
  {title:'Babylon',aliases:['Babylon']},
  {title:'The Perfect Insider',aliases:['The Perfect Insider','Subete ga F ni Naru: The Perfect Insider']},
  {title:'Paranoia Agent',aliases:['Paranoia Agent','Mousou Dairinin']},
  {title:'Moriarty the Patriot',aliases:['Moriarty the Patriot','Yuukoku no Moriarty']},
  {title:'Odd Taxi',aliases:['Odd Taxi','ODDTAXI']},
  {title:'ACCA: 13-Territory Inspection Dept.',aliases:['ACCA: 13-Territory Inspection Dept.','ACCA: 13-ku Kansatsu-ka']},
  {title:'B: The Beginning',aliases:['B: The Beginning']},
  {title:'Gankutsuou: The Count of Monte Cristo',aliases:['Gankutsuou: The Count of Monte Cristo','Gankutsuou']},
  {title:'Blast of Tempest',aliases:['Blast of Tempest','Zetsuen no Tempest']},
  {title:'From the New World',aliases:['From the New World','Shinsekai yori']},
  {title:'Ajin: Demi-Human',aliases:['Ajin: Demi-Human','Ajin']},
  {title:'Boogiepop and Others',aliases:['Boogiepop and Others','Boogiepop wa Warawanai']},
  {title:'Serial Experiments Lain',aliases:['Serial Experiments Lain']},
  {title:'Texhnolyze',aliases:['Texhnolyze']},
  {title:'Rainbow',aliases:['Rainbow: Nisha Rokubou no Shichinin','Rainbow']},
  {title:'Inuyashiki: Last Hero',aliases:['Inuyashiki: Last Hero','Inuyashiki']}
];

const nameIndex=new Map();
for(const e of entries) for(const n of namesFor(e)) if(!nameIndex.has(norm(n))) nameIndex.set(norm(n),e);
const available=[];
for(const pick of curated){
  if([pick.title,...pick.aliases].some(x=>libraryNames.has(norm(x)))) continue;
  const e=pick.aliases.map(a=>nameIndex.get(norm(a))).find(Boolean);
  if(!e) continue;
  if(!['TV','ONA'].includes(e.type)) continue;
  if(String(e.status||'').toUpperCase()==='UPCOMING') continue;
  if(!Number.isFinite(e.episodes)||e.episodes<=0) continue;
  if(Number.isFinite(e.animeSeason?.year)&&e.animeSeason.year>currentYear) continue;
  available.push({pick,e});
}
if(available.length<5) throw new Error(`Only ${available.length} curated recommendation candidates matched the database`);

let start=0;
if(previousNames.size){
  const indexes=available.map((x,i)=>previousNames.has(norm(x.pick.title))?i:-1).filter(i=>i>=0);
  if(indexes.length) start=(Math.max(...indexes)+1)%available.length;
}
const selected=[];
for(let i=0;i<available.length&&selected.length<5;i++){
  const x=available[(start+i)%available.length];
  if(!previousNames.has(norm(x.pick.title))) selected.push(x);
}
if(selected.length<5){
  for(const x of available) if(!selected.includes(x)&&selected.length<5) selected.push(x);
}

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
for(const {pick,e} of selected){
  const title=pick.title;
  if(e.picture){
    try{
      const r=await fetch(e.picture,{headers:{'User-Agent':'the-watchlist-ai-suggestions/1.0'},signal:AbortSignal.timeout(20000)});
      if(r.ok){
        const bytes=Buffer.from(await r.arrayBuffer());
        if(bytes.length>1000){
          const ext=detectExt(bytes),name=`${slug(title)}${ext}`;
          await fs.writeFile(`${coverDir}/${name}`,bytes);
          generated[title]=`/project-anime/covers/${name}`;
        }
      }
    }catch(err){console.warn(`Cover failed for ${title}: ${err.message}`)}
  }
  const tags=(e.tags||[]).filter(t=>/psych|thrill|myst|crime|gambl|strategy|detect|drama|suspense|horror|supernatural/i.test(String(t))).slice(0,4);
  const year=Number.isFinite(e.animeSeason?.year)?e.animeSeason.year:null;
  suggestions.push({
    id:`ai-${slug(title)}`,
    title,
    status:'AI Suggested',
    episodes:e.episodes||null,
    score:null,
    genre:tags.length?tags.join(', '):'Psychological, Thriller, Mystery',
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
