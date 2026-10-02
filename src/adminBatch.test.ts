import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {describe,it,expect} from "vitest";
const workflow=readFileSync(new URL("../.github/workflows/anime-admin-issues.yml",import.meta.url),"utf8");
const script=workflow.split("node --input-type=module <<'NODE'\n")[1].split("          NODE")[0].replace(/^          /gm,"");
const a={id:"a",title:"A",status:"Backlog",score:null,episodes:null,genre:"",studio:"",year:null,latestEpisodeYear:null,synopsis:"",image:"",lastUpdated:"old"};
function run(changes:unknown[]){const dir=mkdtempSync(join(tmpdir(),"anime-batch-"));try{mkdirSync(join(dir,"src"));const path=join(dir,"src/anime.json");writeFileSync(path,JSON.stringify([a,{...a,id:"b",title:"B"}]));const result=spawnSync(process.execPath,["--input-type=module"],{cwd:dir,input:script,encoding:"utf8",env:{...process.env,ISSUE_BODY:'<!-- LE_ANIME_ADMIN_V1 -->\n```json\n'+JSON.stringify({action:"batch",changes})+'\n```'}});return {status:result.status,items:JSON.parse(readFileSync(path,"utf8")),error:result.stderr}}finally{rmSync(dir,{recursive:true,force:true})}}
describe("GitHub batch application",()=>{
 it("applies edits, additions and deletions in one request with completion timestamps",()=>{const r=run([{action:"upsert",anime:{...a,status:"Completed"}},{action:"delete",id:"b"},{action:"upsert",anime:{...a,id:"c",title:"C"}}]);expect(r.status,r.error).toBe(0);expect(r.items.map((x:any)=>x.id)).toEqual(["a","c"]);expect(r.items[0].lastUpdated).not.toBe("old");expect(r.items[1].lastUpdated).toBeUndefined()});
 it("writes nothing when a later edit is invalid",()=>{const r=run([{action:"upsert",anime:{...a,status:"Completed"}},{action:"upsert",anime:{...a,id:"c",title:"C",score:8}}]);expect(r.status).not.toBe(0);expect(r.items).toHaveLength(2);expect(r.items[0].status).toBe("Backlog")});
});
