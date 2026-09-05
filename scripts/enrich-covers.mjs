import fs from 'node:fs/promises';
const titles=JSON.parse(await fs.readFile(new URL('../src/allTitles.json',import.meta.url),'utf8'));
const out={};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<titles.length;i++){
  const title=titles[i];
  try{
    const u=new URL('https://api.jikan.moe/v4/anime');u.searchParams.set('q',title);u.searchParams.set('limit','5');u.searchParams.set('sfw','true');
    let r;for(let attempt=0;attempt<4;attempt++){r=await fetch(u);if(r.ok)break;await sleep(1500*(attempt+1))}
    if(!r?.ok)continue;
    const j=await r.json();const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const n=norm(title);
    const best=(j.data||[]).find(x=>[x.title,x.title_english,...(x.title_synonyms||[])].some(t=>norm(t)===n))||j.data?.[0];
    const image=best?.images?.jpg?.large_image_url||best?.images?.webp?.large_image_url||best?.images?.jpg?.image_url||'';
    if(image)out[title]=image;
  }catch(e){console.warn('cover failed',title,e?.message||e)}
  console.log(`${i+1}/${titles.length} ${title}`);await sleep(420);
}
await fs.writeFile(new URL('../src/generatedCovers.json',import.meta.url),JSON.stringify(out,null,2));
console.log(`Resolved ${Object.keys(out).length}/${titles.length} covers`);