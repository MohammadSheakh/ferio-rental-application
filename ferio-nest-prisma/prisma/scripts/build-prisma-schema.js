/*  ============  V2 found ============= 
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const schemaDir = path.join(__dirname, "../schema");
const output = path.join(__dirname, "../schema.prisma");

const files = fs.readdirSync(schemaDir)
  .filter(f => f.endsWith(".prisma"))
  .sort(); // ensure consistent order

const content = files
  .map(file => fs.readFileSync(path.join(schemaDir, file), "utf8"))
  .join("\n\n");

fs.writeFileSync(output, content);

console.log("✅ Prisma schema built");
*/

// prisma/scripts/build-prisma-schema.js
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaDir = join(__dirname, "../schema");
const output = join(__dirname, "../schema.prisma");

const files = fs.readdirSync(schemaDir)
  .filter(f => f.endsWith(".prisma"))
  .sort(); // ensure consistent order

const content = files
  .map(file => fs.readFileSync(join(schemaDir, file), "utf8"))
  .join("\n\n");

fs.writeFileSync(output, content);

console.log("✅ Prisma schema built");