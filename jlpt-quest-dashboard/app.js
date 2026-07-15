const fallback = {
  schemaVersion: 2,
  updatedAt: "2026-07-15T13:30:00+02:00",
  profile: { name: "Juliann", rank: "Voyageur N5", level: 3, xp: 182, xpNext: 250, streakDays: 2, lifetimeStars: 5 },
  campaign: { target: "JLPT N5", targetMonth: "Décembre 2026", countdownDate: "2026-12-01", currentChapter: "Fondations retrouvées", tagline: "一歩一歩" },
  today: { date: "2026-07-15", status: "solid", stars: 2, morningQuest: "12 à 15 min d'Anki, reviews uniquement.", eveningQuest: "Continuer la leçon Obi 45 sans pression de la finir.", confirmedSummary: "16 reviews en 12 min, puis 10 min actives sur Obi 45.", energy: "Relancé" },
  anki: { doneToday: true, minutes: 12, reviewsToday: 16, due: 326, backlog: 310, newCardsEnabled: false, newCardsUnlockAt: 150 },
  obi: { doneToday: true, activeRecall: true, currentLesson: 45, totalLessons: 82, lessonTitle: "Aimer, détester et préférer", minutes: 10, lessonsThisWeek: 1, weeklyTarget: 3 },
  listening: { doneToday: false, title: "Japanese with Shun", minutes: 0, weeklyMinutes: 0, weeklyTargetMinutes: 30 },
  week: { start: "2026-07-13", stars: 2, target: 8, bonusStars: 0, days: [{ date: "2026-07-15", label: "Mer", stars: 2, confirmed: true }] },
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

let baseData = fallback;
let client = null;
let session = null;
let installPrompt = null;
let toastTimer = null;

function render(data, live, syncText = "Progression synchronisée") {
  const days = daysUntil(data.campaign.countdownDate);
  const elapsed = clamp(100 - Math.round((days / 139) * 100));
  document.getElementById("daysLeft").textContent = days;
  document.getElementById("countdown").style.setProperty("--countdown", `${elapsed}%`);
  document.getElementById("chapterLabel").textContent = `Chapitre ${String(data.profile.level).padStart(2, "0")} · ${data.campaign.currentChapter}`;
  document.getElementById("todaySummary").textContent = data.today.confirmedSummary || "Le matin propose. Le réel confirme.";

  const sync = document.getElementById("syncState");
  sync.classList.toggle("is-offline", !live);
  document.getElementById("syncLabel").textContent = syncText;
  document.getElementById("offlineNotice").classList.toggle("visible", !live && location.protocol === "file:");

  document.getElementById("heroStats").innerHTML = [
    ["Rang", data.profile.rank],
    ["Niveau", `Niveau ${data.profile.level}`],
    ["Série", `${data.profile.streakDays} jours`],
    ["Aujourd'hui", `${stars(data.today.stars)} ${data.today.stars}/4`]
  ].map(([label, value]) => `<div class="hero-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");

  const xpProgress = pct(data.profile.xp, data.profile.xpNext);
  const xpRemaining = Math.max(0, Number(data.profile.xpNext) - Number(data.profile.xp));
  document.getElementById("levelSigil").textContent = String(data.profile.level).padStart(2, "0");
  document.getElementById("xpText").textContent = `${data.profile.xp} / ${data.profile.xpNext} XP`;
  document.getElementById("xpBar").style.setProperty("--w", `${xpProgress}%`);
  document.getElementById("xpRemaining").textContent = `${xpRemaining} XP restant${xpRemaining > 1 ? "s" : ""}`;
  document.getElementById("todayLanterns").innerHTML = Array.from({ length: 4 }, (_, index) => `<span class="lantern ${index < Number(data.today.stars) ? "lit" : ""}"></span>`).join("");
  document.getElementById("lanternCaption").textContent = data.today.stars >= 2
    ? "Journée solide. Le feu est entretenu, inutile d'en faire un examen blanc."
    : data.today.stars === 1 ? "Journée sauvée. Le chemin reste visible." : "Une lanterne suffit pour sauver la journée.";
  const nextMilestone = data.milestones.find(item => item.state === "next") || data.milestones.find(item => item.state === "locked") || data.milestones.at(-1);
  document.getElementById("nextMilestone").textContent = nextMilestone?.title || "Le sanctuaire N5";
  document.getElementById("nextMilestoneText").textContent = nextMilestone?.text || "Continuer un pas après l'autre.";

  const quests = [
    { icon: "復", title: "Anki, la mémoire", body: data.today.morningQuest, done: data.anki.doneToday, state: data.anki.doneToday ? `${data.anki.minutes} min faites` : "À faire" },
    { icon: "文", title: `Obi ${data.obi.currentLesson}, la structure`, body: data.today.eveningQuest, done: data.obi.doneToday, state: data.obi.doneToday ? "Reprise active" : "En attente" },
    { icon: "聴", title: "Écoute, le monde vivant", body: `${data.listening.title}, objectif 10 minutes attentives`, done: data.listening.doneToday, state: data.listening.doneToday ? "Étoile gagnée" : "Optionnelle" }
  ];
  document.getElementById("questList").innerHTML = quests.map(item => `
    <article class="quest-card ${item.done ? "is-done" : ""}">
      <div class="quest-icon">${esc(item.done ? "✓" : item.icon)}</div>
      <div class="quest-copy"><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span></div>
          <div class="quest-meta"><span class="reward">${item.done ? "40 XP acquis" : "+40 XP"}</span><div class="quest-state">${esc(item.state)}</div></div>
        </article>`).join("");

  const backlog = Number(data.anki.backlog) || 0;
  const reviewsToUnlock = Math.max(0, backlog - data.anki.newCardsUnlockAt);
  const dojos = [
    { mark: "復", name: "Anki", value: `${backlog}`, meta: `${reviewsToUnlock} reviews avant le retour des nouvelles cartes`, progress: data.anki.newCardsEnabled ? 100 : clamp(100 - (reviewsToUnlock / 1.6)), foot: [`${data.anki.reviewsToday} aujourd'hui`, `${data.anki.minutes} min`] },
    { mark: "文", name: "Obi Senpai", value: `${data.obi.currentLesson}/${data.obi.totalLessons}`, meta: data.obi.lessonTitle, progress: pct(data.obi.currentLesson, data.obi.totalLessons), foot: [`${data.obi.lessonsThisWeek}/${data.obi.weeklyTarget} cette semaine`, `${pct(data.obi.currentLesson, data.obi.totalLessons)}%`] },
    { mark: "聴", name: "Écoute", value: `${data.listening.weeklyMinutes} min`, meta: data.listening.title, progress: pct(data.listening.weeklyMinutes, data.listening.weeklyTargetMinutes), foot: ["Cap hebdo", `${data.listening.weeklyTargetMinutes} min`] }
  ];
  document.getElementById("dojoGrid").innerHTML = dojos.map(item => `
    <article class="dojo" data-mark="${esc(item.mark)}">
      <div class="dojo-top"><span class="dojo-name">${esc(item.name)}</span><span class="quest-state">${Math.round(item.progress)}%</span></div>
      <div class="dojo-value">${esc(item.value)}</div><p class="dojo-meta">${esc(item.meta)}</p>
      <div class="bar"><i style="--w:${item.progress}%"></i></div>
      <div class="dojo-foot"><span>${esc(item.foot[0])}</span><span>${esc(item.foot[1])}</span></div>
    </article>`).join("");

  const completeCount = data.milestones.filter(item => item.state === "complete").length;
  const pathPct = pct(Math.max(0, completeCount - 1), Math.max(1, data.milestones.length - 1));
  document.getElementById("pathProgress").style.setProperty("--w", `${pathPct}%`);
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
    ? data.recentLogs.map(item => `<div class="log"><span class="log-date">${formatShortDate(item.date)}</span><strong>${esc(item.label)}</strong><span>${esc(item.value)}</span></div>`).join("")
    : '<p class="dojo-meta">Le carnet attend sa première session confirmée.</p>';

  document.getElementById("ankiRule").textContent = data.anki.newCardsEnabled
    ? "Le backlog est sous le seuil. Les nouvelles cartes peuvent revenir doucement, 3 à 5 maximum."
    : `Nouvelles cartes gelées jusqu'à ${data.anki.newCardsUnlockAt} reviews de retard. Il en reste ${reviewsToUnlock} à résorber, sans mode punition.`;
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
  document.getElementById("weekScore").textContent = week.stars;
  document.getElementById("weekTarget").textContent = ` / ${week.target} étoiles`;
  document.getElementById("weekBar").style.setProperty("--w", `${pct(week.stars, week.target)}%`);
}

function companionLine(starCount, energy) {
  if (starCount >= 3) return `Trois lanternes. Très belle journée, ${energy ? energy.toLowerCase() : "capitaine"}. On garde le feu, pas besoin d'en rajouter.`;
  if (starCount >= 2) return "Deux étoiles, journée solide. Les bases reprennent leur place, sans séance héroïque.";
  if (starCount === 1) return "Une étoile suffit pour que le chemin reste visible. La journée est sauvée.";
  return "Le chemin n'a pas disparu. Une session de dix minutes suffit pour rallumer la première lanterne.";
}

function deriveProgression(profile, events, scores, quests) {
  const today = toIsoDate();
  const weekStart = toIsoDate(startOfWeek(new Date()));
  const todayEvents = events.filter(event => event.occurred_on === today);
  const weekEvents = events.filter(event => event.occurred_on >= weekStart);
  const scoreMap = new Map(scores.map(score => [score.occurred_on, score]));
  const todayScore = scoreMap.get(today) || { total_stars: 0 };
  const quest = quests.find(item => item.quest_date === today);
  const latestBacklogEvent = events.find(event => event.backlog !== null && event.backlog !== undefined);
  const latestObi = events.find(event => event.category === "obi" && event.lesson_number);
  const starsFromEvents = scores.reduce((total, score) => total + Number(score.total_stars || 0), 0);
  const lifetimeStars = Number(profile.lifetime_stars_seed || 0) + starsFromEvents;
  const xp = Number(profile.xp_seed || 0) + (starsFromEvents * 40);
  let level = Number(profile.level_seed || 1);
  let xpNext = Number(profile.xp_next_seed || 100);
  while (xp >= xpNext) {
    level += 1;
    xpNext += 100;
  }

  const ankiToday = todayEvents.filter(event => event.category === "anki");
  const obiToday = todayEvents.filter(event => event.category === "obi");
  const listeningToday = todayEvents.filter(event => event.category === "listening");
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
    backlog: Number(latestBacklogEvent?.backlog ?? quest?.backlog ?? profile.backlog_seed ?? 0),
    newCardsEnabled: Number(latestBacklogEvent?.backlog ?? quest?.backlog ?? profile.backlog_seed ?? 999) <= 150,
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
  data.week = {
    start: weekStart,
    stars: weekStars,
    target: Number(profile.weekly_star_target || 8),
    bonusStars: weekScores.reduce((total, score) => total + Number(score.bonus_star || 0), 0),
    days: weekScores.map(score => ({ date: score.occurred_on, stars: Number(score.total_stars), confirmed: true }))
  };
  data.recentLogs = logs;
  return data;
}

function eventToLog(event) {
  if (event.category === "anki") return { date: event.occurred_on, label: "Anki", value: `${event.reviews || 0} reviews en ${event.minutes} min`, confirmed: true };
  if (event.category === "obi") return { date: event.occurred_on, label: `Obi ${event.lesson_number || ""}`.trim(), value: `${event.minutes} min${event.active_recall ? " avec rappel actif" : ""}`, confirmed: true };
  if (event.category === "listening") return { date: event.occurred_on, label: "Écoute", value: `${event.minutes} min${event.phrase ? `, ${event.phrase}` : ""}`, confirmed: true };
  return { date: event.occurred_on, label: "Bonus", value: event.note || "Immersion plaisir", confirmed: true };
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

async function loadCloud() {
  if (!session) return;
  setSync(false, "Synchronisation...");
  const [profileResult, eventsResult, scoresResult, questsResult] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
    client.from("study_events").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    client.from("daily_scores").select("*").order("occurred_on", { ascending: false }).limit(370),
    client.from("daily_quests").select("*").order("quest_date", { ascending: false }).limit(60)
  ]);
  const failure = [profileResult, eventsResult, scoresResult, questsResult].find(result => result.error);
  if (failure) throw failure.error;
  if (!profileResult.data) throw new Error("Profil Supabase introuvable.");
  document.getElementById("importHistoryButton").hidden = eventsResult.data.length > 0;
  render(deriveProgression(profileResult.data, eventsResult.data, scoresResult.data, questsResult.data), true);
}

