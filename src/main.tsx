import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {openDB} from "idb";
import s1 from "./seed1.json";
import s2 from "./seed2.json";
import s3 from "./seed3.json";
import s4 from "./seed4.json";
import covers from "./generatedCovers.json";
import "./style.css";
import {registerSW} from "virtual:pwa-register";

registerSW({immediate:true});

type Anime={id:string,title:string,status:string,episodes:number|null,score:number|null,genre:string,studio:string,year:number|null,synopsis:string,image:string};
type SortKey="score-desc"|"score-asc"|"title-asc"|"year-desc"|"year-asc"|"studio-asc";

const seed=[...s1,...s2,...s3,...s4] as Anime[];
const coverMap=covers as Record<string,string>;
const COVER_VERSION=1;
const dbp=openDB("le-anime",3,{upgrade(db){if(!db.objectStoreNames.contains("anime"))db.createObjectStore("anime",{keyPath:"id"});if(!db.objectStoreNames.contains("meta"))db.createObjectStore("meta")}});

const splitTags=(value:string)=>String(value||"").split(/[,/;|]+/).map(x=>x.trim()).filter(Boolean);
const stars=(n:number|null)=>n?"★".repeat(n):"—";

async function migrate(){
  const db=await dbp;
  let all=await db.getAll("anime") as Anime[];
  const byTitle=new Map(all.map(a=>[a.title,a]));
  const seedVersion=Number(await db.get("meta","seedVersion")||0);

  if(seedVersion<4){
    const tx=db.transaction(["anime","meta"],"readwrite"),store=tx.objectStore("anime");
    for(const s of seed){
      const old=byTitle.get(s.title),image=coverMap[s.title]||old?.image||"";
      if(!old) await store.put({...s,image});
      else{
        const placeholder=old.id.startsWith("sheet-")&&!old.status&&old.episodes==null&&old.score==null&&!old.genre&&!old.studio&&old.year==null&&!old.synopsis;
        if(placeholder) await store.put({...s,id:old.id,image});
        else if(!old.image&&image) await store.put({...old,image});
      }
    }
    await tx.objectStore("meta").put(4,"seedVersion");
    await tx.done;
    all=await db.getAll("anime") as Anime[];
  }

  const coverVersion=Number(await db.get("meta","coverVersion")||0);
  if(coverVersion<COVER_VERSION){
    const tx=db.transaction(["anime","meta"],"readwrite");
    for(const a of all){
      const local=coverMap[a.title];
      if(local&&a.image!==local) await tx.objectStore("anime").put({...a,image:local});
    }
    await tx.objectStore("meta").put(COVER_VERSION,"coverVersion");
    await tx.done;
    all=await db.getAll("anime") as Anime[];
  }else{
    let changed=false;
    const tx=db.transaction("anime","readwrite");
    for(const a of all){if(!a.image&&coverMap[a.title]){await tx.store.put({...a,image:coverMap[a.title]});changed=true}}
    await tx.done;
    if(changed) all=await db.getAll("anime") as Anime[];
  }
  return all;
}

