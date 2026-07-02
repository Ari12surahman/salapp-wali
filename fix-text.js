const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = [
  ...walkSync(path.join(__dirname, 'app')),
  ...walkSync(path.join(__dirname, 'components'))
].filter(f => f.endsWith('.tsx'));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Regex to find tw`...` inside <Text ...>
  // We want to add pr-1 to any tw`...` that doesn't already have pr-1, pr-2, etc.
  // Actually, let's just append ' pr-1' before the closing backtick of any tw`...` that has 'text-', 'font-', or is inside a Text component.
  // Since tw`...` is mostly used for Text, View, etc., we can just look for `<Text ` and replace tw`...` inside it.
  
  // A safer regex: match <Text ... tw`...` ...>...</Text>
  // Let's just do a simple replacement:
  // If we see font-bold, font-extrabold, font-black, or text-..., let's add pr-1 if it's not there.
  // Wait, if it's a View with text-center, it might not hurt to have pr-1? It might slightly uncenter.
  
  // Let's do it precisely: Match `<Text ... style={tw`...`} ...>` and append ` pr-1` inside the backticks.
  content = content.replace(/<Text([^>]*?)style=\{tw`([^`]+)`\}([^>]*?)>/g, (match, before, classes, after) => {
    if (!classes.includes('pr-1') && !classes.includes('pr-2') && !classes.includes('pr-3') && !classes.includes('px-')) {
      return `<Text${before}style={tw\`${classes} pr-1\`}${after}>`;
    }
    return match;
  });

  // What about style={[tw`...`, ...]}?
  content = content.replace(/<Text([^>]*?)style=\{\[tw`([^`]+)`([^\]]*?)\]\}([^>]*?)>/g, (match, before, classes, afterStyles, afterTag) => {
    if (!classes.includes('pr-1') && !classes.includes('pr-2') && !classes.includes('pr-3') && !classes.includes('px-')) {
      return `<Text${before}style={[tw\`${classes} pr-1\`${afterStyles}]}${afterTag}>`;
    }
    return match;
  });

  // What about conditional classes tw\`... ${...} ...\`?
  // We'll just replace the last backtick with ` pr-1\`` if it's inside <Text style={tw`...`}>
  // This is handled by the first regex if there are no backticks inside ${}.
  // But JS template literals can be complex.
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
}

console.log(`Modified ${modifiedCount} files`);
