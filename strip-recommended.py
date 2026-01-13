import re

# Read the file
with open('src/lib/models.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove lines with "recommended: true" or "recommended: false"
content = re.sub(r'^\s*recommended:\s*(?:true|false),?\s*$\n', '', content, flags=re.MULTILINE)

# Clean up any double commas or trailing commas before }
content = re.sub(r',\s*,', ',', content)
content = re.sub(r',(\s*})', r'\1', content)

# Write back
with open('src/lib/models.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("✅ Stripped all 'recommended' flags from models.ts")
