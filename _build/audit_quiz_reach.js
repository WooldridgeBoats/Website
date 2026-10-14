/* audit_quiz_reach.js - reachability audit for the "Which Wooldridge" quiz.
 *
 *   node _build/audit_quiz_reach.js              summary + FAIL list
 *   node _build/audit_quiz_reach.js --full       every model, every stat
 *   node _build/audit_quiz_reach.js --model ssd  detail for one model id
 *
 * WHY THIS IS NODE AND NOT PERL: the point is to execute the EXACT scoring logic
 * the page ships. This lifts the FACTS / T / DIM_WEIGHT / BUDGET literals straight
 * out of which-wooldridge/index.html and evaluates them, so a hand edit to the
 * matrix is picked up with zero transcription risk. A Perl port would silently
 * drift from the JS the first time somebody tweaks a weight. Node v24 is on this
 * box standalone. Nothing schedules this - it is an on-demand audit.
 *
 * WHAT IT ANSWERS: "can a customer honestly describing boat X ever be told X?"
 * It brute-forces every reachable answer path (the quiz skips DRAFT and POWER
 * when WATER=salt, and MISSION takes 1 or 2 picks) and reports:
 *   - how often each model is the top recommendation
 *   - whether each model wins on its OWN ideal-customer profile: the answer set
 *     that maximises that model's own score. A model that fails THAT is broken -
 *     it is unreachable by the exact buyer it was designed for.
 *   - how many "wins" are only tie-breaks. Ties resolve by key order in T, which
 *     is arbitrary and invisible - a model that only wins on ties is one
 *     reordering away from never winning at all.
 *
 * SECOND RECOMMENDER (added 2026-10-14): request-a-quote/index.html scores the same
 * matrix with its own, smaller scorer. Its copy of T must equal the quiz's cell for
 * cell - drift FAILS this audit and is fixed by perl _build/sync_quiz_matrix.pl.
 * Its own reachability is printed as NOTE lines and never fails the audit: closing
 * those gaps needs new questions or new weights, a business call.
 *
 * Rebalancing the matrix is Stephen + Danny's call, not this script's. This only
 * measures. Re-run after any weight change, and after gen_fleet.pl rewrites FACTS.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'which-wooldridge', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');
const a0 = html.indexOf('const FACTS = ');
const a1 = html.indexOf('const QUESTIONS = [');
if (a0 < 0 || a1 < 0 || a1 < a0) {
  console.error('FAIL: could not locate the FACTS..QUESTIONS block in ' + PAGE);
  console.error('The page structure changed - fix this script before trusting it.');
  process.exit(2);
}
const { FACTS, T, DIM_WEIGHT, BUDGET } =
  new Function(html.slice(a0, a1) + '\n; return {FACTS, T, DIM_WEIGHT, BUDGET};')();

const ids = Object.keys(T);
const mismatch = ids.filter(id => !FACTS[id]).concat(Object.keys(FACTS).filter(id => !T[id]));
if (mismatch.length) {
  console.error('FAIL: T and FACTS disagree on model ids: ' + mismatch.join(', '));
  process.exit(2);
}

/* Mirror of score() in which-wooldridge/index.html. Keep in step by hand. */
function scoreAll(a) {
  const out = [];
  for (const id of ids) {
    const t = T[id], f = FACTS[id];
    let s = 0;
    for (const dim of ['water', 'shallow', 'crew', 'rough', 'helm', 'tow', 'load']) {
      if (!(dim in a)) continue;
      s += (t[dim][a[dim]] ?? 0) * DIM_WEIGHT[dim];
    }
    for (const u of (a.use || [])) s += (t.use[u] ?? 0) * DIM_WEIGHT.use;
    if (a.power === 'ob') s += (f.drive !== 'ib') ? 5 : -6;
    if (a.power === 'ib') s += (f.drive === 'ib') ? 5 : -6;
    if (a.water === 'salt' && f.drive !== 'offshore') s -= 4;
    if (a.crew === 'big' && f.maxLen < 20) s -= 4;
    if (a.tow === 'mid' && f.maxLen >= 23) s -= 4;
    if (a.helm === 'tiller' && !f.styles.includes('tiller')) s -= 2;
    const b = BUDGET.find(x => x.id === a.budget);
    if (b && b.id !== 'b0') s += (f.from > b.cap) ? -8 : 2;
    out.push({ id, s });
  }
  out.sort((x, y) => y.s - x.s);   // stable, same as V8 in the browser
  return out;
}

