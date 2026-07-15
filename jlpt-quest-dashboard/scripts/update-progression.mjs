#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(scriptDir, '../../progression.json');

async function main() {
  const current = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const input = await readStdinJson();
  const next = deepMerge(current, input);

  next.updatedAt = input.updatedAt || new Date().toISOString();
  await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  process.stdout.write(`${filePath}\n`);
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return patch;
  if (!patch || typeof patch !== 'object') return patch;

  return Object.fromEntries(
    [...new Set([...Object.keys(base || {}), ...Object.keys(patch)])].map((key) => {
      if (!(key in patch)) return [key, base[key]];
      const baseValue = base?.[key];
      const patchValue = patch[key];
      const mergeable = baseValue && patchValue
        && typeof baseValue === 'object'
        && typeof patchValue === 'object'
        && !Array.isArray(baseValue)
        && !Array.isArray(patchValue);
      return [key, mergeable ? deepMerge(baseValue, patchValue) : patchValue];
    }),
  );
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = chunks.join('').trim();
  if (!text) throw new Error('A JSON patch is required on stdin.');
  return JSON.parse(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
