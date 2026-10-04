import {normalizeSearch} from "./search";
export type CatalogAnime={id:string;title:string;status:string;score:number|null;genre:string;studio:string;year:number|null;genres?:string[];studios?:string[];mediaType?:"Series"|"Movie"|"OVA / Special";franchiseName?:string};

const rules:[RegExp,string][]=[
  [/^dragon ball/i,"Dragon Ball"],[/^pokémon|^pokemon/i,"Pokémon"],[/^sword art online/i,"Sword Art Online"],[/^my hero academia/i,"My Hero Academia"],[/^jujutsu kaisen/i,"Jujutsu Kaisen"],[/^inuyasha/i,"Inuyasha"],[/^yu-gi-oh/i,"Yu-Gi-Oh!"],[/^bakugan/i,"Bakugan"],[/^blue lock/i,"Blue Lock"],[/^psycho-pass/i,"Psycho-Pass"],[/^classroom of the elite/i,"Classroom of the Elite"],[/^the quintessential quintuplets/i,"The Quintessential Quintuplets"],[/^fairy tail/i,"Fairy Tail"],[/^hunter.{0,2}hunter/i,"Hunter × Hunter"],[/^fruits basket/i,"Fruits Basket"],[/^steins.?gate/i,"Steins;Gate"],[/^black lagoon/i,"Black Lagoon"],[/^nier/i,"NieR"],[/^rosario/i,"Rosario + Vampire"],[/^the world god only knows/i,"The World God Only Knows"]
];
export const franchiseOf=(title:string)=>rules.find(([r])=>r.test(title))?.[1]||title;

export const mediaTypeOf=(a:CatalogAnime)=>{
  if(a.mediaType)return a.mediaType;
  const t=a.title.toLowerCase();
  if(/movie|film|ordinal scale|progressive:|episode nagi|jujutsu kaisen 0|dark side of dimensions|dragon ball super: broly/.test(t)) return "Movie";
  if(/ova|special|sinners of the system/.test(t)) return "OVA / Special";
  return "Series";
};

const aliases:Record<string,string[]>={
  "Attack on Titan":["aot","shingeki no kyojin"],
  "Demon Slayer":["kimetsu no yaiba"],"Death Note":["desu noto"],
  "The Rising of the Shield Hero":["tate no yuusha no nariagari"],
  "Assassination Classroom":["ansatsu kyoushitsu"],"One Punch Man":["opm"],
  "Re:ZERO":["re zero","rezero"],"Frieren":["sousou no frieren"],
  "Mushoku Tensei":["jobless reincarnation"],"Oshi no Ko":["my star"],
  "Is It Wrong to Try to Pick Up Girls in a Dungeon?":["danmachi","dungeon ni deai"],
  "Kaguya-sama":["love is war"],"The Quintessential Quintuplets":["gotoubun no hanayome"],
  "Classroom of the Elite":["cote","youkoso jitsuryoku"],
  "Dragon Ball Z":["dbz"],"Dragon Ball Super":["dbs"],"Dragon Ball GT":["dbgt"],
  "Sword Art Online":["sao"],"My Hero Academia":["mha","bnha","boku no hero academia"],
  "Jujutsu Kaisen":["jjk"],"The Eminence in Shadow":["eminence","kage no jitsuryokusha"],
  "DAN DA DAN":["dandadan"],"Hunter × Hunter":["hxh","hunter x hunter"],
  "Fullmetal Alchemist: Brotherhood":["fmab"],"That Time I Got Reincarnated as a Slime":["slime","tensura"]
};
export const aliasesFor=(...titles:string[])=>Object.entries(aliases).filter(([title,alternatives])=>[title,...alternatives].some(name=>titles.some(value=>{const candidate=normalizeSearch(value),base=normalizeSearch(name);return candidate===base||candidate.startsWith(base+" ")}))).flatMap(([title,alternatives])=>[title,...alternatives]);
export const searchableText=(a:CatalogAnime)=>`${a.title} ${(a.genres||[]).join(" ")} ${a.genre} ${(a.studios||[]).join(" ")} ${a.studio} ${a.franchiseName||franchiseOf(a.title)} ${aliasesFor(a.title).join(" ")}`.toLowerCase();
