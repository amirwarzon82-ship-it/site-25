'use strict';
/* =====================================================================
   Teacher panel — core: helpers, state, UI kit, dashboard, attendance, grades
   ===================================================================== */
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const RED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const fa = (n, o) => Number(n).toLocaleString('fa-IR', o || {});
const fmt = x => (x == null || isNaN(x)) ? '—' : fa(Math.round(x * 100) / 100, { maximumFractionDigits: 2 });
// خواندن عدد اعشاری با ارقام فارسی و «٫» یا «,» یا «/»؛ نامعتبر → null
const numIn = v => { if (v == null) return null; const t = String(v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,،\/]/g, '.').replace(/\s/g, ''); return /^\d*\.?\d+$/.test(t) ? parseFloat(t) : null; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const iso = d => { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const pdate = (s, o) => { const d = typeof s === 'number' ? new Date(s) : new Date(s + 'T12:00:00'); return d.toLocaleDateString('fa-IR-u-ca-persian', o || { day: 'numeric', month: 'long' }); };
const pdt = ms => new Date(ms).toLocaleString('fa-IR-u-ca-persian', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const mem = {};
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return; } catch (e) { } if (v === undefined) return mem[k] === undefined ? null : mem[k]; if (v === null) delete mem[k]; else mem[k] = v; }
const norm_fa = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ‌]/g, '').toLowerCase();

/* ---------- icons ---------- */
const ICP = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  att: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  gr: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  qz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  st: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.5 2.6 3.5 5"/>',
  ann: '<path d="M4 11v2a1 1 0 0 0 1 1h2l5 4V6L7 10H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  rep: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  bk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  set: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  dl: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', ul: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3z"/>', file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', copy2: '<path d="M8 8h12v12H8zM4 16V4h12"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>', chevR: '<path d="M9 6l6 6-6 6"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
const ic = (n, s) => '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICP[n] || '') + '</svg>';

/* ---------- constants & state ---------- */
const CATS = { quiz: 'کوییز کلاسی', cont: 'نمره مستمر', exam: 'آزمون', hw: 'تمرین' }, CK = Object.keys(CATS);
const PG = [['dash', 'داشبورد', 'dash'], ['att', 'حضور و غیاب', 'att'], ['gr', 'نمرات', 'gr'], ['qz', 'کوییزها', 'qz'], ['st', 'دانش‌آموزان', 'st'], ['ann', 'اطلاعیه‌ها', 'ann'], ['rep', 'گزارش‌ها', 'rep'], ['bk', 'پشتیبان‌گیری', 'bk'], ['set', 'تنظیمات', 'set']];
const BN = ['dash', 'att', 'gr', 'qz'];
let S = null, RES = [], INFO = {}, page = 'dash';
let CID = +ls('cid') || 0, CLS = [], TAKEN = [], MAXST = 30;
const ST = { adate: iso(), aview: 'day', aq: '', gcat: 'quiz', sq: '', ssort: 'name', qv: 'list', qid: 0 };
const V = {}, AFTER = {}, A = {};

const toObj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const arr = x => Array.isArray(x) ? x : [];
const okUser = u => /^[a-z0-9._-]{3,24}$/.test(String(u || ''));
function genUser(d) {
  const used = new Set(TAKEN.map(x => String(x).toLowerCase()));
  d.st.forEach(s => { if (s.user) used.add(String(s.user).toLowerCase()); });
  let u; do { const a = new Uint32Array(1); crypto.getRandomValues(a); u = 's' + (1000 + a[0] % 9000); } while (used.has(u));
  return u;
}
function genCode() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + a[0] % 900000); }
function norm(d) {
  d = toObj(d); d.st = arr(d.st); d.att = toObj(d.att); d.pts = arr(d.pts); d.gr = toObj(d.gr); d.quizzes = arr(d.quizzes); d.ann = arr(d.ann); d.polls = arr(d.polls); d.hw = arr(d.hw); d.sched = arr(d.sched); d.cfg = toObj(d.cfg);
  let mx = 0, fixed = false;
  d.st.forEach(s => { mx = Math.max(mx, +s.id || 0); if (!s.code) { s.code = genCode(); fixed = true; } if (!s.user || !okUser(s.user)) { s.user = genUser(d); fixed = true; } });
  CK.forEach(c => { d.gr[c] = toObj(d.gr[c]); d.gr[c].items = arr(d.gr[c].items); d.gr[c].items.forEach(i => { i.sc = toObj(i.sc); mx = Math.max(mx, +i.id || 0); }); });
  d.quizzes.forEach(q => { mx = Math.max(mx, +q.id || 0); q.qs = arr(q.qs); });
  d.ann.forEach(a => { mx = Math.max(mx, +a.id || 0); }); d.polls.forEach(a => { mx = Math.max(mx, +a.id || 0); a.qs = arr(a.qs); }); d.hw.forEach(a => { mx = Math.max(mx, +a.id || 0); }); d.sched.forEach(a => { mx = Math.max(mx, +a.id || 0); });
  Object.keys(d.att).forEach(k => { d.att[k] = toObj(d.att[k]); });
  d.nid = Math.max(+d.nid || 1, mx + 1);
  const c = d.cfg; if (c.cls === undefined) c.cls = 'کارگاه طراحی سایت'; if (c.school === undefined) c.school = 'هنرستان خوارزمی'; if (c.teacher === undefined) c.teacher = 'استاد تقی‌زاده';
  if (c.showGrades === undefined) c.showGrades = true; if (c.showAtt === undefined) c.showAtt = true; if (c.showRank === undefined) c.showRank = true; if (c.polls === undefined) c.polls = true; if (c.board === undefined) c.board = false; if (!c.pass) c.pass = 10;
  c.w = toObj(c.w); CK.forEach(k => { if (c.w[k] === undefined) c.w[k] = 1; });
  d.rev = +d.rev || 0; d._fixed = fixed;
  return d;
}