async function importStarterHistory() {
  if (!session) return;
  const button = document.getElementById("importHistoryButton");
  button.disabled = true;
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
    showToast("Le départ du 15 juillet est importé. Tes 2 étoiles sont là.");
    await loadCloud();
  } catch (error) {
    showToast(readableError(error));
  } finally {
    button.disabled = false;
  }
}

async function submitEntry(event) {
  event.preventDefault();
  if (!session) {
    document.getElementById("entryDialog").close();
    openAuth();
    return;
  }
  const category = document.getElementById("entryCategory").value;
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
    if (!navigator.onLine) {
      queueEvent(payload);
      showToast("Session gardée hors ligne. Elle partira au retour du réseau.");
    } else {
      const { error } = await client.from("study_events").insert(payload);
      if (error) throw error;
      showToast("Lanterne allumée. Session confirmée.");
    }
    document.getElementById("entryDialog").close();
    document.getElementById("entryNote").value = "";
    await loadCloud();
  } catch (error) {
    showToast(readableError(error));
  } finally {
    submit.disabled = false;
  }
}

function queueEvent(payload) {
  const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
  queued.push(payload);
  localStorage.setItem(pendingKey, JSON.stringify(queued));
}

async function flushQueue() {
  if (!session || !navigator.onLine) return;
  const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
  if (!queued.length) return;
  const { error } = await client.from("study_events").upsert(queued, { onConflict: "id", ignoreDuplicates: true });
  if (error) return;
  localStorage.removeItem(pendingKey);
  showToast(`${queued.length} session${queued.length > 1 ? "s" : ""} hors ligne synchronisée${queued.length > 1 ? "s" : ""}.`);
  await loadCloud();
}

