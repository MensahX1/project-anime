import {describe,expect,it} from "vitest";
import {franchiseOf,mediaTypeOf,searchableText,type CatalogAnime} from "./catalog";

const anime=(overrides:Partial<CatalogAnime>):CatalogAnime=>({id:"x",title:"Example",status:"Completed",score:null,genre:"Drama",studio:"Studio",year:2020,...overrides});

describe("catalog helpers",()=>{
  it("groups known franchise titles",()=>{
    expect(franchiseOf("Jujutsu Kaisen 0")).toBe("Jujutsu Kaisen");
    expect(franchiseOf("Psycho-Pass: Sinners of the System")).toBe("Psycho-Pass");
  });

  it("classifies movies and specials without changing normal series",()=>{
    expect(mediaTypeOf(anime({title:"Jujutsu Kaisen 0"}))).toBe("Movie");
    expect(mediaTypeOf(anime({title:"Psycho-Pass: Sinners of the System"}))).toBe("OVA / Special");
    expect(mediaTypeOf(anime({title:"Death Note"}))).toBe("Series");
  });

  it("includes aliases in searchable text",()=>{
    expect(searchableText(anime({title:"Classroom of the Elite"}))).toContain("cote");
    expect(searchableText(anime({title:"Attack on Titan"}))).toContain("aot");
  });
});
