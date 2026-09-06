import {useEffect,useRef} from "react";

const selector='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(onClose:()=>void,initialSelector?:string){
 const ref=useRef<T|null>(null);
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(el=>!el.hasAttribute("disabled")&&el.getAttribute("aria-hidden")!=="true");
  const initial=(initialSelector?dialog.querySelector<HTMLElement>(initialSelector):null)||focusables()[0]||dialog;
  initial.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();return;}
   if(event.key!=="Tab")return;
   const items=focusables();
   if(!items.length){event.preventDefault();dialog.focus();return;}
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener("keydown",onKeyDown);
  return()=>{window.removeEventListener("keydown",onKeyDown);previous?.focus();};
 },[initialSelector,onClose]);
 return ref;
}
