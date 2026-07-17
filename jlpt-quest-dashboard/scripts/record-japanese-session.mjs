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
    next.week = { start: activeWeek, stars: 0, target: next.week?.target || 8, bonusStars: 0, totalMinutes: 0, reviews: 0, days: [] };
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
    next.duolingo = { ...next.duolingo, doneToday: false, minutes: 0, sparksToday: 0, xpToday: 0 };
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

  const obiInput = input.obi || {};
  const obi = { ...next.obi, ...obiInput };
  const completedLesson = Number(obiInput.completedLesson ?? obiInput.currentLesson ?? next.obi.currentLesson);
  obi.doneToday = Boolean(obi.activeRecall || obiInput.lessonCompleted);
  if (obiInput.lessonCompleted && Number.isFinite(completedLesson)) {
    obi.lastCompletedLesson = completedLesson;
    obi.currentLesson = Math.min(Number(obi.totalLessons || completedLesson + 1), completedLesson + 1);
    if (!obiInput.lessonTitle) obi.lessonTitle = "Prochaine leçon à ouvrir";
  }
  delete obi.completedLesson;
  delete obi.lessonCompleted;

  const listening = { ...next.listening, ...(input.listening || {}) };
  listening.doneToday = Number(listening.minutes || 0) >= 10;

  const duolingo = { ...next.duolingo, ...(input.duolingo || {}) };
  delete duolingo.done;
  duolingo.doneToday = Boolean(input.duolingo?.done || Number(duolingo.minutes || 0) > 0);
  duolingo.sparksToday = Number(duolingo.doneToday);
  duolingo.xpToday = duolingo.doneToday ? 5 : 0;

  const existingDay = next.week.days.find((day) => day.date === input.date);
  const duolingoEarned = duolingo.doneToday && !Boolean(existingDay?.duolingoEarned);
  const bonusEarned = Boolean(input.bonus?.earned) && (Boolean(existingDay?.bonusEarned) || Number(next.week.bonusStars || 0) < 2);
  const stars = Number(anki.doneToday) + Number(obi.doneToday) + Number(listening.doneToday) + Number(bonusEarned);
  const dayTotalMinutes = Number(anki.minutes || 0) + Number(obi.minutes || 0) + Number(listening.minutes || 0) + Number(duolingo.minutes || 0);
  const dayReviews = Number(anki.reviewsToday || 0);
  const previousStars = Number(next.today.stars || 0);
  const earnedDelta = Math.max(0, stars - previousStars);

  next.anki = anki;
  next.obi = obi;
  next.listening = listening;
  next.duolingo = duolingo;
  next.today = {
    ...next.today,
    stars,
    status: stars >= 3 ? 'legendary' : stars >= 2 ? 'solid' : stars === 1 ? 'saved' : 'rest',
    confirmedSummary: input.summary || next.today.confirmedSummary,
    energy: input.energy || next.today.energy,
  };
  if (obiInput.lessonCompleted && Number.isFinite(completedLesson)) {
    next.today.eveningQuest = `Obi ${completedLesson} terminé. Prochaine marche : ouvrir Obi ${obi.currentLesson}.`;
  }

  next.profile.lifetimeStars = Number(next.profile.lifetimeStars || 0) + earnedDelta;
  next.profile.xp = Number(next.profile.xp || 0) + (earnedDelta * 40) + (duolingoEarned ? 5 : 0);
  while (next.profile.xp >= next.profile.xpNext) {
    next.profile.level += 1;
    next.profile.xpNext += 100;
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
    Object.assign(existingDay, { stars, confirmed: true, bonusEarned, duolingoEarned: Boolean(existingDay.duolingoEarned || duolingoEarned), totalMinutes: dayTotalMinutes, reviews: dayReviews });
  } else {
    next.week.days.push({ date: input.date, label: weekday(input.date), stars, confirmed: true, bonusEarned, duolingoEarned, totalMinutes: dayTotalMinutes, reviews: dayReviews });
  }
  next.week.stars = next.week.days.reduce((sum, day) => sum + Number(day.stars || 0), 0);
  next.week.bonusStars = next.week.days.filter((day) => day.bonusEarned).length;
  next.duolingo.daysThisWeek = next.week.days.filter((day) => day.duolingoEarned).length;
  next.duolingo.streakDays = calculateDateStreak(next.week.days.filter((day) => day.duolingoEarned).map((day) => day.date), input.date);
  next.week.totalMinutes = next.week.days.reduce((sum, day) => sum + Number(day.totalMinutes || 0), 0);
  next.week.reviews = next.week.days.reduce((sum, day) => sum + Number(day.reviews || 0), 0);

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
    const lessonNumber = input.obi.completedLesson ?? input.obi.currentLesson;
    const lesson = lessonNumber ? `Obi ${lessonNumber}` : 'Obi';
    const value = input.obi.lessonCompleted && !Number(input.obi.minutes || 0)
      ? 'leçon terminée'
      : `${input.obi.minutes || 0} min actives${input.obi.lessonCompleted ? ', leçon terminée' : ''}`;
    logs.push({ date: input.date, label: lesson, value, confirmed: true });
  }
  if (Number(input.listening?.minutes || 0) > 0) {
    logs.push({ date: input.date, label: 'Écoute', value: `${input.listening.minutes} min attentives`, confirmed: true });
  }
  if (input.bonus?.earned) {
    logs.push({ date: input.date, label: 'Bonus', value: input.bonus.label || 'Immersion plaisir', confirmed: true });
  }
  if (input.duolingo?.done || Number(input.duolingo?.minutes || 0) > 0) {
    logs.push({ date: input.date, label: 'Duolingo', value: `${input.duolingo.minutes || 0} min, étincelle +5 XP`, confirmed: true });
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

function calculateDateStreak(dates, fromDate) {
  const active = new Set(dates);
  const cursor = new Date(`${fromDate}T12:00:00+02:00`);
  if (!active.has(fromDate)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
