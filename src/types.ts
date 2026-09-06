export type Anime={
  id:string;
  title:string;
  status:string;
  episodes:number|null;
  score:number|null;
  genre:string;
  studio:string;
  year:number|null;
  latestEpisodeYear:number|null;
  synopsis:string;
  image:string;
  genres?:string[];
  studios?:string[];
  mediaType?:"Series"|"Movie"|"OVA / Special";
  franchiseName?:string;
  metadataSource?:string;
  metadataUpdatedAt?:string;
};

export type AnimeCatalogEntry={
  title:string;
  synonyms:string[];
  mediaType:"Series"|"Movie"|"OVA / Special";
  episodes:number|null;
  year:number|null;
  genres:string[];
  studios:string[];
  picture:string;
};

export type SortKey="score-desc"|"score-asc"|"title-asc"|"year-desc"|"year-asc"|"studio-asc";
