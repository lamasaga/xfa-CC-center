import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'public/universities_data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

/** @type {Record<string, number>} */
const MANUAL = {
  mit: 1, harvard: 1, stanford: 1, caltech: 1, princeton: 1, yale: 1,
  columbia: 1, upenn: 1, brown: 1, dartmouth: 1, cornell: 1,
  oxford: 1, cambridge: 1,
  uchicago: 2, duke: 2, northwestern: 2, jhu: 2, rice: 2, vanderbilt: 2,
  ucla: 2, uc_berkeley: 2, cmu: 2, washu: 2, notre_dame: 2,
  imperial: 2, lse: 2, kcl: 3, warwick: 3, birmingham: 3, durham: 3,
  eth_zurich: 2, epfl: 2, tudelft: 2, psl: 2, tum: 3, tcd: 3,
  hku: 2, cuhk: 2, hkust: 2, nus: 2, ntu: 3, cityu_hk: 3,
  cooper_union: 2, risd: 2, ensba: 2, antwerp_arts: 2,
  ucl: 3, edinburgh: 4, manchester: 4, bristol: 5, glasgow: 6,
  southampton: 5, leeds: 5, sheffield: 5, nottingham: 5,
  qmul: 5, newcastle: 5, lancaster: 4,
  mcgill: 4, uoft: 4, ubc: 4, ualberta: 5, mcmaster: 4,
  unimelb: 5, unsw: 5, usyd: 4, anu: 4, monash: 5, uq: 4, uwa: 4,
  adelaide: 6, uts: 4, macquarie: 5,
  usc: 3, michigan_ann_arbor: 3, emory: 3, unc_chapel_hill: 3,
  uva: 3, ucsd: 4, ut_austin: 4, uflorida: 4,
  udk_berlin: 3, csm: 3, dae: 3, gsa: 4, rca: 3,
  chelsea_arts: 4, parsons: 3, esmod: 5, polimoda: 5, pratt: 4,
  artcenter: 4,
  uva_nl: 4, kuleuven: 4, sorbonne: 4, paris_saclay: 4, kth: 4,
  heidelberg: 4, lund: 4, copenhagen: 4, polimi: 4, helsinki: 4,
  oslo: 4, vienna: 4, barcelona: 5, uam: 5,
};

function parseRate(raw) {
  if (raw === '' || raw == null) return null;
  const nums = String(raw).match(/[\d.]+/g);
  if (!nums?.length) return null;
  return Math.min(...nums.map(Number));
}

function computeTier(u) {
  if (MANUAL[u.id]) return MANUAL[u.id];

  const rate = parseRate(u.admission?.acceptance_rate);
  const qs = u.ranking?.qs ?? 999;
  const al = u.admission?.a_level || '';
  const region = u.region;

  if (/无特定成绩|不对ALEVEL|E或以上|至少E|2门A-Level|CDD|CCC|灵活|校本/.test(al) && !/A\*A\*A/.test(al)) {
    if (rate != null && rate >= 70) return 6;
    if (rate != null && rate >= 55) return 5;
    if (u.is_art_school) return 5;
  }

  if (/4门A-Level|四门/.test(al) && (qs <= 25 || (rate != null && rate <= 20))) return 2;

  if (region === '新加坡') return rate != null && rate <= 18 ? 2 : 3;
  if (region === '香港') return rate != null && rate <= 12 ? 2 : 3;

  if (/A\*A\*A/.test(al) && (qs <= 20 || (rate != null && rate <= 15))) return 2;

  if (rate != null) {
    if (rate < 6) return 1;
    if (rate < 12) return 2;
    if (rate < 22) return 3;
    if (rate < 45) return 4;
    if (rate < 68) return 5;
    return 6;
  }

  if (/A\*A\*A/.test(al)) return 2;
  if (/A\*AA|AAA/.test(al)) return 3;
  if (/AAB|ABB|BBB/.test(al)) return 4;
  if (/BBC|CCC|CDD/.test(al)) return 5;
  return 4;
}

const counts = {};
for (const u of data.universities) {
  const tier = computeTier(u);
  u.admission_difficulty = tier;
  counts[tier] = (counts[tier] || 0) + 1;
  console.log(`${tier}\t${u.id}\t${u.name}`);
}

writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('counts', counts);
