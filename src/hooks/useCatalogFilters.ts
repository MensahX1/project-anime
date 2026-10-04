import {useMemo,useState} from "react";
import {aliasesFor,franchiseOf,mediaTypeOf} from "../catalog";
import {createSearchDocument,prepareSearchQuery,searchScore} from "../search";
import {splitTags} from "../appData";
import type {Anime,SortKey} from "../types";

const tagsOf=(anime:Anime)=>anime.genres?.length?anime.genres:splitTags(anime.genre);
const studiosOf=(anime:Anime)=>anime.studios?.length?anime.studios:splitTags(anime.studio);

export function useCatalogFilters(items:Anime[]){
 const[q,setQ]=useState("");
 const[filter,setFilter]=useState("All");
 const[genreFilters,setGenreFilters]=useState<string[]>([]);
 const[studioFilter,setStudioFilter]=useState("All");
 const[scoreFilters,setScoreFilters]=useState<string[]>([]);
 const[typeFilter,setTypeFilter]=useState("All");
 const[franchiseFilter,setFranchiseFilter]=useState("All");
 const[decadeFilter,setDecadeFilter]=useState("All");
 const[sort,setSort]=useState<SortKey>("score-desc");

 const genres=useMemo(()=>Array.from(new Set(items.flatMap(tagsOf))).sort(),[items]);
 const studios=useMemo(()=>Array.from(new Set(items.flatMap(studiosOf))).sort(),[items]);
 const franchises=useMemo(()=>Array.from(new Set(items.map(a=>a.franchiseName||franchiseOf(a.title)))).filter(name=>items.filter(a=>(a.franchiseName||franchiseOf(a.title))===name).length>1).sort(),[items]);
 const decades=useMemo(()=>Array.from(new Set(items.map(a=>a.year?Math.floor(a.year/10)*10:null).filter((x):x is number=>x!=null))).sort((a,b)=>b-a),[items]);

 const documents=useMemo(()=>new Map(items.map(a=>[a,createSearchDocument(a.title,aliasesFor(a.title),[...(a.genres||[]),a.genre,...(a.studios||[]),a.studio,a.franchiseName||franchiseOf(a.title)])])),[items]);
 const query=useMemo(()=>prepareSearchQuery(q),[q]);
 const relevance=useMemo(()=>new Map(items.map(a=>[a,searchScore(documents.get(a)!,query)])),[items,documents,query]);
 const shown=useMemo(()=>items.filter(a=>{
  const animeGenres=tagsOf(a);
  const year=a.year||a.latestEpisodeYear;
  return (filter==="All"||a.status===filter)
   &&(!query.text||(relevance.get(a)||0)>0)
   &&(!genreFilters.length||genreFilters.every(g=>animeGenres.includes(g)))
   &&(studioFilter==="All"||studiosOf(a).includes(studioFilter))
   &&(!scoreFilters.length||scoreFilters.includes(a.score==null?"Unrated":String(a.score)))
   &&(typeFilter==="All"||(a.mediaType||mediaTypeOf(a))===typeFilter)
   &&(franchiseFilter==="All"||(a.franchiseName||franchiseOf(a.title))===franchiseFilter)
   &&(decadeFilter==="All"||(year!=null&&Math.floor(year/10)*10===+decadeFilter));
 }).sort((a,b)=>(query.text?(relevance.get(b)||0)-(relevance.get(a)||0):0)||(sort==="score-desc"?(b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title)
  :sort==="score-asc"?(a.score??99)-(b.score??99)||a.title.localeCompare(b.title)
  :sort==="title-asc"?a.title.localeCompare(b.title)
  :sort==="year-desc"?(b.latestEpisodeYear??b.year??0)-(a.latestEpisodeYear??a.year??0)||a.title.localeCompare(b.title)
  :sort==="year-asc"?(a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title)
  :(a.studios?.[0]||a.studio||"zzz").localeCompare(b.studios?.[0]||b.studio||"zzz")||a.title.localeCompare(b.title))),[items,query,relevance,filter,genreFilters,studioFilter,scoreFilters,typeFilter,franchiseFilter,decadeFilter,sort]);

 const toggleScore=(score:string)=>setScoreFilters(current=>score==="All"?[]:current.includes(score)?current.filter(x=>x!==score):[...current,score]);
 const toggleGenre=(genre:string)=>setGenreFilters(current=>current.includes(genre)?current.filter(x=>x!==genre):[...current,genre]);
 const hasFilters=Boolean(q||filter!=="All"||genreFilters.length||studioFilter!=="All"||scoreFilters.length||typeFilter!=="All"||franchiseFilter!=="All"||decadeFilter!=="All"||sort!=="score-desc");
 const reset=()=>{setQ("");setFilter("All");setGenreFilters([]);setStudioFilter("All");setScoreFilters([]);setTypeFilter("All");setFranchiseFilter("All");setDecadeFilter("All");setSort("score-desc")};

 return {q,setQ,filter,setFilter,genreFilters,toggleGenre,studioFilter,setStudioFilter,scoreFilters,toggleScore,typeFilter,setTypeFilter,franchiseFilter,setFranchiseFilter,decadeFilter,setDecadeFilter,sort,setSort,genres,studios,franchises,decades,shown,hasFilters,reset};
}
