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

// Each Friday choose one title from five different facets of the user's 5-star taste.
// This intentionally prevents all five recommendations from collapsing into one genre.
const buckets=[
  {
    name:'Mind Games',
    genre:'Mind Games, Strategy, Suspense',
    reason:'For the Classroom of the Elite / Death Note side of your taste: manipulation, gambits and pressure.',
    picks:[
      {title:'Kaiji: Ultimate Survivor',aliases:['Kaiji: Ultimate Survivor','Gyakkyou Burai Kaiji: Ultimate Survivor']},
      {title:'One Outs',aliases:['One Outs']},
      {title:'Moriarty the Patriot',aliases:['Moriarty the Patriot','Yuukoku no Moriarty']},
      {title:'ACCA: 13-Territory Inspection Dept.',aliases:['ACCA: 13-Territory Inspection Dept.','ACCA: 13-ku Kansatsu-ka']},
      {title:'No Game No Life',aliases:['No Game No Life']}
    ]
  },
  {
    name:'Dark Action',
    genre:'Dark Action, Sci-Fi, Drama',
    reason:'For the Akame ga Kill / Jujutsu Kaisen side of your taste: stylish action with real consequences.',
    picks:[
      {title:'Cyberpunk: Edgerunners',aliases:['Cyberpunk: Edgerunners']},
      {title:'Btooom!',aliases:['Btooom!']},
      {title:'Kabaneri of the Iron Fortress',aliases:['Kabaneri of the Iron Fortress','Koutetsujou no Kabaneri']},
      {title:'Claymore',aliases:['Claymore']},
      {title:'Dorohedoro',aliases:['Dorohedoro']}
    ]
  },
  {
    name:'Supernatural Mystery',
    genre:'Supernatural, Mystery, Suspense',
    reason:'For the DAN DA DAN / Future Diary side of your taste: weird supernatural rules wrapped in mystery.',
    picks:[
      {title:'The Case Study of Vanitas',aliases:['The Case Study of Vanitas','Vanitas no Karte']},
      {title:'ID: INVADED',aliases:['ID: INVADED','Id:Invaded']},
      {title:'Mononoke',aliases:['Mononoke']},
      {title:'Boogiepop and Others',aliases:['Boogiepop and Others','Boogiepop wa Warawanai']},
      {title:'From the New World',aliases:['From the New World','Shinsekai yori']}
    ]
  },
  {
    name:'Character / Romance',
    genre:'Romance, Character Drama, Comedy',
    reason:'A change of pace based on the romance and character-driven shows you rate well, without going pure slice-of-life.',
    picks:[
      {title:'Call of the Night',aliases:['Call of the Night','Yofukashi no Uta']},
      {title:"Scum's Wish",aliases:["Scum's Wish",'Kuzu no Honkai']},
      {title:'Insomniacs After School',aliases:['Insomniacs After School','Kimi wa Houkago Insomnia']},
      {title:'ReLIFE',aliases:['ReLIFE']},
      {title:'Golden Time',aliases:['Golden Time']}
    ]
  },
  {
    name:'Wildcard',
    genre:'Fantasy, Comedy, Adventure',
    reason:'For the Eminence in Shadow side of your taste: high-concept worlds, personality and fun rather than another grim thriller.',
    picks:[
      {title:'The Devil Is a Part-Timer!',aliases:['The Devil Is a Part-Timer!','Hataraku Maou-sama!']},
      {title:'Cautious Hero: The Hero Is Overpowered but Overly Cautious',aliases:['Cautious Hero: The Hero Is Overpowered but Overly Cautious','Shinchou Yuusha: Kono Yuusha ga Ore Tueee Kuse ni Shinchou Sugiru']},
      {title:'Princess Connect! Re:Dive',aliases:['Princess Connect! Re:Dive']},
      {title:'Combatants Will Be Dispatched!',aliases:['Combatants Will Be Dispatched!','Sentouin, Hakenshimasu!']},
      {title:'The Dungeon of Black Company',aliases:['The Dungeon of Black Company','Meikyuu Black Company']}
    ]
  }
];

const nameIndex=new Map();
for(const e of entries) for(const n of namesFor(e)) if(!nameIndex.has(norm(n))) nameIndex.set(norm(n),e);

function usable(pick){
  if([pick.title,...pick.aliases].some(x=>libraryNames.has(norm(x)))) return null;
  const e=pick.aliases.map(a=>nameIndex.get(norm(a))).find(Boolean);
  if(!e) return null;
  if(!['TV','ONA'].includes(e.type)) return null;
  if(String(e.status||'').toUpperCase()==='UPCOMING') return null;
  if(!Number.isFinite(e.episodes)||e.episodes<=0) return null;
  if(Number.isFinite(e.animeSeason?.year)&&e.animeSeason.year>currentYear) return null;
  return e;
}

const week=Math.floor(Date.now()/(7*24*60*60*1000));
const selected=[];
for(let b=0;b<buckets.length;b++){
  const bucket=buckets[b];
  const available=bucket.picks.map(pick=>({pick,e:usable(pick)})).filter(x=>x.e);
  if(!available.length) throw new Error(`No usable recommendations in ${bucket.name}`);
  const fresh=available.filter(x=>!previousNames.has(norm(x.pick.title)));
  const pool=fresh.length?fresh:available;
  const choice=pool[(week+b)%pool.length];
  selected.push({...choice,bucket});
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
for(const {pick,e,bucket} of selected){
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
  const year=Number.isFinite(e.animeSeason?.year)?e.animeSeason.year:null;
  suggestions.push({
    id:`ai-${slug(title)}`,
    title,
    status:'AI Suggested',
    episodes:e.episodes||null,
    score:null,
    genre:bucket.genre,
    studio:'',
    year,
    latestEpisodeYear:year,
    synopsis:bucket.reason,
    image:''
  });
}

await fs.writeFile('src/aiSuggestions.json',JSON.stringify(suggestions,null,2)+'\n');
await fs.writeFile('src/generatedCovers.json',JSON.stringify(generated,null,2)+'\n');
console.log('AI Suggested:',suggestions.map(x=>`${x.title} [${x.genre}]`).join(' | '));