/* ---------- calculations (mirror of the PHP side) ---------- */
const stById = id => S.st.find(s => s.id == id);
const pts = id => S.pts.reduce((a, p) => a + (p.sid == id ? +p.v : 0), 0);
const scoresOf = (c, id) => { const v = []; S.gr[c].items.forEach(i => { const x = i.sc[id]; if (x !== undefined && x !== '' && x !== null) v.push(+x); }); return v; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const catAvg = (c, id) => avg(scoresOf(c, id));
const allAvg = id => avg([].concat(...CK.map(c => scoresOf(c, id))));
const finalOf = id => { let n = 0, d = 0; CK.forEach(c => { const a = catAvg(c, id); if (a == null) return; const w = Math.max(0, +S.cfg.w[c]); n += a * w; d += w; }); return d > 0 ? n / d : null; };
const cnt = a => { const c = { p: 0, a: 0, l: 0 }; for (const k in a) if (c[a[k]] !== undefined) c[a[k]]++; return c; };
const attOf = id => { const c = { p: 0, a: 0, l: 0 }; for (const d in S.att) { const v = S.att[d][id]; if (c[v] !== undefined) c[v]++; } return c; };
const attPct = id => { const c = attOf(id), t = c.p + c.a + c.l; return t ? Math.round(c.p / t * 100) : null; };
const gcl = x => x == null ? '' : x >= 15 ? 'cl-g' : x >= S.cfg.pass ? 'cl-y' : 'cl-r';
const lvlc = x => x == null ? '' : x >= 15 ? 'pl' : x >= S.cfg.pass ? 'wn' : 'mi';
const lastQ = () => RES.slice().sort((a, b) => b.e - a.e);
const initial = n => (String(n || '؟').trim()[0] || '؟');
const avc = id => 'c' + (Math.abs(+id || 0) % 6) + ((typeof AV !== 'undefined' && AV.s && AV.s[id]) ? ' ph u' + id : '');
const quizOf = id => S.quizzes.find(q => q.id == id);
function qStatus(q) { const n = Date.now(); if (q.on === false) return 'off'; if (q.from > 0 && n < q.from) return 'soon'; if (q.to > 0 && n > q.to) return 'closed'; return 'open'; }
const QSTAT = { open: ['باز', 'pl'], soon: ['به‌زودی', 'wn'], closed: ['بسته', 'mi'], off: ['غیرفعال', ''] };

/* ---------- api ---------- */
async function api(path, o) {
  o = o || {};
  if (CID && /^\/api\/(state|results|polls|taken|restore|classes|hw|msgs|avatars?|attempt)/.test(path)) path += (path.indexOf('?') > -1 ? '&' : '?') + 'c=' + CID;
  let r;
  try { r = await fetch(path, { method: o.method || (o.body !== undefined ? 'POST' : 'GET'), headers: o.raw ? {} : { 'Content-Type': 'application/json' }, body: o.body, cache: 'no-store', credentials: 'same-origin' }); }
  catch (e) { return { status: 0, data: { error: 'offline' } }; }
  let d = {}; try { d = await r.json(); } catch (e) { }
  if (r.status === 401 && S) showLogin();
  return { status: r.status, data: d };
}

/* ---------- save engine ---------- */
let saveT, dirty = false, saving = false, syncSt = 'ok';
function setSync(s) {
  syncSt = s; const e = $('#sync'); if (!e) return;
  e.className = 'sync' + (s === 'saving' ? ' saving' : s === 'off' ? ' off' : '');
  e.lastChild.textContent = s === 'ok' ? 'ذخیره شد' : s === 'saving' ? 'در حال ذخیره…' : 'ذخیره نشد؛ تلاش مجدد…';
}
function save() { dirty = true; setSync('saving'); clearTimeout(saveT); saveT = setTimeout(flush, 450); }
async function flush() {
  if (saving) { saveT = setTimeout(flush, 400); return; }
  if (!dirty || !S) return;
  saving = true; dirty = false;
  const r = await api('/api/state', { method: 'PUT', body: JSON.stringify(S, (k, v) => k === '_fixed' ? undefined : v) });
  saving = false;
  if (r.status === 200) { S.rev = r.data.rev; setSync(dirty ? 'saving' : 'ok'); if (dirty) { clearTimeout(saveT); saveT = setTimeout(flush, 300); } }
  else if (r.status === 409) conflict();
  else if (r.status === 422) { dirty = false; setSync('ok'); toast(r.data.error === 'too_many_students' ? 'حداکثر ' + fa(r.data.max || 30) + ' دانش‌آموز در هر کلاس مجاز است.' : r.data.error === 'dup_user' ? 'نام کاربری «' + r.data.user + '» تکراری است.' : 'ذخیره ناموفق بود.', { err: 1 }); boot(false); }
  else if (r.status === 401) { dirty = true; }
  else { dirty = true; setSync('off'); clearTimeout(saveT); saveT = setTimeout(flush, 4000); }
}
window.addEventListener('beforeunload', e => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } });
function conflict() {
  dirty = false; setSync('off');
  const m = modal({ title: 'تغییر همزمان', cls: 'sm', html: '<p class="mut" style="line-height:1.9">اطلاعات کلاس در یک تب یا دستگاه دیگر تغییر کرده است. برای جلوگیری از پاک‌شدن کار دیگر، باید نسخه‌ی جدید بارگذاری شود.</p><div class="ph acts" style="margin:16px 0 0;justify-content:flex-end"><button class="btn" id="cfDl">دانلود تغییرات من</button><button class="btn pri" id="cfRl">بارگذاری نسخه‌ی جدید</button></div>', noClose: true });
  m.box.querySelector('#cfDl').onclick = () => download('class-my-changes.json', JSON.stringify(S), 'application/json');
  m.box.querySelector('#cfRl').onclick = async () => { m.close(); await boot(true); };
}

