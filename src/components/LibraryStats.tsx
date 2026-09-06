import {useEffect,useId} from "react";
import {splitTags} from "../appData";
import type {Anime} from "../types";

const top=(values:string[],limit=3)=>Array.from(values.reduce((m,x)=>m.set(x,(m.get(x)||0)+1),new Map<string,number>()).entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit);

export default function LibraryStats({items,onClose}:{items:Anime[];onClose:()=>void}){
 const titleId=useId();
 useEffect(()=>{const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown)},[onClose]);
 const completed=items.filter(a=>a.status==="Completed").length;
 const planned=items.filter(a=>a.status==="Planned").length;
 const rated=items.filter(a=>a.score!=null);
 const average=rated.length?(rated.reduce((sum,a)=>sum+(a.score||0),0)/rated.length).toFixed(1):"—";
 const genres=top(items.flatMap(a=>a.genres?.length?a.genres:splitTags(a.genre)));
 const studios=top(items.flatMap(a=>a.studios?.length?a.studios:splitTags(a.studio)));
 return <div className="sheet statsSheet" onClick={onClose}><section className="panel statsModal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e=>e.stopPropagation()}>
  <button className="close" onClick={onClose} aria-label="Close library stats">×</button>
  <div className="eyebrow">LIBRARY INSIGHTS</div>
  <h2 id={titleId}>Your stats</h2>
  <div className="statsPanel" aria-label="Library stats">
   <div className="stat"><b>{items.length}</b><span>Titles</span></div>
   <div className="stat"><b>{completed}</b><span>Completed</span></div>
   <div className="stat"><b>{planned}</b><span>Planned</span></div>
   <div className="stat"><b>{average}</b><span>Avg rating</span></div>
   <div className="statWide"><span>Top genres</span><b>{genres.map(([name,count])=>`${name} ${count}`).join(" · ")||"—"}</b></div>
   <div className="statWide"><span>Top studios</span><b>{studios.map(([name,count])=>`${name} ${count}`).join(" · ")||"—"}</b></div>
  </div>
 </section></div>;
}
