import type {SortKey} from "../types";

type Props={
  typeFilter:string;setTypeFilter:(v:string)=>void;
  franchiseFilter:string;setFranchiseFilter:(v:string)=>void;franchises:string[];
  genreFilters:string[];toggleGenre:(v:string)=>void;genres:string[];
  studioFilter:string;setStudioFilter:(v:string)=>void;studios:string[];
  scoreFilter:string;setScoreFilter:(v:string)=>void;
  decadeFilter:string;setDecadeFilter:(v:string)=>void;decades:number[];
  quickFilter:string;setQuickFilter:(v:string)=>void;
  sort:SortKey;setSort:(v:SortKey)=>void;
  shownCount:number;totalCount:number;hasFilters:boolean;onReset:()=>void;
};

export default function FilterPanel(p:Props){
  return <section className="filterPanel">
    <div className="quickFilters" aria-label="Quick filters">
      {["All","Unrated","Recent"].map(x=><button key={x} className={p.quickFilter===x?"active":""} onClick={()=>p.setQuickFilter(x)}>{x}</button>)}
    </div>
    <div className="filterGrid">
      <label><span>Type</span><select value={p.typeFilter} onChange={e=>p.setTypeFilter(e.target.value)}><option>All</option><option>Series</option><option>Movie</option><option>OVA / Special</option></select></label>
      <label><span>Franchise</span><select value={p.franchiseFilter} onChange={e=>p.setFranchiseFilter(e.target.value)}><option>All</option>{p.franchises.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Studio</span><select value={p.studioFilter} onChange={e=>p.setStudioFilter(e.target.value)}><option value="All">All studios</option>{p.studios.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Rating</span><select value={p.scoreFilter} onChange={e=>p.setScoreFilter(e.target.value)}><option value="All">All ratings</option><option value="4+">4★ and up</option><option value="3+">3★ and up</option>{[5,4,3,2,1].map(x=><option key={x} value={x}>Exactly {x} ★</option>)}<option value="Unrated">Unrated</option></select></label>
      <label><span>Decade</span><select value={p.decadeFilter} onChange={e=>p.setDecadeFilter(e.target.value)}><option value="All">All years</option>{p.decades.map(x=><option key={x} value={x}>{x}s</option>)}</select></label>
      <label><span>Sort</span><select value={p.sort} onChange={e=>p.setSort(e.target.value as SortKey)}><option value="score-desc">Rating: high to low</option><option value="score-asc">Rating: low to high</option><option value="title-asc">Title: A to Z</option><option value="year-desc">Latest episode: newest</option><option value="year-asc">Original year: oldest</option><option value="studio-asc">Studio: A to Z</option></select></label>
    </div>
    <div className="genreChips" aria-label="Genre filters">{p.genres.map(x=><button key={x} className={p.genreFilters.includes(x)?"active":""} onClick={()=>p.toggleGenre(x)}>{x}</button>)}</div>
    <div className="filterSummary"><span>{p.shownCount} of {p.totalCount} titles</span>{p.hasFilters&&<button onClick={p.onReset}>Reset</button>}</div>
  </section>;
}
