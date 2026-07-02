const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const dirs = ['app', 'components', '(tabs)'];
let files = [];
for (const dir of dirs) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    files = [...files, ...walkSync(fullPath)];
  }
}
files = files.filter(f => f.endsWith('.tsx'));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Remove 'pr-1' and ' pr-1' inside tw`...`
  // We will do a global replace of ' pr-1`' to '`' and 'pr-1 ' to '' inside tw templates
  // Actually, simplest is to use regex:
  content = content.replace(/tw`([^`]+)`/g, (match, classes) => {
    // split classes, remove pr-1
    let classArray = classes.split(/\s+/);
    classArray = classArray.filter(c => c !== 'pr-1');
    return `tw\`${classArray.join(' ')}\``;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
}

console.log(`Removed pr-1 from ${modifiedCount} files`);