const OPT = {
  water:   ['skinny', 'rivers', 'big', 'salt'],
  shallow: ['extreme', 'some', 'rarely'],
  use:     ['riverfish', 'saltfish', 'hunt', 'family', 'haul'],
  crew:    ['solo', 'small', 'big'],
  rough:   ['never', 'some', 'often'],
  power:   ['ob', 'ib', 'either'],
  helm:    ['tiller', 'console', 'windshield', 'cabin'],
  tow:     ['mid', 'full', 'hd'],
  load:    ['light', 'mid', 'heavy'],
};
const BUD = BUDGET.map(b => b.id);
const USESETS = [];
for (let i = 0; i < OPT.use.length; i++) {
  USESETS.push([OPT.use[i]]);
  for (let j = i + 1; j < OPT.use.length; j++) USESETS.push([OPT.use[i], OPT.use[j]]);
}

const COMBOS = [];
for (const water of OPT.water) {
  const salt = water === 'salt';                 // DRAFT and POWER are skipped on salt
  for (const shallow of (salt ? [null] : OPT.shallow))
    for (const use of USESETS)
      for (const crew of OPT.crew)
        for (const rough of OPT.rough)
          for (const power of (salt ? [null] : OPT.power))
            for (const helm of OPT.helm)
              for (const tow of OPT.tow)
                for (const load of OPT.load)
                  for (const budget of BUD) {
                    const a = { water, use, crew, rough, helm, tow, load, budget };
                    if (shallow) a.shallow = shallow;
                    if (power) a.power = power;
                    COMBOS.push(a);
                  }
}

const stat = {};
for (const id of ids) {
  stat[id] = { win: 0, tieWin: 0, runner: 0, top3: 0, ownBest: -1e9, ownBestSelfWin: 0, ownBestN: 0, ownBeatenBy: {} };
}
for (const a of COMBOS) {
  const r = scoreAll(a);
  stat[r[0].id].win++;
  if (r[0].s - r[1].s <= 1e-9) stat[r[0].id].tieWin++;
  stat[r[1].id].runner++;
  for (let k = 0; k < 3; k++) stat[r[k].id].top3++;
  for (const { id, s } of r) {
    const st = stat[id];
    if (s > st.ownBest + 1e-9) { st.ownBest = s; st.ownBestN = 0; st.ownBestSelfWin = 0; st.ownBeatenBy = {}; }
    if (Math.abs(s - st.ownBest) < 1e-9) {
      st.ownBestN++;
      if (r[0].id === id) st.ownBestSelfWin++;
      else st.ownBeatenBy[r[0].id] = (st.ownBeatenBy[r[0].id] || 0) + 1;
    }
  }
}

const N = COMBOS.length;
const argv = process.argv.slice(2);
const one = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : null;
const full = argv.includes('--full');
const pct = n => (100 * n / N).toFixed(2) + '%';
const selfPct = id => (100 * stat[id].ownBestSelfWin / stat[id].ownBestN);

console.log('Which Wooldridge - recommendation reachability');
console.log('source : ' + PAGE);
console.log('models : ' + ids.length + '   answer paths enumerated: ' + N.toLocaleString());
console.log('');

const order = ids.slice().sort((x, y) => stat[y].win - stat[x].win);

