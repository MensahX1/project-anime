import AnimeFields from "./AnimeFields";
import {useId} from "react";
import {repoAnime} from "../appData";
import {useDialogFocus} from "../hooks/useDialogFocus";
import type {Anime} from "../types";

type Props={anime:Anime;onChange:(anime:Anime)=>void;onClose:()=>void;onSubmit:(anime:Anime)=>void};

export default function AnimeForm({anime,onChange,onClose,onSubmit}:Props){
 const titleId=useId();
 const dialogRef=useDialogFocus<HTMLFormElement>(onClose,"input");
 const heading=repoAnime.some(x=>x.id===anime.id)?"Edit anime":"Add anime";
 return <div className="sheet"><form ref={dialogRef} className="panel form" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onSubmit={e=>{e.preventDefault();onSubmit(anime)}}>
  <button type="button" className="close" onClick={onClose} aria-label="Close anime form">×</button>
  <h2 id={titleId}>{heading}</h2>
  <AnimeFields anime={anime} onChange={onChange}/>
 </form></div>;
}
