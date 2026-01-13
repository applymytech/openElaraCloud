const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/lib/models.ts', 'utf8');

// Remove lines with "recommended: true" or "recommended: false" (with optional comments)
content = content.replace(/^\s*recommended:\s*(?:true|false).*$/gm, '');

// Clean up any double blank lines
content = content.replace(/\n\n\n+/g, '\n\n');

// Clean up trailing commas before }
content = content.replace(/,(\s*})/g, '$1');

// Write back
fs.writeFileSync('src/lib/models.ts', content, 'utf8');

console.log('✅ Stripped all recommended flags from models.ts');