/* ---------- ui kit ---------- */
function toast(t, o) {
  o = o || {}; const w = $('#toasts'), e = document.createElement('div');
  e.className = 'toast' + (o.err ? ' er' : ''); e.setAttribute('role', 'status');
  e.innerHTML = '<span>' + esc(t) + '</span>' + (o.act ? '<button class="btn xs" style="background:rgba(255,255,255,.28);border:0;color:inherit;font-weight:800">' + esc(o.act) + '</button>' : '');
  if (o.act) { e.style.pointerEvents = 'auto'; e.querySelector('button').onclick = () => { o.fn(); e.remove(); }; }
  w.appendChild(e); while (w.children.length > 3) w.firstChild.remove();
  setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 320); }, o.act ? 6000 : 2000);
}
function modal(o) {
  const w = document.createElement('div'); w.className = 'mdl';
  w.innerHTML = '<div class="box ' + (o.cls || '') + '" role="dialog" aria-modal="true"><div class="mh"><h2>' + o.title + '</h2>' + (o.noClose ? '' : '<button class="btn ic" data-x aria-label="بستن">' + ic('x') + '</button>') + '</div><div class="mb">' + o.html + '</div></div>';
  document.body.appendChild(w);
  const prev = document.activeElement;
  const kd = e => { if (e.key === 'Escape' && !o.noClose && w === $$('.mdl').pop()) close(); };
  const close = () => { document.removeEventListener('keydown', kd); w.remove(); if (o.onClose) o.onClose(); try { prev && prev.focus && prev.focus(); } catch (e) { } };
  document.addEventListener('keydown', kd);
  if (!o.noClose) { w.addEventListener('mousedown', e => { if (e.target === w) close(); }); const x = w.querySelector('[data-x]'); if (x) x.onclick = close; }
  const f = w.querySelector('[autofocus],input.inp,textarea'); if (f && !o.nofocus && matchMedia('(hover:hover)').matches) setTimeout(() => f.focus(), 60);
  return { el: w.querySelector('.mb'), box: w, close };
}
function ask(o) {
  return new Promise(res => {
    let done = false;
    const m = modal({ title: esc(o.title || 'تأیید'), cls: 'sm', html: '<p class="mut" style="line-height:1.9">' + (o.html || esc(o.body || '')) + '</p><div class="ph acts" style="margin:16px 0 0;justify-content:flex-end"><button class="btn" data-n>انصراف</button><button class="btn ' + (o.danger ? 'dg' : 'pri') + '" data-y>' + esc(o.ok || 'تأیید') + '</button></div>', onClose: () => { if (!done) res(false); } });
    m.box.querySelector('[data-n]').onclick = () => m.close();
    m.box.querySelector('[data-y]').onclick = () => { done = true; m.close(); res(true); };
  });
}
function askText(o) {
  return new Promise(res => {
    let done = false;
    const m = modal({ title: esc(o.title), cls: 'sm', html: '<div class="fld"><label>' + esc(o.label || '') + '</label><input class="inp" id="atx" value="' + esc(o.value || '') + '" placeholder="' + esc(o.ph || '') + '" maxlength="' + (o.max || 80) + '"></div><div class="ph acts" style="margin:16px 0 0;justify-content:flex-end"><button class="btn" data-n>انصراف</button><button class="btn pri" data-y>' + esc(o.ok || 'ذخیره') + '</button></div>', onClose: () => { if (!done) res(null); } });
    const inp = m.box.querySelector('#atx'), go = () => { const v = inp.value.trim(); if (!v && !o.empty) { inp.focus(); return; } done = true; m.close(); res(v); };
    m.box.querySelector('[data-n]').onclick = () => m.close(); m.box.querySelector('[data-y]').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => { inp.focus(); inp.select(); }, 80);
  });
}
function undoable(msg, fn) {
  const before = JSON.stringify(S, (k, v) => k === '_fixed' ? undefined : v);
  fn(); save(); render();
  toast(msg, { act: 'بازگردانی', fn: () => { const rev = S.rev; S = norm(JSON.parse(before)); S.rev = rev; save(); render(); toast('بازگردانی شد'); } });
}
function download(name, text, type) {
  const b = new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function csv(rows) { return '﻿' + rows.map(r => r.map(c => { c = c == null ? '' : String(c); return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n'); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('کپی شد'); } catch (e) { const i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('کپی شد'); } catch (e2) { toast('کپی نشد', { err: 1 }); } i.remove(); } }
function printHtml(h) { $('#printArea').innerHTML = h; setTimeout(() => window.print(), 80); }
function confetti() {
  if (RED) return; const cv = $('#conf'), x = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#5eead4', '#a78bfa', '#fbbf24', '#fb7185', '#60a5fa'], P = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .6, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 5, s: Math.random() * 7 + 4, c: cols[Math.random() * 5 | 0], r: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
  let f = 0; (function step() { x.clearRect(0, 0, cv.width, cv.height); P.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); x.restore(); }); if (++f < 110) requestAnimationFrame(step); else x.clearRect(0, 0, cv.width, cv.height); })();
}
const bar = (label, v, extra) => '<div class="bar"><div><span>' + esc(label) + '</span><span>' + (extra || fmt(v)) + '</span></div><i><u class="' + (v != null && v < S.cfg.pass ? 'rd' : '') + '" data-w="' + (v ? Math.min(100, v * 5) : 0) + '" style="width:0"></u></i></div>';
const stat = (ico, val, label, o) => { o = o || {}; return '<div class="glass card stat hv"><div class="ic">' + ic(ico, 20) + '</div>' + (val == null || val === '' ? '<b>—</b>' : '<b data-count="' + val + '" data-dec="' + (o.dec || 0) + '" data-suf="' + (o.suf || '') + '">' + fmt(val) + (o.suf || '') + '</b>') + '<span>' + label + '</span></div>'; };
const empty = (ico, t, btn) => '<div class="glass empty">' + ic(ico, 34) + '<div>' + t + '</div>' + (btn || '') + '</div>';
function donut(c, size) {
  const t = c.p + c.a + c.l, C = 2 * Math.PI * 52; let o = 0, h = '';
  [[c.p, '#5eead4'], [c.l, '#fbbf24'], [c.a, '#fb7185']].forEach(x => { const L = t ? x[0] / t * C : 0; if (L > 0) { h += '<circle r="52" cx="70" cy="70" fill="none" stroke="' + x[1] + '" stroke-width="14" stroke-dasharray="' + L + ' ' + (C - L) + '" stroke-dashoffset="' + (-o) + '" transform="rotate(-90 70 70)"/>'; o += L; } });
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 140 140" role="img" aria-label="نمودار حضور"><circle r="52" cx="70" cy="70" fill="none" stroke="rgba(128,138,190,.2)" stroke-width="14"/>' + h + '<text x="70" y="77" text-anchor="middle" fill="currentColor" font-size="24" font-weight="800">' + (t ? fa(Math.round(c.p / t * 100)) + '٪' : '—') + '</text></svg>';
}

/* ---------- theme ---------- */
const themePref = () => ls('theme') || 'auto';
const isLight = () => { const p = themePref(); return p === 'light' || (p === 'auto' && matchMedia('(prefers-color-scheme:light)').matches); };
function applyTheme() { document.documentElement.setAttribute('data-theme', isLight() ? 'light' : 'dark'); const m = $('meta[name=theme-color]'); if (m) m.content = isLight() ? '#eef1fb' : '#0a0e2a'; }
applyTheme();
matchMedia('(prefers-color-scheme:light)').addEventListener && matchMedia('(prefers-color-scheme:light)').addEventListener('change', applyTheme);
A.theme = () => { ls('theme', isLight() ? 'dark' : 'light'); applyTheme(); render(); };
A.setTheme = v => { ls('theme', v); applyTheme(); render(); };

/* ---------- router & render ---------- */
function go(p) { if (location.hash !== '#/' + p) location.hash = '#/' + p; else render(1); }
A.go = go;
window.addEventListener('hashchange', () => { const p = location.hash.replace('#/', ''); if (PG.some(x => x[0] === p) && p !== page) { page = p; ST.qv = 'list'; render(1); window.scrollTo(0, 0); } });
function buildNav() {
  $('#bcls').textContent = S.cfg.cls || 'پنل استاد'; $('#bsch').textContent = S.cfg.school || 'مدیریت کلاس';
  document.title = 'پنل استاد | ' + (S.cfg.cls || '');
  $('#nav').innerHTML = PG.map((p, i) => (p[0] === 'ann' ? '<div class="sep"></div>' : '') + '<button class="nv' + (p[0] === page ? ' on' : '') + '" onclick="A.go(\'' + p[0] + '\')"' + (p[0] === page ? ' aria-current="page"' : '') + '>' + ic(p[2]) + '<span>' + p[1] + '</span>' + (typeof navBadge === 'function' ? navBadge(p[0]) : '') + '</button>').join('');
  const more = !BN.includes(page);
  $('#bn').innerHTML = BN.map(k => { const p = PG.find(x => x[0] === k); return '<button class="' + (k === page ? 'on' : '') + '" onclick="A.go(\'' + k + '\')">' + ic(p[2], 21) + p[1].split(' ')[0] + '</button>'; }).join('') + '<button class="' + (more ? 'on' : '') + '" onclick="A.moreMenu()">' + ic('more', 21) + 'بیشتر</button>';
  $('#foot').innerHTML = '<div class="r"><button class="btn sm" onclick="A.pal()" style="flex:1">' + ic('search', 15) + ' جستجو <kbd>Ctrl K</kbd></button><button class="btn ic" onclick="A.theme()" aria-label="تغییر تم" style="min-width:36px;padding:3px">' + ic(isLight() ? 'sun' : 'moon', 16) + '</button></div>پنل استاد · نسخه‌ی ' + fa(INFO.ver || '3.0');
}
A.moreMenu = () => {
  const m = modal({ title: 'منو', html: '<div class="list">' + PG.filter(p => !BN.includes(p[0])).map(p => '<button class="it clk" style="all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;background:var(--fill);border:1px solid var(--gb);cursor:pointer" data-p="' + p[0] + '">' + ic(p[2], 20) + '<span class="n" style="flex:1">' + p[1] + '</span></button>').join('') +
    '<button style="all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;background:var(--fill);border:1px solid var(--gb);cursor:pointer" data-a="theme">' + ic(isLight() ? 'sun' : 'moon', 20) + '<span style="flex:1">تغییر تم</span></button><button style="all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;background:var(--fill);border:1px solid var(--gb);cursor:pointer;color:var(--r)" data-a="out">' + ic('out', 20) + '<span style="flex:1">خروج</span></button></div>' });
  m.box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { m.close(); go(b.dataset.p); });
  m.box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { m.close(); if (b.dataset.a === 'theme') A.theme(); else A.logout(); });
};
function topbar() {
  return '<div class="top"><span class="d">' + new Date().toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</span><span class="sync' + (syncSt === 'saving' ? ' saving' : syncSt === 'off' ? ' off' : '') + '" id="sync"><i></i><span>' + (syncSt === 'ok' ? 'ذخیره شد' : syncSt === 'saving' ? 'در حال ذخیره…' : 'ذخیره نشد؛ تلاش مجدد…') + '</span></span>' +
    (typeof clsChip === 'function' ? clsChip() + bellBtn() : '') + '<div class="glass me" onclick="A.pickAv(\'t\')" style="cursor:pointer" title="تغییر عکس پروفایل"><span>' + esc(S.cfg.teacher) + '</span><span class="av' + ((typeof AV !== 'undefined' && AV.t) ? ' ph tav' : '') + '">' + esc(initial(String(S.cfg.teacher).replace(/^استاد\s*/, ''))) + '</span></div><button class="btn ic" onclick="A.logout()" aria-label="خروج" title="خروج">' + ic('out') + '</button></div>';
}
function render(fx) {
  if (!S) return;
  buildNav();
  $('#main').innerHTML = topbar() + '<div class="pg' + (fx ? ' fx' : '') + '" id="pg">' + (V[page] ? V[page]() : '') + '</div><div class="credit">طراحی و توسعه توسط <b>امیرعلی ساقی</b> · ۲۰۲۶</div>';
  post(fx); if (AFTER[page]) AFTER[page]();
}
function post(fx) {
  const m = $('#main');
  if (fx && !RED) m.querySelectorAll('.card,.it,.hero,.tw,.empty,.qc').forEach((e, i) => { if (i > 40) return; e.style.animationDelay = Math.min(i * 40, 600) + 'ms'; e.classList.add('rise'); });
  m.querySelectorAll('.bar u').forEach(u => { const w = u.dataset.w; if (RED || !fx) u.style.width = w + '%'; else setTimeout(() => u.style.width = w + '%', 140); });
  m.querySelectorAll('[data-count]').forEach(b => {
    const n = parseFloat(b.dataset.count), dec = +b.dataset.dec || 0, suf = b.dataset.suf || '', f = x => fa(x, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (RED || !fx || isNaN(n)) { b.textContent = f(n); return; }
    const s = performance.now(); (function st(now) { const p = Math.min(1, (now - s) / 900), e = 1 - Math.pow(1 - p, 3); b.textContent = f(n * e); if (p < 1) requestAnimationFrame(st); })(s);
  });
}
document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.card.hv'); if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); } });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.btn'); if (!b || RED) return; const r = b.getBoundingClientRect(), p = document.createElement('span'); p.className = 'rp'; p.style.left = (e.clientX - r.left) + 'px'; p.style.top = (e.clientY - r.top) + 'px'; b.appendChild(p); setTimeout(() => p.remove(), 600); });

