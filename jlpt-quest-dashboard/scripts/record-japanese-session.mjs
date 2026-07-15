#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(scriptDir, '../../progression.json');
const event = process.argv[2] || 'result';

async function main() {
  const current = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const input = await readStdinJson();
  const next = event === 'quest'
    ? recordQuest(current, input)
    : event === 'result'
      ? recordResult(current, input)
      : null;

  if (!next) throw new Error(`Unknown event "${event}". Use quest or result.`);
  next.updatedAt = input.updatedAt || new Date().toISOString();
  await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  process.stdout.write(`${filePath}\n`);
}

function recordQuest(current, input) {
  requireFields(input, ['date', 'morningQuest']);
  const newDay = current.today?.date !== input.date;
  const next = structuredClone(current);

  const activeWeek = weekStart(input.date);
  if (next.week?.start !== activeWeek) {
    next.week = { start: activeWeek, stars: 0, target: next.week?.target || 8, bonusStars: 0, days: [] };
  }

  if (newDay) {
    next.today = {
      date: input.date,
      status: 'planned',
      stars: 0,
      morningQuest: input.morningQuest,
      eveningQuest: input.eveningQuest || '',
      confirmedSummary: '',
      energy: '',
    };
    next.anki = { ...next.anki, doneToday: false, minutes: 0, reviewsToday: 0 };
    next.obi = { ...next.obi, doneToday: false, activeRecall: false, minutes: 0 };
    next.listening = { ...next.listening, doneToday: false, minutes: 0 };
  } else {
    next.today.morningQuest = input.morningQuest;
    if ('eveningQuest' in input) next.today.eveningQuest = input.eveningQuest;
  }

  if (Number.isFinite(input.backlog)) {
    next.anki.backlog = input.backlog;
    next.anki.newCardsEnabled = input.backlog <= next.anki.newCardsUnlockAt;
  }
  return next;
}

function recordResult(current, input) {
  requireFields(input, ['date']);
  const next = structuredClone(current);
  if (next.today?.date !== input.date) {
    throw new Error(`Result date ${input.date} does not match active quest ${next.today?.date}.`);
  }

  const anki = { ...next.anki, ...(input.anki || {}) };
  anki.doneToday = Number(anki.minutes || 0) >= 10;
  anki.newCardsEnabled = Number(anki.backlog) <= Number(anki.newCardsUnlockAt);

  const obi = { ...next.obi, ...(input.obi || {}) };
  obi.doneToday = Boolean(obi.activeRecall || input.obi?.lessonCompleted);

  const listening = { ...next.listening, ...(input.listening || {}) };
  listening.doneToday = Number(listening.minutes || 0) >= 10;

  const existingDay = next.week.days.find((day) => day.date === input.date);
  const bonusEarned = Boolean(input.bonus?.earned) && (Boolean(existingDay?.bonusEarned) || Number(next.week.bonusStars || 0) < 2);
  const stars = Number(anki.doneToday) + Number(obi.doneToday) + Number(listening.doneToday) + Number(bonusEarned);
  const previousStars = Number(next.today.stars || 0);
  const earnedDelta = Math.max(0, stars - previousStars);

  next.anki = anki;
  next.obi = obi;
  next.listening = listening;
  next.today = {
    ...next.today,
    stars,
    status: stars >= 3 ? 'legendary' : stars >= 2 ? 'solid' : stars === 1 ? 'saved' : 'rest',
    confirmedSummary: input.summary || next.today.confirmedSummary,
    energy: input.energy || next.today.energy,
  };

  next.profile.lifetimeStars = Number(next.profile.lifetimeStars || 0) + earnedDelta;
  next.profile.xp = Number(next.profile.xp || 0) + earnedDelta * 40;
  while (next.profile.xp >= next.profile.xpNext) {
    next.profile.xp -= next.profile.xpNext;
    next.profile.level += 1;
  }

  if (!existingDay && stars > 0) {
    const previousDate = next.week.days.filter((day) => day.confirmed && day.stars > 0).map((day) => day.date).sort().at(-1);
    next.profile.streakDays = previousDate === previousIsoDate(input.date)
      ? Number(next.profile.streakDays || 0) + 1
      : 1;
  } else if (!existingDay && stars === 0) {
    next.profile.streakDays = 0;
  }

  if (existingDay) {
    Object.assign(existingDay, { stars, confirmed: true, bonusEarned });
  } else {
    next.week.days.push({ date: input.date, label: weekday(input.date), stars, confirmed: true, bonusEarned });
  }
  next.week.stars = next.week.days.reduce((sum, day) => sum + Number(day.stars || 0), 0);
  next.week.bonusStars = next.week.days.filter((day) => day.bonusEarned).length;

  const logs = buildLogs(input, stars);
  const logKeys = new Set(logs.map((log) => `${log.date}:${log.label}`));
  next.recentLogs = [...logs, ...next.recentLogs.filter((log) => !logKeys.has(`${log.date}:${log.label}`))].slice(0, 8);
  return next;
}

function buildLogs(input, stars) {
  const logs = [];
  if (input.anki) {
    const reviews = input.anki.reviewsToday ? `, ${input.anki.reviewsToday} reviews` : '';
    logs.push({ date: input.date, label: 'Anki', value: `${input.anki.minutes || 0} min${reviews}`, confirmed: true });
  }
  if (input.obi?.activeRecall || input.obi?.lessonCompleted) {
    const lesson = input.obi.currentLesson ? `Obi ${input.obi.currentLesson}` : 'Obi';
    logs.push({ date: input.date, label: lesson, value: `${input.obi.minutes || 0} min actives`, confirmed: true });
  }
  if (Number(input.listening?.minutes || 0) > 0) {
    logs.push({ date: input.date, label: 'Écoute', value: `${input.listening.minutes} min attentives`, confirmed: true });
  }
  if (input.bonus?.earned) {
    logs.push({ date: input.date, label: 'Bonus', value: input.bonus.label || 'Immersion plaisir', confirmed: true });
  }
  if (!logs.length) logs.push({ date: input.date, label: 'Bilan', value: `${stars} étoile`, confirmed: true });
  return logs;
}

function weekday(date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' })
    .format(new Date(`${date}T12:00:00+02:00`))
    .replace('.', '');
}

function weekStart(date) {
  const value = new Date(`${date}T12:00:00+02:00`);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function previousIsoDate(date) {
  const value = new Date(`${date}T12:00:00+02:00`);
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

function requireFields(input, fields) {
  for (const field of fields) {
    if (!(field in input)) throw new Error(`Missing required field: ${field}`);
  }
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = chunks.join('').trim();
  if (!text) throw new Error('A JSON payload is required on stdin.');
  return JSON.parse(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
