/* Rad sa sadržajem programa (JSON koji pravi AI, a Dragana uređuje). */

import { daysBetween, todayISO } from "./util.js";

const arr = v => (Array.isArray(v) ? v : []);
const s = v => (v == null ? "" : String(v));

export function normalizeContent(c = {}) {
  const content = { ...c };
  content.version = 1;
  content.title = s(c.title);
  content.childNames = s(c.childNames);
  content.durationWeeks = Math.max(1, Math.min(52, parseInt(c.durationWeeks, 10) || 4));
  content.intro = s(c.intro);
  content.areas = arr(c.areas).map((a, i) => ({ id: s(a.id || i + 1), title: s(a.title), intro: s(a.intro) }));
  content.weeks = arr(c.weeks).map((w, i) => {
    const from = parseInt(w.fromWeek, 10) || i + 1;
    return { label: s(w.label) || `${from}. nedelja`, fromWeek: from, toWeek: Math.max(from, parseInt(w.toWeek, 10) || from), title: s(w.title), focus: s(w.focus), summary: s(w.summary) };
  });
  content.activities = arr(c.activities).map((a, i) => ({
    code: s(a.code || i + 1), title: s(a.title), areaId: s(a.areaId), weeks: arr(a.weeks).map(Number).filter(Boolean),
    goal: s(a.goal), materials: arr(a.materials).map(s), frequency: s(a.frequency), steps: arr(a.steps).map(s).filter(Boolean),
    levels: arr(a.levels).map(l => ({ name: s(l.name), text: s(l.text) })), adapt: s(a.adapt), parentTracks: arr(a.parentTracks).map(s),
    develops: s(a.develops), note: s(a.note), imageIds: arr(a.imageIds).map(s), video: s(a.video),
  }));
  const as = c.assessment || {};
  content.assessment = {
    summary: s(as.summary), intro: s(as.intro), conclusion: s(as.conclusion), keyPoints: arr(as.keyPoints).map(s),
    areas: arr(as.areas).map(a => ({ title: s(a.title), text: s(a.text), strengths: arr(a.strengths).map(s), needs: arr(a.needs).map(s), parentTracks: arr(a.parentTracks).map(s) })),
  };
  content.goals = arr(c.goals).map(g => ({ area: s(g.area), goal: s(g.goal), outcomes: arr(g.outcomes).map(s) }));
  content.principles = arr(c.principles).map(p => ({ title: s(p.title), text: s(p.text) }));
  content.routines = arr(c.routines).map(r => ({ title: s(r.title), focus: s(r.focus), text: s(r.text), activityTitles: arr(r.activityTitles).map(s), parentTracks: arr(r.parentTracks).map(s), note: s(r.note) }));
  content.sections = arr(c.sections).map(x => ({ title: s(x.title), body: s(x.body) }));
  content.encouragements = arr(c.encouragements).map(s).filter(Boolean);
  content.motto = s(c.motto);
  content.closingMessage = s(c.closingMessage);
  return content;
}

/* Trenutna nedelja programa prema datumu početka. */
export function currentWeek(program) {
  const c = program.content;
  if (!program.start_date) return 1;
  const d = daysBetween(program.start_date, todayISO());
  if (d < 0) return 1;
  return Math.min(c.durationWeeks, Math.floor(d / 7) + 1);
}

/* Grupe nedelja za prikaz (npr. "1–2. nedelja" je jedna grupa). */
export function weekGroups(content) {
  if (content.weeks.length) return content.weeks;
  const out = [];
  for (let i = 1; i <= content.durationWeeks; i++) out.push({ label: `${i}. nedelja`, fromWeek: i, toWeek: i, title: "", focus: "", summary: "" });
  return out;
}

export function groupForWeek(content, week) {
  const groups = weekGroups(content);
  return groups.find(g => week >= g.fromWeek && week <= g.toWeek) || groups[groups.length - 1] || null;
}

export function activitiesForGroup(content, group) {
  if (!group) return [];
  return content.activities.filter(a => a.weeks.some(w => w >= group.fromWeek && w <= group.toWeek));
}

export const activityByCode = (content, code) => content.activities.find(a => a.code === code);

export function activityByTitle(content, title) {
  const t = String(title).toLowerCase().replace(/[„“"]/g, "").trim();
  return content.activities.find(a => a.title.toLowerCase().replace(/[„“"]/g, "").includes(t) || t.includes(a.title.toLowerCase().replace(/[„“"]/g, "").split(" - ")[0].trim()));
}

/* Predlog za danas: aktivnost iz tekuće nedelje koja nije rađena prethodna 2 dana. */
export function todaysPick(program, observations, offset = 0) {
  const c = program.content;
  if (!c.activities.length) return null;
  let pool = activitiesForGroup(c, groupForWeek(c, currentWeek(program)));
  if (!pool.length) pool = c.activities;
  const recent = new Set(observations.filter(o => daysBetween(o.obs_date, todayISO()) < 2).map(o => o.activity_code));
  const fresh = pool.filter(a => !recent.has(a.code));
  const list = fresh.length ? fresh : pool;
  const day = Math.floor(Date.now() / 864e5);
  return list[(day + offset) % list.length];
}

export function imageIdsOf(content) {
  const ids = new Set();
  content.activities.forEach(a => a.imageIds.forEach(id => ids.add(id)));
  return [...ids];
}
