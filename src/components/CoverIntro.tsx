import {stars} from "../appData";
import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import type {Anime} from "../types";
import "../coverIntro.css";

export default function CoverIntro({items}:{items:Anime[]}){
 const[covers]=useState(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return [];
  const favorites=items.filter(a=>(a.score===6||a.score===5||a.score===4)&&a.image);
  for(let i=favorites.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[favorites[i],favorites[j]]=[favorites[j],favorites[i]]}
  return favorites;
 });
 const[visible,setVisible]=useState(covers.length>0);
 const[index,setIndex]=useState(-1);
 const[held,setHeld]=useState(false);
 const continueRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!visible)return;
  const start=window.setTimeout(()=>setIndex(0),4000);
  const main=document.querySelector("main");
  const previousInert=main?.inert;
  const previousOverflow=document.body.style.overflow;
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(main)main.inert=true;
  document.body.style.overflow="hidden";
  continueRef.current?.focus();
  const keydown=(event:KeyboardEvent)=>{if(event.key==="Escape")setVisible(false);if(event.key==="Tab"){event.preventDefault();continueRef.current?.focus()}};
  window.addEventListener("keydown",keydown);
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const stop=()=>{if(motion.matches)setVisible(false)};
  motion.addEventListener("change",stop);
  return()=>{window.clearTimeout(start);motion.removeEventListener("change",stop);window.removeEventListener("keydown",keydown);if(main)main.inert=previousInert||false;document.body.style.overflow=previousOverflow;previousFocus?.focus()};
 },[visible]);
 useEffect(()=>{if(!visible||index<0||held)return;const timer=window.setTimeout(()=>setIndex(index+1),800);return()=>window.clearTimeout(timer)},[visible,index,covers.length,held]);
 if(!visible)return null;
 return <div className="coverIntro" onContextMenu={e=>e.preventDefault()} role="dialog" aria-modal="true" aria-label="Top-rated anime collection">
  <div className="introGlow" aria-hidden="true"/>
  <div className="introCards" aria-hidden="true">{covers.map((anime,i)=>{
   const columns=window.innerWidth<600?5:8;
   const rows=Math.ceil(covers.length/columns);
   const x=((i%columns+.5)/columns-.5)*100;
   const y=((Math.floor(i/columns)+.5)/rows-.5)*94;
   const angle=(i%2===0?1:-1)*(8+i%5*3);
   const style={"--x":`${x}vw`, "--y":`${y}svh`, "--sx":`${-x*.85}vw`, "--sy":`${-y*.8}svh`, "--spin":`${angle}deg`, "--delay":`${i%8*25}ms`, "--layer":i%7} as CSSProperties;
   return <div className="introCover" key={anime.id} style={style}><img src={anime.image} alt="" draggable={false} decoding="async"/></div>;
  })}</div>
  <div className={`introSpotlights${held?" introHeld":""}`} aria-hidden="true" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setHeld(true)}} onPointerUp={()=>setHeld(false)} onPointerCancel={()=>setHeld(false)} onLostPointerCapture={()=>setHeld(false)}>{index>=0&&Array.from({length:Math.min(index+1,10)},(_,offset)=>index-offset).reverse().map(sequence=>{
   const anime=covers[sequence%covers.length];
   return <div className="introSpotlight" key={sequence}><img src={anime.image} alt="" draggable={false} decoding="async"/><div className="spotlightCaption"><span className={anime.score===6?"ultraStars":undefined}>{stars(anime.score)}{anime.score===6?" Ultra":""}</span><strong>{anime.title}</strong></div></div>;
  })}</div>
  <div className="introHeading"><span>TOP-RATED COLLECTION</span><h2>Richie’s AniVault</h2></div>
  <div className="introMark" aria-hidden="true"><span>RICHIE’S TOP-RATED COLLECTION</span><strong>AniVault</strong><div>★★★★★</div></div>
  <div className="introContinue"><button ref={continueRef} onClick={()=>setVisible(false)}>Continue <span aria-hidden="true">→</span></button><small>Press and hold the covers to pause</small></div>
 </div>;
}
