import {describe,expect,it} from "vitest";
import {aliasesFor} from "./catalog";
import {createSearchDocument,normalizeSearch,prepareSearchQuery,rankSearch,searchScore} from "./search";

const entry=(title:string,aliases:string[]=[],metadata:string[]=[])=>({item:title,document:createSearchDocument(title,aliases,metadata)});
const score=(title:string,query:string)=>searchScore(createSearchDocument(title),prepareSearchQuery(query));

describe("relevant anime search",()=>{
 it("matches omitted words, reordered words, accents and punctuation",()=>{
  expect(score("Attack on Titan","attack titan")).toBeGreaterThan(0);
  expect(score("Attack on Titan","titan attack")).toBeGreaterThan(0);
  expect(score("Pokémon","pokemon")).toBeGreaterThan(0);
  expect(score("Steins;Gate","steins gate")).toBeGreaterThan(0);
  expect(score("DAN DA DAN","dandadan")).toBeGreaterThan(0);
  expect(normalizeSearch("進撃の巨人")).toBe("進撃の巨人");
 });
 it("accepts small title typos and transpositions but keeps short terms literal",()=>{
  expect(score("Naruto","naroto")).toBeGreaterThan(0);
  expect(score("Naruto","naurto")).toBeGreaterThan(0);
  expect(score("Naruto","zzzzzz")).toBe(0);
  expect(score("Naruto","nro")).toBe(0);
  expect(score("Jujutsu Kaisen 0","kaisen 1")).toBe(0);
 });
 it("ranks titles above metadata and exact hits above fuzzy hits",()=>{
  expect(rankSearch([entry("Elsewhere",[],["Naruto Studio"]),entry("Boruto"),entry("Naruto Shippuden"),entry("Naruto")],"naruto")).toEqual(["Naruto","Naruto Shippuden","Elsewhere"]);
  expect(rankSearch([entry("Naroto"),entry("Naruto")],"naruto")).toEqual(["Naruto","Naroto"]);
 });
 it("supports English/Japanese synonyms and abbreviations on sequels",()=>{
  const title="Jujutsu Kaisen 2nd Season";
  expect(rankSearch([entry(title,aliasesFor(title))],"jjk")).toEqual([title]);
  expect(rankSearch([entry("Shingeki no Kyojin",["Attack on Titan",...aliasesFor("Shingeki no Kyojin")])],"aot")).toEqual(["Shingeki no Kyojin"]);
 });
 it("preserves genre/studio searches and combinations without fuzzy metadata noise",()=>{
  const doc=createSearchDocument("Naruto",[],["Action","Studio Pierrot"]);
  expect(searchScore(doc,prepareSearchQuery("action pierrot"))).toBe(200);
  expect(searchScore(doc,prepareSearchQuery("naruto action"))).toBe(200);
  expect(searchScore(doc,prepareSearchQuery("actoin"))).toBe(0);
 });
 it("ranks before applying the result limit and handles blank input",()=>{
  const entries=Array.from({length:30},(_,i)=>entry(`Naruto Side Story ${i}`));
  entries.push(entry("Naruto"));
  const result=rankSearch(entries,"naruto",24);
  expect(result).toHaveLength(24);
  expect(result[0]).toBe("Naruto");
  expect(rankSearch(entries,"   ")).toEqual([]);
 });
});
