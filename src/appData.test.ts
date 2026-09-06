import {describe,expect,it} from "vitest";
import {initialAnime,repoAnime,statusTabs} from "./appData";

describe("app data",()=>{
  it("loads only canonical library titles",()=>{
    const items=initialAnime();
    expect(items).toHaveLength(repoAnime.length);
    expect(items.every(anime=>anime.status!=="AI Suggested")).toBe(true);
  });

  it("does not expose the removed AI Picks tab",()=>{
    expect(statusTabs.some(tab=>tab.value==="AI Suggested")).toBe(false);
  });
});
