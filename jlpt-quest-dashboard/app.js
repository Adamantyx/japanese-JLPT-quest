const fallback = {
  schemaVersion: 3,
  updatedAt: "2026-07-15T22:55:00+02:00",
  profile: { name: "Juliann", rank: "Voyageur N5", level: 3, xp: 182, xpNext: 250, streakDays: 2, lifetimeStars: 5 },
  campaign: { target: "JLPT N5", targetMonth: "Décembre 2026", countdownDate: "2026-12-01", currentChapter: "Fondations retrouvées", tagline: "一歩一歩" },
  today: { date: "2026-07-15", status: "solid", stars: 2, morningQuest: "12 à 15 min d'Anki, reviews uniquement.", eveningQuest: "Continuer la leçon Obi 45 sans pression de la finir.", confirmedSummary: "16 reviews en 12 min, puis 10 min actives sur Obi 45.", energy: "Relancé" },
  anki: { doneToday: true, minutes: 12, reviewsToday: 16, due: 326, backlog: 310, newCardsEnabled: false, newCardsUnlockAt: 150 },
  obi: { doneToday: true, activeRecall: true, currentLesson: 45, totalLessons: 82, lessonTitle: "Aimer, détester et préférer", minutes: 10, lessonsThisWeek: 1, weeklyTarget: 3 },
  listening: { doneToday: false, title: "Japanese with Shun", minutes: 0, weeklyMinutes: 0, weeklyTargetMinutes: 30 },
  duolingo: { doneToday: false, minutes: 0, sparksToday: 0, daysThisWeek: 0, streakDays: 0, xpToday: 0 },
  boss: { cycle: "2026-07-A", completed: false, passed: false, score: null, xpAwarded: 0 },
  week: { start: "2026-07-13", stars: 2, target: 8, bonusStars: 0, totalMinutes: 22, reviews: 16, days: [{ date: "2026-07-15", label: "Mer", stars: 2, confirmed: true }] },
  milestones: [
    { date: "2026-07-15", title: "Le feu est rallumé", text: "Anki et Obi ont repris sans nouvelles cartes.", state: "complete" },
    { date: "2026-08", title: "Camp de base", text: "Anki quotidien, Obi trois fois par semaine.", state: "next" },
    { date: "2026-10", title: "Premier mock N5", text: "Un test complet révèle les trous réels.", state: "locked" },
    { date: "2026-12", title: "Le sanctuaire N5", text: "Passage du JLPT avec une base consolidée.", state: "locked" }
  ],
  recentLogs: [
    { date: "2026-07-15", label: "Anki", value: "16 reviews en 12 min", confirmed: true },
    { date: "2026-07-15", label: "Obi 45", value: "10 min actives", confirmed: true }
  ]
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const pct = (value, max) => max > 0 ? clamp(Math.round((Number(value) / Number(max)) * 100)) : 0;
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const pendingKey = "jlpt-quest-pending-events-v1";
const bossAttemptKey = "jlpt-quest-boss-attempt-v1";
const bossQuestions = [
  { prompt: "スーパーで魚を買います。", hint: "Quelle temporalité est exprimée ici ?", options: ["J'ai acheté du poisson au supermarché.", "J'achète ou j'achèterai du poisson au supermarché.", "Je n'achète pas de poisson au supermarché."], answer: 1 },
  { prompt: "昨日、本を買いました。", hint: "昨日 signifie hier.", options: ["Hier, j'ai acheté un livre.", "Demain, j'achèterai un livre.", "Hier, je n'ai pas acheté de livre."], answer: 0 },
  { prompt: "魚が好きじゃありません。", hint: "好き exprime le fait d'aimer.", options: ["J'aime le poisson.", "Je préfère le poisson.", "Je n'aime pas le poisson."], answer: 2 },
  { prompt: "七時＿起きます。", hint: "Je me lève à 7 heures.", options: ["を", "に", "で"], answer: 1 },
  { prompt: "日曜日", hint: "Quel sens correspond à ce mot ?", options: ["Samedi", "Dimanche", "Aujourd'hui"], answer: 1 }
];

let baseData = fallback;
let currentData = fallback;
let client = null;
let session = null;
let installPrompt = null;
let toastTimer = null;
let celebrationTimer = null;
let authMode = "login";

function render(data, live, syncText = "Progression synchronisée") {
  currentData = data;
  const days = daysUntil(data.campaign.countdownDate);
  const elapsed = clamp(100 - Math.round((days / 139) * 100));
  animateNumber(document.getElementById("daysLeft"), days, value => String(value), 650);
  document.getElementById("countdown").style.setProperty("--countdown", `${elapsed}%`);
  document.getElementById("chapterLabel").textContent = `Chapitre ${String(data.profile.level).padStart(2, "0")} · ${data.campaign.currentChapter}`;
  document.getElementById("todaySummary").textContent = data.today.confirmedSummary || "Le matin propose. Le réel confirme.";
  document.getElementById("top").dataset.world = worldStage(data.profile.lifetimeStars);

  const mode = live ? "live" : navigator.onLine ? "preview" : "offline";
  setSync(mode, syncText);
  document.getElementById("offlineNotice").classList.toggle("visible", !navigator.onLine);
  document.getElementById("previewBanner").hidden = Boolean(session);

  document.getElementById("heroStats").innerHTML = [
    ["Rang", data.profile.rank],
    ["Niveau", `Niveau ${data.profile.level}`],
    ["Série", `${data.profile.streakDays} jours`],
    ["Aujourd'hui", `${stars(data.today.stars)} ${data.today.stars}/4`]
  ].map(([label, value]) => `<div class="hero-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");

  const xpProgress = pct(data.profile.xp, data.profile.xpNext);
  const xpRemaining = Math.max(0, Number(data.profile.xpNext) - Number(data.profile.xp));
  document.getElementById("levelSigil").textContent = String(data.profile.level).padStart(2, "0");
  animateNumber(document.getElementById("xpText"), data.profile.xp, value => `${value} / ${data.profile.xpNext} XP`, 900);
  document.getElementById("xpBar").style.setProperty("--w", `${xpProgress}%`);
  document.getElementById("xpProgress").setAttribute("aria-valuenow", String(xpProgress));
  document.getElementById("xpRemaining").textContent = `${xpRemaining} XP restant${xpRemaining > 1 ? "s" : ""}`;
  document.getElementById("todayLanterns").innerHTML = Array.from({ length: 4 }, (_, index) => `<span class="lantern ${index < Number(data.today.stars) ? "lit" : ""}" style="--delay:${index * 0.14}s"></span>`).join("");
  document.getElementById("todayLanterns").setAttribute("aria-label", `${data.today.stars} étoile${Number(data.today.stars) > 1 ? "s" : ""} sur 4 aujourd'hui`);
  document.getElementById("lanternCaption").textContent = data.today.stars >= 2
    ? "Journée solide. Le feu est entretenu, inutile d'en faire un examen blanc."
    : data.today.stars === 1 ? "Journée sauvée. Le chemin reste visible." : "Une lanterne suffit pour sauver la journée.";
  const nextMilestone = data.milestones.find(item => item.state === "next") || data.milestones.find(item => item.state === "locked") || data.milestones.at(-1);
  document.getElementById("nextMilestone").textContent = nextMilestone?.title || "Le sanctuaire N5";
  document.getElementById("nextMilestoneText").textContent = nextMilestone?.text || "Continuer un pas après l'autre.";

  const quests = [
    { category: "anki", icon: "復", title: "Anki, la mémoire", body: data.today.morningQuest, done: data.anki.doneToday, state: data.anki.doneToday ? `${data.anki.minutes} min faites` : "À faire" },
    { category: "obi", icon: "文", title: `Obi ${data.obi.currentLesson}, la structure`, body: data.today.eveningQuest, done: data.obi.doneToday, state: data.obi.doneToday ? "Reprise active" : "En attente" },
    { category: "listening", icon: "聴", title: "Écoute, le monde vivant", body: `${data.listening.title}, objectif 10 minutes attentives`, done: data.listening.doneToday, state: data.listening.doneToday ? "Étoile gagnée" : "Optionnelle" }
  ];
  document.getElementById("questList").innerHTML = quests.map((item, index) => `
    <button class="quest-card ${item.done ? "is-done" : ""}" type="button" data-entry-category="${item.category}" style="--quest-delay:${0.08 + index * 0.1}s">
      <span class="quest-icon">${esc(item.done ? "✓" : item.icon)}</span>
      <span class="quest-copy"><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span></span>
      <span class="quest-meta"><span class="reward">${item.done ? "40 XP acquis" : "+40 XP"}</span><span class="quest-state">${esc(item.state)}</span></span>
        </button>`).join("");

  const hasBacklog = data.anki.backlog !== null && data.anki.backlog !== undefined && data.anki.backlog !== "";
  const backlog = hasBacklog ? Number(data.anki.backlog) : null;
  const reviewsToUnlock = hasBacklog ? Math.max(0, backlog - data.anki.newCardsUnlockAt) : null;
  const dojos = [
    { mark: "復", name: "Anki", value: hasBacklog ? `${backlog}` : "—", meta: hasBacklog ? `${reviewsToUnlock} reviews avant le retour des nouvelles cartes` : "Backlog à renseigner lors de la prochaine session", progress: hasBacklog ? data.anki.newCardsEnabled ? 100 : clamp(100 - (reviewsToUnlock / 1.6)) : 0, foot: [`${data.anki.reviewsToday} aujourd'hui`, `${data.anki.minutes} min`] },
    { mark: "文", name: "Obi Senpai", value: `${data.obi.currentLesson}/${data.obi.totalLessons}`, meta: data.obi.lessonTitle, progress: pct(data.obi.currentLesson, data.obi.totalLessons), foot: [`${data.obi.lessonsThisWeek}/${data.obi.weeklyTarget} cette semaine`, `${pct(data.obi.currentLesson, data.obi.totalLessons)}%`] },
    { mark: "聴", name: "Écoute", value: `${data.listening.weeklyMinutes} min`, meta: data.listening.title, progress: pct(data.listening.weeklyMinutes, data.listening.weeklyTargetMinutes), foot: ["Cap hebdo", `${data.listening.weeklyTargetMinutes} min`] }
  ];
  document.getElementById("dojoGrid").innerHTML = dojos.map(item => `
    <article class="dojo" data-mark="${esc(item.mark)}">
      <div class="dojo-top"><span class="dojo-name">${esc(item.name)}</span><span class="quest-state">${Math.round(item.progress)}%</span></div>
      <div class="dojo-value">${esc(item.value)}</div><p class="dojo-meta">${esc(item.meta)}</p>
      <div class="bar" role="progressbar" aria-label="Progression ${esc(item.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(item.progress)}"><i style="--w:${item.progress}%"></i></div>
      <div class="dojo-foot"><span>${esc(item.foot[0])}</span><span>${esc(item.foot[1])}</span></div>
    </article>`).join("");

  const completeCount = data.milestones.filter(item => item.state === "complete").length;
  const pathPct = pct(Math.max(0, completeCount - 1), Math.max(1, data.milestones.length - 1));
  document.getElementById("pathProgress").style.setProperty("--w", `${pathPct}%`);
  document.getElementById("pathTraveler").style.setProperty("--x", `${9 + (pathPct * 0.82)}%`);
  document.getElementById("milestones").innerHTML = data.milestones.map(item => `
    <article class="milestone ${esc(item.state)}">
      <div class="milestone-date">${esc(item.date)}</div><div class="milestone-node"></div>
      <strong>${esc(item.title)}</strong><p>${esc(item.text)}</p>
    </article>`).join("");

  const stage = data.profile.lifetimeStars >= 16 ? "Messager du sanctuaire" : data.profile.lifetimeStars >= 8 ? "Gardien des lanternes" : "Éclaireur du chemin";
  document.getElementById("companionStage").textContent = `${stage} · ${data.profile.lifetimeStars} étoiles`;
  document.getElementById("companionCard").dataset.state = data.today.stars >= 2 ? "active" : "rest";
  document.getElementById("companionSpeech").textContent = companionLine(data.today.stars, data.today.energy);

  renderWeek(data.week);
  document.getElementById("logs").innerHTML = data.recentLogs.length
    ? data.recentLogs.map(item => `<div class="log"><span class="log-date">${formatShortDate(item.date)}</span><strong>${esc(item.label)}</strong><div class="log-detail"><span>${esc(item.value)}</span>${live && item.id ? `<button class="log-delete" type="button" data-delete-event="${esc(item.id)}" aria-label="Supprimer la session ${esc(item.label)} du ${esc(item.date)}">×</button>` : ""}</div></div>`).join("")
    : '<p class="dojo-meta">Le carnet attend sa première session confirmée.</p>';

  document.getElementById("ankiRule").textContent = !hasBacklog
    ? "Renseigne le backlog lors de ta prochaine session Anki. Tant qu'il est inconnu, aucune nouvelle carte par défaut."
    : data.anki.newCardsEnabled
    ? "Le backlog est sous le seuil. Les nouvelles cartes peuvent revenir doucement, 3 à 5 maximum."
    : `Nouvelles cartes gelées jusqu'à ${data.anki.newCardsUnlockAt} reviews de retard. Il en reste ${reviewsToUnlock} à résorber, sans mode punition.`;
  renderGameSystems(data);
  document.getElementById("lastUpdate").textContent = `Mis à jour ${formatDateTime(data.updatedAt)}`;
}

function renderWeek(week) {
  const labels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const start = parseDate(week.start);
  const byDate = new Map(week.days.map(day => [day.date, day]));
  document.getElementById("weekDays").innerHTML = labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const day = byDate.get(toIsoDate(date)) || { stars: 0, confirmed: false };
    return `<div class="day ${day.confirmed ? "confirmed" : ""}"><span>${label}</span><span class="day-stars">${day.stars ? "★".repeat(day.stars) : "·"}</span></div>`;
  }).join("");
  animateNumber(document.getElementById("weekScore"), week.stars, value => String(value), 700);
  document.getElementById("weekTarget").textContent = ` / ${week.target} étoiles`;
  const progress = pct(week.stars, week.target);
  document.getElementById("weekBar").style.setProperty("--w", `${progress}%`);
  document.getElementById("weekBar").parentElement.setAttribute("role", "progressbar");
  document.getElementById("weekBar").parentElement.setAttribute("aria-label", "Objectif hebdomadaire d'étoiles");
  document.getElementById("weekBar").parentElement.setAttribute("aria-valuemin", "0");
  document.getElementById("weekBar").parentElement.setAttribute("aria-valuemax", "100");
  document.getElementById("weekBar").parentElement.setAttribute("aria-valuenow", String(progress));
}

