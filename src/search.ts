/** Shared, dependency-free relevance matching for the library and add catalog. */
export const normalizeSearch=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();

type SearchText={text:string;compact:string;words:string[]};
export type SearchDocument={title:SearchText;aliases:SearchText[];metadata:SearchText};
export type SearchQuery=SearchText;
const prepare=(value:string):SearchText=>{const text=normalizeSearch(value);return {text,compact:text.replace(/ /g,""),words:text.split(" ").filter(Boolean)}};
export const prepareSearchQuery=prepare;
export function createSearchDocument(title:string,aliases:string[]=[],metadata:string[]=[]):SearchDocument{
 return {title:prepare(title),aliases:Array.from(new Set(aliases)).map(prepare),metadata:prepare([title,...aliases,...metadata].join(" "))};
}

/** Bounded edit distance, including adjacent transpositions, for title words only. */
function editDistance(a:string,b:string,limit:number){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let previous=Array.from({length:b.length+1},(_,i)=>i),older=previous;
 for(let i=1;i<=a.length;i++){
  const row=[i];let minimum=i;
  for(let j=1;j<=b.length;j++){
   row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);
   minimum=Math.min(minimum,row[j]);
  }
  if(minimum>limit)return limit+1;
  older=previous;previous=row;
 }
 return previous[b.length];
}

function literalScore(text:SearchText,query:SearchQuery){
 if(!text.text)return 0;
 const extra=Math.min(80,Math.max(0,text.text.length-query.text.length));
 if(text.text===query.text)return 1000;
 if(text.compact===query.compact)return 990;
 if(text.text.startsWith(query.text))return 900-extra;
 if(text.text.includes(query.text)||text.compact.includes(query.compact))return 800-extra;
 if(query.words.every(word=>text.words.some(term=>term===word||term.startsWith(word))))return 700-extra;
 return 0;
}

export function searchScore(doc:SearchDocument,query:SearchQuery,allowTypos=true){
 if(!query.text)return 1;
 let score=literalScore(doc.title,query);
 for(const alias of doc.aliases)score=Math.max(score,Math.max(0,literalScore(alias,query)-20));
 if(score)return score;
 // Metadata searches remain literal, so typos do not create unrelated genre/studio hits.
 if(literalScore(doc.metadata,query))return 200;
 if(!allowTypos)return 0;
 for(const text of [doc.title,...doc.aliases]){
  let edits=0;
  const matches=query.words.every(word=>{
   if(text.words.some(term=>term===word||term.startsWith(word)))return true;
   // Short abbreviations and numbers must match literally.
   if(word.length<4||/^\d+$/.test(word))return false;
   const limit=word.length>=8?2:1;
   let best=limit+1;
   for(const term of text.words){if(Math.abs(term.length-word.length)<=limit)best=Math.min(best,editDistance(word,term,limit))}
   if(best>limit)return false;
   edits+=best;return true;
  });
  if(matches)score=Math.max(score,400-edits*30-Math.min(80,text.text.length));
 }
 return score;
}

/** Rank before limiting results. Skip expensive fuzzy matching if enough literal hits exist. */
export function rankSearch<T>(entries:{item:T;document:SearchDocument}[],query:string,limit=Infinity):T[]{
 const prepared=prepare(query);
 if(!prepared.text)return [];
 const matches=entries.map(entry=>({...entry,score:searchScore(entry.document,prepared,false)}));
 const literalCount=matches.filter(entry=>entry.score>0).length;
 if(literalCount<limit)for(const entry of matches)if(!entry.score)entry.score=searchScore(entry.document,prepared);
 return matches.filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score||a.document.title.text.localeCompare(b.document.title.text)).slice(0,limit).map(entry=>entry.item);
}