if (one) {
  if (!stat[one]) { console.error('unknown model id: ' + one + '\nknown: ' + ids.join(', ')); process.exit(2); }
  const s = stat[one];
  console.log(FACTS[one].nm + '  (' + one + ')');
  console.log('  top recommendation on  : ' + s.win + ' paths  (' + pct(s.win) + ')');
  console.log('  ... of which tie-breaks: ' + s.tieWin);
  console.log('  runner-up on           : ' + s.runner + ' paths');
  console.log('  in the top 3 on        : ' + s.top3 + ' paths  (' + pct(s.top3) + ')');
  console.log('  best score it can reach: ' + s.ownBest.toFixed(1) + '  (on ' + s.ownBestN + ' ideal profiles)');
  console.log('  wins on its OWN ideal  : ' + s.ownBestSelfWin + '/' + s.ownBestN + '  = ' + selfPct(one).toFixed(0) + '%');
  const bb = Object.entries(s.ownBeatenBy).sort((x, y) => y[1] - x[1]);
  if (bb.length) console.log('  beaten there by        : ' + bb.map(([w, c]) => FACTS[w].nm + ' x' + c).join(', '));
} else if (full) {
  console.log('MODEL                          TOP REC     SHARE   TIE-ONLY  RUNNER-UP    TOP3   OWN-IDEAL');
  for (const id of order) {
    const s = stat[id];
    console.log(
      (FACTS[id].nm + ' ').padEnd(30, '.') +
      String(s.win).padStart(8) + pct(s.win).padStart(10) +
      String(s.tieWin).padStart(10) + String(s.runner).padStart(11) +
      String(s.top3).padStart(8) + (selfPct(id).toFixed(0) + '%').padStart(11));
  }
}

const unreachable = order.filter(id => stat[id].win === 0);
const notSelf = order.filter(id => stat[id].ownBestSelfWin === 0);
const tieOnly = order.filter(id => stat[id].win > 0 && stat[id].win === stat[id].tieWin);

console.log('');
let bad = 0;
if (unreachable.length) {
  bad++;
  console.log('FAIL - can NEVER be the recommendation:');
  for (const id of unreachable) console.log('   ' + FACTS[id].nm);
}
if (notSelf.length) {
  bad++;
  console.log('FAIL - loses on its OWN ideal-customer profile (unreachable by the buyer it was built for):');
  for (const id of notSelf) {
    const bb = Object.entries(stat[id].ownBeatenBy).sort((x, y) => y[1] - x[1])
      .map(([w, c]) => FACTS[w].nm + ' (' + Math.round(100 * c / stat[id].ownBestN) + '%)').join(', ');
    console.log('   ' + (FACTS[id].nm + ' ').padEnd(30, '.') + ' beaten there by ' + bb);
  }
}
if (tieOnly.length) {
  bad++;
  console.log('FAIL - only ever wins on an arbitrary tie-break:');
  for (const id of tieOnly) console.log('   ' + FACTS[id].nm);
}

const RARE = 1.0;   // percent of all answer paths
const rare = order.filter(id => stat[id].win > 0 && (100 * stat[id].win / N) < RARE);
if (rare.length) {
  console.log('WARN - recommended on under ' + RARE + '% of answer paths:');
  for (const id of rare) console.log('   ' + (FACTS[id].nm + ' ').padEnd(30, '.') + pct(stat[id].win));
}

if (!bad) console.log('PASS - every model is reachable and wins on its own ideal-customer profile.');

/* ── Request a Quote: the second public recommender ──────────────────────────
 * request-a-quote/index.html scores the same matrix with its OWN scorer (fewer
 * questions: water, use, crew, load, power, budget - and its own answer options:
 * water "mixed", crew "huge", uses guide/freight/cabin/offshore via USE_MAP).
 * (1) Its copy of T must equal the quiz's, cell for cell. Drift is a FAIL: the fix
 *     is mechanical - perl _build/sync_quiz_matrix.pl.
 * (2) Its own reachability is REPORTED, never failed on: closing a gap there means
 *     new questions or new weights, which is Stephen + Danny's call, not a code fix.
 */
