import type {Anime} from "./types";

export const DRAFT_KEY="le-anime-pending-changes-v1";
export const SENT_KEY="le-anime-handed-off-changes-v1";
export type PendingChange={action:"upsert";anime:Anime}|{action:"delete";id:string;title:string};
export const changeId=(change:PendingChange)=>change.action==="upsert"?change.anime.id:change.id;
const editableKeys=["title","status","episodes","score","genre","studio","year","latestEpisodeYear","synopsis"] as const;
export const sameAnime=(a:Anime,b:Anime)=>editableKeys.every(key=>a[key]===b[key]);
export function stageChange(changes:PendingChange[],change:PendingChange,baseline:Anime[]):PendingChange[]{
 const id=changeId(change),original=baseline.find(a=>a.id===id);
 const rest=changes.filter(c=>changeId(c)!==id);
 if(change.action==="delete"&&!original)return rest;
 if(change.action==="upsert"&&original&&sameAnime(original,change.anime))return rest;
 return [...rest,change];
}
export function remainingChanges(changes:PendingChange[],baseline:Anime[]){
 return changes.filter(c=>{const original=baseline.find(a=>a.id===changeId(c));return c.action==="delete"?Boolean(original):!original||!sameAnime(original,c.anime)});
}
export function applyPending(baseline:Anime[],changes:PendingChange[]){
 const items=baseline.map(a=>({...a}));
 for(const c of changes){const i=items.findIndex(a=>a.id===changeId(c));if(c.action==="delete"){if(i>=0)items.splice(i,1)}else if(i>=0)items[i]=c.anime;else items.push(c.anime)}
 return items;
}
export function readPending(baseline:Anime[],key=DRAFT_KEY):PendingChange[]{
 try{const value=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(value))return [];const remaining=remainingChanges(value.filter(c=>c&&((c.action==="delete"&&typeof c.id==="string")||(c.action==="upsert"&&c.anime&&typeof c.anime.id==="string"&&typeof c.anime.title==="string"))),baseline);localStorage.setItem(key,JSON.stringify(remaining));return remaining}catch{return []}
}

export function mergeChanges(older:PendingChange[],newer:PendingChange[]):PendingChange[]{const changes=new Map(older.map(c=>[changeId(c),c]));for(const c of newer)changes.set(changeId(c),c);return [...changes.values()]}
