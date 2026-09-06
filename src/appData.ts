import animeData from "./anime.json";
import suggestionsData from "./aiSuggestions.json";
import covers from "./generatedCovers.json";
import type {Anime} from "./types";

const NEW_WINDOW_MS=14*24*60*60*1000;
const coverMap=covers as Record<string,string>;

export const repoAnime=animeData as Anime[];
export const aiSuggestions=suggestionsData as Anime[];
export const statusTabs=[
  {label:"All",value:"All"},
  {label:"Done",value:"Completed"},
  {label:"Paused",value:"Paused"},
  {label:"Plan",value:"Planned"},
  {label:"AI Picks",value:"AI Suggested"}
];

export const splitTags=(value:string)=>String(value||"").split(/[,/;|]+/).map(x=>x.trim()).filter(Boolean);
export const stars=(score:number|null)=>score?"★".repeat(score):"—";

const withCover=(anime:Anime):Anime=>({
  ...anime,
  latestEpisodeYear:(anime as Anime & {latestSeasonYear?:number|null}).latestEpisodeYear??(anime as Anime & {latestSeasonYear?:number|null}).latestSeasonYear??null,
  image:coverMap[anime.title]||anime.image||""
});

export const initialAnime=()=>[...repoAnime,...aiSuggestions].map(withCover);

export const isRecentlyUpdated=(anime:Anime)=>{
  if(!anime.metadataUpdatedAt)return false;
  const timestamp=Date.parse(anime.metadataUpdatedAt);
  return Number.isFinite(timestamp)&&Date.now()-timestamp>=0&&Date.now()-timestamp<=NEW_WINDOW_MS;
};
