import {useState} from "react";
import {franchiseOf} from "./catalog";
import {EDIT_KEY,exportLibrary,issueUrl,newAnime} from "./admin";
import {initialAnime,repoAnime,statusTabs} from "./appData";
import AnimeCard from "./components/AnimeCard";
import AnimeDetails from "./components/AnimeDetails";
import AnimeForm from "./components/AnimeForm";
import FilterPanel from "./components/FilterPanel";
import LibraryStats from "./components/LibraryStats";
import {useCatalogFilters} from "./hooks/useCatalogFilters";
import type {Anime} from "./types";

const deployedAt=new Date(__DEPLOYED_AT__).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});

export default function App(){
 const[items]=useState<Anime[]>(initialAnime),[selected,setSelected]=useState<Anime|null>(null),[edit,setEdit]=useState<Anime|null>(null),[editMode,setEditMode]=useState(()=>localStorage.getItem(EDIT_KEY)==="1"),[notice,setNotice]=useState("");
 const filters=useCatalogFilters(items);
 const toggleEdit=()=>{const next=!editMode;setEditMode(next);localStorage.setItem(EDIT_KEY,next?"1":"0");setEdit(null);setNotice(next?"Edit mode enabled · GitHub will verify you when you submit":"Edit mode disabled")};
 const commit=(anime:Anime)=>{window.open(issueUrl(`upsert ${anime.title||"anime"}`,{action:"upsert",anime:{...anime,image:""}}),"_blank","noopener,noreferrer");setEdit(null);setNotice("GitHub opened. Submit the prefilled issue to publish this change.")};
 const remove=(anime:Anime)=>{if(!confirm(`Create a GitHub request to delete ${anime.title}?`))return;window.open(issueUrl(`delete ${anime.title}`,{action:"delete",id:anime.id,title:anime.title}),"_blank","noopener,noreferrer");setSelected(null)};
 const related=selected?items.filter(a=>a.id!==selected.id&&(a.franchiseName||franchiseOf(a.title))===(selected.franchiseName||franchiseOf(selected.title))):[];
 return <main>
  <header><div><div className="eyebrow">RICHIE’S LIBRARY</div><h1>The Watchlist</h1><p>{repoAnime.length} titles</p></div><div className="headerActions"><button className="adminPill" onClick={toggleEdit}>{editMode?"Editing":"Admin"}</button>{editMode&&<button className="add" onClick={()=>setEdit(newAnime())} aria-label="Add anime">＋</button>}</div></header>
  {notice&&<div className="notice">{notice}</div>}
  <LibraryStats items={items}/>
  <div className="search"><span aria-hidden="true">⌕</span><input value={filters.q} onChange={e=>filters.setQ(e.target.value)} placeholder="Search titles, aliases, franchises, genres, studios…" aria-label="Search anime"/></div>
  <nav aria-label="Library status">{statusTabs.map(x=><button key={x.value} className={filters.filter===x.value?"active":""} onClick={()=>filters.setFilter(x.value)}>{x.label}</button>)}</nav>
  <FilterPanel typeFilter={filters.typeFilter} setTypeFilter={filters.setTypeFilter} franchiseFilter={filters.franchiseFilter} setFranchiseFilter={filters.setFranchiseFilter} franchises={filters.franchises} genreFilters={filters.genreFilters} toggleGenre={filters.toggleGenre} genres={filters.genres} studioFilter={filters.studioFilter} setStudioFilter={filters.setStudioFilter} studios={filters.studios} scoreFilter={filters.scoreFilter} setScoreFilter={filters.setScoreFilter} decadeFilter={filters.decadeFilter} setDecadeFilter={filters.setDecadeFilter} decades={filters.decades} quickFilter={filters.quickFilter} setQuickFilter={filters.setQuickFilter} sort={filters.sort} setSort={filters.setSort} shownCount={filters.shown.length} totalCount={items.length} hasFilters={filters.hasFilters} onReset={filters.reset}/>
  <section className="grid">{filters.shown.map(anime=><AnimeCard key={anime.id} anime={anime} onSelect={setSelected}/>)}</section>
  <footer><button onClick={()=>exportLibrary(repoAnime)}>Export repo data</button><small>Last deployed {deployedAt}</small></footer>
  {selected&&!edit&&<AnimeDetails anime={selected} related={related} editMode={editMode} onClose={()=>setSelected(null)} onSelect={setSelected} onEdit={setEdit} onDelete={remove}/>} 
  {edit&&editMode&&<AnimeForm anime={edit} onChange={setEdit} onClose={()=>setEdit(null)} onSubmit={commit}/>} 
 </main>
}
