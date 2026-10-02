import {useEffect,useState} from "react";
import type {CSSProperties} from "react";
import type {Anime} from "../types";
import "../coverIntro.css";

export default function CoverIntro({items}:{items:Anime[]}){
 const[covers]=useState(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return [];
  const favorites=items.filter(a=>a.score===5&&a.image);
  for(let i=favorites.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[favorites[i],favorites[j]]=[favorites[j],favorites[i]]}
  return favorites;
 });
 const[visible,setVisible]=useState(covers.length>0);
 useEffect(()=>{
  if(!visible)return;
  const timer=window.setTimeout(()=>setVisible(false),8200);
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const stop=()=>{if(motion.matches)setVisible(false)};
  motion.addEventListener("change",stop);
  return()=>{window.clearTimeout(timer);motion.removeEventListener("change",stop)};
 },[visible]);
 if(!visible)return null;
 return <div className="coverIntro" aria-hidden="true">
  <div className="introGlow"/>
  <div className="introCards">{covers.map((anime,i)=>{
   const columns=window.innerWidth<600?5:8;
   const rows=Math.ceil(covers.length/columns);
   const x=((i%columns+.5)/columns-.5)*100;
   const y=((Math.floor(i/columns)+.5)/rows-.5)*94;
   const angle=(i%2===0?1:-1)*(8+i%5*3);
   const style={"--x":`${x}vw`, "--y":`${y}svh`, "--sx":`${-x*.85}vw`, "--sy":`${-y*.8}svh`, "--spin":`${angle}deg`, "--delay":`${i%8*25}ms`, "--layer":i%7} as CSSProperties;
   return <div className="introCover" key={anime.id} style={style}><img src={anime.image} alt="" decoding="async"/></div>;
  })}</div>
  <div className="introSpotlights">{covers.map((anime,i)=><div className="introSpotlight" key={anime.id} style={{"--spot-delay":`${4000+i*(3100/Math.max(1,covers.length-1))}ms`,zIndex:i} as CSSProperties}><img src={anime.image} alt="" decoding="async"/><div className="spotlightCaption"><span>★★★★★</span><strong>{anime.title}</strong></div></div>)}</div>
  <div className="introMark"><span>RICHIE’S FIVE-STAR COLLECTION</span><strong>AniVault</strong><div>★★★★★</div></div>
 </div>;
}