function companionLine(starCount, energy) {
  if (starCount >= 3) return `Trois lanternes. Très belle journée, ${energy ? energy.toLowerCase() : "capitaine"}. On garde le feu, pas besoin d'en rajouter.`;
  if (starCount >= 2) return "Deux étoiles, journée solide. Les bases reprennent leur place, sans séance héroïque.";
  if (starCount === 1) return "Une étoile suffit pour que le chemin reste visible. La journée est sauvée.";
  return "Le chemin n'a pas disparu. Une session de dix minutes suffit pour rallumer la première lanterne.";
}

function deriveProgression(profile, events, scores, quests, bossAttempts = []) {
  const today = toIsoDate();
  const weekStart = toIsoDate(startOfWeek(new Date()));
  const todayEvents = events.filter(event => event.occurred_on === today);
  const weekEvents = events.filter(event => event.occurred_on >= weekStart);
  const scoreMap = new Map(scores.map(score => [score.occurred_on, score]));
  const todayScore = scoreMap.get(today) || { total_stars: 0 };
  const quest = quests.find(item => item.quest_date === today);
  const latestBacklogEvent = events.find(event => event.backlog !== null && event.backlog !== undefined);
  const backlogValue = latestBacklogEvent?.backlog ?? quest?.backlog ?? profile.backlog_seed ?? null;
  const latestObi = events.find(event => event.category === "obi" && event.lesson_number);
  const starsFromEvents = scores.reduce((total, score) => total + Number(score.total_stars || 0), 0);
  const lifetimeStars = Number(profile.lifetime_stars_seed || 0) + starsFromEvents;
  const duolingoDates = [...new Set(events.filter(event => event.category === "duolingo").map(event => event.occurred_on))];
  const bossXp = bossAttempts.filter(attempt => attempt.passed).reduce((total, attempt) => total + Number(attempt.xp_awarded || 0), 0);
  const xp = Number(profile.xp_seed || 0) + (starsFromEvents * 40) + (duolingoDates.length * 5) + bossXp;
  let level = Number(profile.level_seed || 1);
  let xpNext = Number(profile.xp_next_seed || 100);
  while (xp >= xpNext) {
    level += 1;
    xpNext += 100;
  }

  const ankiToday = todayEvents.filter(event => event.category === "anki");
  const obiToday = todayEvents.filter(event => event.category === "obi");
  const listeningToday = todayEvents.filter(event => event.category === "listening");
  const duolingoToday = todayEvents.filter(event => event.category === "duolingo");
  const weekScores = scores.filter(score => score.occurred_on >= weekStart);
  const weekStars = weekScores.reduce((total, score) => total + Number(score.total_stars || 0), 0);
  const logs = events.slice(0, 8).map(eventToLog);

  const data = structuredClone(baseData);
  data.updatedAt = events[0]?.created_at || quests[0]?.updated_at || new Date().toISOString();
  data.profile = {
    name: profile.display_name,
    rank: profile.rank,
    level,
    xp,
    xpNext,
    streakDays: calculateStreak(scores),
    lifetimeStars
  };
  data.campaign.countdownDate = profile.target_date;
  data.campaign.currentChapter = chapterFor(lifetimeStars);
  data.today = {
    date: today,
    status: Number(todayScore.total_stars) >= 2 ? "solid" : Number(todayScore.total_stars) === 1 ? "saved" : "open",
    stars: Number(todayScore.total_stars || 0),
    morningQuest: quest?.morning_quest || "10 à 20 min d'Anki, reviews uniquement.",
    eveningQuest: quest?.evening_quest || `Obi ${latestObi?.lesson_number || profile.current_lesson_seed}, reprise active si l'énergie tient.`,
    confirmedSummary: todayEvents.length ? summaryFor(todayEvents) : "Le matin propose. Le réel confirme.",
    energy: todayEvents.find(event => event.energy)?.energy || ""
  };
  data.anki = {
    doneToday: ankiToday.reduce((sum, event) => sum + Number(event.minutes), 0) >= 10,
    minutes: ankiToday.reduce((sum, event) => sum + Number(event.minutes), 0),
    reviewsToday: ankiToday.reduce((sum, event) => sum + Number(event.reviews || 0), 0),
    due: 0,
    backlog: backlogValue === null ? null : Number(backlogValue),
    newCardsEnabled: backlogValue !== null && Number(backlogValue) <= 150,
    newCardsUnlockAt: 150
  };
  data.obi = {
    doneToday: obiToday.some(event => event.active_recall || event.lesson_completed),
    activeRecall: obiToday.some(event => event.active_recall),
    currentLesson: Number(latestObi?.lesson_number || profile.current_lesson_seed || 1),
    totalLessons: 82,
    lessonTitle: latestObi?.lesson_title || "Bootcamp N5",
    minutes: obiToday.reduce((sum, event) => sum + Number(event.minutes), 0),
    lessonsThisWeek: new Set(weekEvents.filter(event => event.category === "obi" && (event.active_recall || event.lesson_completed)).map(event => event.occurred_on)).size,
    weeklyTarget: 3
  };
  data.listening = {
    doneToday: listeningToday.reduce((sum, event) => sum + Number(event.minutes), 0) >= 10,
    title: "Japanese with Shun",
    minutes: listeningToday.reduce((sum, event) => sum + Number(event.minutes), 0),
    weeklyMinutes: weekEvents.filter(event => event.category === "listening").reduce((sum, event) => sum + Number(event.minutes), 0),
    weeklyTargetMinutes: 30
  };
  data.duolingo = {
    doneToday: duolingoToday.length > 0,
    minutes: duolingoToday.reduce((sum, event) => sum + Number(event.minutes || 0), 0),
    sparksToday: duolingoToday.length ? 1 : 0,
    daysThisWeek: new Set(weekEvents.filter(event => event.category === "duolingo").map(event => event.occurred_on)).size,
    streakDays: calculateDateStreak(duolingoDates),
    xpToday: duolingoToday.length ? 5 : 0
  };
  const currentBoss = bossAttempts.find(attempt => attempt.cycle_key === bossCycleKey()) || null;
  data.boss = {
    cycle: bossCycleKey(),
    completed: Boolean(currentBoss),
    passed: Boolean(currentBoss?.passed),
    score: currentBoss?.score ?? null,
    xpAwarded: Number(currentBoss?.xp_awarded || 0)
  };
  data.week = {
    start: weekStart,
    stars: weekStars,
    target: Number(profile.weekly_star_target || 8),
    bonusStars: weekScores.reduce((total, score) => total + Number(score.bonus_star || 0), 0),
    days: weekScores.map(score => ({ date: score.occurred_on, stars: Number(score.total_stars), confirmed: true })),
    totalMinutes: weekEvents.reduce((sum, event) => sum + Number(event.minutes || 0), 0),
    reviews: weekEvents.reduce((sum, event) => sum + Number(event.reviews || 0), 0)
  };
  data.recentLogs = logs;
  return data;
}

