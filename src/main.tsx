import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import animeData from "./anime.json";
import covers from "./generatedCovers.json";
import "./style.css";
import {registerSW} from "virtual:pwa-register";

registerSW({immediate:true});

type Anime={id:string,title:string,status:string,episodes:number|null,watchedEpisodes:number|null,newEpisodes:number,score:number|null,genre:string,studio:string,year:number|null,latestEpisodeYear:number|null,synopsis:string,image:string,metadataSource?:string,newEpisodeDetectedAt?:string};
type SortKey="score-desc"|"score-asc"|"title-asc"|"year-desc"|"year-asc"|"studio-asc";

const repoAnime=animeData as Anime[];
const coverMap=covers as Record<string,string>;
const REPO="MensahX1/project-anime";
const EDIT_KEY="le-anime-edit-mode";

const splitTags=(value:string)=>String(value||"").split(/[,/;|]+/).map(x=>x.trim()).filter(Boolean);
const stars=(n:number|null)=>n?"★".repeat(n):"—";
const withCover=(a:Anime):Anime=>({...a,watchedEpisodes:(a as any).watchedEpisodes??((a.status==="Completed"&&a.episodes!=null)?a.episodes:null),newEpisodes:(a as any).newEpisodes??0,latestEpisodeYear:(a as any).latestEpisodeYear??(a as any).latestSeasonYear??null,image:coverMap[a.title]||a.image||""});
const initialAnime=()=>repoAnime.map(withCover);
const isCaughtUp=(a:Anime)=>a.episodes!=null&&a.watchedEpisodes!=null&&a.watchedEpisodes>=a.episodes;

