import {useMemo,useState} from "react";
import {franchiseOf,mediaTypeOf,searchableText} from "./catalog";
import {EDIT_KEY,exportLibrary,issueUrl,newAnime} from "./admin";
import {initialAnime,repoAnime,splitTags,statusTabs} from "./appData";
import AnimeCard from "./components/AnimeCard";
import AnimeDetails from "./components/AnimeDetails";
import AnimeForm from "./components/AnimeForm";
import FilterPanel from "./components/FilterPanel";
import type {Anime,SortKey} from "./types";

export default function App(){
 const[items]=useState<Anime[]>(initialAnime),[q,setQ]=useState(""),[filter,setFilter]=useState("All"),[genreFilter,setGenreFilter]=useState("All"),[studioFilter,setStudioFilter]=useState("All"),[scoreFilter,setScoreFilter]=useState("All"),[typeFilter,setTypeFilter]=useState("All"),[franchiseFilter,setFranchiseFilter]=useState("All"),[sort,setSort]=useState<SortKey>("score-desc"),[selected,setSelected]=useState<Anime|null>(null),[edit,setEdit]=useState<Anime|null>(null),[editMode,setEditMode]=useState(()=>localStorage.getItem(EDIT_KEY)==="1"),[notice,setNotice]=useState("");
 const genres=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.genre)))).sort(),[items]);
 const studios=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.studio)))).sort(),[items]);
 const franchises=useMemo(()=>Array.from(new Set(items.map(a=>franchiseOf(a.title)))).filter(f=>items.filter(a=>franchiseOf(a.title)===f).length>1).sort(),[items]);
 const shown=useMemo(()=>items.filter(a=>{const query=q.trim().toLowerCase();return (filter==="All"||a.status===filter)&&(!query||searchableText(a).includes(query))&&(genreFilter==="All"||splitTags(a.genre).includes(genreFilter))&&(studioFilter==="All"||splitTags(a.studio).includes(studioFilter))&&(scoreFilter==="All"||(scoreFilter==="Unrated"?a.score==null:a.score===+scoreFilter))&&(typeFilter==="All"||mediaTypeOf(a)===typeFilter)&&(franchiseFilter==="All"||franchiseOf(a.title)===franchiseFilter)}).sort((a,b)=>sort==="score-desc"?(b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title):sort==="score-asc"?(a.score??99)-(b.score??99)||a.title.localeCompare(b.title):sort==="title-asc"?a.title.localeCompare(b.title):sort==="year-desc"?(b.latestEpisodeYear??b.year??0)-(a.latestEpisodeYear??a.year??0)||a.title.localeCompare(b.title):sort==="year-asc"?(a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title):(a.studio||"zzz").localeCompare(b.studio||"zzz")||a.title.localeCompare(b.title)),[items,q,filter,genreFilter,studioFilter,scoreFilter,typeFilter,franchiseFilter,sort]);
 const hasFilters=Boolean(q||filter!=="All"||genreFilter!=="All"||studioFilter!=="All"||scoreFilter!=="All"||typeFilter!=="All"||franchiseFilter!=="All"||sort!=="score-desc");
 const reset=()=>{setQ("");setFilter("All");setGenreFilter("All");setStudioFilter("All");setScoreFilter("All");setTypeFilter("All");setFranchiseFilter("All");setSort("score-desc")};
 const toggleEdit=()=>{const next=!editMode;setEditMode(next);localStorage.setItem(EDIT_KEY,next?"1":"0");setEdit(null);setNotice(next?"Edit mode enabled · GitHub will verify you when you submit":"Edit mode disabled")};
 const commit=(anime:Anime)=>{window.open(issueUrl(`upsert ${anime.title||"anime"}`,{action:"upsert",anime:{...anime,image:""}}),"_blank","noopener,noreferrer");setEdit(null);setNotice("GitHub opened. Submit the prefilled issue to publish this change.")};
 const remove=(anime:Anime)=>{if(!confirm(`Create a GitHub request to delete ${anime.title}?`))return;window.open(issueUrl(`delete ${anime.title}`,{action:"delete",id:anime.id,title:anime.title}),"_blank","noopener,noreferrer");setSelected(null)};
 const related=selected?items.filter(a=>a.id!==selected.id&&franchiseOf(a.title)===franchiseOf(selected.title)&&a.status!=="AI Suggested"):[];
 return <main>
  <header><div><div className="eyebrow">RICHIE’S LIBRARY</div><h1>The Watchlist</h1><p>{repoAnime.length} titles · 5 weekly AI picks</p></div><div className="headerActions"><button className="adminPill" onClick={toggleEdit}>{editMode?"Editing":"Admin"}</button>{editMode&&<button className="add" onClick={()=>setEdit(newAnime())}>＋</button>}</div></header>
  {notice&&<div className="notice">{notice}</div>}
  <div className="search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search titles, aliases, franchises…"/></div>
  <nav>{statusTabs.map(x=><button key={x.value} className={filter===x.value?"active":""} onClick={()=>setFilter(x.value)}>{x.label}</button>)}</nav>
  <FilterPanel typeFilter={typeFilter} setTypeFilter={setTypeFilter} franchiseFilter={franchiseFilter} setFranchiseFilter={setFranchiseFilter} franchises={franchises} genreFilter={genreFilter} setGenreFilter={setGenreFilter} genres={genres} studioFilter={studioFilter} setStudioFilter={setStudioFilter} studios={studios} scoreFilter={scoreFilter} setScoreFilter={setScoreFilter} sort={sort} setSort={setSort} shownCount={shown.length} totalCount={items.length} hasFilters={hasFilters} onReset={reset}/>
  <section className="grid">{shown.map(anime=><AnimeCard key={anime.id} anime={anime} onSelect={setSelected}/>)}</section>
  <footer><button onClick={()=>exportLibrary(repoAnime)}>Export repo data</button></footer>
  {selected&&!edit&&<AnimeDetails anime={selected} related={related} editMode={editMode} onClose={()=>setSelected(null)} onSelect={setSelected} onEdit={setEdit} onDelete={remove}/>} 
  {edit&&editMode&&<AnimeForm anime={edit} onChange={setEdit} onClose={()=>setEdit(null)} onSubmit={commit}/>} 
 </main>
}
