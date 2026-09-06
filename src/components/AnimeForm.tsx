import {useEffect,useId} from "react";
import {repoAnime} from "../appData";
import type {Anime} from "../types";

type Props={anime:Anime;onChange:(anime:Anime)=>void;onClose:()=>void;onSubmit:(anime:Anime)=>void};

export default function AnimeForm({anime,onChange,onClose,onSubmit}:Props){
 const titleId=useId();
 useEffect(()=>{const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown)},[onClose]);
 const heading=repoAnime.some(x=>x.id===anime.id)?"Edit anime":"Add anime";
 return <div className="sheet"><form className="panel form" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={e=>{e.preventDefault();onSubmit(anime)}}>
  <button type="button" className="close" onClick={onClose} aria-label="Close anime form">×</button>
  <h2 id={titleId}>{heading}</h2>
  {(["title","genre","studio","synopsis"] as const).map(k=><label key={k}>{k[0].toUpperCase()+k.slice(1)}{k==="synopsis"?<textarea value={anime[k]} onChange={e=>onChange({...anime,[k]:e.target.value})}/>:<input required={k==="title"} value={anime[k]} onChange={e=>onChange({...anime,[k]:e.target.value})}/>}</label>)}
  <div className="row"><label>Status<select value={anime.status} onChange={e=>onChange({...anime,status:e.target.value})}><option value="">Uncategorized</option>{["Completed","Paused","Planned"].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<select value={anime.score??""} onChange={e=>onChange({...anime,score:e.target.value?+e.target.value:null})}><option value="">—</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x} ★</option>)}</select></label></div>
  <div className="row"><label>Total episodes<input type="number" min="0" value={anime.episodes??""} onChange={e=>onChange({...anime,episodes:e.target.value?+e.target.value:null})}/></label><label>Latest episode year<input type="number" min="1900" max="2100" value={anime.latestEpisodeYear??""} onChange={e=>onChange({...anime,latestEpisodeYear:e.target.value?+e.target.value:null})}/></label></div>
  <label>Original year<input type="number" min="1900" max="2100" value={anime.year??""} onChange={e=>onChange({...anime,year:e.target.value?+e.target.value:null})}/></label>
  <button className="save">Continue in GitHub</button>
 </form></div>;
}
