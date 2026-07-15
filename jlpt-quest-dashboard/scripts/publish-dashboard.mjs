#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, '..');
const japaneseDir = path.resolve(dashboardDir, '..');
const publishDir = path.resolve(japaneseDir, 'japanese-JLPT-quest');
const publishDashboardDir = path.join(publishDir, 'jlpt-quest-dashboard');

async function main() {
  await assertPublishRepo();
  await fs.mkdir(path.join(publishDashboardDir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'supabase'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'vendor'), { recursive: true });

  await copy(path.join(japaneseDir, 'index.html'), path.join(publishDir, 'index.html'));
  await copy(path.join(japaneseDir, 'progression.json'), path.join(publishDir, 'progression.json'));

  for (const name of ['index.html', 'app.js', 'supabase-config.js', 'manifest.webmanifest', 'service-worker.js', 'README.md', 'DEPLOYMENT.md', 'PROGRESSION_FORMAT.md']) {
    await copy(path.join(dashboardDir, name), path.join(publishDashboardDir, name));
  }
  for (const name of ['campaign-path.jpg', 'kitsune-guide.png', 'icon-192.png', 'icon-512.png']) {
    await copy(path.join(dashboardDir, 'assets', name), path.join(publishDashboardDir, 'assets', name));
  }
  for (const name of ['schema.sql', 'README.md']) {
    await copy(path.join(dashboardDir, 'supabase', name), path.join(publishDashboardDir, 'supabase', name));
  }
  await copy(path.join(dashboardDir, 'vendor', 'supabase.min.js'), path.join(publishDashboardDir, 'vendor', 'supabase.min.js'));
  for (const name of ['record-japanese-session.mjs', 'update-progression.mjs', 'publish-dashboard.mjs', 'supabase-sync.mjs']) {
    await copy(path.join(scriptDir, name), path.join(publishDashboardDir, 'scripts', name));
  }

  runGit(['add', '-A']);
  const changes = runGit(['status', '--porcelain']).trim();
  if (!changes) {
    process.stdout.write('Dashboard already up to date.\n');
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  runGit(['commit', '-m', `Update JLPT quest ${date}`]);
  runGit(['push', 'origin', 'main']);
  process.stdout.write('Dashboard committed and pushed.\n');
}

async function assertPublishRepo() {
  try {
    await fs.access(path.join(publishDir, '.git'));
  } catch {
    throw new Error(`Missing deployment checkout: ${publishDir}`);
  }
}

async function copy(source, destination) {
  await fs.copyFile(source, destination);
}

function runGit(args) {
  return execFileSync('git', args, { cwd: publishDir, encoding: 'utf8' });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
