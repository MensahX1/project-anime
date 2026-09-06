import {mediaTypeOf} from "../catalog";
import {isRecentlyUpdated,stars} from "../appData";
import type {Anime} from "../types";

type Props={anime:Anime;onSelect:(anime:Anime)=>void};

export default function AnimeCard({anime,onSelect}:Props){
  const open=()=>onSelect(anime);
  return <article role="button" tabIndex={0} aria-label={`Open ${anime.title}`} onClick={open} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}}}>
    <div className="poster">
      {anime.image?<img loading="lazy" src={anime.image} alt={`${anime.title} cover`}/>:<div className="fallback"><b>{anime.title.slice(0,1)}</b><span>{anime.title}</span></div>}
      <span className="badge">{anime.status==="AI Suggested"?"AI Pick":anime.status||"Uncategorized"}</span>
      {isRecentlyUpdated(anime)&&anime.status!=="AI Suggested"&&<span className="newBadge">NEW</span>}
    </div>
    <h3>{anime.title}</h3>
    <div className="rating">{stars(anime.score)}</div>
    <small>{mediaTypeOf(anime)}{anime.episodes?` · ${anime.episodes} eps`:""}{anime.latestEpisodeYear?` · ${anime.latestEpisodeYear}`:""}</small>
    {anime.studio&&<small className="studioLine">{anime.studio}</small>}
  </article>;
}
