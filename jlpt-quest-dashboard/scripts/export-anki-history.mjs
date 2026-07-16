#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const deckId = 1754331009531;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const japaneseDir = path.resolve(scriptDir, "../..");
const outputPath = path.join(japaneseDir, "anki-history.json");
const databasePath = path.join(os.homedir(), "Library/Application Support/Anki2/Utilisateur 1/collection.anki2");
const databaseUri = `file:${databasePath}?immutable=1`;

function query(sql) {
  const output = execFileSync("sqlite3", ["-json", databaseUri, sql], { encoding: "utf8" }).trim();
  return output ? JSON.parse(output) : [];
}

const daily = query(`
  SELECT
    date(datetime(r.id / 1000, 'unixepoch', 'localtime')) AS date,
    count(*) AS reviews,
    round(sum(r.time) / 60000.0, 1) AS minutes
  FROM revlog r
  JOIN cards c ON c.id = r.cid
  WHERE c.did = ${deckId}
  GROUP BY date
  ORDER BY date;
`);

const [coverage] = query(`
  SELECT
    date(datetime(min(r.id) / 1000, 'unixepoch', 'localtime')) AS firstDate,
    date(datetime(max(r.id) / 1000, 'unixepoch', 'localtime')) AS lastDate,
    count(*) AS reviews,
    round(sum(r.time) / 60000.0, 1) AS minutes,
    count(DISTINCT date(datetime(r.id / 1000, 'unixepoch', 'localtime'))) AS activeDays
  FROM revlog r
  JOIN cards c ON c.id = r.cid
  WHERE c.did = ${deckId};
`);

const payload = {
  schemaVersion: 1,
  source: "Anki revlog, deck TANGO N5",
  deckId,
  importedAt: new Date().toISOString(),
  coverage,
  baseline: {
    measuredAt: "2026-07-15T13:20:13+02:00",
    cardsTotal: 948,
    newCards: 513,
    relearningCards: 5,
    recentCards: 97,
    matureCards: 333,
    estimatedRetrievableCards: 355,
    retrievabilityPercent: 82,
    difficultyPercent: 48,
    averageStabilityMonths: 4.7
  },
  daily
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write(`Exported ${daily.length} active days to ${outputPath}\n`);
