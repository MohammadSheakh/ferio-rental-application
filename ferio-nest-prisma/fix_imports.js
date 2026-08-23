const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(process.cwd(), 'src');

// Find all .ts files
const files = execSync(`find ${srcDir} -name "*.ts"`).toString().split('\n').filter(Boolean);

const commonPattern = /from ['"](\.\.?\/)+common[^'"]*['"]|from ['"]src\/common[^'"]*['"]/g;
const databasePattern = /from ['"](\.\.?\/)+core\/database\/prisma[^'"]*['"]|from ['"]src\/core\/database\/prisma[^'"]*['"]/g;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Pattern to match: import { ... } from '...'
    // We want to capture the symbols and the source
    const importRegex = /import\s+({[^}]+}|[^{;]+)\s+from\s+(['"]([^'"]+)['"]);/g;

    let commonSymbols = new Set();
    let databaseSymbols = new Set();
    let otherLines = [];
    
    let lines = content.split('\n');
    let newLines = [];
    let handled = false;

    // This is a bit complex to do with regex alone if we want to consolidate.
    // Let's do a simpler approach first: replace all matching imports with the alias.
    // Then we can post-process to consolidate if there are multiple.

    let updatedContent = content.replace(importRegex, (match, symbols, fullPath, pathValue) => {
        if (pathValue.includes('@nestjs/common')) return match;
        
        if (pathValue.match(/(\.\.?\/)+common/) || pathValue.startsWith('src/common')) {
            changed = true;
            // Clean up symbols: remove { } and whitespace
            const cleanSymbols = symbols.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            cleanSymbols.forEach(s => commonSymbols.add(s));
            return `__COMMON_IMPORT__`;
        }
        
        if (pathValue.match(/(\.\.?\/)+core\/database\/prisma/) || pathValue.startsWith('src/core/database/prisma')) {
            changed = true;
            const cleanSymbols = symbols.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            cleanSymbols.forEach(s => databaseSymbols.add(s));
            return `__DATABASE_IMPORT__`;
        }
        
        return match;
    });

    if (changed) {
        let finalLines = updatedContent.split('\n');
        let commonImportAdded = false;
        let databaseImportAdded = false;

        let resultLines = [];
        for (let line of finalLines) {
            if (line.includes('__COMMON_IMPORT__')) {
                if (!commonImportAdded && commonSymbols.size > 0) {
                    resultLines.push(`import { ${Array.from(commonSymbols).join(', ')} } from '@app/common';`);
                    commonImportAdded = true;
                }
            } else if (line.includes('__DATABASE_IMPORT__')) {
                if (!databaseImportAdded && databaseSymbols.size > 0) {
                    resultLines.push(`import { ${Array.from(databaseSymbols).join(', ')} } from '@app/database';`);
                    databaseImportAdded = true;
                }
            } else {
                resultLines.push(line);
            }
        }
        
        fs.writeFileSync(file, resultLines.join('\n'));
        console.log(`Updated ${file}`);
    }
});
