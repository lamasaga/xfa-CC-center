const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IN_DIR = path.join(__dirname, '..', 'study-app', 'public', 'university-images');
const OUT_DIR = path.join(__dirname, '..', 'study-app', 'public', 'university-images-processed');
const MAPPING_PATH = path.join(IN_DIR, 'mapping.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 450; // 16:9
const QUALITY = 85;

async function processImage(id, filename) {
  const inputPath = path.join(IN_DIR, filename);
  const outputPath = path.join(OUT_DIR, `${id}.jpg`);

  if (!fs.existsSync(inputPath)) {
    console.log(`❌ ${id}: file not found`);
    return false;
  }

  try {
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: QUALITY, progressive: true })
      .toFile(outputPath);

    const outSize = fs.statSync(outputPath).size;
    console.log(`✅ ${id}: ${id}.jpg (${(outSize / 1024).toFixed(1)}KB)`);
    return true;
  } catch (e) {
    console.log(`❌ ${id}: ${e.message}`);
    return false;
  }
}

async function run() {
  const results = [];
  for (const [id, info] of Object.entries(mapping)) {
    if (info.status === 'success' && info.filename) {
      const ok = await processImage(id, info.filename);
      results.push({ id, ok });
    }
  }

  const success = results.filter(r => r.ok).length;
  console.log(`\nProcessed: ${success}/${results.length}`);

  // Copy mapping.json
  const newMapping = {};
  for (const [id, info] of Object.entries(mapping)) {
    newMapping[id] = {
      ...info,
      filename: info.status === 'success' ? `${id}.jpg` : info.filename,
    };
  }
  fs.writeFileSync(path.join(OUT_DIR, 'mapping.json'), JSON.stringify(newMapping, null, 2));
  console.log('Mapping saved.');
}

run().catch(console.error);
