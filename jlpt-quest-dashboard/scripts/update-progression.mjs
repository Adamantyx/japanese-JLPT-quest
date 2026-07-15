#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(scriptDir, '../../progression.json');

async function main() {
  const raw = await fs.readFile(filePath, 'utf8');
  const current = JSON.parse(raw);
  const input = await readStdinJson();

  const next = {
    ...current,
    ...input,
    anki: { ...current.anki, ...(input.anki || {}) },
    obi: { ...current.obi, ...(input.obi || {}) },
    listening: { ...current.listening, ...(input.listening || {}) },
    milestones: input.milestones || current.milestones,
    recentLogs: input.recentLogs || current.recentLogs,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  process.stdout.write(`${filePath}\n`);
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = chunks.join('').trim();
  if (!text) return {};
  return JSON.parse(text);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
