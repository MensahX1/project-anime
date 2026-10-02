import {describe,it,expect} from "vitest";
import {applyPending,mergeChanges,remainingChanges,stageChange} from "./pendingChanges";
import type {Anime} from "./types";
const anime=(id:string):Anime=>({id,title:id,status:"Backlog",score:null,episodes:null,genre:"",studio:"",year:null,latestEpisodeYear:null,synopsis:"",image:""});
describe("pending library edits",()=>{
 it("restores handed-off edits without overwriting newer pending changes",()=>{
  const a=anime("a"),b=anime("b");
  const sent=stageChange([],{action:"upsert",anime:{...a,status:"Watching"}},[a,b]);
  const pending=stageChange([],{action:"upsert",anime:{...a,status:"Completed"}},applyPending([a,b],sent));
  const restored=mergeChanges(sent,pending);
  expect(restored).toHaveLength(1);expect(applyPending([a,b],restored)[0].status).toBe("Completed");
  expect(remainingChanges(restored,[{...a,status:"Completed"},b])).toEqual([]);
 });

 it("keeps only the latest edit per title and previews several titles",()=>{
  const baseline=[anime("a"),anime("b")];
  let changes=stageChange([],{action:"upsert",anime:{...baseline[0],status:"Watching"}},baseline);
  changes=stageChange(changes,{action:"upsert",anime:{...baseline[0],status:"Completed"}},baseline);
  changes=stageChange(changes,{action:"upsert",anime:{...baseline[1],score:4}},baseline);
  expect(changes).toHaveLength(2);expect(applyPending(baseline,changes).map(a=>[a.status,a.score])).toEqual([["Completed",null],["Backlog",4]]);
 });
 it("cancels edits reverted to baseline and newly added titles deleted before saving",()=>{
  const a=anime("a"),baseline=[a];
  const changed=stageChange([],{action:"upsert",anime:{...a,score:5}},baseline);
  expect(stageChange(changed,{action:"upsert",anime:a},baseline)).toEqual([]);
  const added=stageChange([],{action:"upsert",anime:anime("b")},baseline);
  expect(stageChange(added,{action:"delete",id:"b",title:"b"},baseline)).toEqual([]);
 });
 it("retains unpublished drafts and removes only changes reflected in published data",()=>{
  const a=anime("a"),b=anime("b"),edited={...a,status:"Completed"};
  const changes=stageChange(stageChange([],{action:"upsert",anime:edited},[a,b]),{action:"delete",id:"b",title:"b"},[a,b]);
  expect(remainingChanges(changes,[a,b])).toHaveLength(2);
  expect(remainingChanges(changes,[{...edited,lastUpdated:"new"}])).toEqual([]);
 });
});