const QPAGE = path.join(__dirname, '..', 'request-a-quote', 'index.html');
const qhtml = fs.readFileSync(QPAGE, 'utf8');
const q0 = qhtml.indexOf('const FACTS = ');
const q1 = qhtml.indexOf('const USE_LABEL = ');
if (q0 < 0 || q1 < 0 || q1 < q0) {
  console.error('FAIL: could not locate the FACTS..USE_LABEL block in ' + QPAGE);
  process.exit(2);
}
const RQ = new Function(qhtml.slice(q0, q1) + '\n; return {FACTS, T, DIM_W, USE_MAP, BUDGET};')();
console.log('');
console.log('Request a Quote - same matrix, its own scorer');
console.log('source : ' + QPAGE);
const drift = [];
for (const id of new Set(ids.concat(Object.keys(RQ.T)))) {
  if (!T[id] || !RQ.T[id]) { drift.push(id + ' (missing on one page)'); continue; }
  for (const dim of new Set(Object.keys(T[id]).concat(Object.keys(RQ.T[id])))) {
    if (!T[id][dim] || !RQ.T[id][dim]) { drift.push(id + '.' + dim + '  missing on the ' + (T[id][dim] ? 'quote page' : 'quiz')); continue; }
    for (const k of new Set(Object.keys(T[id][dim]).concat(Object.keys(RQ.T[id][dim]))))
      if ((T[id][dim] || {})[k] !== (RQ.T[id][dim] || {})[k])
        drift.push(id + '.' + dim + '.' + k + '  quiz ' + T[id][dim][k] + ' / quote ' + RQ.T[id][dim][k]);
  }
}
if (JSON.stringify(Object.keys(T)) !== JSON.stringify(Object.keys(RQ.T))) drift.push('model ORDER differs (ties resolve by key order)');
if (drift.length) {
  bad++;
  console.log('FAIL - the quote page\'s matrix differs from the quiz (run: perl _build/sync_quiz_matrix.pl):');
  for (const d of drift.slice(0, 25)) console.log('   ' + d);
  if (drift.length > 25) console.log('   ... and ' + (drift.length - 25) + ' more');
} else {
  console.log('PASS - the quote page scores from the quiz\'s matrix, cell for cell.');
}

