import {mediaTypeOf} from "../catalog";
import {stars} from "../appData";
import type {Anime} from "../types";

type Props={anime:Anime;onSelect:(anime:Anime)=>void};

const formatUpdated=(value?:string)=>{
  if(!value)return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return null;
  return date.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
};

export default function AnimeCard({anime,onSelect}:Props){
  const open=()=>onSelect(anime);
  const updated=formatUpdated(anime.lastUpdated);
  return <article role="button" tabIndex={0} aria-label={`Open ${anime.title}`} onClick={open} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}}}>
    <div className="poster">
      {anime.image?<img loading="lazy" src={anime.image} alt={`${anime.title} cover`}/>:<div className="fallback"><b>{anime.title.slice(0,1)}</b><span>{anime.title}</span></div>}
      <span className="badge">{anime.status||"Uncategorized"}</span>
    </div>
    <h3>{anime.title}</h3>
    <div className="rating">{stars(anime.score)}</div>
    <small>{mediaTypeOf(anime)}{anime.episodes?` · ${anime.episodes} eps`:""}{anime.latestEpisodeYear?` · ${anime.latestEpisodeYear}`:""}</small>
    {anime.studio&&<small className="studioLine">{anime.studio}</small>}
    {updated&&<small className="updatedLine">Updated {updated}</small>}
  </article>;
}
