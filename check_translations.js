const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const allFiles = [...getAllFiles('src'), ...getAllFiles('app')];
const keys = new Set();

const regex1 = /\bt\(['"]([a-zA-Z0-9_.-]+)['"]/g;
const regex2 = /nameKey:\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
const regex3 = /\[missing\s*['"]?([a-zA-Z0-9_.-]+)['"]?\s*translation\]/g;

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex1.exec(content)) !== null) {
    keys.add(match[1]);
  }
  while ((match = regex2.exec(content)) !== null) {
    keys.add(match[1]);
  }
  while ((match = regex3.exec(content)) !== null) {
    keys.add(match[1]);
  }
});

const enJson = JSON.parse(fs.readFileSync('src/services/localization/translations/en.json', 'utf8'));

function flattenObj(obj, parent = '', res = {}) {
  for (let key in obj) {
    let propName = parent ? parent + '.' + key : key;
    if (typeof obj[key] == 'object' && obj[key] !== null) {
      flattenObj(obj[key], propName, res);
    } else {
      res[propName] = obj[key];
    }
  }
  return res;
}

const flatEn = flattenObj(enJson);
const missing = [];

keys.forEach(k => {
  if (!flatEn[k]) missing.push(k);
});

console.log('--- ALL KEYS ---');
console.log(Array.from(keys).sort().join('\n'));
console.log('\n--- MISSING KEYS ---');
console.log(missing.sort().join('\n'));