function eventToLog(event) {
  const common = { id: event.id, date: event.occurred_on, confirmed: true };
  if (event.category === "anki") return { ...common, label: "Anki", value: `${event.reviews || 0} reviews en ${event.minutes} min` };
  if (event.category === "obi") return { ...common, label: `Obi ${event.lesson_number || ""}`.trim(), value: `${event.minutes} min${event.active_recall ? " avec rappel actif" : ""}` };
  if (event.category === "listening") return { ...common, label: "Écoute", value: `${event.minutes} min${event.phrase ? `, ${event.phrase}` : ""}` };
  if (event.category === "duolingo") return { ...common, label: "Duolingo", value: `${event.minutes || 0} min, étincelle +5 XP` };
  return { ...common, label: "Bonus", value: event.note || "Immersion plaisir" };
}

function summaryFor(events) {
  return events.map(event => eventToLog(event).value).join(" · ");
}

function chapterFor(starCount) {
  if (starCount >= 32) return "La route du sanctuaire";
  if (starCount >= 16) return "Les fondations solides";
  if (starCount >= 8) return "Les lanternes régulières";
  return "Fondations retrouvées";
}

function calculateStreak(scores) {
  const active = new Set(scores.filter(score => Number(score.total_stars) > 0).map(score => score.occurred_on));
  let cursor = new Date();
  if (!active.has(toIsoDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateDateStreak(dates) {
  const active = new Set(dates);
  let cursor = new Date();
  if (!active.has(toIsoDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function worldStage(starsCount) {
  if (Number(starsCount) >= 32) return "sanctuary";
  if (Number(starsCount) >= 16) return "morning";
  if (Number(starsCount) >= 8) return "dawn";
  return "night";
}

function companionEvolution(starsCount) {
  const stages = [
    { key: "scout", title: "Éclaireur du chemin", threshold: 0 },
    { key: "guardian", title: "Gardien des lanternes", threshold: 8 },
    { key: "messenger", title: "Messager du sanctuaire", threshold: 16 },
    { key: "sage", title: "Sage des fondations", threshold: 32 }
  ];
  const current = [...stages].reverse().find(stage => Number(starsCount) >= stage.threshold) || stages[0];
  const next = stages[stages.indexOf(current) + 1] || null;
  return { current, next };
}

function renderGameSystems(data) {
  const duolingo = data.duolingo || fallback.duolingo;
  document.getElementById("sparkOrb").classList.toggle("is-lit", duolingo.doneToday);
  document.getElementById("sparkOrb").textContent = duolingo.doneToday ? "✓" : "火";
  document.getElementById("sparkStats").innerHTML = [
    `<span class="mini-chip gold">${duolingo.doneToday ? "+5 XP aujourd'hui" : "+5 XP max / jour"}</span>`,
    `<span class="mini-chip">${duolingo.daysThisWeek || 0} jour${Number(duolingo.daysThisWeek) > 1 ? "s" : ""} cette semaine</span>`,
    `<span class="mini-chip">Série ${duolingo.streakDays || 0} j</span>`
  ].join("");
  const sparkButton = document.getElementById("recordDuolingoButton");
  sparkButton.disabled = Boolean(duolingo.doneToday);
  sparkButton.textContent = duolingo.doneToday ? "Étincelle allumée" : "Noter mon étincelle";

  const grammarProgress = pct(data.obi.currentLesson, data.obi.totalLessons);
  const skills = [
    { mark: "仮", name: "Kana", status: "Socle vérifié", progress: 100, evidence: "Hiragana et katakana acquis", className: "is-verified" },
    { mark: "文", name: "Grammaire", status: "Couverture", progress: grammarProgress, evidence: `${data.obi.currentLesson}/${data.obi.totalLessons} leçons Obi parcourues`, className: "" },
    { mark: "語", name: "Vocabulaire", status: "Non mesuré", progress: null, evidence: `${data.anki.backlog ?? "—"} reviews en attente, pas une mesure de maîtrise`, className: "is-unmeasured" },
    { mark: "漢", name: "Kanji", status: "Non mesuré", progress: null, evidence: "Un futur mini-test débloquera une mesure fiable", className: "is-unmeasured" }
  ];
  document.getElementById("skillGrid").innerHTML = skills.map(skill => `
    <article class="skill-region ${skill.className}" data-mark="${skill.mark}">
      <div class="skill-head"><strong>${skill.name}</strong><span class="skill-status">${skill.status}</span></div>
      <p>${skill.progress === null ? "Aucune fausse jauge ici. On attend une preuve exploitable." : skill.progress === 100 ? "Province sécurisée, entretien léger." : "Notions rencontrées dans le parcours Obi."}</p>
      <div class="bar" role="progressbar" aria-label="${skill.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${skill.progress ?? 0}"><i style="--w:${skill.progress ?? 0}%"></i></div>
      <span class="skill-evidence">${skill.evidence}</span>
    </article>`).join("");

  const evolution = companionEvolution(data.profile.lifetimeStars);
  const evolutionProgress = evolution.next ? pct(Number(data.profile.lifetimeStars) - evolution.current.threshold, evolution.next.threshold - evolution.current.threshold) : 100;
  document.getElementById("companionCard").dataset.evolution = evolution.current.key;
  document.getElementById("companionStage").textContent = `${evolution.current.title} · ${data.profile.lifetimeStars} étoiles`;
  document.getElementById("evolutionBar").style.setProperty("--w", `${evolutionProgress}%`);
  document.getElementById("evolutionNext").textContent = evolution.next ? `${evolution.next.threshold - Number(data.profile.lifetimeStars)} étoiles avant ${evolution.next.title}` : "Évolution maximale actuelle";

  const seals = [
    { icon: "火", name: "Premier feu", text: "Première étoile confirmée", unlocked: data.profile.lifetimeStars >= 1 },
    { icon: "双", name: "Journée solide", text: "Deux lanternes en un jour", unlocked: data.today.stars >= 2 },
    { icon: "四", name: "Cap Obi 45", text: "La moitié du Bootcamp approchée", unlocked: data.obi.currentLesson >= 45 },
    { icon: "週", name: "Semaine ardente", text: "Cinq étoiles sur une semaine", unlocked: data.week.stars >= 5 },
    { icon: "復", name: "Montagne réduite", text: "Backlog Anki sous 250", unlocked: data.anki.backlog !== null && data.anki.backlog < 250 },
    { icon: "試", name: "Épreuve N5", text: "Mini-boss réussi à 4/5", unlocked: Boolean(data.boss?.passed) }
  ];
  document.getElementById("sealGrid").innerHTML = seals.map(seal => `<article class="seal ${seal.unlocked ? "" : "locked"}"><div class="seal-icon"><span>${seal.unlocked ? seal.icon : "鎖"}</span></div><strong>${seal.name}</strong><p>${seal.text}</p></article>`).join("");

  const totalMinutes = Number(data.week.totalMinutes ?? (Number(data.anki.minutes) + Number(data.obi.minutes) + Number(data.listening.minutes) + Number(duolingo.minutes)));
  const nextStep = Number(data.anki.backlog) > 150 ? "10 à 20 min de reviews Anki, aucune nouvelle carte." : data.obi.lessonsThisWeek < data.obi.weeklyTarget ? `Reprise active Obi ${data.obi.currentLesson}.` : "10 min de Japanese with Shun.";
  document.getElementById("expeditionList").innerHTML = [
    ["Feu récolté", `${data.week.stars}/${data.week.target} étoiles`],
    ["Temps engagé", `${totalMinutes} min`],
    ["Anki", `${data.week.reviews ?? data.anki.reviewsToday} reviews`],
    ["Obi", `${data.obi.lessonsThisWeek}/${data.obi.weeklyTarget} reprises actives`],
    ["Étincelles Duo", `${duolingo.daysThisWeek || 0}`]
  ].map(([label, value]) => `<div class="expedition-line"><span>${label}</span><strong>${value}</strong></div>`).join("");
  document.getElementById("expeditionNext").textContent = nextStep;

  const boss = data.boss || fallback.boss;
  document.getElementById("bossScore").textContent = boss.completed ? `${boss.score}/5` : "—";
  document.getElementById("bossStatus").textContent = boss.completed ? boss.passed ? "Sceau débloqué" : "À retenter au prochain cycle" : "Disponible";
  document.getElementById("startBossButton").textContent = boss.completed ? "Déjà tenté" : "Affronter";
  document.getElementById("startBossButton").disabled = boss.completed;
}

function bossCycleKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getDate() <= 15 ? "A" : "B"}`;
}

async function loadCloud() {
  if (!session) return;
  setSync("syncing", "Synchronisation...");
  const [profileResult, eventsResult, scoresResult, questsResult, bossResult] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
    client.from("study_events").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    client.from("daily_scores").select("*").order("occurred_on", { ascending: false }).limit(370),
    client.from("daily_quests").select("*").order("quest_date", { ascending: false }).limit(60),
    client.from("boss_attempts").select("*").order("attempted_at", { ascending: false }).limit(30)
  ]);
  const failure = [profileResult, eventsResult, scoresResult, questsResult].find(result => result.error);
  if (failure) throw failure.error;
  if (!profileResult.data) throw new Error("Profil Supabase introuvable.");
  const cloudIsEmpty = eventsResult.data.length === 0;
  document.getElementById("importHistoryButton").hidden = !cloudIsEmpty;
  document.getElementById("restoreBanner").hidden = !cloudIsEmpty;
  if (cloudIsEmpty) {
    render(baseData, true, "Compte relié");
    document.getElementById("restoreBanner").hidden = false;
    setSync("pending", "Progression à restaurer");
    return;
  }
  render(deriveProgression(profileResult.data, eventsResult.data, scoresResult.data, questsResult.data, bossResult.error ? [] : bossResult.data), true);
}

async function importStarterHistory() {
  if (!session) return;
  const button = document.getElementById("importHistoryButton");
  const restoreButton = document.getElementById("restoreProgressButton");
  button.disabled = true;
  restoreButton.disabled = true;
  const profileUpdate = {
    display_name: "Juliann",
    level_seed: 3,
    xp_seed: 102,
    xp_next_seed: 250,
    lifetime_stars_seed: 3,
    backlog_seed: 310,
    current_lesson_seed: 45
  };
  const starterEvents = [
    { id: "71520260-0000-5000-8000-000000000001", occurred_on: "2026-07-15", category: "anki", minutes: 12, reviews: 16, backlog: 310, note: "Reprise confirmée", source: "migration" },
    { id: "71520260-0000-5000-8000-000000000002", occurred_on: "2026-07-15", category: "obi", minutes: 10, lesson_number: 45, lesson_title: "Aimer, détester et préférer", active_recall: true, note: "Reprise active confirmée", source: "migration" }
  ];
  const starterQuest = {
    quest_date: "2026-07-15",
    morning_quest: "12 à 15 min d'Anki, reviews uniquement.",
    evening_quest: "Continuer la leçon Obi 45 sans pression de la finir.",
    backlog: 310,
    source: "migration"
  };
  try {
    const results = await Promise.all([
      client.from("profiles").update(profileUpdate).eq("user_id", session.user.id),
      client.from("study_events").upsert(starterEvents, { onConflict: "id" }),
      client.from("daily_quests").upsert(starterQuest, { onConflict: "user_id,quest_date" })
    ]);
    const failure = results.find(result => result.error);
    if (failure) throw failure.error;
    button.hidden = true;
    document.getElementById("restoreBanner").hidden = true;
    showToast("Le départ du 15 juillet est importé. Tes 2 étoiles sont là.");
    await loadCloud();
  } catch (error) {
    showToast(readableError(error));
  } finally {
    button.disabled = false;
    restoreButton.disabled = false;
  }
}

async function submitEntry(event) {
  event.preventDefault();
  const category = document.getElementById("entryCategory").value;
  if (!session && category !== "duolingo") {
    document.getElementById("entryDialog").close();
    openAuth();
    return;
  }
  const payload = {
    id: crypto.randomUUID(),
    occurred_on: document.getElementById("entryDate").value,
    category,
    minutes: category === "bonus" ? 0 : numberValue("entryMinutes"),
    reviews: category === "anki" ? optionalNumber("entryReviews") : null,
    backlog: category === "anki" ? optionalNumber("entryBacklog") : null,
    lesson_number: category === "obi" ? optionalNumber("entryLesson") : null,
    lesson_title: category === "obi" ? textValue("entryLessonTitle") : null,
    active_recall: category === "obi" && document.getElementById("entryRecall").checked,
    lesson_completed: category === "obi" && document.getElementById("entryCompleted").checked,
    phrase: category === "listening" ? textValue("entryPhrase") : null,
    note: textValue("entryNote"),
    source: "app"
  };

  const submit = document.querySelector('#entryForm button[type="submit"]');
  submit.disabled = true;
  try {
    if (!session) {
      if (!queueEvent(payload)) return;
      baseData = applyPendingPreviewEvents(baseData);
      render(baseData, false, "Étincelle gardée sur cet appareil");
      showToast("Étincelle allumée. +5 XP, elle sera synchronisée à la connexion.");
      celebrate(payload);
    } else if (category === "duolingo" && navigator.onLine) {
      const { data: existingSpark, error: sparkError } = await client
        .from("study_events")
        .select("id")
        .eq("category", "duolingo")
        .eq("occurred_on", payload.occurred_on)
        .maybeSingle();
      if (sparkError) throw sparkError;
      if (existingSpark) {
        showToast("L'étincelle Duolingo de ce jour est déjà comptée.");
        return;
      }
    }
    if (session && !navigator.onLine) {
      if (!queueEvent(payload)) return;
      showToast(category === "duolingo" ? "Étincelle gardée hors ligne." : "Session gardée hors ligne. Elle partira au retour du réseau.");
    } else if (session) {
      const { error } = await client.from("study_events").insert(payload);
      if (error && isNetworkError(error)) {
        if (!queueEvent(payload)) return;
        showToast("Le réseau a décroché. Session gardée sur cet appareil.");
      } else if (error) {
        throw error;
      } else {
        showToast(category === "duolingo" ? "Étincelle allumée. +5 XP." : "Lanterne allumée. Session confirmée.");
        celebrate(payload);
        await loadCloud();
      }
    }
    document.getElementById("entryDialog").close();
    document.getElementById("entryNote").value = "";
  } catch (error) {
    showToast(readableError(error));
  } finally {
    submit.disabled = false;
  }
}

function queueEvent(payload) {
  const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
  if (payload.category === "duolingo" && queued.some(item => item.category === "duolingo" && item.occurred_on === payload.occurred_on)) {
    showToast("Cette étincelle Duolingo attend déjà la synchronisation.");
    return false;
  }
  queued.push(payload);
  localStorage.setItem(pendingKey, JSON.stringify(queued));
  setSync("pending", `${queued.length} session${queued.length > 1 ? "s" : ""} en attente`);
  return true;
}

function applyPendingPreviewEvents(data) {
  const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
  const pendingSparks = queued.filter(item => item.category === "duolingo");
  const today = toIsoDate();
  const todaySpark = pendingSparks.find(item => item.occurred_on === today);
  if (!todaySpark || data.duolingo?.doneToday) return data;

  const next = structuredClone(data);
  const minutes = Number(todaySpark.minutes || 0);
  next.duolingo = {
    ...next.duolingo,
    doneToday: true,
    minutes,
    sparksToday: 1,
    xpToday: 5
  };
  next.profile.xp = Number(next.profile.xp || 0) + 5;
  while (next.profile.xp >= next.profile.xpNext) {
    next.profile.level += 1;
    next.profile.xpNext += 100;
  }

  const weekStartDate = toIsoDate(startOfWeek(new Date()));
  const knownSparkDates = next.week.days.filter(day => day.duolingoEarned).map(day => day.date);
  const pendingSparkDates = pendingSparks.map(item => item.occurred_on);
  const weekSparkDates = [...new Set([...knownSparkDates, ...pendingSparkDates])].filter(date => date >= weekStartDate);
  next.duolingo.daysThisWeek = weekSparkDates.length;
  next.duolingo.streakDays = calculateDateStreak([...new Set([...knownSparkDates, ...pendingSparkDates])]);

  let day = next.week.days.find(item => item.date === today);
  if (!day) {
    day = { date: today, label: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date()), stars: 0, confirmed: true };
    next.week.days.push(day);
  }
  if (!day.duolingoEarned) {
    day.duolingoEarned = true;
    day.totalMinutes = Number(day.totalMinutes || 0) + minutes;
    next.week.totalMinutes = Number(next.week.totalMinutes || 0) + minutes;
  }
  next.recentLogs = [
    { date: today, label: "Duolingo", value: `${minutes} min, étincelle +5 XP`, confirmed: true },
    ...next.recentLogs.filter(log => !(log.date === today && log.label === "Duolingo"))
  ].slice(0, 8);
  next.updatedAt = new Date().toISOString();
  return next;
}

async function flushQueue() {
  if (!session || !navigator.onLine) return 0;
  const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
  if (!queued.length) return 0;
  setSync("syncing", `Envoi de ${queued.length} session${queued.length > 1 ? "s" : ""}...`);
  const { error } = await client.from("study_events").upsert(queued, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    setSync("pending", `${queued.length} session${queued.length > 1 ? "s" : ""} en attente`);
    return 0;
  }
  localStorage.removeItem(pendingKey);
  showToast(`${queued.length} session${queued.length > 1 ? "s" : ""} hors ligne synchronisée${queued.length > 1 ? "s" : ""}.`);
  return queued.length;
}

function updateCategoryFields() {
  const category = document.getElementById("entryCategory").value;
  document.querySelectorAll(".category-only").forEach(field => {
    field.hidden = !field.dataset.categories.split(" ").includes(category);
  });
  const minutes = document.getElementById("entryMinutes");
  minutes.value = category === "duolingo" ? "3" : category === "obi" || category === "listening" ? "10" : "12";
  const hints = {
    anki: "10 minutes d'Anki donnent une étoile. Pas besoin de finir la montagne aujourd'hui.",
    obi: "Une reprise active ou une leçon terminée donne l'étoile Obi.",
    listening: "10 minutes attentives donnent l'étoile. Une seule phrase repérée suffit.",
    duolingo: "Une session donne une étincelle et 5 XP, une seule fois par jour. Elle ne sauve pas la journée.",
    bonus: "Bonus plaisir, One Piece attentif ou kanji relié à un mot connu. Deux fois par semaine maximum."
  };
  document.getElementById("entryHint").textContent = hints[category];
}

async function submitAuth(event) {
  event.preventDefault();
  if (authMode === "signup") return signUp();
  if (authMode === "recovery") return updatePassword();
  setAuthStatus("Connexion...");
  const { error } = await client.auth.signInWithPassword({ email: textValue("authEmail"), password: document.getElementById("authPassword").value });
  setAuthStatus(error ? readableError(error) : "Connecté. Le chemin se synchronise.");
}

async function signUp() {
  setAuthStatus("Création du compte...");
  const options = { data: { display_name: textValue("authName") || "Voyageur" } };
  if (location.protocol.startsWith("http")) options.emailRedirectTo = `${location.origin}${location.pathname}`;
  const { data, error } = await client.auth.signUp({ email: textValue("authEmail"), password: document.getElementById("authPassword").value, options });
  if (error) setAuthStatus(readableError(error));
  else if (!data.session) setAuthStatus("Compte créé. Confirme l'email reçu, puis reconnecte-toi ici.");
  else setAuthStatus("Compte créé et connecté.");
}

async function requestPasswordReset() {
  const email = textValue("authEmail");
  if (!email) return setAuthStatus("Entre ton email, puis relance la récupération.");
  setAuthStatus("Envoi du lien de récupération...");
  const redirectTo = location.protocol.startsWith("http") ? `${location.origin}${location.pathname}` : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  setAuthStatus(error ? readableError(error) : "Lien envoyé. Ouvre l'email sur cet appareil pour choisir un nouveau mot de passe.");
}

async function updatePassword() {
  setAuthStatus("Mise à jour du mot de passe...");
  const { error } = await client.auth.updateUser({ password: document.getElementById("authPassword").value });
  if (error) return setAuthStatus(readableError(error));
  setAuthStatus("Mot de passe mis à jour. Tu es connecté.");
  setAuthMode("login");
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  document.getElementById("authModes").hidden = recovery || Boolean(session);
  document.getElementById("authNameField").hidden = !signup;
  document.getElementById("authEmailField").hidden = recovery;
  document.getElementById("forgotPasswordButton").hidden = mode !== "login";
  document.getElementById("authTitle").textContent = recovery ? "Choisir un nouveau mot de passe" : signup ? "Créer ton compte voyageur" : "Synchroniser le chemin";
  document.getElementById("authSubmitButton").textContent = recovery ? "Mettre à jour" : signup ? "Créer mon compte" : "Se connecter";
  document.getElementById("authPassword").autocomplete = recovery || signup ? "new-password" : "current-password";
  document.querySelectorAll("[data-auth-mode]").forEach(button => button.classList.toggle("active", button.dataset.authMode === mode));
  setAuthStatus("");
}

async function deleteStudyEvent(id) {
  if (!session || !id) return;
  if (!window.confirm("Supprimer cette session du carnet ? Les étoiles seront recalculées.")) return;
  setSync("syncing", "Correction du carnet...");
  const { error } = await client.from("study_events").delete().eq("id", id);
  if (error) {
    showToast(readableError(error));
    return loadCloud();
  }
  showToast("Session supprimée. Le carnet est à jour.");
  await loadCloud();
}

async function signOut() {
  await client.auth.signOut();
  document.getElementById("authDialog").close();
  render(baseData, false, "Aperçu non connecté");
}

async function handleSession(nextSession) {
  session = nextSession;
  const signedIn = Boolean(session);
  document.getElementById("accountButton").textContent = signedIn ? session.user.user_metadata?.display_name || "Mon compte" : "Connexion";
  document.getElementById("authForm").hidden = signedIn;
  document.getElementById("authModes").hidden = signedIn || authMode === "recovery";
  document.getElementById("signedInActions").hidden = !signedIn;
  document.getElementById("accountCard").classList.toggle("visible", signedIn);
  document.getElementById("previewBanner").hidden = signedIn;
  if (!signedIn) document.getElementById("restoreBanner").hidden = true;
  if (signedIn) {
    document.getElementById("accountName").textContent = session.user.user_metadata?.display_name || "Voyageur N5";
    document.getElementById("accountEmail").textContent = session.user.email;
    await flushQueue();
    await loadCloud();
  } else {
    setAuthMode("login");
  }
}

function openEntry(category = null) {
  if (!session && category !== "duolingo") return openAuth("Connecte-toi une fois pour enregistrer ta progression depuis tous tes appareils.");
  if (category) document.getElementById("entryCategory").value = category;
  updateCategoryFields();
  document.getElementById("entryDate").value = toIsoDate();
  document.getElementById("entryDialog").showModal();
}

function openAuth(message = "") {
  setAuthStatus(message);
  document.getElementById("authDialog").showModal();
}

function openBoss() {
  const currentBoss = currentData.boss || fallback.boss;
  if (currentBoss.completed) return showToast("Mini-boss déjà tenté pour ce cycle. Le prochain arrive dans l'autre moitié du mois.");
  document.getElementById("bossQuestions").innerHTML = bossQuestions.map((question, questionIndex) => `
    <fieldset class="quiz-question"><legend>${questionIndex + 1}. ${esc(question.prompt)}</legend><small>${esc(question.hint)}</small><div class="quiz-options">
      ${question.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="boss-${questionIndex}" value="${optionIndex}" required> <span>${esc(option)}</span></label>`).join("")}
    </div></fieldset>`).join("");
  document.getElementById("bossDialog").showModal();
}

async function submitBoss(event) {
  event.preventDefault();
  const answers = bossQuestions.map((_, index) => Number(document.querySelector(`input[name="boss-${index}"]:checked`).value));
  const score = answers.reduce((total, answer, index) => total + Number(answer === bossQuestions[index].answer), 0);
  const passed = score >= 4;
  const attempt = { cycle_key: bossCycleKey(), score, passed, answers, xp_awarded: passed ? 25 : 0 };
  const button = document.querySelector('#bossForm button[type="submit"]');
  button.disabled = true;
  try {
    if (session) {
      const { error } = await client.from("boss_attempts").insert(attempt);
      if (error) throw error;
      await loadCloud();
    } else {
      const previous = readLocalBossAttempt();
      localStorage.setItem(bossAttemptKey, JSON.stringify(attempt));
      const next = structuredClone(currentData);
      next.boss = { cycle: attempt.cycle_key, completed: true, passed, score, xpAwarded: attempt.xp_awarded };
      if (passed && !previous?.passed) next.profile.xp += 25;
      baseData = next;
      render(next, false, "Aperçu non connecté");
    }
    document.getElementById("bossDialog").close();
    showBossResult(score, passed);
  } catch (error) {
    showToast(readableError(error));
  } finally {
    button.disabled = false;
  }
}

function showBossResult(score, passed) {
  document.getElementById("celebrationSigil").textContent = passed ? "試" : "学";
  document.getElementById("celebrationTitle").textContent = passed ? "Mini-boss vaincu" : "Trous repérés";
  document.getElementById("celebrationText").textContent = `${score}/5. ${passed ? "Le sceau Épreuve N5 rejoint ta collection." : "Aucune perte. Ces erreurs indiquent simplement quoi revoir."}`;
  document.getElementById("celebrationXp").textContent = passed ? "+25 XP · Sceau débloqué" : "Prochaine tentative au prochain cycle";
  launchCelebrationParticles();
}

function readLocalBossAttempt() {
  try {
    const attempt = JSON.parse(localStorage.getItem(bossAttemptKey) || "null");
    return attempt?.cycle_key === bossCycleKey() ? attempt : null;
  } catch {
    return null;
  }
}

function applyLocalBossAttempt(data) {
  const attempt = readLocalBossAttempt();
  if (!attempt) return data;
  const next = structuredClone(data);
  next.boss = {
    cycle: attempt.cycle_key,
    completed: true,
    passed: Boolean(attempt.passed),
    score: Number(attempt.score),
    xpAwarded: Number(attempt.xp_awarded || 0)
  };
  if (attempt.passed) next.profile.xp = Number(next.profile.xp || 0) + Number(attempt.xp_awarded || 0);
  return next;
}

function bindUi() {
  document.getElementById("quickAddButton").addEventListener("click", () => openEntry());
  document.getElementById("heroRecordButton").addEventListener("click", () => openEntry());
  document.getElementById("previewLoginButton").addEventListener("click", () => openAuth());
  document.getElementById("restoreProgressButton").addEventListener("click", importStarterHistory);
  document.getElementById("accountButton").addEventListener("click", () => openAuth());
  document.getElementById("recordDuolingoButton").addEventListener("click", () => openEntry("duolingo"));
  document.getElementById("startBossButton").addEventListener("click", openBoss);
  document.getElementById("bossForm").addEventListener("submit", submitBoss);
  document.getElementById("questList").addEventListener("click", event => {
    const quest = event.target.closest("[data-entry-category]");
    if (quest) openEntry(quest.dataset.entryCategory);
  });
  document.getElementById("logs").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-event]");
    if (button) deleteStudyEvent(button.dataset.deleteEvent);
  });
  document.getElementById("entryCategory").addEventListener("change", updateCategoryFields);
  document.getElementById("entryForm").addEventListener("submit", submitEntry);
  document.getElementById("authForm").addEventListener("submit", submitAuth);
  document.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
  document.getElementById("forgotPasswordButton").addEventListener("click", requestPasswordReset);
  document.getElementById("signOutButton").addEventListener("click", signOut);
  document.getElementById("importHistoryButton").addEventListener("click", importStarterHistory);
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
  window.addEventListener("online", async () => {
    document.getElementById("offlineNotice").classList.remove("visible");
    await flushQueue();
    if (session) await loadCloud();
  });
  window.addEventListener("offline", () => {
    document.getElementById("offlineNotice").classList.add("visible");
    setSync("offline", "Hors ligne");
  });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    document.getElementById("installButton").hidden = false;
  });
  document.getElementById("installButton").addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    document.getElementById("installButton").hidden = true;
  });
}

