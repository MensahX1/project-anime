import {franchiseOf,mediaTypeOf,whyPick} from "../catalog";
import {isRecentlyUpdated,repoAnime,stars} from "../appData";
import type {Anime} from "../types";

type Props={anime:Anime;related:Anime[];editMode:boolean;onClose:()=>void;onSelect:(anime:Anime)=>void;onEdit:(anime:Anime)=>void;onDelete:(anime:Anime)=>void};

export default function AnimeDetails({anime,related,editMode,onClose,onSelect,onEdit,onDelete}:Props){
 return <div className="sheet" onClick={onClose}><div className="panel" onClick={e=>e.stopPropagation()}>
  <button className="close" onClick={onClose}>×</button>
  <div className="hero">{anime.image?<img src={anime.image} alt={`${anime.title} cover`}/>:<div className="heroFallback">{anime.title}</div>}</div>
  <h2>{anime.title}</h2>
  {isRecentlyUpdated(anime)&&anime.status!=="AI Suggested"&&<div className="newNotice">NEW · metadata updated recently</div>}
  <div className="rating big">{stars(anime.score)}</div>
  <p className="meta">{anime.status==="AI Suggested"?"AI Pick":anime.status||"Uncategorized"} · {mediaTypeOf(anime)} · {anime.episodes||"—"} episodes · latest {anime.latestEpisodeYear||anime.year||"—"}</p>
  <p className="franchiseLabel">{franchiseOf(anime.title)}</p>
  <p>{anime.synopsis||"Suggested from the patterns in your 5-star anime."}</p>
  <p className="muted">{anime.genre}<br/>{anime.studio}</p>
  {anime.status==="AI Suggested"&&<div className="whyPick"><b>Why this pick?</b><span>{whyPick(anime,repoAnime)}</span></div>}
  {related.length>0&&<section className="franchiseSection"><h3>More in {franchiseOf(anime.title)}</h3><div className="relatedRow">{related.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.image&&<img src={a.image} alt=""/>}<span>{a.title}</span><small>{stars(a.score)} · {mediaTypeOf(a)}</small></button>)}</div></section>}
  {editMode&&anime.status!=="AI Suggested"&&<div className="actions"><button onClick={()=>onEdit(anime)}>Edit</button><button className="danger" onClick={()=>onDelete(anime)}>Delete</button></div>}
 </div></div>;
}
