import {useEffect,useId,useMemo,useState} from "react";
import animeIndexData from "../animeIndex.json";
import {repoAnime} from "../appData";
import {newAnime} from "../admin";
import type {Anime,AnimeCatalogEntry} from "../types";

const index=animeIndexData as AnimeCatalogEntry[];
const norm=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();

const toAnime=(entry:AnimeCatalogEntry):Anime=>({
  ...newAnime(),
  title:entry.title,
  episodes:entry.episodes,
  year:entry.year,
  latestEpisodeYear:entry.year,
  genre:entry.genres.join(", "),
  studio:entry.studios.join(", "),
  genres:entry.genres,
  studios:entry.studios,
  mediaType:entry.mediaType,
  image:entry.picture,
  metadataSource:"manami-project/anime-offline-database"
});

type Props={onSelect:(anime:Anime)=>void;onManual:()=>void;onClose:()=>void};

export default function AnimeSearch({onSelect,onManual,onClose}:Props){
 const titleId=useId();
 const[q,setQ]=useState("");
 const existing=useMemo(()=>new Set(repoAnime.map(a=>norm(a.title))),[]);
 useEffect(()=>{const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown)},[onClose]);
 const results=useMemo(()=>{
  const query=norm(q);
  if(query.length<2)return [];
  const words=query.split(" ").filter(Boolean);
  return index.filter(entry=>{
    if(existing.has(norm(entry.title)))return false;
    const haystack=norm([entry.title,...entry.synonyms].join(" "));
    return words.every(word=>haystack.includes(word));
  }).slice(0,24);
 },[q,existing]);
 return <div className="sheet" onClick={onClose}><section className="panel catalogSearch" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e=>e.stopPropagation()}>
  <button type="button" className="close" onClick={onClose} aria-label="Close anime search">×</button>
  <h2 id={titleId}>Add anime</h2>
  <p className="muted">Search the local anime catalog to prefill metadata.</p>
  <div className="search catalogSearchInput"><span aria-hidden="true">⌕</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search anime title…" aria-label="Search anime database"/></div>
  {q.trim().length<2?<p className="catalogHint">Type at least 2 characters.</p>:results.length?<div className="catalogResults">{results.map(entry=><button key={`${entry.title}-${entry.year??""}`} type="button" onClick={()=>onSelect(toAnime(entry))}>
    {entry.picture?<img src={entry.picture} alt="" loading="lazy"/>:<div className="catalogThumb">{entry.title.slice(0,1)}</div>}
    <span><b>{entry.title}</b><small>{entry.mediaType} · {entry.year??"—"}{entry.episodes?` · ${entry.episodes} eps`:""}</small>{entry.studios.length>0&&<small>{entry.studios.join(", ")}</small>}</span>
  </button>)}</div>:<p className="catalogHint">No unused matches found.</p>}
  <button type="button" className="manualAdd" onClick={onManual}>Add manually instead</button>
 </section></div>;
}