function issueUrl(title:string,payload:unknown){
  const body=`<!-- LE_ANIME_ADMIN_V1 -->\nThis request was created by The Watchlist. Only the authorized GitHub account can apply it.\n\n\`\`\`json\n${JSON.stringify(payload,null,2)}\n\`\`\``;
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`[anime-admin] ${title}`)}&body=${encodeURIComponent(body)}`;
}

function App(){
  const[items]=useState<Anime[]>(initialAnime);
  const[q,setQ]=useState("");
  const[filter,setFilter]=useState("All");
  const[genreFilter,setGenreFilter]=useState("All");
  const[studioFilter,setStudioFilter]=useState("All");
  const[scoreFilter,setScoreFilter]=useState("All");
  const[progressFilter,setProgressFilter]=useState("All");
  const[sort,setSort]=useState<SortKey>("score-desc");
  const[selected,setSelected]=useState<Anime|null>(null);
  const[edit,setEdit]=useState<Anime|null>(null);
  const[editMode,setEditMode]=useState(()=>localStorage.getItem(EDIT_KEY)==="1");
  const[notice,setNotice]=useState("");

  const genres=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.genre)))).sort((a,b)=>a.localeCompare(b)),[items]);
  const studios=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.studio)))).sort((a,b)=>a.localeCompare(b)),[items]);

  const shown=useMemo(()=>{
    const result=items.filter(a=>{
      const matchesStatus=filter==="All"||a.status===filter;
      const matchesSearch=`${a.title} ${a.genre} ${a.studio}`.toLowerCase().includes(q.toLowerCase());
      const matchesGenre=genreFilter==="All"||splitTags(a.genre).includes(genreFilter);
      const matchesStudio=studioFilter==="All"||splitTags(a.studio).includes(studioFilter);
      const matchesScore=scoreFilter==="All"||(scoreFilter==="Unrated"?a.score==null:a.score===Number(scoreFilter));
      const matchesProgress=progressFilter==="All"||(progressFilter==="Caught up"?isCaughtUp(a):progressFilter==="New episodes"?a.newEpisodes>0:!isCaughtUp(a));
      return matchesStatus&&matchesSearch&&matchesGenre&&matchesStudio&&matchesScore&&matchesProgress;
    });
    return result.sort((a,b)=>{
      if(sort==="score-desc") return (b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title);
      if(sort==="score-asc") return (a.score??99)-(b.score??99)||a.title.localeCompare(b.title);
      if(sort==="title-asc") return a.title.localeCompare(b.title);
      if(sort==="year-desc") return (b.latestEpisodeYear??b.year??0)-(a.latestEpisodeYear??a.year??0)||a.title.localeCompare(b.title);
      if(sort==="year-asc") return (a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title);
      return (a.studio||"zzz").localeCompare(b.studio||"zzz")||a.title.localeCompare(b.title);
    });
  },[items,q,filter,genreFilter,studioFilter,scoreFilter,progressFilter,sort]);

  const hasFilters=q||filter!=="All"||genreFilter!=="All"||studioFilter!=="All"||scoreFilter!=="All"||progressFilter!=="All"||sort!=="score-desc";
  const resetFilters=()=>{setQ("");setFilter("All");setGenreFilter("All");setStudioFilter("All");setScoreFilter("All");setProgressFilter("All");setSort("score-desc")};
  const toggleEdit=()=>{const next=!editMode;setEditMode(next);localStorage.setItem(EDIT_KEY,next?"1":"0");setEdit(null);setNotice(next?"Edit mode enabled · GitHub will verify you when you submit":"Edit mode disabled")};
  const newAnime=():Anime=>({id:`anime-${crypto.randomUUID()}`,title:"",status:"Planned",episodes:null,watchedEpisodes:null,newEpisodes:0,score:null,genre:"",studio:"",year:new Date().getFullYear(),latestEpisodeYear:new Date().getFullYear(),synopsis:"",image:""});
  const commit=(a:Anime)=>{
    const clean={...a,image:""};
    window.open(issueUrl(`upsert ${a.title||"anime"}`,{action:"upsert",anime:clean}),"_blank","noopener,noreferrer");
    setEdit(null);setNotice("GitHub opened. Submit the prefilled issue to publish this change.");
  };
  const remove=(a:Anime)=>{
    if(!confirm(`Create a GitHub request to delete ${a.title}?`))return;
    window.open(issueUrl(`delete ${a.title}`,{action:"delete",id:a.id,title:a.title}),"_blank","noopener,noreferrer");
    setSelected(null);setNotice("GitHub opened. Submit the prefilled issue to publish this deletion.");
  };
  const backup=()=>{const b=new Blob([JSON.stringify(items.map(a=>({...a,image:""})),null,2)],{type:"application/json"});const u=URL.createObjectURL(b),x=document.createElement("a");x.href=u;x.download="the-watchlist-backup.json";x.click();URL.revokeObjectURL(u)};

  return <main>
    <header><div><div className="eyebrow">RICHIE’S LIBRARY</div><h1>The Watchlist</h1><p>{items.length} titles · GitHub is the source of truth</p></div><div className="headerActions"><button className="adminPill" onClick={toggleEdit}>{editMode?"Editing":"Admin"}</button>{editMode&&<button className="add" onClick={()=>setEdit(newAnime())}>＋</button>}</div></header>
    {notice&&<div className="notice">{notice}</div>}
    <div className="search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search anime, genre, studio…"/></div>
    <nav>{["All","Completed","Paused","Planned"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</nav>

    <section className="filterPanel">
      <div className="filterGrid">
        <label><span>Genre</span><select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)}><option value="All">All genres</option>{genres.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Studio</span><select value={studioFilter} onChange={e=>setStudioFilter(e.target.value)}><option value="All">All studios</option>{studios.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Stars</span><select value={scoreFilter} onChange={e=>setScoreFilter(e.target.value)}><option value="All">All ratings</option>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} ★</option>)}<option value="Unrated">Unrated</option></select></label>
        <label><span>Progress</span><select value={progressFilter} onChange={e=>setProgressFilter(e.target.value)}><option value="All">All progress</option><option value="Caught up">Caught up</option><option value="New episodes">New episodes</option><option value="Behind">Behind / not tracked</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value="score-desc">Rating: high to low</option><option value="score-asc">Rating: low to high</option><option value="title-asc">Title: A to Z</option><option value="year-desc">Latest episode: newest</option><option value="year-asc">Original year: oldest</option><option value="studio-asc">Studio: A to Z</option></select></label>
      </div>
      <div className="filterSummary"><span>{shown.length} of {items.length} titles</span>{hasFilters&&<button onClick={resetFilters}>Reset</button>}</div>
    </section>

    <section className="grid">{shown.map(a=><article key={a.id} onClick={()=>setSelected(a)}><div className="poster">{a.image?<img loading="lazy" src={a.image} alt={`${a.title} cover`}/>:<div className="fallback"><b>{a.title.slice(0,1)}</b><span>{a.title}</span></div>}<span className="badge">{a.status||"Uncategorized"}</span>{a.newEpisodes>0&&<span className="newBadge">NEW{a.newEpisodes>1?` +${a.newEpisodes}`:""}</span>}</div><h3>{a.title}</h3><div className="rating">{stars(a.score)}</div><small>{a.episodes?`${a.episodes} eps`:""}{a.latestEpisodeYear?` · latest ${a.latestEpisodeYear}`:""}{isCaughtUp(a)?" · caught up":""}</small></article>)}</section>
    <footer><button onClick={backup}>Export repo data</button></footer>

    {selected&&!edit&&<div className="sheet" onClick={()=>setSelected(null)}><div className="panel" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="hero">{selected.image?<img src={selected.image} alt={`${selected.title} cover`}/>:<div className="heroFallback">{selected.title}</div>}</div><h2>{selected.title}</h2>{selected.newEpisodes>0&&<div className="newNotice">NEW · {selected.newEpisodes} new episode{selected.newEpisodes===1?"":"s"} detected</div>}<div className="rating big">{stars(selected.score)}</div><p className="meta">{selected.status||"Uncategorized"} · {selected.episodes||"—"} episodes · latest {selected.latestEpisodeYear||selected.year||"—"}</p><p className="meta">Watched: {selected.watchedEpisodes??"—"}{selected.episodes?` / ${selected.episodes}`:""}{isCaughtUp(selected)?" · Caught up":""}</p>{selected.year&&selected.latestEpisodeYear&&selected.latestEpisodeYear!==selected.year&&<p className="meta">Started: {selected.year}</p>}<p>{selected.synopsis||"No synopsis yet."}</p><p className="muted">{selected.genre}<br/>{selected.studio}</p>{editMode&&<div className="actions"><button onClick={()=>setEdit(selected)}>Edit</button><button className="danger" onClick={()=>remove(selected)}>Delete</button></div>}</div></div>}

    {edit&&editMode&&<div className="sheet"><form className="panel form" onSubmit={e=>{e.preventDefault();commit(edit)}}><button type="button" className="close" onClick={()=>setEdit(null)}>×</button><h2>{items.some(x=>x.id===edit.id)?"Edit anime":"Add anime"}</h2>{["title","genre","studio","synopsis"].map(k=><label key={k}>{k[0].toUpperCase()+k.slice(1)}{k==="synopsis"?<textarea value={(edit as any)[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})}/>:<input required={k==="title"} value={(edit as any)[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})}/>}</label>)}<div className="row"><label>Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="">Uncategorized</option>{["Completed","Paused","Planned"].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<select value={edit.score??""} onChange={e=>setEdit({...edit,score:e.target.value?+e.target.value:null})}><option value="">—</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x} ★</option>)}</select></label></div><div className="row"><label>Total episodes<input type="number" min="0" value={edit.episodes??""} onChange={e=>setEdit({...edit,episodes:e.target.value?+e.target.value:null})}/></label><label>Episodes watched<input type="number" min="0" value={edit.watchedEpisodes??""} onChange={e=>setEdit({...edit,watchedEpisodes:e.target.value?+e.target.value:null})}/></label></div><div className="row"><label>Latest episode year<input type="number" min="1900" max="2100" value={edit.latestEpisodeYear??""} onChange={e=>setEdit({...edit,latestEpisodeYear:e.target.value?+e.target.value:null})}/></label><label>Original year<input type="number" min="1900" max="2100" value={edit.year??""} onChange={e=>setEdit({...edit,year:e.target.value?+e.target.value:null})}/></label></div><button className="save">Continue in GitHub</button></form></div>}
  </main>
}

createRoot(document.getElementById("root")!).render(<App/>);
