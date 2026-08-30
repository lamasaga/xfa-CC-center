const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'study-app', 'public', 'universities_data.json');
const OUT_DIR = path.join(__dirname, '..', 'study-app', 'public', 'university-images');
const MAPPING_PATH = path.join(OUT_DIR, 'mapping.json');

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const allUnis = data.universities;
const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

// Collect IDs that need fixing: failed OR very small images
const fixIds = [];
for (const [id, info] of Object.entries(mapping)) {
  if (info.status !== 'success') {
    fixIds.push(id);
  } else if (info.filename) {
    const fpath = path.join(OUT_DIR, info.filename);
    if (fs.existsSync(fpath)) {
      const size = fs.statSync(fpath).size;
      if (size < 15000) {
        fixIds.push(id);
        console.log(`Will re-fetch small image: ${id} (${size} bytes)`);
      }
    }
  }
}

const unis = allUnis.filter(u => fixIds.includes(u.id));
console.log(`Fixing ${unis.length} universities...\n`);

const CONCURRENCY = 4;
const TIMEOUT_MS = 20000;

function resolveUrl(base, rel) {
  rel = rel.trim();
  if (rel.startsWith('http')) return rel;
  if (rel.startsWith('//')) return 'https:' + rel;
  try {
    const baseObj = new URL(base);
    if (rel.startsWith('/')) return baseObj.origin + rel;
    return baseObj.origin + '/' + rel;
  } catch {
    return null;
  }
}

function extractOgImages(html, baseUrl) {
  const images = [];
  const ogRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  const ogRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi;
  const twRegex = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi;
  const twRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi;
  let m;
  while ((m = ogRegex.exec(html)) !== null) images.push(m[1]);
  while ((m = ogRegex2.exec(html)) !== null) images.push(m[1]);
  while ((m = twRegex.exec(html)) !== null) images.push(m[1]);
  while ((m = twRegex2.exec(html)) !== null) images.push(m[1]);
  return images.map(u => resolveUrl(baseUrl, u)).filter(Boolean);
}

function extractPageImages(html, baseUrl) {
  const images = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const resolved = resolveUrl(baseUrl, m[1]);
    if (resolved) images.push(resolved);
  }
  return images;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function downloadImage(url, outPath) {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1000) throw new Error('Image too small: ' + buffer.length);
  fs.writeFileSync(outPath, buffer);
  return buffer.length;
}

async function fetchFromWikipedia(nameEn) {
  try {
    // Try REST API first
    const title = nameEn.replace(/ /g, '_');
    const restUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
    const restRes = await fetch(restUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (restRes.ok) {
      const restData = await restRes.json();
      const img = restData.originalimage?.source || restData.thumbnail?.source;
      if (img) return { url: img, source: 'wikipedia_rest' };
    }
  } catch {}
  
  // Try searching Wikimedia Commons
  try {
    const searchUrl = 'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(nameEn + ' campus') + '&srnamespace=6&srlimit=3&format=json&origin=*';
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    const searchData = await searchRes.json();
    const results = searchData.query?.search || [];
    for (const r of results) {
      const title = r.title.replace('File:', '');
      const imgUrl = 'https://commons.wikimedia.org/w/api.php?action=query&titles=File:' + encodeURIComponent(title) + '&prop=imageinfo&iiprop=url|size&format=json&origin=*';
      const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      const imgData = await imgRes.json();
      const pages = imgData.query?.pages;
      if (pages) {
        const page = pages[Object.keys(pages)[0]];
        const info = page.imageinfo?.[0];
        if (info && info.width > 300) {
          return { url: info.url, source: 'commons' };
        }
      }
    }
  } catch {}
  
  return null;
}

async function processUniversity(uni) {
  const id = uni.id;
  const name = uni.name;
  const website = uni.official_website;
  
  // Remove old small file if exists
  if (mapping[id]?.filename) {
    const oldPath = path.join(OUT_DIR, mapping[id].filename);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch {}
    }
  }
  
  let candidates = [];
  
  // Step 1: Try official website (more lenient)
  try {
    const res = await fetchWithTimeout(website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res.ok) {
      const html = await res.text();
      candidates.push(...extractOgImages(html, website));
      if (candidates.length === 0) {
        candidates.push(...extractPageImages(html, website));
      }
    }
  } catch (e) {
    // continue to Wikipedia
  }
  
  // Step 2: Try Wikipedia / Commons
  if (candidates.length === 0) {
    const wiki = await fetchFromWikipedia(uni.name_en);
    if (wiki) {
      candidates.push(wiki.url);
    }
  }
  
  if (candidates.length === 0) {
    return { id, name, status: 'no_image_found' };
  }
  
  // Step 3: Try downloading each candidate
  for (const url of candidates) {
    try {
      const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
      const outPath = path.join(OUT_DIR, `${id}.${safeExt}`);
      const size = await downloadImage(url, outPath);
      return { id, name, status: 'success', url: url.substring(0, 100), file: `${id}.${safeExt}`, size };
    } catch (e) {
      continue;
    }
  }
  
  return { id, name, status: 'download_failed', candidates: candidates.length };
}

async function run() {
  const results = [];
  
  for (let i = 0; i < unis.length; i += CONCURRENCY) {
    const batch = unis.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(processUniversity));
    results.push(...batchResults);
    
    for (const r of batchResults) {
      if (r.status === 'success') {
        console.log(`✅ ${r.id}: ${r.file} (${(r.size / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`❌ ${r.id}: ${r.status}${r.msg ? ' - ' + r.msg : ''}`);
      }
    }
    
    if (i + CONCURRENCY < unis.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Update mapping
  for (const r of results) {
    const uni = allUnis.find(u => u.id === r.id);
    mapping[r.id] = {
      name: uni.name,
      name_en: uni.name_en,
      status: r.status,
      filename: r.file || null,
    };
  }
  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
  
  const success = results.filter(r => r.status === 'success');
  console.log(`\nFix round: ${success.length}/${results.length} fixed`);
}

run().catch(console.error);
