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
  await writeLocalProgressionBundle();
  await fs.mkdir(path.join(publishDashboardDir, 'assets', 'mimir'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'fonts'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'supabase'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'supabase', 'migrations'), { recursive: true });
  await fs.mkdir(path.join(publishDashboardDir, 'vendor'), { recursive: true });

  await copy(path.join(japaneseDir, 'index.html'), path.join(publishDir, 'index.html'));
  await copy(path.join(japaneseDir, 'progression.json'), path.join(publishDir, 'progression.json'));
  await copy(path.join(japaneseDir, 'progression-data.js'), path.join(publishDir, 'progression-data.js'));
  await copy(path.join(japaneseDir, 'anki-history.json'), path.join(publishDir, 'anki-history.json'));

  for (const name of ['index.html', 'app.js', 'supabase-config.js', 'manifest.webmanifest', 'service-worker.js', 'README.md', 'DEPLOYMENT.md', 'PROGRESSION_FORMAT.md']) {
    await copy(path.join(dashboardDir, name), path.join(publishDashboardDir, name));
  }
  for (const name of ['campaign-path.webp', 'kitsune-guide.webp', 'n5-world-map-v2.jpg', 'icon-192.png', 'icon-512.png']) {
    await copy(path.join(dashboardDir, 'assets', name), path.join(publishDashboardDir, 'assets', name));
  }
  for (const name of ['mimir-idle.png', 'mimir-reading.png', 'mimir-thinking.png', 'mimir-celebrate.png', 'mimir-rest.png']) {
    await copy(path.join(dashboardDir, 'assets', 'mimir', name), path.join(publishDashboardDir, 'assets', 'mimir', name));
  }
  for (const name of ['mimir-form-scout.png', 'mimir-form-guardian.png', 'mimir-form-messenger.png', 'mimir-form-sage.png']) {
    await copy(path.join(dashboardDir, 'assets', 'mimir', name), path.join(publishDashboardDir, 'assets', 'mimir', name));
  }
  for (const name of ['campaign-path.jpg', 'kitsune-guide.png']) {
    await fs.rm(path.join(publishDashboardDir, 'assets', name), { force: true });
  }
  for (const name of ['dm-sans-latin.woff2', 'shippori-mincho-700-latin.woff2', 'shippori-mincho-800-latin.woff2']) {
    await copy(path.join(dashboardDir, 'fonts', name), path.join(publishDashboardDir, 'fonts', name));
  }
  for (const name of ['schema.sql', 'README.md']) {
    await copy(path.join(dashboardDir, 'supabase', name), path.join(publishDashboardDir, 'supabase', name));
  }
  await copy(
    path.join(dashboardDir, 'supabase', 'migrations', '20260715_gamification.sql'),
    path.join(publishDashboardDir, 'supabase', 'migrations', '20260715_gamification.sql')
  );
  await copy(path.join(dashboardDir, 'vendor', 'supabase.min.js'), path.join(publishDashboardDir, 'vendor', 'supabase.min.js'));
  for (const name of ['record-japanese-session.mjs', 'update-progression.mjs', 'publish-dashboard.mjs', 'supabase-sync.mjs', 'export-anki-history.mjs']) {
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

async function writeLocalProgressionBundle() {
  const progression = JSON.parse(await fs.readFile(path.join(japaneseDir, 'progression.json'), 'utf8'));
  await fs.writeFile(
    path.join(japaneseDir, 'progression-data.js'),
    `window.JLPT_BASE_DATA = ${JSON.stringify(progression, null, 2)};\n`,
    'utf8'
  );
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
