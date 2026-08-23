import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaDir = join(__dirname, "../schema");
const output = join(__dirname, "../schema.prisma");

/**
 * Recursively get all .prisma files from a directory and its subdirectories
 * @param {string} dir - Directory to scan
 * @param {string[]} fileList - Accumulated file list
 * @returns {string[]} - Array of file paths
 */
function getAllPrismaFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      getAllPrismaFiles(filePath, fileList);
    } else if (file.endsWith('.prisma')) {
      // Add .prisma files to the list
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Get all .prisma files recursively
const allPrismaFiles = getAllPrismaFiles(schemaDir);

// Sort files to ensure consistent order
// You can customize the sort logic based on your needs
/*----------------
allPrismaFiles.sort((a, b) => {
  // Option 1: Sort by full path
  return a.localeCompare(b);
  
  // Option 2: Sort by filename only (uncomment if preferred)
  // return path.basename(a).localeCompare(path.basename(b));
});
------------------*/

//If you need specific load order (e.g., base config first, then models), you can use prefixes:

allPrismaFiles.sort((a, b) => {
  const getPriority = (filePath) => {
    const relativePath = path.relative(schemaDir, filePath);
    
    // Define priority order
    if (relativePath.includes('base/')) return 0;      // Load base first
    if (relativePath.includes('shared/')) return 1;    // Then shared
    if (relativePath.includes('user/')) return 2;      // Then user
    if (relativePath.includes('learning/')) return 3;  // Then learning
    return 99; // Everything else last
  };

  const priorityA = getPriority(a);
  const priorityB = getPriority(b);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  // If same priority, sort alphabetically
  return a.localeCompare(b);
});



// Read and combine all schema files
const content = allPrismaFiles
  .map(filePath => {
    const fileContent = fs.readFileSync(filePath, "utf8");
    // Optional: Add a comment showing which file this content came from
    const relativePath = path.relative(schemaDir, filePath);
    return `// Source: ${relativePath}\n${fileContent}`;
  })
  .join("\n\n");

fs.writeFileSync(output, content);

console.log("✅ Prisma schema built");
console.log(`📁 Files processed: ${allPrismaFiles.length}`);
allPrismaFiles.forEach(file => {
  console.log(`   - ${path.relative(schemaDir, file)}`);
});
