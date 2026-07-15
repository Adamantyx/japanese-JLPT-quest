#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const url = 'https://ocwstlvorpfwwpxdfdvu.supabase.co';
const apiKey = 'sb_publishable_eyAlvplLV7kS0jvNWthuQw_DQjnqzpS';
const keychainService = 'jlpt-quest-supabase-session';
const keychainAccount = 'default';
const command = process.argv[2];

if (!['login', 'logout', 'snapshot', 'quest', 'result'].includes(command)) {
  fail('Usage: supabase-sync.mjs <login|logout|snapshot|quest|result>');
}

if (command === 'login') await login();
else if (command === 'logout') logout();
else await withSession(command);

async function login() {
  const email = process.env.JLPT_EMAIL;
  const password = process.env.JLPT_PASSWORD;
  if (!email || !password) fail('JLPT_EMAIL et JLPT_PASSWORD sont requis pour la connexion initiale.');
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password })
  });
  const session = await response.json();
  if (!response.ok) fail(session.msg || session.error_description || 'Connexion Supabase impossible.');
  saveRefreshToken(session.refresh_token);
  process.stdout.write('Session Supabase enregistrée dans le Trousseau macOS.\n');
}

function logout() {
  try {
    execFileSync('security', ['delete-generic-password', '-a', keychainAccount, '-s', keychainService], { stdio: 'ignore' });
  } catch {}
  process.stdout.write('Session Supabase locale supprimée.\n');
}

async function withSession(action) {
  const refreshToken = readRefreshToken();
  if (!refreshToken) {
    if (action === 'snapshot') process.stdout.write('{"connected":false,"reason":"not_configured"}\n');
    else process.stdout.write('Supabase ignoré : session locale non configurée.\n');
    return;
  }
  const session = await refreshSession(refreshToken);
  saveRefreshToken(session.refresh_token);
  if (action === 'snapshot') await snapshot(session.access_token);
  else {
    const input = JSON.parse(await readStdin());
    if (action === 'quest') await recordQuest(session.access_token, input);
    else await recordResult(session.access_token, input);
  }
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const session = await response.json();
  if (!response.ok) fail(session.msg || session.error_description || 'Session Supabase expirée.');
  return session;
}

async function snapshot(accessToken) {
  const [profile, events, scores, quests] = await Promise.all([
    rest('profiles?select=*', accessToken),
    rest('study_events?select=*&order=occurred_on.desc,created_at.desc&limit=500', accessToken),
    rest('daily_scores?select=*&order=occurred_on.desc&limit=370', accessToken),
    rest('daily_quests?select=*&order=quest_date.desc&limit=60', accessToken)
  ]);
  process.stdout.write(`${JSON.stringify({ connected: true, profile: profile[0] || null, events, scores, quests }, null, 2)}\n`);
}

async function recordQuest(accessToken, input) {
  const payload = {
    quest_date: input.date,
    morning_quest: input.morningQuest || null,
    evening_quest: input.eveningQuest || null,
    bonus_quest: input.bonusQuest || null,
    backlog: input.backlog ?? null,
    source: 'morning_automation'
  };
  await rest('daily_quests?on_conflict=user_id,quest_date', accessToken, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: payload
  });
  process.stdout.write('Quête synchronisée avec Supabase.\n');
}

async function recordResult(accessToken, input) {
  const events = [];
  if (input.anki && hasFacts(input.anki)) events.push(buildEvent(input.date, 'anki', input.anki));
  if (input.obi && hasFacts(input.obi)) events.push(buildEvent(input.date, 'obi', input.obi));
  if (input.listening && hasFacts(input.listening)) events.push(buildEvent(input.date, 'listening', input.listening));
  if (input.bonus?.earned) events.push(buildEvent(input.date, 'bonus', input.bonus));
  if (!events.length) return process.stdout.write('Aucun fait confirmé à synchroniser.\n');
  await rest('study_events?on_conflict=id', accessToken, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: events
  });
  process.stdout.write(`${events.length} événement(s) synchronisé(s) avec Supabase.\n`);
}

function buildEvent(date, category, facts) {
  return {
    id: deterministicUuid(`${date}:${category}:accountability`),
    occurred_on: date,
    category,
    minutes: Number(facts.minutes || 0),
    reviews: facts.reviewsToday ?? facts.reviews ?? null,
    backlog: facts.backlog ?? null,
    lesson_number: facts.currentLesson ?? facts.lessonNumber ?? null,
    lesson_title: facts.lessonTitle ?? null,
    active_recall: Boolean(facts.activeRecall),
    lesson_completed: Boolean(facts.lessonCompleted),
    note: facts.note ?? null,
    phrase: facts.phrase ?? null,
    energy: facts.energy ?? null,
    source: 'evening_automation'
  };
}

function hasFacts(value) {
  return Number(value.minutes || 0) > 0 || Number(value.reviewsToday || value.reviews || 0) > 0 || value.activeRecall || value.lessonCompleted;
}

async function rest(path, accessToken, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: headers(accessToken, options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) fail(body.message || body.msg || `Supabase HTTP ${response.status}`);
  return body;
}

function headers(accessToken, prefer) {
  return {
    apikey: apiKey,
    authorization: `Bearer ${accessToken || apiKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {})
  };
}

function readRefreshToken() {
  try {
    return execFileSync('security', ['find-generic-password', '-w', '-a', keychainAccount, '-s', keychainService], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function saveRefreshToken(token) {
  execFileSync('security', ['add-generic-password', '-U', '-a', keychainAccount, '-s', keychainService, '-w', token], { stdio: 'ignore' });
}

function deterministicUuid(value) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

async function readStdin() {
  let value = '';
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
