export type AnimeStatus=""|"Completed"|"Paused"|"Planned"|"AI Suggested";

export type Anime={
  id:string;
  title:string;
  status:AnimeStatus|string;
  episodes:number|null;
  score:number|null;
  genre:string;
  studio:string;
  year:number|null;
  latestEpisodeYear:number|null;
  synopsis:string;
  image:string;
  metadataSource?:string;
  metadataUpdatedAt?:string;
};

export type SortKey="score-desc"|"score-asc"|"title-asc"|"year-desc"|"year-asc"|"studio-asc";
