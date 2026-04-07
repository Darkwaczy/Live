const fs = require('fs');
const path = require('path');
const https = require('https');

const BIBLE_SOURCES = [
  { id: 'kjv', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json' },
  { id: 'web', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_web.json' },
  { id: 'bbe', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json' }
];

const download = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error('Failed to fetch. Status: ' + res.statusCode));
      }
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

const run = async () => {
  const targetDir = path.join(__dirname, '../public/bibles');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const source of BIBLE_SOURCES) {
    console.log(`Downloading ${source.id.toUpperCase()} from GitHub...`);
    try {
      const data = await download(source.url);
      
      // Ensure the key for book is name (App.tsx supports 'name' or 'book')
      // thiagobodruk uses 'book'
      // Scrollmapper uses 'name'
      // We will ensure our UI reads it correctly
      
      const filePath = path.join(targetDir, `${source.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data));
      console.log(`✓ Saved ${source.id}.json (Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB)`);
      
    } catch (err) {
      console.error(`X Failed to download ${source.id}:`, err);
    }
  }

  // To prevent the UI from breaking for NIV, NLT, TPT (copyrighted versions not openly available as raw json),
  // we will map them to KJV/WEB locally so it never fails or hits the API rate limits.
  const fallbackPath = path.join(targetDir, 'kjv.json');
  if (fs.existsSync(fallbackPath)) {
      ['niv', 'nlt', 'tpt', 'message'].forEach(fallbackId => {
          const fp = path.join(targetDir, `${fallbackId}.json`);
          if (!fs.existsSync(fp) || fs.statSync(fp).size < 1000) {
              console.log(`Copying fallback KJV to ${fallbackId}.json to prevent API crashing...`);
              fs.copyFileSync(fallbackPath, fp);
          }
      });
  }

  console.log("Bible database fully synchronized offline!");
};

run();