/* Mirror of scoreFit() in request-a-quote/index.html. Keep in step by hand. */
function scoreQuote(st) {
  const out = [];
  for (const id of Object.keys(RQ.T)) {
    const t = RQ.T[id], f = RQ.FACTS[id];
    let s = 0;
    if (st.water) s += (st.water === 'mixed' ? (t.water.rivers + t.water.big) / 2 : (t.water[st.water] ?? 0)) * RQ.DIM_W.water;
    for (const u of st.use) for (const [qu, w] of (RQ.USE_MAP[u] || [])) s += (t.use[qu] ?? 0) * RQ.DIM_W.use * w;
    if (st.crew) { const k = st.crew === 'huge' ? 'big' : st.crew; s += (t.crew[k] ?? 0) * RQ.DIM_W.crew; }
    if (st.load) s += (t.load[st.load] ?? 0) * RQ.DIM_W.load;
    if (st.power === 'ob') s += (f.drive !== 'ib') ? 5 : -6;
    if (st.power === 'ib') s += (f.drive === 'ib') ? 5 : -6;
    if (st.water === 'salt' && f.drive !== 'offshore') s -= 4;
    if ((st.crew === 'big' || st.crew === 'huge') && f.maxLen < 20) s -= 4;
    const b = RQ.BUDGET[st.budget];
    if (b && st.budget !== 'b0') { if (f.from > b.cap) s -= 8; else s += 2; }
    out.push({ id, s });
  }
  out.sort((x, y) => y.s - x.s);
  return out;
}
/* The form requires water and 1-2 uses; crew, load, power and budget are optional. */
const QOPT = {
  water: ['skinny', 'rivers', 'big', 'salt', 'mixed'],
  use:   ['riverfish', 'saltfish', 'hunt', 'guide', 'freight', 'cabin', 'family', 'offshore'],
  crew:  [null, 'solo', 'small', 'big', 'huge'],
  load:  [null, 'light', 'mid', 'heavy'],
  power: [null, 'ob', 'ib', 'either'],
  budget:[null, 'b1', 'b2', 'b3', 'b4', 'b0'],
};
const QUSE = [];
for (let i = 0; i < QOPT.use.length; i++) {
  QUSE.push([QOPT.use[i]]);
  for (let j = i + 1; j < QOPT.use.length; j++) QUSE.push([QOPT.use[i], QOPT.use[j]]);
}
const qids = Object.keys(RQ.T);
const qs = {};
for (const id of qids) qs[id] = { win: 0, tieWin: 0, ownBest: -1e9, ownBestN: 0, ownBestSelfWin: 0, ownBeatenBy: {} };
let QN = 0;
for (const water of QOPT.water) for (const use of QUSE) for (const crew of QOPT.crew)
  for (const load of QOPT.load) for (const power of QOPT.power) for (const budget of QOPT.budget) {
    const r = scoreQuote({ water, use, crew, load, power, budget });
    QN++;
    qs[r[0].id].win++;
    if (r[0].s - r[1].s <= 1e-9) qs[r[0].id].tieWin++;
    for (const { id, s } of r) {
      const st = qs[id];
      if (s > st.ownBest + 1e-9) { st.ownBest = s; st.ownBestN = 0; st.ownBestSelfWin = 0; st.ownBeatenBy = {}; }
      if (Math.abs(s - st.ownBest) < 1e-9) {
        st.ownBestN++;
        if (r[0].id === id) st.ownBestSelfWin++;
        else st.ownBeatenBy[r[0].id] = (st.ownBeatenBy[r[0].id] || 0) + 1;
      }
    }
  }
console.log('answer paths enumerated on its own scorer: ' + QN.toLocaleString() + '  (report only - never fails the audit)');
if (full) {
  console.log('MODEL                          TOP REC     SHARE   TIE-ONLY   OWN-IDEAL');
  for (const id of qids.slice().sort((x, y) => qs[y].win - qs[x].win)) {
    const s = qs[id];
    console.log((RQ.FACTS[id].nm + ' ').padEnd(30, '.') + String(s.win).padStart(8) +
      ((100 * s.win / QN).toFixed(2) + '%').padStart(10) + String(s.tieWin).padStart(10) +
      ((100 * s.ownBestSelfWin / s.ownBestN).toFixed(0) + '%').padStart(12));
  }
}
const qNever = qids.filter(id => qs[id].win === 0);
const qNotSelf = qids.filter(id => qs[id].ownBestSelfWin === 0);
if (qNever.length) console.log('NOTE - never the quote page\'s top fit: ' + qNever.map(id => RQ.FACTS[id].nm).join(', '));
for (const id of qNotSelf) {
  const bb = Object.entries(qs[id].ownBeatenBy).sort((x, y) => y[1] - x[1])
    .map(([w, c]) => RQ.FACTS[w].nm + ' (' + Math.round(100 * c / qs[id].ownBestN) + '%)').join(', ');
  console.log('NOTE - loses on its own ideal profile on the quote page: ' + (RQ.FACTS[id].nm + ' ').padEnd(26, '.') + ' beaten by ' + bb);
}
if (!qNever.length && !qNotSelf.length) console.log('every model is reachable on the quote page and wins its own ideal profile.');

console.log('\n(rerun with --full for the whole table, or --model <id> for one boat)');
process.exit(bad ? 1 : 0);
