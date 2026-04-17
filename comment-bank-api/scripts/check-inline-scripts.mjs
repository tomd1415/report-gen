import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const scriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

let checked = 0;
let failed = false;

for (const fileName of fs.readdirSync(publicDir).filter((name) => name.endsWith('.html')).sort()) {
  const filePath = path.join(publicDir, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = [...html.matchAll(scriptPattern)].map((match) => match[1]);

  scripts.forEach((script, index) => {
    checked += 1;
    try {
      new Function(script);
    } catch (error) {
      failed = true;
      console.error(`${path.relative(rootDir, filePath)} inline script ${index + 1}: ${error.message}`);
    }
  });
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} inline script${checked === 1 ? '' : 's'} for syntax errors.`);
}