/* ---------- auth ---------- */
function showLogin() {
  window.__lgDone = null; if (window.LGFX) LGFX.reset();
  $('#lg').style.display = 'grid';
  const u = $('#lu'); if (u && !u.value) { const last = ls('lastUser'); if (last) u.value = last; }
  // روی گوشی کیبورد خودکار باز نمی‌شود تا صفحه‌ی ورود کامل دیده شود
  setTimeout(() => { if (window.matchMedia && matchMedia('(pointer:coarse)').matches) return; const n = $('#lu'), p = $('#lp'); (n && !n.value ? n : p).focus(); }, 60);
}
// بعد از ورود موفق، اول انیمیشن موفقیت تمام می‌شود، بعد صفحه‌ی ورود بسته می‌شود
function hideLogin() { const go = () => { $('#lg').style.display = 'none'; }; const d = window.__lgDone; window.__lgDone = null; if (d) d.then(go, go); else go(); }
async function doLogin() {
  const e = $('#le'), b = $('#lb'); if (b.disabled) return; e.textContent = '';
  const u = $('#lu').value.trim(), p = $('#lp').value;
  const bad = m => { if (window.LGFX) LGFX.fail(m); else e.textContent = m; };
  if (!u || !p) { bad(!u ? 'نام کاربری را وارد کنید.' : 'رمز عبور را وارد کنید.'); (!u ? $('#lu') : $('#lp')).focus(); return; }
  b.disabled = true;
  const r = await api('/api/login', { body: JSON.stringify({ user: u, pass: p }) });
  b.disabled = false;
  if (r.status === 200) {
    ls('lastUser', u); $('#lp').value = ''; $('#lp').type = 'password';
    if (window.LGFX) window.__lgDone = LGFX.success();
    await boot(dirty); if (dirty) flush();
  } else bad(r.status === 403 ? 'رمز پیش‌فرض است؛ ابتدا ADMIN_PASS را در Railway (Variables) تنظیم کنید.' : r.status === 429 ? 'تلاش‌های زیاد؛ ۱۵ دقیقه بعد دوباره امتحان کنید.' : r.status === 0 ? 'ارتباط با سرور برقرار نشد؛ اینترنت را بررسی کنید.' : 'نام کاربری یا رمز عبور درست نیست.');
}
A.logout = async () => {
  if (!(await ask({ title: 'خروج از حساب', body: 'آیا می‌خواهید از حساب خود خارج شوید؟', ok: 'بله، خارج شو', danger: 1 }))) return;
  return A.logoutNow();
};
A.logoutNow = async () => { if (dirty) { await flush(); } if (typeof actStop === 'function') actStop(); await api('/api/logout'); S = null; RES = []; showLogin(); };
const _pe = $('#lpe'); if (_pe) _pe.onclick = () => { const i = $('#lp'), sh = i.type === 'password'; i.type = sh ? 'text' : 'password'; _pe.classList.toggle('on', sh); _pe.setAttribute('aria-label', sh ? 'پنهان کردن رمز' : 'نمایش رمز'); };
$('#lp').addEventListener('keyup', e => { const c = $('#lcaps'); if (c && e.getModifierState) c.classList.toggle('on', e.getModifierState('CapsLock')); });
$('#lb').onclick = doLogin; $('#lp').onkeydown = e => { if (e.key === 'Enter') doLogin(); }; $('#lu').onkeydown = e => { if (e.key === 'Enter') $('#lp').focus(); };

