import type {Anime} from "./types";

const REPO="MensahX1/project-anime";
export const EDIT_KEY="le-anime-edit-mode";

export function issueUrl(title:string,payload:unknown){
  const body=`<!-- LE_ANIME_ADMIN_V1 -->\nThis request was created by The Watchlist. Only the authorized GitHub account can apply it.\n\n\`\`\`json\n${JSON.stringify(payload,null,2)}\n\`\`\``;
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`[anime-admin] ${title}`)}&body=${encodeURIComponent(body)}`;
}

export function newAnime():Anime{
  const year=new Date().getFullYear();
  return {id:`anime-${crypto.randomUUID()}`,title:"",status:"Planned",episodes:null,score:null,genre:"",studio:"",year,latestEpisodeYear:year,synopsis:"",image:""};
}

export function exportLibrary(items:Anime[]){
  const blob=new Blob([JSON.stringify(items.map(a=>({...a,image:""})),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download="the-watchlist-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
