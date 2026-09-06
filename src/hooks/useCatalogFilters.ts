import {useMemo,useState} from "react";
import {franchiseOf,mediaTypeOf,searchableText} from "../catalog";
import {isRecentlyUpdated,splitTags} from "../appData";
import type {Anime,SortKey} from "../types";

const tagsOf=(anime:Anime)=>anime.genres?.length?anime.genres:splitTags(anime.genre);
const studiosOf=(anime:Anime)=>anime.studios?.length?anime.studios:splitTags(anime.studio);

export function useCatalogFilters(items:Anime[]){
 const[q,setQ]=useState("");
 const[filter,setFilter]=useState("All");
 const[genreFilters,setGenreFilters]=useState<string[]>([]);
 const[studioFilter,setStudioFilter]=useState("All");
 const[scoreFilter,setScoreFilter]=useState("All");
 const[typeFilter,setTypeFilter]=useState("All");
 const[franchiseFilter,setFranchiseFilter]=useState("All");
 const[decadeFilter,setDecadeFilter]=useState("All");
 const[quickFilter,setQuickFilter]=useState("All");
 const[sort,setSort]=useState<SortKey>("score-desc");

 const genres=useMemo(()=>Array.from(new Set(items.flatMap(tagsOf))).sort(),[items]);
 const studios=useMemo(()=>Array.from(new Set(items.flatMap(studiosOf))).sort(),[items]);
 const franchises=useMemo(()=>Array.from(new Set(items.map(a=>a.franchiseName||franchiseOf(a.title)))).filter(name=>items.filter(a=>(a.franchiseName||franchiseOf(a.title))===name).length>1).sort(),[items]);
 const decades=useMemo(()=>Array.from(new Set(items.map(a=>a.year?Math.floor(a.year/10)*10:null).filter((x):x is number=>x!=null))).sort((a,b)=>b-a),[items]);

 const shown=useMemo(()=>items.filter(a=>{
  const query=q.trim().toLowerCase();
  const animeGenres=tagsOf(a);
  const year=a.year||a.latestEpisodeYear;
  return (filter==="All"||a.status===filter)
   &&(!query||searchableText(a).includes(query))
   &&(!genreFilters.length||genreFilters.every(g=>animeGenres.includes(g)))
   &&(studioFilter==="All"||studiosOf(a).includes(studioFilter))
   &&(scoreFilter==="All"||(scoreFilter==="Unrated"?a.score==null:scoreFilter==="4+"?(a.score??0)>=4:scoreFilter==="3+"?(a.score??0)>=3:a.score===+scoreFilter))
   &&(typeFilter==="All"||(a.mediaType||mediaTypeOf(a))===typeFilter)
   &&(franchiseFilter==="All"||(a.franchiseName||franchiseOf(a.title))===franchiseFilter)
   &&(decadeFilter==="All"||(year!=null&&Math.floor(year/10)*10===+decadeFilter))
   &&(quickFilter==="All"||(quickFilter==="Unrated"?a.score==null:quickFilter==="Recent"?isRecentlyUpdated(a):true));
 }).sort((a,b)=>sort==="score-desc"?(b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title)
  :sort==="score-asc"?(a.score??99)-(b.score??99)||a.title.localeCompare(b.title)
  :sort==="title-asc"?a.title.localeCompare(b.title)
  :sort==="year-desc"?(b.latestEpisodeYear??b.year??0)-(a.latestEpisodeYear??a.year??0)||a.title.localeCompare(b.title)
  :sort==="year-asc"?(a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title)
  :(a.studios?.[0]||a.studio||"zzz").localeCompare(b.studios?.[0]||b.studio||"zzz")||a.title.localeCompare(b.title)),[items,q,filter,genreFilters,studioFilter,scoreFilter,typeFilter,franchiseFilter,decadeFilter,quickFilter,sort]);

 const toggleGenre=(genre:string)=>setGenreFilters(current=>current.includes(genre)?current.filter(x=>x!==genre):[...current,genre]);
 const hasFilters=Boolean(q||filter!=="All"||genreFilters.length||studioFilter!=="All"||scoreFilter!=="All"||typeFilter!=="All"||franchiseFilter!=="All"||decadeFilter!=="All"||quickFilter!=="All"||sort!=="score-desc");
 const reset=()=>{setQ("");setFilter("All");setGenreFilters([]);setStudioFilter("All");setScoreFilter("All");setTypeFilter("All");setFranchiseFilter("All");setDecadeFilter("All");setQuickFilter("All");setSort("score-desc")};

 return {q,setQ,filter,setFilter,genreFilters,toggleGenre,studioFilter,setStudioFilter,scoreFilter,setScoreFilter,typeFilter,setTypeFilter,franchiseFilter,setFranchiseFilter,decadeFilter,setDecadeFilter,quickFilter,setQuickFilter,sort,setSort,genres,studios,franchises,decades,shown,hasFilters,reset};
}
