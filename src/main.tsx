import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import animeData from "./anime.json";
import covers from "./generatedCovers.json";
import "./style.css";
import {registerSW} from "virtual:pwa-register";

registerSW({immediate:true});

type Anime={id:string,title:string,status:string,episodes:number|null,score:number|null,genre:string,studio:string,year:number|null,synopsis:string,image:string};
type SortKey="score-desc"|"score-asc"|"title-asc"|"year-desc"|"year-asc"|"studio-asc";
type AdminUser={id:number,login:string};

const repoAnime=animeData as Anime[];
const coverMap=covers as Record<string,string>;
const ADMIN_API=String((import.meta as any).env.VITE_ADMIN_API_URL||"").replace(/\/$/,"");
const TOKEN_KEY="le-anime-admin-token";

const splitTags=(value:string)=>String(value||"").split(/[,/;|]+/).map(x=>x.trim()).filter(Boolean);
const stars=(n:number|null)=>n?"★".repeat(n):"—";
const withCover=(a:Anime):Anime=>({...a,image:coverMap[a.title]||a.image||""});
const initialAnime=()=>repoAnime.map(withCover);

async function adminFetch(path:string,options:RequestInit={}){
  const token=sessionStorage.getItem(TOKEN_KEY);
  if(!token) throw new Error("Admin session expired. Sign in again.");
  const r=await fetch(`${ADMIN_API}${path}`,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||`Request failed (${r.status})`);
  return data;
}

function App(){
  const[items,setItems]=useState<Anime[]>(initialAnime);
  const[q,setQ]=useState("");
  const[filter,setFilter]=useState("All");
  const[genreFilter,setGenreFilter]=useState("All");
  const[studioFilter,setStudioFilter]=useState("All");
  const[scoreFilter,setScoreFilter]=useState("All");
  const[sort,setSort]=useState<SortKey>("score-desc");
  const[selected,setSelected]=useState<Anime|null>(null);
  const[edit,setEdit]=useState<Anime|null>(null);
  const[admin,setAdmin]=useState<AdminUser|null>(null);
  const[adminChecking,setAdminChecking]=useState(false);
  const[saving,setSaving]=useState(false);
  const[notice,setNotice]=useState("");

  useEffect(()=>{
    const hash=new URLSearchParams(location.hash.replace(/^#/,""));
    const incoming=hash.get("admin_token");
    if(incoming){
      sessionStorage.setItem(TOKEN_KEY,incoming);
      history.replaceState(null,"",location.pathname+location.search);
    }
    const token=sessionStorage.getItem(TOKEN_KEY);
    if(token&&ADMIN_API){
      setAdminChecking(true);
      adminFetch("/session").then(x=>setAdmin(x.user)).catch(()=>sessionStorage.removeItem(TOKEN_KEY)).finally(()=>setAdminChecking(false));
    }
  },[]);

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
  const login=()=>{
    if(!ADMIN_API){alert("Admin backend is not configured yet.");return;}
    location.href=`${ADMIN_API}/auth/github?return_to=${encodeURIComponent(location.href.split("#")[0])}`;
  };
  const logout=()=>{sessionStorage.removeItem(TOKEN_KEY);setAdmin(null);setEdit(null);setNotice("Signed out")};
  const newAnime=():Anime=>({id:`anime-${crypto.randomUUID()}`,title:"",status:"Planned",episodes:null,score:null,genre:"",studio:"",year:new Date().getFullYear(),synopsis:"",image:""});
  const commit=async(a:Anime)=>{
    if(!admin)return;
    setSaving(true);setNotice("");
    try{
      await adminFetch("/anime/upsert",{method:"POST",body:JSON.stringify({anime:{...a,image:""}})});
      const updated=withCover(a);
      setItems(x=>{const i=x.findIndex(v=>v.id===a.id);return i<0?[...x,updated]:x.map(v=>v.id===a.id?updated:v)});
      setSelected(updated);setEdit(null);setNotice("Saved to GitHub · deployment started");
    }catch(e:any){alert(e.message||String(e))}finally{setSaving(false)}
  };
  const remove=async(a:Anime)=>{
    if(!admin||!confirm(`Delete ${a.title} from the repo?`))return;
    setSaving(true);setNotice("");
    try{
      await adminFetch(`/anime/${encodeURIComponent(a.id)}`,{method:"DELETE"});
      setItems(x=>x.filter(v=>v.id!==a.id));setSelected(null);setEdit(null);setNotice("Deleted from GitHub · deployment started");
    }catch(e:any){alert(e.message||String(e))}finally{setSaving(false)}
  };
  const backup=()=>{const b=new Blob([JSON.stringify(items.map(a=>({...a,image:""})),null,2)],{type:"application/json"});const u=URL.createObjectURL(b),x=document.createElement("a");x.href=u;x.download="le-anime-backup.json";x.click();URL.revokeObjectURL(u)};

  return <main>
    <header><div><div className="eyebrow">MY LIBRARY</div><h1>Lè Anime</h1><p>{items.length} titles · GitHub is the source of truth</p></div><div className="headerActions">{admin?<><button className="adminPill" onClick={logout}>@{admin.login}</button><button className="add" onClick={()=>setEdit(newAnime())}>＋</button></>:<button className="adminPill" disabled={adminChecking} onClick={login}>{adminChecking?"Checking…":"Admin"}</button>}</div></header>
    {notice&&<div className="notice">{notice}</div>}
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
    <footer><button onClick={backup}>Export repo data</button></footer>

    {selected&&!edit&&<div className="sheet" onClick={()=>setSelected(null)}><div className="panel" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="hero">{selected.image?<img src={selected.image} alt={`${selected.title} cover`}/>:<div className="heroFallback">{selected.title}</div>}</div><h2>{selected.title}</h2><div className="rating big">{stars(selected.score)}</div><p className="meta">{selected.status||"Uncategorized"} · {selected.year||"—"} · {selected.episodes||"—"} episodes</p><p>{selected.synopsis||"No synopsis yet."}</p><p className="muted">{selected.genre}<br/>{selected.studio}</p>{admin&&<div className="actions"><button onClick={()=>setEdit(selected)}>Edit</button><button className="danger" disabled={saving} onClick={()=>remove(selected)}>Delete</button></div>}</div></div>}

    {edit&&admin&&<div className="sheet"><form className="panel form" onSubmit={e=>{e.preventDefault();commit(edit)}}><button type="button" className="close" onClick={()=>setEdit(null)}>×</button><h2>{items.some(x=>x.id===edit.id)?"Edit anime":"Add anime"}</h2>{["title","genre","studio","synopsis"].map(k=><label key={k}>{k[0].toUpperCase()+k.slice(1)}{k==="synopsis"?<textarea value={(edit as any)[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})}/>:<input required={k==="title"} value={(edit as any)[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})}/>}</label>)}<div className="row"><label>Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="">Uncategorized</option>{["Completed","Paused","Planned"].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<select value={edit.score??""} onChange={e=>setEdit({...edit,score:e.target.value?+e.target.value:null})}><option value="">—</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x} ★</option>)}</select></label></div><div className="row"><label>Episodes<input type="number" min="0" value={edit.episodes??""} onChange={e=>setEdit({...edit,episodes:e.target.value?+e.target.value:null})}/></label><label>Year<input type="number" min="1900" max="2100" value={edit.year??""} onChange={e=>setEdit({...edit,year:e.target.value?+e.target.value:null})}/></label></div><button className="save" disabled={saving}>{saving?"Publishing…":"Save to GitHub"}</button></form></div>}
  </main>
}

createRoot(document.getElementById("root")!).render(<App/>);
