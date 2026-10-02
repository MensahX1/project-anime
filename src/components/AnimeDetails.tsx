import AnimeFields from "./AnimeFields";
import {useId,useState} from "react";
import {franchiseOf,mediaTypeOf} from "../catalog";
import {stars} from "../appData";
import {useDialogFocus} from "../hooks/useDialogFocus";
import type {Anime} from "../types";

type Props={anime:Anime;related:Anime[];onClose:()=>void;onSelect:(anime:Anime)=>void;onQueue:(anime:Anime)=>void;onDelete:(anime:Anime)=>void};

const formatUpdated=(value?:string)=>{
 const date=value?new Date(value):null;
 return date&&!Number.isNaN(date.getTime())?date.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}):null;
};

export default function AnimeDetails({anime,related,onClose,onSelect,onQueue,onDelete}:Props){
 const titleId=useId();
 const[draft,setDraft]=useState(anime);
 const dialogRef=useDialogFocus<HTMLDivElement>(onClose);
 const updated=formatUpdated(anime.lastUpdated);
 return <div className="sheet" onClick={onClose}><div ref={dialogRef} className="panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={e=>e.stopPropagation()}>
  <button className="close" onClick={onClose} aria-label="Close anime details">×</button>
  <div className="hero">{anime.image?<img src={anime.image} alt={`${anime.title} cover`}/>:<div className="heroFallback">{anime.title}</div>}</div>
  <h2 id={titleId}>{anime.title}</h2>
  <div className="rating big">{stars(anime.score)}</div>
  <p className="meta">{anime.status||"Uncategorized"} · {mediaTypeOf(anime)} · {anime.episodes||"—"} episodes · latest {anime.latestEpisodeYear||anime.year||"—"}</p>
  {updated&&<p className="muted updatedDetail">Last updated {updated}</p>}
  <p className="franchiseLabel">{franchiseOf(anime.title)}</p>
  <p>{anime.synopsis||"No synopsis available."}</p>
  <form className="form inlineEditor" aria-label="Edit anime details" onSubmit={e=>{e.preventDefault();onQueue(draft)}}><AnimeFields anime={draft} onChange={setDraft}/></form>
  {related.length>0&&<section className="franchiseSection"><h3>More in {franchiseOf(anime.title)}</h3><div className="relatedRow">{related.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.image&&<img src={a.image} alt=""/>}<span>{a.title}</span><small>{stars(a.score)} · {mediaTypeOf(a)}</small></button>)}</div></section>}
  <div className="actions"><button className="danger" onClick={()=>onDelete(anime)}>Delete</button></div>
 </div></div>;
}