async function loadBaseData() {
  try {
    const response = await fetch(`../progression.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("progression.json unavailable");
    return applyPendingPreviewEvents(applyLocalBossAttempt(await response.json()));
  } catch {
    return applyPendingPreviewEvents(applyLocalBossAttempt(fallback));
  }
}

async function boot() {
  bindUi();
  updateCategoryFields();
  document.getElementById("entryDate").value = toIsoDate();
  baseData = await loadBaseData();
  render(baseData, false, location.protocol === "file:" ? "Aperçu local" : "Aperçu non connecté");

  if (!window.supabase || !window.JLPT_SUPABASE) {
    showToast("La synchronisation Supabase n'a pas pu démarrer.");
    return;
  }
  client = window.supabase.createClient(window.JLPT_SUPABASE.url, window.JLPT_SUPABASE.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data } = await client.auth.getSession();
  await handleSession(data.session);
  client.auth.onAuthStateChange((event, nextSession) => setTimeout(async () => {
    if (event === "PASSWORD_RECOVERY") {
      session = nextSession;
      setAuthMode("recovery");
      openAuth("Choisis maintenant un nouveau mot de passe.");
      return;
    }
    await handleSession(nextSession);
  }, 0));

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function setSync(state, label) {
  const sync = document.getElementById("syncState");
  sync.classList.remove("is-offline", "is-preview", "is-syncing", "is-pending");
  if (state !== "live") sync.classList.add(`is-${state}`);
  document.getElementById("syncLabel").textContent = label;
}

function setAuthStatus(message) { document.getElementById("authStatus").textContent = message; }
function textValue(id) { return document.getElementById(id).value.trim() || null; }
function numberValue(id) { return Number(document.getElementById(id).value || 0); }
function optionalNumber(id) { const value = document.getElementById(id).value; return value === "" ? null : Number(value); }
function stars(count) { return Number(count) > 0 ? "★".repeat(Number(count)) : "☆"; }
function daysUntil(date) { return Math.max(0, Math.ceil((parseDate(date) - new Date()) / 86400000)); }
function parseDate(date) { return new Date(`${date}T12:00:00`); }
function toIsoDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function startOfWeek(date) { const copy = new Date(date); const day = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - day); copy.setHours(12, 0, 0, 0); return copy; }
function formatShortDate(date) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(parseDate(date)); }
function formatDateTime(date) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)); }
function readableError(error) { return error?.message ? `Impossible pour l'instant : ${error.message}` : "Impossible pour l'instant. Réessaie dans un instant."; }
function isNetworkError(error) { return !navigator.onLine || /fetch|network|connexion|réseau/i.test(error?.message || ""); }

function animateNumber(element, target, formatter, duration = 700) {
  const finalValue = Number(target) || 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const current = Number(element.dataset.value || String(element.textContent).match(/\d+/)?.[0] || 0);
  element.dataset.value = String(finalValue);
  if (reducedMotion || current === finalValue) {
    element.textContent = formatter(finalValue);
    return;
  }
  cancelAnimationFrame(element._countFrame);
  const start = performance.now();
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatter(Math.round(current + ((finalValue - current) * eased)));
    if (progress < 1) element._countFrame = requestAnimationFrame(tick);
  };
  element._countFrame = requestAnimationFrame(tick);
}

function celebrate(payload) {
  const isDuolingo = payload.category === "duolingo";
  const earned = payload.category === "anki" ? Number(payload.minutes) >= 10
    : payload.category === "obi" ? payload.active_recall || payload.lesson_completed
      : payload.category === "listening" ? Number(payload.minutes) >= 10
        : payload.category === "bonus";
  const copy = {
    anki: ["復", "Mémoire renforcée", `${payload.minutes} min d'Anki inscrites dans le carnet.`],
    obi: ["文", "Structure consolidée", `Obi ${payload.lesson_number || ""} avance d'un pas.`],
    listening: ["聴", "Oreille éveillée", `${payload.minutes} min de japonais vivant.`],
    duolingo: ["火", "Étincelle allumée", "Le mouvement est lancé. La vraie quête reste Anki, Obi ou l'écoute."],
    bonus: ["遊", "Bonus plaisir", "Le japonais a aussi le droit d'être un jeu."]
  }[payload.category] || ["星", "Trace enregistrée", "Le chemin garde la mémoire de ce pas."];
  document.getElementById("celebrationSigil").textContent = copy[0];
  document.getElementById("celebrationTitle").textContent = earned || isDuolingo ? copy[1] : "Trace enregistrée";
  document.getElementById("celebrationText").textContent = copy[2];
  document.getElementById("celebrationXp").textContent = isDuolingo ? "+5 XP · aucune lanterne" : earned ? "+40 XP · 1 lanterne" : "Pas d'étoile, mais le pas compte";
  launchCelebrationParticles(isDuolingo ? 12 : 18);
}

function launchCelebrationParticles(count = 18) {
  document.getElementById("celebrationParticles").innerHTML = Array.from({ length: count }, (_, index) => {
    const angle = index * 20;
    const distance = 100 + ((index % 4) * 24);
    const color = index % 3 === 0 ? "#5eb7aa" : index % 2 === 0 ? "#e66f43" : "#f8d98e";
    return `<i class="celebration-particle" style="--angle:${angle}deg;--distance:${distance}px;--particle-delay:${(index % 5) * 0.025}s;--particle-color:${color}"></i>`;
  }).join("");
  const celebration = document.getElementById("celebration");
  celebration.classList.remove("visible");
  requestAnimationFrame(() => requestAnimationFrame(() => celebration.classList.add("visible")));
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => celebration.classList.remove("visible"), 2200);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

boot().catch(error => {
  render(baseData, false, "Aperçu non connecté");
  showToast(readableError(error));
});