function App(){
  const[items,setItems]=useState<Anime[]>([]);
  const[q,setQ]=useState("");
  const[filter,setFilter]=useState("All");
  const[genreFilter,setGenreFilter]=useState("All");
  const[studioFilter,setStudioFilter]=useState("All");
  const[scoreFilter,setScoreFilter]=useState("All");
  const[sort,setSort]=useState<SortKey>("score-desc");
  const[selected,setSelected]=useState<Anime|null>(null);

  useEffect(()=>{migrate().then(setItems)},[]);

  const genres=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.genre)))).sort((a,b)=>a.localeCompare(b)),[items]);
  const studios=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.studio)))).sort((a,b)=>a.localeCompare(b)),[items]);

  const shown=useMemo(()=>{
    const result=items.filter(a=>{
      const matchesStatus=filter==="All"||a.status===filter;
      const matchesSearch=`${a.title} ${a.genre} ${a.studio}`.toLowerCase().includes(q.toLowerCase());
      const matchesGenre=genreFilter==="All"||splitTags(a.genre).includes(genreFilter);
      const matchesStudio=studioFilter==="All"||splitTags(a.studio).includes(studioFilter);
      const matchesScore=scoreFilter==="All"||(scoreFilter==="Unrated"?a.score==null:a.score===Number(scoreFilter));
      return matchesStatus&&matchesSearch&&matchesGenre&&matchesStudio&&matchesScore;
    });

    return result.sort((a,b)=>{
      if(sort==="score-desc") return (b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title);
      if(sort==="score-asc") return (a.score??99)-(b.score??99)||a.title.localeCompare(b.title);
      if(sort==="title-asc") return a.title.localeCompare(b.title);
      if(sort==="year-desc") return (b.year??0)-(a.year??0)||a.title.localeCompare(b.title);
      if(sort==="year-asc") return (a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title);
      return (a.studio||"zzz").localeCompare(b.studio||"zzz")||a.title.localeCompare(b.title);
    });
  },[items,q,filter,genreFilter,studioFilter,scoreFilter,sort]);

  const hasFilters=q||filter!=="All"||genreFilter!=="All"||studioFilter!=="All"||scoreFilter!=="All"||sort!=="score-desc";
  const resetFilters=()=>{setQ("");setFilter("All");setGenreFilter("All");setStudioFilter("All");setScoreFilter("All");setSort("score-desc")};
  const backup=()=>{const b=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});const u=URL.createObjectURL(b),x=document.createElement("a");x.href=u;x.download="le-anime-backup.json";x.click();URL.revokeObjectURL(u)};
  const restore=(f:File)=>{const r=new FileReader();r.onload=async()=>{try{const data=JSON.parse(String(r.result)),db=await dbp,tx=db.transaction(["anime","meta"],"readwrite");await tx.objectStore("anime").clear();for(const a of data)await tx.objectStore("anime").put(a);await tx.objectStore("meta").put(0,"coverVersion");await tx.done;setItems(await migrate())}catch{alert("Invalid backup")}};r.readAsText(f)};

  return <main>
    <header><div><div className="eyebrow">MY LIBRARY</div><h1>Lè Anime</h1><p>{items.length} titles · stored on this iPhone</p></div></header>
    <div className="search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search anime, genre, studio…"/></div>
    <nav>{["All","Completed","Paused","Planned"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</nav>

    <section className="filterPanel">
      <div className="filterGrid">
        <label><span>Genre</span><select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)}><option value="All">All genres</option>{genres.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Studio</span><select value={studioFilter} onChange={e=>setStudioFilter(e.target.value)}><option value="All">All studios</option>{studios.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Stars</span><select value={scoreFilter} onChange={e=>setScoreFilter(e.target.value)}><option value="All">All ratings</option>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} ★</option>)}<option value="Unrated">Unrated</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value="score-desc">Rating: high to low</option><option value="score-asc">Rating: low to high</option><option value="title-asc">Title: A to Z</option><option value="year-desc">Year: newest first</option><option value="year-asc">Year: oldest first</option><option value="studio-asc">Studio: A to Z</option></select></label>
      </div>
      <div className="filterSummary"><span>{shown.length} of {items.length} titles</span>{hasFilters&&<button onClick={resetFilters}>Reset</button>}</div>
    </section>

    <section className="grid">{shown.map(a=><article key={a.id} onClick={()=>setSelected(a)}><div className="poster">{a.image?<img loading="lazy" src={a.image} alt={`${a.title} cover`}/>:<div className="fallback"><b>{a.title.slice(0,1)}</b><span>{a.title}</span></div>}<span className="badge">{a.status||"Uncategorized"}</span></div><h3>{a.title}</h3><div className="rating">{stars(a.score)}</div><small>{a.year||""}{a.episodes?` · ${a.episodes} eps`:""}</small></article>)}</section>
    <footer><button onClick={backup}>Export backup</button><label>Import backup<input hidden type="file" accept=".json" onChange={e=>e.target.files?.[0]&&restore(e.target.files[0])}/></label></footer>

    {selected&&<div className="sheet" onClick={()=>setSelected(null)}><div className="panel" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="hero">{selected.image?<img src={selected.image} alt={`${selected.title} cover`}/>:<div className="heroFallback">{selected.title}</div>}</div><h2>{selected.title}</h2><div className="rating big">{stars(selected.score)}</div><p className="meta">{selected.status||"Uncategorized"} · {selected.year||"—"} · {selected.episodes||"—"} episodes</p><p>{selected.synopsis||"No synopsis yet."}</p><p className="muted">{selected.genre}<br/>{selected.studio}</p></div></div>}
  </main>
}

createRoot(document.getElementById("root")!).render(<App/>);
