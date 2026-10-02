import {useMemo,useState} from "react";
import {franchiseOf} from "./catalog";
import {EDIT_KEY,exportLibrary,issueBody,issueUrl,newAnime} from "./admin";
import {initialAnime,repoAnime,statusTabs} from "./appData";
import CoverIntro from "./components/CoverIntro";
import AnimeCard from "./components/AnimeCard";
import AnimeDetails from "./components/AnimeDetails";
import AnimeForm from "./components/AnimeForm";
import AnimeSearch from "./components/AnimeSearch";
import FilterPanel from "./components/FilterPanel";
import LibraryStats from "./components/LibraryStats";
import {useCatalogFilters} from "./hooks/useCatalogFilters";
import type {Anime} from "./types";
import {applyPending,DRAFT_KEY,readPending,stageChange} from "./pendingChanges";
import type {PendingChange} from "./pendingChanges";
import "./insights.css";

const deployedAt=new Date(__DEPLOYED_AT__).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});

export default function App(){
 const[baseline]=useState<Anime[]>(initialAnime);
 const[pending,setPending]=useState<PendingChange[]>(()=>readPending(baseline));
 const items=useMemo(()=>applyPending(baseline,pending),[baseline,pending]);
 const[selected,setSelected]=useState<Anime|null>(null),[edit,setEdit]=useState<Anime|null>(null),[showAddSearch,setShowAddSearch]=useState(false),[showStats,setShowStats]=useState(false),[editMode,setEditMode]=useState(()=>localStorage.getItem(EDIT_KEY)==="1"),[notice,setNotice]=useState("");
 const filters=useCatalogFilters(items);
 const toggleEdit=()=>{const next=!editMode;setEditMode(next);localStorage.setItem(EDIT_KEY,next?"1":"0");setEdit(null);setShowAddSearch(false);setNotice(next?"Edit mode enabled · edits stay here until you save all changes":"Edit mode disabled")};
 const persist=(next:PendingChange[])=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(next));setPending(next);setBatchLink("");setBatchText("");return true}catch{setNotice("Could not save drafts on this device. Free up browser storage and try again.");return false}};
 const commit=(anime:Anime)=>{
  if(items.some(a=>a.id!==anime.id&&a.title.trim().toLowerCase()===anime.title.trim().toLowerCase())){setNotice("That title is already in your library.");return}
  const next=stageChange(pending,{action:"upsert",anime:{...anime,title:anime.title.trim()}},baseline);
  if(!persist(next))return;
  setEdit(null);setSelected(null);setNotice("Change queued. Keep editing, then save all changes.");
 };
 const remove=(anime:Anime)=>{if(!confirm(`Queue deletion of ${anime.title}?`))return;if(persist(stageChange(pending,{action:"delete",id:anime.id,title:anime.title},baseline))){setSelected(null);setNotice("Deletion queued. Save all changes when you are ready.")}};
 const discard=()=>{if(confirm("Discard all pending changes?")){if(persist([])){setEdit(null);setSelected(null);setNotice("Pending changes discarded.")}}};
 const saveAll=async()=>{
  const payload={action:"batch",changes:pending.map(c=>c.action==="upsert"?{...c,anime:{...c.anime,image:""}}:c)};
  if(issueBody(payload).length>65000){setNotice("This batch exceeds GitHub’s size limit. Remove some pending edits before submitting.");return}
  const title=`save ${pending.length} anime changes`,url=issueUrl(title,payload);
  if(url.length<=7000){window.open(url,"_blank","noopener,noreferrer");setNotice("Submit the prefilled GitHub issue to publish all changes together. Your drafts stay here until the published update loads.")}
  else{try{await navigator.clipboard.writeText(issueBody(payload));setNotice("Batch copied. Open GitHub, paste into the issue body, and submit to publish all changes together.");setBatchLink(issueUrl(title))}catch{setBatchText(issueBody(payload));setBatchLink(issueUrl(title));setNotice("Copy the batch below, open GitHub, paste into the issue body, and submit.")}}
 };
 const[batchLink,setBatchLink]=useState(""),[batchText,setBatchText]=useState("");
 const related=selected?items.filter(a=>a.id!==selected.id&&(a.franchiseName||franchiseOf(a.title))===(selected.franchiseName||franchiseOf(selected.title))):[];
 const chooseCatalogAnime=(anime:Anime)=>{setShowAddSearch(false);setEdit(anime)};
 const addManual=()=>{setShowAddSearch(false);setEdit(newAnime())};
 const pickRandom=()=>{if(!items.length)return;const anime=items[Math.floor(Math.random()*items.length)];setEdit(null);setShowAddSearch(false);setSelected(anime);setNotice(`Random pick · ${anime.title}`)};
 return <><CoverIntro items={items}/><main>
  <header><div><div className="eyebrow">RICHIE’S LIBRARY</div><h1>AniVault</h1><p>{items.length} titles</p></div><div className="headerActions"><button className="adminPill" onClick={pickRandom} aria-label="Pick a random anime from the full library">Random</button><button className="adminPill" onClick={()=>setShowStats(true)}>Stats</button><button className="adminPill" onClick={toggleEdit}>{editMode?"Editing":"Admin"}</button>{editMode&&<button className="add" onClick={()=>setShowAddSearch(true)} aria-label="Add anime">＋</button>}</div></header>
  {pending.length>0&&<section className="pendingBar" aria-label="Pending changes"><span>{pending.length} pending {pending.length===1?"change":"changes"}</span><button onClick={saveAll}>Save all changes</button><button className="discard" onClick={discard}>Discard</button></section>}
  {batchLink&&<div className="batchHelp">{batchText&&<textarea aria-label="Batch to copy" readOnly value={batchText} onFocus={e=>e.currentTarget.select()}/>}<a href={batchLink} target="_blank" rel="noreferrer">Open GitHub to submit batch</a></div>}
  {notice&&<div className="notice">{notice}</div>}
  <div className="search"><span aria-hidden="true">⌕</span><input value={filters.q} onChange={e=>filters.setQ(e.target.value)} placeholder="Search titles, aliases, franchises, genres, studios…" aria-label="Search anime"/></div>
  <nav aria-label="Library status">{statusTabs.map(x=><button key={x.value} className={filters.filter===x.value?"active":""} onClick={()=>filters.setFilter(x.value)}>{x.label}</button>)}</nav>
  <FilterPanel typeFilter={filters.typeFilter} setTypeFilter={filters.setTypeFilter} franchiseFilter={filters.franchiseFilter} setFranchiseFilter={filters.setFranchiseFilter} franchises={filters.franchises} genreFilters={filters.genreFilters} toggleGenre={filters.toggleGenre} genres={filters.genres} studioFilter={filters.studioFilter} setStudioFilter={filters.setStudioFilter} studios={filters.studios} scoreFilter={filters.scoreFilter} setScoreFilter={filters.setScoreFilter} decadeFilter={filters.decadeFilter} setDecadeFilter={filters.setDecadeFilter} decades={filters.decades} quickFilter={filters.quickFilter} setQuickFilter={filters.setQuickFilter} sort={filters.sort} setSort={filters.setSort} shownCount={filters.shown.length} totalCount={items.length} hasFilters={filters.hasFilters} onReset={filters.reset}/>
  <section className="grid">{filters.shown.map(anime=><AnimeCard key={anime.id} anime={anime} onSelect={setSelected}/>)}</section>
  <footer><button onClick={()=>exportLibrary(repoAnime)}>Export repo data</button><small>Last deployed {deployedAt}</small></footer>
  {showStats&&<LibraryStats items={items} onClose={()=>setShowStats(false)}/>}
  {showAddSearch&&editMode&&<AnimeSearch items={items} onSelect={chooseCatalogAnime} onManual={addManual} onClose={()=>setShowAddSearch(false)}/>}
  {selected&&!edit&&!showAddSearch&&<AnimeDetails anime={selected} related={related} editMode={editMode} onClose={()=>setSelected(null)} onSelect={setSelected} onEdit={setEdit} onDelete={remove}/>}
  {edit&&editMode&&<AnimeForm anime={edit} onChange={setEdit} onClose={()=>setEdit(null)} onSubmit={commit}/>}
 </main></>
}
