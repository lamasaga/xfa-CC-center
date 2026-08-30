const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'study-app', 'public', 'universities_data.json');
const OUT_DIR = path.join(__dirname, '..', 'study-app', 'public', 'university-images');
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const unis = data.universities;

const CONCURRENCY = 5;
const TIMEOUT_MS = 12000;

// URL quality scoring
const EXCLUDE_KEYWORDS = ['logo', 'crest', 'shield', 'favicon', 'icon', 'webclip', 'placeholder', 'thumbnail', 'thumb', 'badge', 'emblem'];
const POSITIVE_KEYWORDS = ['campus', 'building', 'aerial', 'drone', 'hero', 'scene', 'view', 'landscape', 'hall', 'quad', 'scenery', 'panorama', 'exterior'];

function scoreImageUrl(url) {
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.endsWith('.svg') || lower.endsWith('.ico')) return -100;
  for (const kw of EXCLUDE_KEYWORDS) {
    if (lower.includes(kw)) score -= 50;
  }
  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) score += 30;
  }
  if (lower.match(/\.(jpg|jpeg)$/)) score += 10;
  if (lower.match(/\.(png)$/)) score += 5;
  return score;
}

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
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const lower = url.toLowerCase();
    if (!lower.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
      throw new Error('Not an image: ' + contentType);
    }
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 2000) throw new Error('Image too small: ' + buffer.length);
  fs.writeFileSync(outPath, buffer);
  return buffer.length;
}

async function processUniversity(uni) {
  const id = uni.id;
  const name = uni.name;
  const website = uni.official_website;
  
  try {
    const res = await fetchWithTimeout(website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) {
      return { id, name, status: 'http_error', code: res.status };
    }
    const html = await res.text();
    
    let ogImages = extractOgImages(html, website);
    ogImages = ogImages.filter(u => scoreImageUrl(u) > -50);
    ogImages.sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a));
    
    let candidates = [...ogImages];
    if (candidates.length === 0) {
      const pageImages = extractPageImages(html, website);
      const scored = pageImages
        .filter(u => scoreImageUrl(u) > -30)
        .sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a));
      candidates = scored.slice(0, 5);
    }
    
    if (candidates.length === 0) {
      return { id, name, status: 'no_image_found' };
    }
    
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
  } catch (e) {
    return { id, name, status: 'error', msg: e.message.substring(0, 80) };
  }
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
  
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status !== 'success');
  
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${success.length}`);
  console.log(`Failed: ${failed.length}`);
  
  const mapping = {};
  for (const r of results) {
    const uni = unis.find(u => u.id === r.id);
    mapping[r.id] = {
      name: uni.name,
      name_en: uni.name_en,
      status: r.status,
      filename: r.file || null,
    };
  }
  fs.writeFileSync(path.join(OUT_DIR, 'mapping.json'), JSON.stringify(mapping, null, 2));
  console.log(`\nMapping saved to: ${path.join(OUT_DIR, 'mapping.json')}`);
}

run().catch(console.error);