async function loadRes() { const r = await api('/api/results'); if (r.status === 200) { RES = arr(r.data.attempts); if (S && typeof syncLinks === 'function') syncLinks(); } }
async function loadInfo() { const r = await api('/api/info'); if (r.status === 200) INFO = r.data; }
async function boot(keep) {
  const cl = await api('/api/classes');
  if (cl.status === 200) { CLS = arr(cl.data.list); CID = cl.data.cur; MAXST = cl.data.max || 30; ls('cid', String(CID)); const tk = await api('/api/taken'); TAKEN = tk.status === 200 ? arr(tk.data.users) : []; }
  const r = await api('/api/state');
  if (r.status !== 200) { if (r.status === 401) showLogin(); else { showLogin(); $('#le').textContent = 'ارتباط با سرور برقرار نشد.'; } return; }
  if (!keep) { S = norm(r.data); } else { if (!S) S = norm(r.data); else S.rev = +r.data.rev || 0; }
  hideLogin();
  await Promise.all([loadRes(), loadInfo()]);
  const p = location.hash.replace('#/', ''); if (PG.some(x => x[0] === p)) page = p;
  render(1);
  if (S._fixed) { S._fixed = false; save(); }
  if (typeof actStart === 'function') actStart();
}
setInterval(async () => { if (!S || document.hidden || dirty || saving) return; if (page === 'qz' || page === 'dash') { await loadRes(); if (!$('.mdl') && !document.activeElement.closest('input,textarea,select')) { if (page === 'dash' || (page === 'qz' && ST.qv !== 'edit')) render(); } } }, 60000);

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function banners() {
  let h = '';
  if (INFO.weak) h += '<div class="warn rise">' + ic('alert', 22) + '<span><b>رمز عبور پیش‌فرض است.</b> هر کسی که آدرس پنل را بداند می‌تواند وارد شود. همین حالا رمز را عوض کنید.</span><button class="btn sm pri" onclick="A.go(\'set\')">تغییر رمز</button></div>';
  if (INFO.writable === false) h += '<div class="warn rise">' + ic('alert', 22) + '<span><b>پوشه‌ی داده‌ها قابل‌نوشتن نیست.</b> تغییرات ذخیره نمی‌شود؛ دسترسی پوشه‌ی class-data را روی ۷۵۵ بگذارید.</span></div>';
  const lb = +ls('lastDl') || 0;
  if (S.st.length && Date.now() - lb > 14 * 864e5) h += '<div class="warn rise">' + ic('bk', 22) + '<span>' + (lb ? 'آخرین دانلود پشتیبان ' + fa(Math.floor((Date.now() - lb) / 864e5)) + ' روز پیش بود.' : 'هنوز نسخه‌ی پشتیبانی روی دستگاه خودتان نگه نداشته‌اید.') + ' یک نسخه دانلود کنید تا اطلاعات کلاس همیشه امن باشد.</span><button class="btn sm" onclick="A.dlBackup()">دانلود پشتیبان</button></div>';
  return h;
}
V.dash = () => S.st.length ? dash2() : onboard();
function onboard() {
  const g = greet(), st = [['st', 'افزودن دانش‌آموزان', 'نام‌ها را وارد کنید؛ چند نام را می‌توانید یکجا بچسبانید.', 'st'], ['att', 'ثبت حضور و غیاب', 'از اولین جلسه شروع کنید.', 'att'], ['gr', 'تعریف ستون نمره', 'کوییز کلاسی، نمره مستمر، آزمون یا تمرین.', 'gr'], ['qz', 'ساخت اولین کوییز', 'دانش‌آموزان آن را در اپ می‌بینند و آنلاین پاسخ می‌دهند.', 'qz']];
  return banners() + '<div class="glass hero"><div><h1>' + g + ' ' + esc(S.cfg.teacher) + '</h1><p class="sub" style="margin:0">کلاس شما خالی است. با این چهار قدم شروع کنید.</p></div></div><div class="grid">' + st.map((x, i) => '<div class="glass card hv" style="cursor:pointer" onclick="A.go(\'' + x[0] + '\')"><span class="bdg">' + fa(i + 1) + '</span><div class="ic" style="margin:8px 0;display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--fill);color:var(--a)">' + ic(x[3], 20) + '</div><h3>' + x[1] + '</h3><p class="sub" style="margin:0;font-size:13px">' + x[2] + '</p></div>').join('') + '</div>' +
    '<div class="glass card"><h3>بازیابی از پشتیبان</h3><p class="sub" style="margin:0 0 10px">اگر قبلاً از اطلاعات کلاس نسخه‌ی پشتیبان گرفته‌اید، همین‌جا برگردانید.</p><button class="btn" onclick="A.go(\'bk\')">' + ic('ul', 16) + ' رفتن به پشتیبان‌گیری</button></div>';
}
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 18 ? 'ظهر بخیر' : 'عصر بخیر'; };
function dash2() {
  const td = iso(), c = cnt(S.att[td] || {}), tot = c.p + c.a + c.l;
  let all = [], ni = 0; CK.forEach(k => { ni += S.gr[k].items.length; S.st.forEach(s => { all = all.concat(scoresOf(k, s.id)); }); });
  const dates = Object.keys(S.att).filter(d => Object.keys(S.att[d]).length).sort().slice(-7);
  const tr = dates.map(d => { const x = cnt(S.att[d]), t = x.p + x.a + x.l || 1, p = x.p / t * 100; return '<div title="' + pdate(d) + '"><span>' + fa(Math.round(p)) + '</span><u style="height:' + Math.max(4, p * .95) + 'px"></u>' + pdate(d, { day: 'numeric', month: 'numeric' }) + '</div>'; }).join('');
  const rk = S.st.slice().sort((a, b) => pts(b.id) - pts(a.id)).slice(0, 5).map((s, i) => { const p = pts(s.id); return '<div class="it clk" onclick="A.openS(' + s.id + ')"><span class="rk">' + fa(i + 1) + '</span><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + '</span><span class="n">' + esc(s.name) + '</span><span class="bdg ' + (p < 0 ? 'mi' : p > 0 ? 'pl' : '') + '">' + (p > 0 ? '+' : '') + fa(p) + '</span></div>'; }).join('');
  const risk = S.st.map(s => { const a = allAvg(s.id), ab = attOf(s.id).a, p = pts(s.id), why = []; if (a != null && a < S.cfg.pass) why.push('میانگین پایین'); if (ab >= 3) why.push(fa(ab) + ' غیبت'); if (p < 0) why.push('امتیاز منفی'); return why.length ? { s, why } : null; }).filter(Boolean).slice(0, 5)
    .map(x => '<div class="it clk" onclick="A.openS(' + x.s.id + ')"><span class="av" style="background:var(--r);color:#fff">' + esc(initial(x.s.name)) + '</span><span class="n">' + esc(x.s.name) + '<br><small class="mut">' + x.why.join(' · ') + '</small></span></div>').join('');
  const lq = lastQ().slice(0, 5).map(a => { const q = quizOf(a.qid); return '<div class="it"><span class="dot" style="background:' + (a.sc >= S.cfg.pass ? 'var(--a)' : 'var(--r)') + '"></span><span class="n">' + esc(a.n) + ' · ' + esc(q ? q.t : 'کوییز حذف‌شده') + '</span><span class="bdg ' + lvlc(a.sc) + '">' + fmt(a.sc) + '</span></div>'; }).join('');
  const lp = S.pts.slice(-5).reverse().map(p => { const s = stById(p.sid); return '<div class="it"><span class="dot" style="background:' + (p.v > 0 ? 'var(--a)' : 'var(--r)') + '"></span><span class="n">' + (s ? esc(s.name) : '—') + ' · ' + (p.v > 0 ? 'امتیاز مثبت' : 'امتیاز منفی') + '</span><small class="mut">' + pdate(p.d) + '</small></div>'; }).join('');
  const act = S.quizzes.filter(q => qStatus(q) === 'open').length;
  const ann = S.ann.slice().sort((a, b) => b.d - a.d).filter(a => !a.hide)[0];
  return banners() + '<div class="glass hero"><div><h1>' + greet() + ' ' + esc(S.cfg.teacher) + '</h1><p class="sub" style="margin:0 0 14px">' + (tot ? 'امروز حضور و غیاب ثبت شده است.' : 'هنوز حضور و غیاب امروز ثبت نشده است.') + '</p><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" onclick="A.go(\'att\')">' + ic('att', 16) + ' ثبت حضور امروز</button><button class="btn" onclick="A.newQuiz()">' + ic('plus', 16) + ' ساخت کوییز</button><button class="btn" onclick="A.go(\'gr\')">' + ic('gr', 16) + ' ثبت نمره</button></div></div>' + donut(c, 150) + '</div>' +
    '<div class="grid">' + stat('st', S.st.length, 'دانش‌آموز') + stat('att', tot ? Math.round(c.p / tot * 100) : null, 'حضور امروز', { suf: '٪' }) + stat('gr', avg(all), 'میانگین کل از ۲۰', { dec: 1 }) + stat('qz', act, 'کوییز باز · ' + fa(RES.length) + ' پاسخ ثبت‌شده') + '</div>' +
    '<div class="g2"><div class="glass card"><h3>روند حضور (۷ جلسه‌ی اخیر)</h3>' + (tr ? '<div class="trend">' + tr + '</div>' : '<div class="empty">هنوز جلسه‌ای ثبت نشده است.</div>') + '</div><div class="glass card"><h3>میانگین هر بخش</h3>' + CK.map(k => { const v = []; S.st.forEach(s => { v.push(...scoresOf(k, s.id)); }); return bar(CATS[k], avg(v)); }).join('') + '</div></div>' +
    '<div class="g3"><div class="glass card"><h3>برترین‌ها (امتیاز)</h3><div class="list">' + rk + '</div></div><div class="glass card"><h3>نیازمند توجه</h3><div class="list">' + (risk || '<div class="empty">همه‌چیز خوب است ✨</div>') + '</div></div><div class="glass card"><h3>آخرین فعالیت‌ها</h3><div class="list">' + (lq + lp || '<div class="empty">فعالیتی ثبت نشده است.</div>') + '</div></div></div>' +
    (ann ? '<div class="glass card"><div class="ph" style="margin:0"><div><h3>' + ic('ann', 16) + ' آخرین اطلاعیه: ' + esc(ann.t) + '</h3><p class="sub" style="margin:0;white-space:pre-wrap">' + esc(ann.b || '') + '</p></div><button class="btn sm" onclick="A.go(\'ann\')">مدیریت</button></div></div>' : '');
}

/* =====================================================================
   ATTENDANCE
   ===================================================================== */
function shiftDay(n) { const d = new Date(ST.adate + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
V.att = () => {
  const d = ST.adate, a = S.att[d] || {}, c = cnt(a), jd = pdate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const head = '<div class="ph"><div><h1>حضور و غیاب</h1><p class="sub">وضعیت هر جلسه را ثبت کنید و امتیاز مثبت یا منفی بدهید.</p></div><div class="seg" role="tablist"><button class="' + (ST.aview === 'day' ? 'on' : '') + '" onclick="A.aview(\'day\')">روزانه</button><button class="' + (ST.aview === 'grid' ? 'on' : '') + '" onclick="A.aview(\'grid\')">جدول جلسات</button></div></div>';
  if (!S.st.length) return head + empty('st', 'ابتدا دانش‌آموزان را اضافه کنید.', '<p style="margin-top:12px"><button class="btn pri" onclick="A.go(\'st\')">افزودن دانش‌آموز</button></p>');
  if (ST.aview === 'grid') return head + attGrid();
  return head + '<div class="frm" style="align-items:center"><button class="btn ic" onclick="A.day(-1)" aria-label="روز قبل">' + ic('chevR') + '</button><div class="fld" style="flex:0 1 200px"><input class="inp" type="date" value="' + d + '" onchange="A.setDay(this.value)" aria-label="تاریخ"></div><button class="btn ic" onclick="A.day(1)" aria-label="روز بعد">' + ic('chevL') + '</button><button class="btn" onclick="A.setDay(\'' + iso() + '\')">امروز</button><span class="mut sm" style="flex:1;min-width:140px">' + jd + '</span></div>' +
    '<div class="frm" style="align-items:center"><span class="chip"><i class="dot" style="background:var(--a)"></i>حاضر <b>' + fa(c.p) + '</b></span><span class="chip"><i class="dot"></i>غایب <b>' + fa(c.a) + '</b></span><span class="chip"><i class="dot" style="background:var(--y)"></i>تأخیر <b>' + fa(c.l) + '</b></span><span class="chip">بدون ثبت <b>' + fa(S.st.length - c.p - c.a - c.l) + '</b></span><span style="flex:1"></span><button class="btn pri" onclick="A.allP()">' + ic('check', 16) + ' همه حاضر</button><button class="btn" onclick="A.clearDay()">پاک‌کردن روز</button></div>' +
    '<div class="frm"><input class="inp w" placeholder="جستجوی دانش‌آموز…" value="' + esc(ST.aq) + '" oninput="A.aq(this.value)" aria-label="جستجو"></div><div class="list" id="alist">' + attRows() + '</div>';
};
function attRows() {
  const a = S.att[ST.adate] || {}, q = norm_fa(ST.aq);
  const l = S.st.filter(s => !q || norm_fa(s.name).includes(q));
  return l.map(s => {
    const v = a[s.id], p = pts(s.id);
    return '<div class="it"><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + '</span><span class="n clk" style="cursor:pointer" onclick="A.openS(' + s.id + ')">' + esc(s.name) + '</span>' +
      [['p', 'حاضر'], ['a', 'غایب'], ['l', 'تأخیر']].map(x => '<button class="btn sm ' + x[0] + (v === x[0] ? ' on' : '') + '" aria-pressed="' + (v === x[0]) + '" onclick="A.setA(' + s.id + ',\'' + x[0] + '\')">' + x[1] + '</button>').join('') +
      '<button class="btn sm xs dg" onclick="A.pt(' + s.id + ',-1)" aria-label="امتیاز منفی">−</button><span class="bdg ' + (p < 0 ? 'mi' : p > 0 ? 'pl' : '') + '" title="مجموع امتیاز">' + (p > 0 ? '+' : '') + fa(p) + '</span><button class="btn sm xs" style="color:var(--a)" onclick="A.pt(' + s.id + ',1)" aria-label="امتیاز مثبت">+</button></div>';
  }).join('') || '<div class="glass empty">موردی پیدا نشد.</div>';
}
function attGrid() {
  const set = new Set(Object.keys(S.att).filter(d => Object.keys(S.att[d]).length)); set.add(ST.adate);
  const dates = Array.from(set).sort().slice(-18);
  const th = dates.map(d => '<th style="min-width:46px;font-size:11px;cursor:pointer" onclick="A.setDay(\'' + d + '\');A.aview(\'day\')" title="' + pdate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + '">' + pdate(d, { day: 'numeric', month: 'numeric' }) + '</th>').join('');
  const tr = S.st.map(s => '<tr><td>' + esc(s.name) + '</td>' + dates.map(d => { const v = (S.att[d] || {})[s.id]; return '<td><button class="hm ' + (v || '') + '" style="border:0;cursor:pointer" onclick="A.cyc(' + s.id + ',\'' + d + '\')" aria-label="' + ({ p: 'حاضر', a: 'غایب', l: 'تأخیر' }[v] || 'ثبت‌نشده') + '"></button></td>'; }).join('') + '<td><span class="bdg ' + (attPct(s.id) != null && attPct(s.id) < 75 ? 'mi' : 'pl') + '">' + (attPct(s.id) == null ? '—' : fa(attPct(s.id)) + '٪') + '</span></td><td>' + fa(attOf(s.id).a) + '</td></tr>').join('');
  return '<div class="frm" style="align-items:center"><span class="chip"><i class="dot" style="background:var(--a)"></i>حاضر</span><span class="chip"><i class="dot"></i>غایب</span><span class="chip"><i class="dot" style="background:var(--y)"></i>تأخیر</span><span class="mut sm">روی هر خانه بزنید تا وضعیت عوض شود. روی تاریخ بزنید تا آن روز باز شود.</span><span style="flex:1"></span><button class="btn" onclick="A.exportAtt()">' + ic('dl', 16) + ' خروجی CSV</button></div><div class="glass tw"><table><thead><tr><th>دانش‌آموز</th>' + th + '<th>حضور</th><th>غیبت</th></tr></thead><tbody>' + tr + '</tbody></table></div>';
}
Object.assign(A, {
  aview: v => { ST.aview = v; render(); },
  day: n => { ST.adate = shiftDay(n); render(); },
  setDay: v => { if (v) { ST.adate = v; render(); } },
  aq: v => { ST.aq = v; const e = $('#alist'); if (e) e.innerHTML = attRows(); },
  setA: (id, v) => { const d = ST.adate; S.att[d] = S.att[d] || {}; if (S.att[d][id] === v) delete S.att[d][id]; else S.att[d][id] = v; if (!Object.keys(S.att[d]).length) delete S.att[d]; save(); render(); },
  cyc: (id, d) => { const order = ['', 'p', 'a', 'l']; S.att[d] = S.att[d] || {}; const n = order[(order.indexOf(S.att[d][id] || '') + 1) % 4]; if (n) S.att[d][id] = n; else delete S.att[d][id]; save(); render(); },
  allP: () => { const d = ST.adate; S.att[d] = S.att[d] || {}; S.st.forEach(s => { S.att[d][s.id] = 'p'; }); save(); render(); toast('حضور همه ثبت شد'); confetti(); },
  clearDay: async () => { if (!S.att[ST.adate]) return; if (await ask({ title: 'پاک‌کردن حضور و غیاب', body: 'وضعیت همه‌ی دانش‌آموزان در ' + pdate(ST.adate) + ' پاک شود؟', ok: 'پاک شود', danger: 1 })) undoable('حضور و غیاب این روز پاک شد', () => { delete S.att[ST.adate]; }); },
  pt: (id, v) => { S.pts.push({ sid: id, v, d: ST.adate }); save(); render(); toast((v > 0 ? 'امتیاز مثبت' : 'امتیاز منفی') + ' برای ' + (stById(id) || {}).name); },
  exportAtt: () => { const ds = Object.keys(S.att).sort(); download('attendance.csv', csv([['نام'].concat(ds.map(d => pdate(d, { year: 'numeric', month: 'numeric', day: 'numeric' }))).concat(['درصد حضور'])].concat(S.st.map(s => [s.name].concat(ds.map(d => ({ p: 'ح', a: 'غ', l: 'ت' }[(S.att[d] || {})[s.id]] || ''))).concat([attPct(s.id) == null ? '' : attPct(s.id)])))), 'text/csv'); },
});

/* =====================================================================
   GRADES
   ===================================================================== */
V.gr = () => {
  const tabs = '<div class="tabs">' + CK.map(c => '<button class="btn' + (c === ST.gcat ? ' p on' : '') + '" onclick="A.gcat(\'' + c + '\')">' + CATS[c] + ' <span class="bdg" style="min-width:0;padding:0 7px">' + fa(S.gr[c].items.length) + '</span></button>').join('') + '<button class="btn' + (ST.gcat === 'sum' ? ' p on' : '') + '" onclick="A.gcat(\'sum\')">' + ic('star', 15) + ' نمره‌ی نهایی</button></div>';
  const head = '<div class="ph"><div><h1>ثبت نمرات</h1><p class="sub">نمره‌ها از ۲۰ هستند؛ با Enter یا کلیدهای جهت‌دار بین خانه‌ها حرکت کنید.</p></div></div>';
  if (!S.st.length) return head + empty('st', 'ابتدا دانش‌آموزان را اضافه کنید.', '<p style="margin-top:12px"><button class="btn pri" onclick="A.go(\'st\')">افزودن دانش‌آموز</button></p>');
  if (ST.gcat === 'sum') return head + tabs + gSummary();
  const c = ST.gcat, d = S.gr[c];
  const th = d.items.map(i => '<th><span class="hd"><b onclick="A.renI(' + i.id + ')" title="تغییر نام">' + esc(i.t) + '</b>' + (i.qz ? '<span class="lkb" title="نمره‌ها خودکار از کوییز ثبت می‌شوند">' + ic('bolt', 13) + '</span>' : '') + '<button class="btn xs dg" onclick="A.delI(' + i.id + ')" aria-label="حذف ستون">×</button></span></th>').join('');
  const tr = S.st.map((s, r) => '<tr><td>' + esc(s.name) + '</td>' + d.items.map((i, k) => { const x = i.sc[s.id]; return '<td><input class="inp sc ' + gcl(x === undefined || x === '' ? null : +x) + '" type="number" inputmode="decimal" min="0" max="20" step="any" data-r="' + r + '" data-k="' + k + '" value="' + (x === undefined ? '' : x) + '"' + (i.qz ? ' disabled title="ثبت خودکار از کوییز"' : '') + ' onchange="A.setG(' + i.id + ',' + s.id + ',this)" onkeydown="A.gkey(event,this)" aria-label="' + esc(s.name + ' — ' + i.t) + '"></td>'; }).join('') + '<td><span class="bdg ' + lvlc(catAvg(c, s.id)) + '" id="ra' + s.id + '">' + fmt(catAvg(c, s.id)) + '</span></td></tr>').join('');
  const foot = '<tfoot><tr><td>میانگین ستون</td>' + d.items.map(i => '<td id="ca' + i.id + '">' + fmt(avg(S.st.map(s => i.sc[s.id]).filter(x => x !== undefined && x !== '').map(Number))) + '</td>').join('') + '<td>' + fmt(avg(S.st.map(s => catAvg(c, s.id)).filter(x => x != null))) + '</td></tr></tfoot>';
  return head + tabs + '<div class="frm"><input class="inp w" id="ni" placeholder="' + (c === 'cont' ? 'مثلاً واحد ۱: HTML' : 'عنوان ستون، مثلاً جلسه ۳') + '" onkeydown="if(event.key===\'Enter\')A.addI()"><button class="btn pri" onclick="A.addI()">' + ic('plus', 16) + ' افزودن ستون</button><button class="btn" onclick="A.exportG()" ' + (d.items.length ? '' : 'disabled') + '>' + ic('dl', 16) + ' CSV</button></div>' +
    (d.items.length ? '<div class="glass tw"><table><thead><tr><th>دانش‌آموز</th>' + th + '<th>میانگین</th></tr></thead><tbody>' + tr + '</tbody>' + foot + '</table></div>' : empty('gr', 'هنوز ستونی برای «' + CATS[c] + '» نساخته‌اید.<br>عنوان بنویسید و «افزودن ستون» را بزنید.'));
};
function gSummary() {
  const w = S.cfg.w, rows = S.st.map(s => ({ s, f: finalOf(s.id), c: CK.map(k => catAvg(k, s.id)) })).sort((a, b) => (b.f == null ? -1 : b.f) - (a.f == null ? -1 : a.f));
  const fs = rows.map(r => r.f).filter(x => x != null), hist = [0, 0, 0, 0, 0]; fs.forEach(x => { hist[Math.min(4, Math.floor(x / 4))]++; });
  const mx = Math.max(1, ...hist), lab = ['۰–۴', '۴–۸', '۸–۱۲', '۱۲–۱۶', '۱۶–۲۰'];
  return '<div class="g2"><div class="glass card"><h3>توزیع نمره‌ی نهایی</h3><div class="trend">' + hist.map((n, i) => '<div><span>' + fa(n) + '</span><u style="height:' + Math.max(4, n / mx * 100) + 'px' + (i < 2 ? ';background:linear-gradient(180deg,var(--r),var(--y))' : '') + '"></u>' + lab[i] + '</div>').join('') + '</div></div><div class="glass card"><h3>وزن بخش‌ها</h3><p class="sub" style="font-size:13px">نمره‌ی نهایی میانگین وزنی بخش‌هاست. وزن‌ها را در تنظیمات عوض کنید.</p>' + CK.map(k => '<div class="bar"><div><span>' + CATS[k] + '</span><span>وزن ' + fa(w[k]) + '</span></div></div>').join('') + '<button class="btn sm" onclick="A.go(\'set\')">تغییر وزن‌ها</button></div></div>' +
    '<div class="glass tw"><table><thead><tr><th>رتبه · دانش‌آموز</th>' + CK.map(k => '<th>' + CATS[k] + '</th>').join('') + '<th>نمره‌ی نهایی</th></tr></thead><tbody>' + rows.map((r, i) => '<tr><td><span class="rk" style="display:inline-block">' + fa(i + 1) + '</span> ' + esc(r.s.name) + '</td>' + r.c.map(x => '<td><span class="bdg ' + lvlc(x) + '">' + fmt(x) + '</span></td>').join('') + '<td><span class="bdg ' + lvlc(r.f) + '" style="font-size:14px">' + fmt(r.f) + '</span></td></tr>').join('') + '</tbody></table></div>';
}
Object.assign(A, {
  gcat: c => { ST.gcat = c; render(); },
  addI: () => { const t = $('#ni').value.trim(); if (!t) { toast('عنوان را بنویسید', { err: 1 }); $('#ni').focus(); return; } S.gr[ST.gcat].items.push({ id: S.nid++, t, sc: {} }); save(); render(); },
  renI: async id => { const i = S.gr[ST.gcat].items.find(x => x.id == id); const t = await askText({ title: 'تغییر نام ستون', label: 'عنوان', value: i.t }); if (t) { i.t = t; save(); render(); } },
  delI: async id => { const i = S.gr[ST.gcat].items.find(x => x.id == id); if (await ask({ title: 'حذف ستون', body: 'ستون «' + i.t + '» با همه‌ی نمره‌هایش حذف شود؟', ok: 'حذف', danger: 1 })) undoable('ستون حذف شد', () => { S.gr[ST.gcat].items = S.gr[ST.gcat].items.filter(x => x.id != id); }); },
  setG: (iid, sid, el) => {
    const it = S.gr[ST.gcat].items.find(x => x.id == iid); if (!it) return; let v = el.value.trim();
    if (v === '') delete it.sc[sid]; else { let n = parseFloat(v.replace(',', '.')); if (isNaN(n)) { delete it.sc[sid]; el.value = ''; } else { n = Math.min(20, Math.max(0, n)); it.sc[sid] = n; el.value = n; } }
    const x = it.sc[sid]; el.className = 'inp sc ' + gcl(x === undefined ? null : x);
    const ra = $('#ra' + sid); if (ra) { const a = catAvg(ST.gcat, sid); ra.textContent = fmt(a); ra.className = 'bdg ' + lvlc(a); }
    const ca = $('#ca' + iid); if (ca) ca.textContent = fmt(avg(S.st.map(s => it.sc[s.id]).filter(z => z !== undefined && z !== '').map(Number)));
    save(); el.classList.add('tick'); setTimeout(() => el.classList.remove('tick'), 500);
  },
  gkey: (e, el) => {
    const r = +el.dataset.r, k = +el.dataset.k; let t = null;
    if (e.key === 'Enter' || e.key === 'ArrowDown') t = $('input[data-r="' + (r + (e.shiftKey ? -1 : 1)) + '"][data-k="' + k + '"]');
    else if (e.key === 'ArrowUp') t = $('input[data-r="' + (r - 1) + '"][data-k="' + k + '"]');
    else if (e.key === 'ArrowLeft' && el.selectionStart === undefined) t = $('input[data-r="' + r + '"][data-k="' + (k + 1) + '"]');
    if (t) { e.preventDefault(); t.focus(); t.select(); }
  },
  exportG: () => { const c = ST.gcat, d = S.gr[c]; download('grades-' + c + '.csv', csv([['نام'].concat(d.items.map(i => i.t)).concat(['میانگین'])].concat(S.st.map(s => [s.name].concat(d.items.map(i => i.sc[s.id] === undefined ? '' : i.sc[s.id])).concat([fmt(catAvg(c, s.id)) === '—' ? '' : Math.round(catAvg(c, s.id) * 100) / 100])))), 'text/csv'); },
});