function updateCategoryFields() {
  const category = document.getElementById("entryCategory").value;
  document.querySelectorAll(".category-only").forEach(field => {
    field.hidden = !field.dataset.categories.split(" ").includes(category);
  });
  const minutes = document.getElementById("entryMinutes");
  minutes.value = category === "obi" ? "10" : category === "listening" ? "10" : "12";
  const hints = {
    anki: "10 minutes d'Anki donnent une étoile. Pas besoin de finir la montagne aujourd'hui.",
    obi: "Une reprise active ou une leçon terminée donne l'étoile Obi.",
    listening: "10 minutes attentives donnent l'étoile. Une seule phrase repérée suffit.",
    bonus: "Bonus plaisir, One Piece attentif ou kanji relié à un mot connu. Deux fois par semaine maximum."
  };
  document.getElementById("entryHint").textContent = hints[category];
}

async function signIn(event) {
  event.preventDefault();
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

async function signOut() {
  await client.auth.signOut();
  document.getElementById("authDialog").close();
  render(baseData, false, "Mode lecture locale");
}

async function handleSession(nextSession) {
  session = nextSession;
  const signedIn = Boolean(session);
  document.getElementById("accountButton").textContent = signedIn ? session.user.user_metadata?.display_name || "Mon compte" : "Connexion";
  document.getElementById("authForm").hidden = signedIn;
  document.getElementById("signedInActions").hidden = !signedIn;
  document.getElementById("accountCard").classList.toggle("visible", signedIn);
  if (signedIn) {
    document.getElementById("accountName").textContent = session.user.user_metadata?.display_name || "Voyageur N5";
    document.getElementById("accountEmail").textContent = session.user.email;
    await flushQueue();
    await loadCloud();
  }
}

function openEntry() {
  if (!session) return openAuth("Connecte-toi une fois pour enregistrer ta progression depuis tous tes appareils.");
  document.getElementById("entryDate").value = toIsoDate();
  document.getElementById("entryDialog").showModal();
}

function openAuth(message = "") {
  setAuthStatus(message);
  document.getElementById("authDialog").showModal();
}

function bindUi() {
  document.getElementById("quickAddButton").addEventListener("click", openEntry);
  document.getElementById("heroRecordButton").addEventListener("click", openEntry);
  document.getElementById("accountButton").addEventListener("click", () => openAuth());
  document.getElementById("entryCategory").addEventListener("change", updateCategoryFields);
  document.getElementById("entryForm").addEventListener("submit", submitEntry);
  document.getElementById("authForm").addEventListener("submit", signIn);
  document.getElementById("signUpButton").addEventListener("click", signUp);
  document.getElementById("signOutButton").addEventListener("click", signOut);
  document.getElementById("importHistoryButton").addEventListener("click", importStarterHistory);
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
  window.addEventListener("online", flushQueue);
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
    return await response.json();
  } catch {
    return fallback;
  }
}

async function boot() {
  bindUi();
  updateCategoryFields();
  document.getElementById("entryDate").value = toIsoDate();
  baseData = await loadBaseData();
  render(baseData, false, location.protocol === "file:" ? "Aperçu local" : "Mode lecture locale");

  if (!window.supabase || !window.JLPT_SUPABASE) {
    showToast("La synchronisation Supabase n'a pas pu démarrer.");
    return;
  }
  client = window.supabase.createClient(window.JLPT_SUPABASE.url, window.JLPT_SUPABASE.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data } = await client.auth.getSession();
  await handleSession(data.session);
  client.auth.onAuthStateChange((_event, nextSession) => setTimeout(() => handleSession(nextSession), 0));

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function setSync(live, label) {
  document.getElementById("syncState").classList.toggle("is-offline", !live);
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

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

boot().catch(error => {
  render(baseData, false, "Mode lecture locale");
  showToast(readableError(error));
});
