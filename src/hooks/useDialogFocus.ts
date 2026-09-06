import {useEffect,useRef} from "react";

const selector='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus(onClose:()=>void){
 const ref=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(el=>!el.hasAttribute("disabled")&&el.getAttribute("aria-hidden")!=="true");
  (focusables()[0]||dialog).focus();
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
 },[onClose]);
 return ref;
}
