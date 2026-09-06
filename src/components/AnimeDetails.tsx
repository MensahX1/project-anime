import {useId} from "react";
import {franchiseOf,mediaTypeOf} from "../catalog";
import {isRecentlyUpdated,stars} from "../appData";
import {useDialogFocus} from "../hooks/useDialogFocus";
import type {Anime} from "../types";

type Props={anime:Anime;related:Anime[];editMode:boolean;onClose:()=>void;onSelect:(anime:Anime)=>void;onEdit:(anime:Anime)=>void;onDelete:(anime:Anime)=>void};

export default function AnimeDetails({anime,related,editMode,onClose,onSelect,onEdit,onDelete}:Props){
 const titleId=useId();
 const dialogRef=useDialogFocus(onClose);
 return <div className="sheet" onClick={onClose}><div ref={dialogRef as React.RefObject<HTMLDivElement>} className="panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={e=>e.stopPropagation()}>
  <button className="close" onClick={onClose} aria-label="Close anime details">×</button>
  <div className="hero">{anime.image?<img src={anime.image} alt={`${anime.title} cover`}/>:<div className="heroFallback">{anime.title}</div>}</div>
  <h2 id={titleId}>{anime.title}</h2>
  {isRecentlyUpdated(anime)&&<div className="newNotice">NEW · metadata updated recently</div>}
  <div className="rating big">{stars(anime.score)}</div>
  <p className="meta">{anime.status||"Uncategorized"} · {mediaTypeOf(anime)} · {anime.episodes||"—"} episodes · latest {anime.latestEpisodeYear||anime.year||"—"}</p>
  <p className="franchiseLabel">{franchiseOf(anime.title)}</p>
  <p>{anime.synopsis||"No synopsis available."}</p>
  <p className="muted">{anime.genre}<br/>{anime.studio}</p>
  {related.length>0&&<section className="franchiseSection"><h3>More in {franchiseOf(anime.title)}</h3><div className="relatedRow">{related.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.image&&<img src={a.image} alt=""/>}<span>{a.title}</span><small>{stars(a.score)} · {mediaTypeOf(a)}</small></button>)}</div></section>}
  {editMode&&<div className="actions"><button onClick={()=>onEdit(anime)}>Edit</button><button className="danger" onClick={()=>onDelete(anime)}>Delete</button></div>}
 </div></div>;
}
