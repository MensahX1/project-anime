import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const titles = JSON.parse(await fs.readFile(new URL('src/allTitles.json', root), 'utf8'));
const seedFiles = ['seed1.json','seed2.json','seed3.json','seed4.json'];
const seeds = (await Promise.all(seedFiles.map(f => fs.readFile(new URL(`src/${f}`, root), 'utf8').then(JSON.parse)))).flat();
const meta = new Map(seeds.map(x => [x.title, x]));
const coverDir = new URL('public/covers/', root);
const sourcesFile = new URL('src/coverSources.json', root);
const generatedFile = new URL('src/generatedCovers.json', root);
await fs.mkdir(coverDir, { recursive: true });

const readJson = async (url, fallback = {}) => { try { return JSON.parse(await fs.readFile(url, 'utf8')); } catch { return fallback; } };
let sources = await readJson(sourcesFile, {});
let generated = await readJson(generatedFile, {});

const args = Object.fromEntries(process.argv.slice(2).map(x => { const [k,v='true'] = x.replace(/^--/, '').split('='); return [k,v]; }));
const verifyOnly = args.verify === 'true';
const start = Math.max(0, Number(args.start || 0));
const count = Math.max(1, Number(args.count || titles.length));
const selected = titles.slice(start, start + count);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '-');
const persist = async () => {
  await fs.writeFile(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
  await fs.writeFile(generatedFile, JSON.stringify(generated, null, 2) + '\n');
};

async function get(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'le-anime-cover-sync/1.0' } });
      if (r.ok) return r;
      last = new Error(`${r.status} ${url}`);
      if (r.status !== 429 && r.status < 500) throw last;
    } catch (e) { last = e; }
    await sleep(1800 * (i + 1));
  }
  throw last || new Error(`Failed ${url}`);
}

function choose(title, rows) {
  const n = norm(title);
  const year = meta.get(title)?.year;
  const wantsMovie = /movie|infinity castle|suzume|reze arc/i.test(title);
  return rows.map(x => {
    const names = [x.title, x.title_english, x.title_japanese, ...(x.title_synonyms || [])].filter(Boolean).map(norm);
    let score = names.includes(n) ? 140 : names.some(v => v.includes(n) || n.includes(v)) ? 65 : 0;
    if (year && x.year === year) score += 35;
    else if (year && x.year && Math.abs(x.year - year) === 1) score += 8;
    else if (year && x.year) score -= 10;
    if (wantsMovie && x.type === 'Movie') score += 18;
    if (!wantsMovie && x.type === 'TV') score += 8;
    if (/recap|summary/i.test(String(x.title))) score -= 30;
    return { x, score };
  }).sort((a,b) => b.score - a.score)[0]?.x;
}

async function fileIsGood(url) {
  try { return (await fs.stat(url)).size > 1000; } catch { return false; }
}

if (verifyOnly) {
  const missing = [];
  for (const title of titles) {
    const name = `${slug(title)}.jpg`;
    if (!sources[title]?.url || !generated[title] || !(await fileIsGood(new URL(name, coverDir)))) missing.push(title);
  }
  if (missing.length) {
    console.error(`Missing ${missing.length}/${titles.length}: ${missing.join(' | ')}`);
    process.exit(1);
  }
  console.log(`Verified ${titles.length}/${titles.length} local covers and source records.`);
  process.exit(0);
}

for (let offset = 0; offset < selected.length; offset++) {
  const title = selected[offset];
  const absoluteIndex = start + offset + 1;
  const name = `${slug(title)}.jpg`;
  const file = new URL(name, coverDir);
  const local = `/project-anime/covers/${name}`;

  try {
    if (!sources[title]?.url) {
      const u = new URL('https://api.jikan.moe/v4/anime');
      u.searchParams.set('q', title);
      u.searchParams.set('limit', '10');
      u.searchParams.set('sfw', 'true');
      const r = await get(u);
      const j = await r.json();
      const best = choose(title, j.data || []);
      const image = best?.images?.jpg?.large_image_url || best?.images?.jpg?.image_url;
      if (!image) throw new Error('No matching JPG cover');
      sources[title] = {
        url: image,
        malId: best.mal_id,
        matchedTitle: best.title_english || best.title,
        type: best.type || null,
        year: best.year || null,
        resolvedAt: new Date().toISOString()
      };
      await persist();
      await sleep(1100);
    }

    if (!(await fileIsGood(file))) {
      const ir = await get(sources[title].url);
      const type = ir.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new Error(`Unexpected content type ${type || 'unknown'}`);
      const bytes = Buffer.from(await ir.arrayBuffer());
      if (bytes.length < 1000) throw new Error('Image too small');
      await fs.writeFile(file, bytes);
    }

    generated[title] = local;
    await persist();
    console.log(`${absoluteIndex}/${titles.length} ✓ ${title} -> ${sources[title].matchedTitle || sources[title].url}`);
  } catch (e) {
    console.warn(`${absoluteIndex}/${titles.length} ✗ ${title}: ${e?.message || e}`);
  }
}

console.log(`Batch complete: ${selected.length} titles. Manifest ${Object.keys(sources).length}/${titles.length}; local map ${Object.keys(generated).length}/${titles.length}.`);
