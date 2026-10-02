import animeData from "./anime.json";
import covers from "./generatedCovers.json";
import {franchiseOf,mediaTypeOf} from "./catalog";
import type {Anime} from "./types";

const coverMap=covers as Record<string,string>;

export const repoAnime=animeData as Anime[];
export const statusTabs=[
  {label:"All",value:"All"},
  {label:"Watching",value:"Watching"},
  {label:"Completed",value:"Completed"},
  {label:"Backlog",value:"Backlog"}
];

export const splitTags=(value:string)=>String(value||"").split(/[,/;|]+/).map(x=>x.trim()).filter(Boolean);
export const stars=(score:number|null)=>score?"★".repeat(score===6?5:score):"—";

const normalizeAnime=(anime:Anime):Anime=>({
  ...anime,
  status:["Planned","Paused"].includes(anime.status)?"Backlog":anime.status,
  genres:anime.genres?.length?anime.genres:splitTags(anime.genre),
  studios:anime.studios?.length?anime.studios:splitTags(anime.studio),
  mediaType:anime.mediaType||mediaTypeOf(anime),
  franchiseName:anime.franchiseName||franchiseOf(anime.title),
  latestEpisodeYear:(anime as Anime & {latestSeasonYear?:number|null}).latestEpisodeYear??(anime as Anime & {latestSeasonYear?:number|null}).latestSeasonYear??null,
  image:coverMap[anime.title]||anime.image||""
});

export const initialAnime=()=>repoAnime.map(normalizeAnime);
