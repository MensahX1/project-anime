import {useMemo,useState} from "react";
import {franchiseOf,mediaTypeOf,searchableText} from "../catalog";
import {splitTags} from "../appData";
import type {Anime,SortKey} from "../types";

export function useCatalogFilters(items:Anime[]){
 const[q,setQ]=useState("");
 const[filter,setFilter]=useState("All");
 const[genreFilter,setGenreFilter]=useState("All");
 const[studioFilter,setStudioFilter]=useState("All");
 const[scoreFilter,setScoreFilter]=useState("All");
 const[typeFilter,setTypeFilter]=useState("All");
 const[franchiseFilter,setFranchiseFilter]=useState("All");
 const[sort,setSort]=useState<SortKey>("score-desc");

 const genres=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.genre)))).sort(),[items]);
 const studios=useMemo(()=>Array.from(new Set(items.flatMap(a=>splitTags(a.studio)))).sort(),[items]);
 const franchises=useMemo(()=>Array.from(new Set(items.map(a=>franchiseOf(a.title)))).filter(name=>items.filter(a=>franchiseOf(a.title)===name).length>1).sort(),[items]);

 const shown=useMemo(()=>items.filter(a=>{
  const query=q.trim().toLowerCase();
  return (filter==="All"||a.status===filter)
   &&(!query||searchableText(a).includes(query))
   &&(genreFilter==="All"||splitTags(a.genre).includes(genreFilter))
   &&(studioFilter==="All"||splitTags(a.studio).includes(studioFilter))
   &&(scoreFilter==="All"||(scoreFilter==="Unrated"?a.score==null:a.score===+scoreFilter))
   &&(typeFilter==="All"||mediaTypeOf(a)===typeFilter)
   &&(franchiseFilter==="All"||franchiseOf(a.title)===franchiseFilter);
 }).sort((a,b)=>sort==="score-desc"?(b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title)
  :sort==="score-asc"?(a.score??99)-(b.score??99)||a.title.localeCompare(b.title)
  :sort==="title-asc"?a.title.localeCompare(b.title)
  :sort==="year-desc"?(b.latestEpisodeYear??b.year??0)-(a.latestEpisodeYear??a.year??0)||a.title.localeCompare(b.title)
  :sort==="year-asc"?(a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title)
  :(a.studio||"zzz").localeCompare(b.studio||"zzz")||a.title.localeCompare(b.title)),[items,q,filter,genreFilter,studioFilter,scoreFilter,typeFilter,franchiseFilter,sort]);

 const hasFilters=Boolean(q||filter!=="All"||genreFilter!=="All"||studioFilter!=="All"||scoreFilter!=="All"||typeFilter!=="All"||franchiseFilter!=="All"||sort!=="score-desc");
 const reset=()=>{setQ("");setFilter("All");setGenreFilter("All");setStudioFilter("All");setScoreFilter("All");setTypeFilter("All");setFranchiseFilter("All");setSort("score-desc")};

 return {q,setQ,filter,setFilter,genreFilter,setGenreFilter,studioFilter,setStudioFilter,scoreFilter,setScoreFilter,typeFilter,setTypeFilter,franchiseFilter,setFranchiseFilter,sort,setSort,genres,studios,franchises,shown,hasFilters,reset};
}
