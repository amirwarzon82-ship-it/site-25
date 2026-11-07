'use strict';
/* =====================================================================
   Teacher panel v4 — classes, student accounts, polls, live activity &
   notifications, quiz → grade links, settings extras, start-up
   ===================================================================== */
Object.assign(ICP, {
  po: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="M4 6l4-3 4 2 4-3"/>',
  ac: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  cl: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
  vol: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
});
PG.length = 0;
PG.push(['dash', 'داشبورد', 'dash'], ['att', 'حضور و غیاب', 'att'], ['gr', 'نمرات', 'gr'], ['qz', 'کوییزها', 'qz'], ['po', 'نظرسنجی‌ها', 'po'], ['st', 'دانش‌آموزان', 'st'],
  ['ann', 'اطلاعیه‌ها', 'ann'], ['ac', 'گزارش فعالیت', 'ac'], ['rep', 'گزارش‌ها', 'rep'], ['cl', 'کلاس‌ها', 'cl'], ['bk', 'پشتیبان‌گیری', 'bk'], ['set', 'تنظیمات', 'set']);

const fdig = s => String(s == null ? '' : s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const modalOpen = () => !!document.querySelector('.mdl');
const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('input,textarea,select')); };

/* ---------- sound ---------- */
let AUD = null;
function audio() { try { AUD = AUD || new (window.AudioContext || window.webkitAudioContext)(); if (AUD.state === 'suspended') AUD.resume(); } catch (e) { } return AUD; }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => audio(), { once: true, passive: true }));
function chime(kind) {
  if (ls('snd') === '0') return;
  const ac = audio(); if (!ac) return;
  const seq = kind === 'ok' ? [660, 880, 1175] : kind === 'warn' ? [440, 330] : [784, 988];
  try {
    const t0 = ac.currentTime;
    seq.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), s = t0 + i * 0.13;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.2, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.45);
      o.start(s); o.stop(s + 0.5);
    });
  } catch (e) { }
}

/* ---------- classes ---------- */
const clsName = id => { const c = CLS.find(x => x.id == id); return c ? c.name : ''; };
function clsChip() {
  return '<button class="btn clsw" onclick="A.clsMenu()" title="تغییر کلاس" aria-label="تغییر کلاس">' + ic('cl', 16) + '<span>' + esc(S.cfg.cls || 'کلاس') + '</span>' + ic('down', 14) + '</button>';
}
async function loadClasses() { const r = await api('/api/classes'); if (r.status === 200) { CLS = arr(r.data.list); MAXST = r.data.max || 30; } }
async function switchClass(id) {
  if (id == CID) return;
  if (dirty || saving) await flush();
  CID = +id; ls('cid', String(CID)); S = null; RES = []; PR = []; ST.qv = 'list'; ST.pv = 'list'; ACT.base = false;
  await boot(false); go('dash'); render(1);
}
V.cl = () => {
  const cards = CLS.map(c => {
    const cur = c.id == CID, nm = cur ? S.cfg.cls : c.name;
    return '<div class="glass card hv' + (cur ? ' curcls' : '') + '"><div class="ph" style="margin:0 0 8px"><div><h3 style="margin:0">' + esc(nm) + '</h3><p class="sub" style="margin:2px 0 0;font-size:13px">' + esc((cur ? S.cfg.school : c.school) || '—') + ' · ' + esc((cur ? S.cfg.teacher : c.teacher) || '—') + '</p></div>' + (cur ? '<span class="bdg pl">کلاس فعلی</span>' : '') + '</div>' +
      '<div class="frm" style="margin:6px 0 12px;gap:6px"><span class="chip">' + ic('st', 14) + fa(cur ? S.st.length : c.st) + ' از ' + fa(MAXST) + ' دانش‌آموز</span><span class="chip">' + ic('qz', 14) + fa(cur ? S.quizzes.length : c.qz) + ' کوییز</span><span class="chip">' + ic('po', 14) + fa(cur ? S.polls.length : c.po) + ' نظرسنجی</span></div>' +
      '<div class="frm" style="margin:0;gap:6px">' + (cur ? '<button class="btn sm pri" onclick="A.go(\'dash\')">رفتن به داشبورد</button><button class="btn sm" onclick="A.clsRename()">' + ic('edit', 14) + ' تغییر نام</button>' : '<button class="btn sm pri" onclick="A.switchC(' + c.id + ')">باز کردن</button>') +
      (CLS.length > 1 ? '<button class="btn sm dg" onclick="A.clsDel(' + c.id + ')" aria-label="حذف کلاس">' + ic('trash', 14) + '</button>' : '') + '</div></div>';
  }).join('');
  return '<div class="ph"><div><h1>کلاس‌ها</h1><p class="sub">هر کلاس دانش‌آموزان، حضور و غیاب، نمرات، کوییزها، نظرسنجی‌ها و اطلاعیه‌های جدا دارد. همه را از همین پنل مدیریت می‌کنید.</p></div><div class="acts"><button class="btn pri" onclick="A.clsNew()">' + ic('plus', 16) + ' کلاس جدید</button></div></div><div class="g2">' + cards + '</div>' +
    '<div class="glass card" style="margin-top:14px"><h3>' + ic('bolt', 16) + ' نکته</h3><p class="sub" style="font-size:13px;line-height:1.9;margin:0">هر دانش‌آموز فقط در یک کلاس حساب دارد و با نام کاربری و رمز خودش وارد اپ می‌شود؛ اپ خودکار کلاس او را باز می‌کند. نام کاربری‌ها در همه‌ی کلاس‌ها یکتا هستند. حداکثر ' + fa(MAXST) + ' دانش‌آموز در هر کلاس و ۱۲ کلاس مجاز است.</p></div>';
};
AFTER.cl = async () => { await loadClasses(); if (page === 'cl' && !modalOpen()) { const e = $('#pg'); if (e) { e.innerHTML = V.cl(); post(0); } } };
Object.assign(A, {
  clsMenu: async () => {
    await loadClasses();
    const m = modal({ title: 'کلاس‌ها', cls: 'sm', html: '<div class="list">' + CLS.map(c => '<button class="it clk clsit' + (c.id == CID ? ' on' : '') + '" data-c="' + c.id + '"><span class="av ' + avc(c.id) + '">' + esc(initial(c.id == CID ? S.cfg.cls : c.name)) + '</span><span class="n">' + esc(c.id == CID ? S.cfg.cls : c.name) + '<br><small class="mut">' + fa(c.id == CID ? S.st.length : c.st) + ' دانش‌آموز</small></span>' + (c.id == CID ? ic('check', 16) : '') + '</button>').join('') + '</div><div class="ph acts" style="margin:14px 0 0"><button class="btn" id="cmNew">' + ic('plus', 16) + ' کلاس جدید</button><span style="flex:1"></span><button class="btn" id="cmAll">مدیریت کلاس‌ها</button></div>' });
    m.box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { m.close(); switchClass(+b.dataset.c); });
    m.box.querySelector('#cmNew').onclick = () => { m.close(); A.clsNew(); };
    m.box.querySelector('#cmAll').onclick = () => { m.close(); go('cl'); };
  },
  switchC: id => switchClass(id),
  clsNew: async () => {
    const t = await askText({ title: 'کلاس جدید', label: 'نام کلاس / درس', ph: 'مثلاً کارگاه شبکه — پایه یازدهم', max: 60 }); if (!t) return;
    const r = await api('/api/classes/add', { body: JSON.stringify({ name: t }) });
    if (r.status === 200) { await switchClass(r.data.id); go('st'); toast('کلاس «' + t + '» ساخته شد؛ دانش‌آموزان را اضافه کنید'); confetti(); }
    else toast(r.data && r.data.error === 'limit' ? 'حداکثر ۱۲ کلاس مجاز است.' : 'ساخت کلاس ناموفق بود', { err: 1 });
  },
  clsRename: async () => { const t = await askText({ title: 'تغییر نام کلاس', label: 'نام کلاس', value: S.cfg.cls, max: 60 }); if (t) { S.cfg.cls = t; save(); const c = CLS.find(x => x.id == CID); if (c) c.name = t; render(); } },
  clsDel: async id => {
    const nm = id == CID ? S.cfg.cls : clsName(id);
    if (!await ask({ title: 'حذف کلاس', html: 'کلاس «' + esc(nm) + '» با همه‌ی دانش‌آموزان، نمرات، کوییزها و پاسخ‌هایش حذف می‌شود.<br>قبل از حذف یک نسخه‌ی ایمنی روی سرور ساخته می‌شود.', ok: 'حذف کلاس', danger: 1 })) return;
    if (dirty || saving) await flush();
    const r = await api('/api/classes/delete', { body: JSON.stringify({ id }) });
    if (r.status !== 200) { toast('حذف ناموفق بود', { err: 1 }); return; }
    await loadClasses(); if (id == CID) { CID = (CLS[0] || {}).id || 1; S = null; await boot(false); } toast('کلاس حذف شد'); render(1);
  },
});

/* ---------- live activity & teacher notifications ---------- */
const ACT = { last: 0, items: [], seen: {}, t: null, base: false, sig: '' };
let UNREAD = 0;
const ACK = { login: ['key', 'ورود', 'var(--a)'], login_fail: ['alert', 'ورود ناموفق', 'var(--r)'], quiz_start: ['qz', 'شروع آزمون', 'var(--b)'], quiz_done: ['check', 'پایان آزمون', 'var(--v)'], poll: ['po', 'نظرسنجی', 'var(--y)'], hw: ['file', 'تکلیف', 'var(--b)'], msg: ['ann', 'پیام', 'var(--v)'] };
let MSG_UN = 0;
const seenId = () => +ls('actSeen') || 0;
function recount() { UNREAD = ACT.items.filter(x => x.id > seenId()).length; }
function refreshBadges() {
  const b = $('#bellN'); if (b) { b.textContent = UNREAD ? fa(Math.min(99, UNREAD)) : ''; b.style.display = UNREAD ? '' : 'none'; }
  if (S) buildNav();
}
const navBadge = k => (k === 'ac' && UNREAD) ? '<b class="cnt">' + fa(Math.min(99, UNREAD)) + '</b>' : (k === 'ms' && MSG_UN) ? '<b class="cnt">' + fa(Math.min(99, MSG_UN)) + '</b>' : '';
const bellBtn = () => '<button class="btn ic bell" onclick="A.go(\'ac\')" aria-label="گزارش فعالیت" title="گزارش فعالیت">' + ic('ac', 18) + '<b class="bdgn" id="bellN" style="' + (UNREAD ? '' : 'display:none') + '">' + (UNREAD ? fa(Math.min(99, UNREAD)) : '') + '</b></button>';
const online = sid => { const t = ACT.seen[CID + '-' + sid]; return !!t && Date.now() - t < 120000; };
const lastSeen = sid => ACT.seen[CID + '-' + sid] || 0;
function actText(x) { return (x.n ? x.n + ' ' : '') + x.x; }
function notifyOne(x) {
  const k = ACK[x.k] || ACK.login, cname = CLS.length > 1 ? '[' + clsName(x.c) + '] ' : '';
  toast(cname + fdig(actText(x)), { err: x.k === 'login_fail' });
  chime(x.k === 'quiz_done' ? 'ok' : x.k === 'login_fail' ? 'warn' : 'info');
  try { if (document.hidden && ls('dn') === '1' && window.Notification && Notification.permission === 'granted') new Notification(k[1] + (clsName(x.c) ? ' · ' + clsName(x.c) : ''), { body: fdig(actText(x)), icon: '/icons/icon-192.png', tag: 'act' + x.id }); } catch (e) { }
}
async function actPoll(first) {
  if (!S) return;
  const r = await api('/api/activity?since=' + (first || !ACT.base ? 0 : ACT.last) + '&limit=' + (first || !ACT.base ? 300 : 60));
  if (r.status !== 200 || !S) return;
  const d = r.data; ACT.seen = toObj(d.seen);
  if (first || !ACT.base) {
    ACT.items = arr(d.items); ACT.last = d.last || 0; ACT.base = true;
    if (ls('actSeen') === null) ls('actSeen', String(ACT.last));
    recount(); refreshBadges(); return;
  }
  const items = arr(d.items);
  if (items.length) {
    ACT.last = Math.max(ACT.last, d.last || 0);
    ACT.items = items.concat(ACT.items).slice(0, 400);
    items.slice().reverse().forEach(notifyOne);
    recount(); refreshBadges();
  }
  const sig = S.st.filter(s => online(s.id)).map(s => s.id).join(',') + '|' + ACT.last;
  if (sig !== ACT.sig) { ACT.sig = sig; if (!modalOpen() && !typing() && (page === 'ac' || page === 'st' || page === 'dash')) render(); }
}
function actStart() { if (ACT.t) return; actPoll(true); ACT.t = setInterval(() => { if (!document.hidden || ls('dn') === '1') actPoll(false); }, 12000); document.addEventListener('visibilitychange', () => { if (!document.hidden && S) actPoll(false); }); }
function actStop() { clearInterval(ACT.t); ACT.t = null; ACT.base = false; ACT.items = []; ACT.last = 0; UNREAD = 0; }

V.ac = () => {
  const cur = ST.acf || 'all', seen = seenId();
  let l = ACT.items.filter(x => cur === 'all' || x.c == CID);
  const day0 = new Date(); day0.setHours(0, 0, 0, 0); const td = l.filter(x => x.t >= day0.getTime());
  const kinds = { login: 0, quiz_done: 0, poll: 0, login_fail: 0 }; td.forEach(x => { if (kinds[x.k] !== undefined) kinds[x.k]++; });
  const sids = Array.from(new Set(td.filter(x => x.k === 'login').map(x => x.c + '-' + x.sid))).length;
  const head = '<div class="ph"><div><h1>گزارش فعالیت</h1><p class="sub">هر کاری دانش‌آموزان در اپ انجام دهند همین‌جا ثبت می‌شود و با صدا و اعلان به شما خبر می‌رسد.</p></div><div class="acts"><button class="btn" onclick="A.actRead()">' + ic('check', 16) + ' همه خوانده شد</button></div></div>';
  const stats = '<div class="grid">' + stat('key', sids, 'دانش‌آموز وارد شده (امروز)') + stat('check', kinds.quiz_done, 'آزمون تمام‌شده (امروز)') + stat('po', kinds.poll, 'شرکت در نظرسنجی (امروز)') + stat('alert', kinds.login_fail, 'ورود ناموفق (امروز)') + '</div>';
  const on = S.st.filter(s => online(s.id)), never = S.st.filter(s => !lastSeen(s.id));
  const pres = '<div class="glass card"><div class="ph" style="margin:0 0 8px"><h3 style="margin:0;flex:1">' + ic('globe', 16) + ' همین الان آنلاین (' + fa(on.length) + ')</h3></div><div class="frm" style="gap:8px;margin:0">' + (on.map(s => '<span class="chip"><i class="dot onl"></i>' + esc(s.name) + '</span>').join('') || '<span class="mut sm">الان کسی در اپ نیست.</span>') + '</div>' +
    (never.length ? '<p class="sub" style="font-size:12.5px;margin:12px 0 0">هنوز وارد نشده‌اند (' + fa(never.length) + '): ' + never.slice(0, 12).map(s => esc(s.name)).join('، ') + (never.length > 12 ? '…' : '') + '</p>' : '') + '</div>';
  const seg = CLS.length > 1 ? '<div class="frm"><div class="seg"><button class="' + (cur === 'all' ? 'on' : '') + '" onclick="A.acf(\'all\')">همه‌ی کلاس‌ها</button><button class="' + (cur === 'cur' ? 'on' : '') + '" onclick="A.acf(\'cur\')">فقط این کلاس</button></div></div>' : '';
  let body = '', lastDay = '';
  l.slice(0, 200).forEach(x => {
    const d = pdate(x.t, { weekday: 'long', day: 'numeric', month: 'long' }); if (d !== lastDay) { body += '<div class="lbl" style="margin:14px 4px 6px">' + d + '</div>'; lastDay = d; }
    const k = ACK[x.k] || ACK.login;
    body += '<div class="it act' + (x.id > seen ? ' nw' : '') + '"><span class="aci" style="color:' + k[2] + '">' + ic(k[0], 17) + '</span><span class="n">' + (x.n ? '<b>' + esc(x.n) + '</b> ' : '') + esc(fdig(x.x)) + (CLS.length > 1 ? '<br><small class="mut">' + esc(clsName(x.c)) + '</small>' : '') + '</span><small class="mut">' + new Date(x.t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + '</small></div>';
  });
  return head + stats + pres + seg + '<div class="list" style="margin-top:6px">' + (body || empty('ac', 'هنوز فعالیتی ثبت نشده است. وقتی دانش‌آموزان وارد اپ شوند یا آزمون بدهند، اینجا می‌بینید.')) + '</div>';
};
AFTER.ac = () => { clearTimeout(ST.acT); ST.acT = setTimeout(() => { if (page === 'ac') { ls('actSeen', String(ACT.last)); recount(); refreshBadges(); } }, 3500); };
Object.assign(A, {
  acf: v => { ST.acf = v; render(); },
  actRead: () => { ls('actSeen', String(ACT.last)); recount(); refreshBadges(); render(); toast('همه‌ی اعلان‌ها خوانده شد'); },
});

/* ---------- quiz → main grades (automatic) ---------- */
function quizLinkVal(it, sid) {
  const at = RES.filter(a => a.qid == it.qz && a.sid == sid && (a.st === 'done' || a.st === 'exp') && !a.pend).sort((a, b) => a.e - b.e);
  if (!at.length) return null; const m = it.qm || 'best'; let v;
  if (m === 'last') v = at[at.length - 1].sc; else if (m === 'first') v = at[0].sc; else if (m === 'avg') v = at.reduce((x, a) => x + (+a.sc), 0) / at.length; else v = Math.max(...at.map(a => +a.sc));
  return Math.round(v * 100) / 100;
}
function syncLinks() {
  if (!S) return false; let ch = false;
  // هر کوییزی که هنوز به نمرات اصلی وصل نیست (مگر استاد خودش خاموش کرده باشد) خودکار وصل می‌شود
  S.quizzes.forEach(q => { if (q.lk === false || findLink(q.id)) return; q.lk = true; q.lkc = q.lkc || 'quiz'; q.lkm = q.lkm || 'best'; ensureLink(q); ch = true; });
  CK.forEach(c => S.gr[c].items.forEach(it => {
    if (!it.qz) return;
    if (!quizOf(it.qz)) { delete it.qz; delete it.qm; ch = true; return; }
    S.st.forEach(s => { const v = quizLinkVal(it, s.id), old = it.sc[s.id]; if (v == null) { if (old !== undefined) { delete it.sc[s.id]; ch = true; } } else if (old !== v) { it.sc[s.id] = v; ch = true; } });
  }));
  if (ch) { save(); if (page === 'gr' && !modalOpen() && !typing()) render(); }
  return ch;
}
function findLink(qid) { for (const c of CK) { const i = S.gr[c].items.find(x => x.qz == qid); if (i) return { c, i }; } return null; }
function ensureLink(q) {
  const ex = findLink(q.id);
  if (q.lk) {
    const cat = CK.includes(q.lkc) ? q.lkc : 'quiz';
    if (ex && ex.c !== cat) { S.gr[ex.c].items = S.gr[ex.c].items.filter(x => x !== ex.i); S.gr[cat].items.push(ex.i); }
    let it = ex ? ex.i : null; if (!it) { it = { id: S.nid++, t: q.t, sc: {}, qz: q.id }; S.gr[cat].items.push(it); }
    it.t = q.t; it.qm = q.lkm || 'best';
  } else if (ex) { delete ex.i.qz; delete ex.i.qm; }
}
function lkCard(q) {
  return '<div class="glass card" style="margin-top:14px"><label class="sw"><input type="checkbox" ' + (q.lk ? 'checked' : '') + ' onchange="A.qlk(this.checked)"><i></i><span><b>ثبت خودکار نمره در «نمرات اصلی»</b> — هر دانش‌آموز که آزمون بدهد، نمره‌اش خودکار در جدول نمرات می‌نشیند</span></label>' +
    '<div class="fg" id="qlkb" style="margin:12px 0 0;' + (q.lk ? '' : 'display:none') + '"><div class="fld"><label>در کدام بخش نمرات؟</label><select onchange="A.qd(\'lkc\',this.value)">' + CK.map(k => '<option value="' + k + '"' + (q.lkc === k ? ' selected' : '') + '>' + CATS[k] + '</option>').join('') + '</select></div>' +
    '<div class="fld"><label>اگر چند بار آزمون داد، کدام نمره؟</label><select onchange="A.qd(\'lkm\',this.value)">' + [['best', 'بهترین نمره'], ['last', 'آخرین نمره'], ['first', 'اولین نمره'], ['avg', 'میانگین تلاش‌ها']].map(x => '<option value="' + x[0] + '"' + (q.lkm === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div></div></div>';
}
A.qlk = v => { QDIRTY = true; QD.lk = !!v; const b = $('#qlkb'); if (b) b.style.display = v ? '' : 'none'; };

/* ---------- students: accounts (username + password) ---------- */
function addNames(txt) {
  const names = txt.split(/[,،\n;\t]/).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean), seen = new Set(S.st.map(s => norm_fa(s.name)));
  let n = 0, dup = 0, lim = 0;
  names.forEach(nm => {
    nm = nm.slice(0, 60); if (seen.has(norm_fa(nm))) { dup++; return; }
    if (S.st.length >= MAXST) { lim++; return; }
    seen.add(norm_fa(nm)); S.st.push({ id: S.nid++, name: nm, user: genUser(S), code: genCode() }); n++;
  });
  if (lim) toast('حداکثر ' + fa(MAXST) + ' دانش‌آموز در هر کلاس؛ ' + fa(lim) + ' نام اضافه نشد.', { err: 1 });
  if (n) save(); return { n, dup, lim };
}
const lastSeenTxt = id => { const t = lastSeen(id); return online(id) ? 'آنلاین' : t ? 'آخرین بازدید: ' + pdt(t) : 'هنوز وارد نشده'; };
V.st = () => {
  const full = S.st.length >= MAXST, v = ST.sview || 'cards';
  const head = '<div class="ph"><div><h1>دانش‌آموزان</h1><p class="sub">برای هر دانش‌آموز نام کاربری و رمز بنویسید یا همان مقدارهای خودکار را بدهید. هر کس با حساب خودش وارد اپ می‌شود. ظرفیت این کلاس: <b>' + fa(S.st.length) + '</b> از ' + fa(MAXST) + ' نفر.</p></div><div class="acts"><button class="btn" onclick="A.printCards()" ' + (S.st.length ? '' : 'disabled') + '>' + ic('print', 16) + ' کارت‌های ورود</button><button class="btn" onclick="A.credCsv()" ' + (S.st.length ? '' : 'disabled') + '>' + ic('dl', 16) + ' فهرست حساب‌ها</button><button class="btn" onclick="A.bulkS()" ' + (full ? 'disabled' : '') + '>' + ic('ul', 16) + ' افزودن گروهی</button></div></div>';
  const add = '<div class="frm"><input class="inp w" id="sn" placeholder="' + (full ? 'ظرفیت کلاس پر است' : 'نام دانش‌آموز؛ چند نام را با ویرگول جدا کنید') + '" ' + (full ? 'disabled' : '') + ' onkeydown="if(event.key===\'Enter\')A.addS()"><button class="btn pri" onclick="A.addS()" ' + (full ? 'disabled' : '') + '>' + ic('plus', 16) + ' افزودن</button></div>';
  if (!S.st.length) return head + add + empty('st', 'هنوز دانش‌آموزی اضافه نشده است.');
  const tools = '<div class="frm" style="align-items:center"><input class="inp w" placeholder="جستجو…" value="' + esc(ST.sq) + '" oninput="A.sq(this.value)" aria-label="جستجو"><div class="seg">' + [['cards', 'کارت‌ها'], ['acc', 'جدول حساب‌ها']].map(x => '<button class="' + (v === x[0] ? 'on' : '') + '" onclick="A.sview(\'' + x[0] + '\')">' + x[1] + '</button>').join('') + '</div>' +
    (v === 'cards' ? '<div class="seg">' + [['name', 'نام'], ['avg', 'میانگین'], ['pts', 'امتیاز'], ['abs', 'غیبت']].map(x => '<button class="' + (ST.ssort === x[0] ? 'on' : '') + '" onclick="A.ssort(\'' + x[0] + '\')">' + x[1] + '</button>').join('') + '</div>' : '') + '</div>';
  return head + add + tools + (v === 'acc' ? '<div id="slist">' + accTable() + '</div>' : '<div class="sg" id="slist">' + stCards() + '</div>');
};
function stFilter() { const q = norm_fa(ST.sq); return S.st.filter(s => !q || norm_fa(s.name).includes(q) || String(s.user || '').includes(q)); }
function stCards() {
  if ((ST.sview || 'cards') === 'acc') return accTable();
  const k = ST.ssort; const l = stFilter().slice().sort((a, b) => k === 'avg' ? (allAvg(b.id) ?? -1) - (allAvg(a.id) ?? -1) : k === 'pts' ? pts(b.id) - pts(a.id) : k === 'abs' ? attOf(b.id).a - attOf(a.id).a : a.name.localeCompare(b.name, 'fa'));
  return l.map(s => {
    const p = pts(s.id), a = allAvg(s.id), ab = attOf(s.id).a;
    return '<div class="glass card hv sc2' + (s.off ? ' offc' : '') + '" onclick="A.openS(' + s.id + ')" tabindex="0" onkeydown="if(event.key===\'Enter\')A.openS(' + s.id + ')"><div class="hd"><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + (online(s.id) ? '<i class="onl"></i>' : '') + '</span><b>' + esc(s.name) + '</b>' + (s.off ? '<span class="bdg mi">مسدود</span>' : '') + '</div>' +
      '<div class="cred" onclick="event.stopPropagation()"><span title="نام کاربری">' + ic('user', 13) + '<bdi dir="ltr">' + esc(s.user) + '</bdi></span><span title="رمز">' + ic('lock', 13) + '<bdi dir="ltr">' + esc(s.code) + '</bdi></span><button class="btn xs" onclick="A.copyCred(' + s.id + ')" aria-label="کپی">' + ic('copy', 12) + '</button></div>' +
      '<div class="mt"><span class="bdg ' + lvlc(a) + '">میانگین ' + fmt(a) + '</span><span class="bdg ' + (ab >= 3 ? 'mi' : '') + '">غیبت ' + fa(ab) + '</span><span class="bdg ' + (p < 0 ? 'mi' : p > 0 ? 'pl' : '') + '">' + (p > 0 ? '+' : '') + fa(p) + '</span></div><small class="mut">' + lastSeenTxt(s.id) + '</small></div>';
  }).join('') || '<div class="glass empty" style="grid-column:1/-1">موردی پیدا نشد.</div>';
}
function accTable() {
  return '<div class="glass tw"><table class="acct"><thead><tr><th>دانش‌آموز</th><th>نام کاربری</th><th>رمز</th><th>فعال</th><th>وضعیت</th><th></th></tr></thead><tbody>' + stFilter().map(s =>
    '<tr><td>' + esc(s.name) + '</td><td><input class="inp" dir="ltr" value="' + esc(s.user) + '" maxlength="24" onchange="A.setUser(' + s.id + ',this)" aria-label="نام کاربری ' + esc(s.name) + '"></td><td><input class="inp" dir="ltr" value="' + esc(s.code) + '" maxlength="30" onchange="A.setPass(' + s.id + ',this)" aria-label="رمز ' + esc(s.name) + '"></td>' +
    '<td><label class="sw"><input type="checkbox" ' + (s.off ? '' : 'checked') + ' onchange="A.togOff(' + s.id + ')"><i></i></label></td><td><small class="mut">' + lastSeenTxt(s.id) + '</small></td><td><button class="btn xs" onclick="A.rndPass(' + s.id + ')" title="رمز تصادفی جدید">' + ic('refresh', 13) + '</button> <button class="btn xs" onclick="A.openS(' + s.id + ')" title="پرونده">' + ic('eye', 13) + '</button></td></tr>').join('') + '</tbody></table></div>' +
    '<p class="sub" style="font-size:12.5px;margin:10px 4px">نام کاربری: ۳ تا ۲۴ نویسه‌ی انگلیسی کوچک، عدد یا . _ - · رمز: حداقل ۴ نویسه. با تغییر رمز، دانش‌آموز از حساب خارج می‌شود.</p>';
}
function chkUser(id, v) {
  v = String(v).trim().toLowerCase();
  if (!okUser(v)) return 'نام کاربری باید ۳ تا ۲۴ نویسه‌ی انگلیسی کوچک، عدد یا . _ - باشد.';
  if (TAKEN.map(x => String(x).toLowerCase()).includes(v) || S.st.some(s => s.id != id && String(s.user).toLowerCase() === v)) return 'این نام کاربری قبلاً استفاده شده است.';
  return '';
}
Object.assign(A, {
  sview: v => { ST.sview = v; render(); },
  addS: () => { const el = $('#sn'); if (!el) return; const r = addNames(el.value); if (!r.n && !r.dup && !r.lim) { toast('نام را بنویسید', { err: 1 }); return; } if (r.n || r.dup) { render(); if (r.n) toast(fa(r.n) + ' دانش‌آموز اضافه شد؛ نام کاربری و رمز خودکار ساخته شد' + (r.dup ? ' · ' + fa(r.dup) + ' نام تکراری نادیده گرفته شد' : '')); else toast('این نام‌ها قبلاً ثبت شده‌اند', { err: 1 }); } },
  setUser: (id, el) => { const s = stById(id); if (!s) return; const bad = chkUser(id, el.value); if (bad) { toast(bad, { err: 1 }); el.value = s.user; return; } s.user = el.value.trim().toLowerCase(); el.value = s.user; save(); toast('نام کاربری ذخیره شد'); },
  setPass: (id, el) => { const s = stById(id); if (!s) return; const v = el.value.trim(); if (v.length < 4) { toast('رمز حداقل ۴ نویسه باشد', { err: 1 }); el.value = s.code; return; } s.code = v; save(); toast('رمز ذخیره شد'); },
  togOff: id => { const s = stById(id); if (!s) return; s.off = !s.off; if (!s.off) delete s.off; save(); render(); toast(s.off ? s.name + ' مسدود شد' : 'حساب ' + s.name + ' فعال شد'); },
  rndPass: id => { const s = stById(id); if (!s) return; s.code = genCode(); save(); render(); toast('رمز جدید ' + s.name + ': ' + s.code); },
  copyCred: id => { const s = stById(id); if (s) copy('نام کاربری: ' + s.user + '\nرمز: ' + s.code + '\n' + (INFO.base || location.origin) + '/app'); },
  credCsv: () => download('accounts-' + (S.cfg.cls || 'class') + '.csv', csv([['نام', 'نام کاربری', 'رمز', 'وضعیت']].concat(S.st.map(s => [s.name, s.user, s.code, s.off ? 'مسدود' : 'فعال']))), 'text/csv'),
  printCards: () => {
    const url = (INFO.base || location.origin) + '/app';
    printHtml(S.st.map(s => '<div class="pc"><b>' + esc(S.cfg.cls) + '</b><br>' + esc(s.name) + '<br>نام کاربری: <span class="big">' + esc(s.user) + '</span><br>رمز: <span class="big">' + esc(s.code) + '</span><br><small dir="ltr">' + esc(url) + '</small></div>').join(''));
  },
});
const _openS = A.openS;
A.openS = id => {
  _openS(id);
  const s = stById(id), mb = $$('.mdl').pop(); if (!s || !mb) return; const b = mb.querySelector('.box'), fr = b.querySelector('.frm'); if (!fr) return;
  fr.innerHTML = '<span class="chip">' + ic('user', 13) + ' نام کاربری: <b dir="ltr">' + esc(s.user) + '</b></span><span class="chip">' + ic('lock', 13) + ' رمز: <b dir="ltr" id="scode">' + esc(s.code) + '</b></span><span class="chip">' + (online(id) ? '<i class="dot onl"></i> آنلاین' : lastSeenTxt(id)) + '</span>' +
    '<button class="btn xs" id="sCp2">' + ic('copy', 13) + ' کپی حساب</button><button class="btn xs" id="sUn">' + ic('edit', 13) + ' نام کاربری</button><button class="btn xs" id="sPw">' + ic('key', 13) + ' رمز</button><button class="btn xs" id="sNc2">' + ic('refresh', 13) + ' رمز تصادفی</button><button class="btn xs" id="sRn2">' + ic('edit', 13) + ' نام</button><button class="btn xs ' + (s.off ? 'pri' : 'dg') + '" id="sBl">' + (s.off ? 'فعال‌سازی حساب' : 'مسدودکردن حساب') + '</button>';
  const redo = () => { const m = $$('.mdl').pop(); if (m) m.remove(); render(); A.openS(id); };
  fr.querySelector('#sCp2').onclick = () => A.copyCred(id);
  fr.querySelector('#sUn').onclick = async () => { const t = await askText({ title: 'نام کاربری', label: 'نام کاربری (انگلیسی)', value: s.user, max: 24 }); if (!t) return; const bad = chkUser(id, t); if (bad) { toast(bad, { err: 1 }); return; } s.user = t.trim().toLowerCase(); save(); redo(); toast('نام کاربری ذخیره شد'); };
  fr.querySelector('#sPw').onclick = async () => { const t = await askText({ title: 'رمز دانش‌آموز', label: 'رمز جدید (حداقل ۴ نویسه)', value: s.code, max: 30 }); if (!t) return; if (t.length < 4) { toast('رمز حداقل ۴ نویسه باشد', { err: 1 }); return; } s.code = t; save(); redo(); toast('رمز ذخیره شد'); };
  fr.querySelector('#sNc2').onclick = () => { s.code = genCode(); save(); redo(); toast('رمز جدید ساخته شد'); };
  fr.querySelector('#sRn2').onclick = async () => { const t = await askText({ title: 'تغییر نام', label: 'نام دانش‌آموز', value: s.name, max: 60 }); if (t) { s.name = t; save(); redo(); } };
  fr.querySelector('#sBl').onclick = () => { s.off = !s.off; if (!s.off) delete s.off; save(); redo(); toast(s.off ? 'حساب مسدود شد' : 'حساب فعال شد'); };
};

/* ---------- polls / surveys ---------- */
let PR = [], PD = null, PDIRTY = false;
const PTYPES = { one: 'تک‌گزینه‌ای', multi: 'چندگزینه‌ای', rate: 'امتیاز ۱ تا ۵', text: 'پاسخ متنی' };
const newPQ = k => ({ k: k || 'one', q: '', o: (k === 'rate' || k === 'text') ? [] : ['', ''] });
const pollOf = id => S.polls.find(p => p.id == id);
const pResp = p => PR.filter(x => x.pid == p.id);
async function loadPR() { const r = await api('/api/polls/results'); if (r.status === 200) PR = arr(r.data.r); }
V.po = () => ST.pv === 'edit' ? poEdit() : ST.pv === 'res' ? poRes() : poList();
AFTER.po = async () => { if (ST.pv === 'edit') return; const n = PR.length; await loadPR(); if (page === 'po' && ST.pv !== 'edit' && !modalOpen() && !typing() && PR.length !== n) render(); };
function poList() {
  const head = '<div class="ph"><div><h1>نظرسنجی‌ها</h1><p class="sub">برای دانش‌آموزان نظرسنجی یا ارزیابی بسازید؛ در اپ می‌بینند و پاسخ می‌دهند. می‌توانید نظرسنجی را ناشناس کنید تا صادقانه‌تر پاسخ بدهند.</p></div><div class="acts"><button class="btn" onclick="A.poTpl()">' + ic('star', 16) + ' قالب «نظرسنجی از دبیر»</button><button class="btn pri" onclick="A.poNew()">' + ic('plus', 16) + ' نظرسنجی جدید</button></div></div>';
  if (!S.polls.length) return head + empty('po', 'هنوز نظرسنجی نساخته‌اید.', '<p style="margin-top:12px"><button class="btn pri" onclick="A.poTpl()">شروع با قالب آماده</button></p>');
  return head + '<div class="g2">' + S.polls.slice().reverse().map(p => {
    const st = qStatus(p), n = pResp(p).length;
    return '<div class="glass card hv"><div class="ph" style="margin:0 0 6px"><div><h3 style="margin:0">' + esc(p.t) + '</h3>' + (p.d ? '<p class="sub" style="margin:2px 0 0;font-size:13px">' + esc(p.d) + '</p>' : '') + '</div><span class="bdg ' + QSTAT[st][1] + '">' + QSTAT[st][0] + '</span></div>' +
      '<div class="frm" style="margin:8px 0;gap:6px"><span class="chip">' + ic('list', 14) + fa(p.qs.length) + ' سؤال</span><span class="chip">' + ic(p.anon ? 'shield' : 'user', 14) + (p.anon ? 'ناشناس' : 'با نام') + '</span><span class="chip">' + fa(n) + ' از ' + fa(S.st.length) + ' پاسخ</span>' + (p.to ? '<span class="chip">پایان: ' + pdt(p.to) + '</span>' : '') + '</div>' +
      '<div class="frm" style="margin:0;gap:6px"><button class="btn sm pri" onclick="A.poRes(' + p.id + ')">' + ic('gr', 14) + ' نتایج</button><button class="btn sm" onclick="A.poEdit(' + p.id + ')">' + ic('edit', 14) + ' ویرایش</button><button class="btn sm" onclick="A.poDup(' + p.id + ')">' + ic('copy', 14) + ' کپی</button><button class="btn sm" onclick="A.poTog(' + p.id + ')">' + (p.on === false ? 'فعال‌سازی' : 'غیرفعال') + '</button><button class="btn sm dg" onclick="A.poDel(' + p.id + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div></div>';
  }).join('') + '</div>';
}
function poEdit() {
  const p = PD;
  return '<div class="ph"><div><h1>' + (ST.poid ? 'ویرایش نظرسنجی' : 'نظرسنجی جدید') + '</h1><p class="sub">عنوان و سؤال‌ها را بنویسید. هر دانش‌آموز فقط یک بار می‌تواند پاسخ بدهد.</p></div><div class="acts"><button class="btn" onclick="A.poBack()">بازگشت</button><button class="btn pri" onclick="A.poSave()">' + ic('check', 16) + ' ذخیره</button></div></div>' +
    (ST.poid && pResp({ id: ST.poid }).length ? '<div class="warn">' + ic('alert', 20) + '<span>این نظرسنجی پاسخ ثبت‌شده دارد. تغییر تعداد یا ترتیب سؤال‌ها ممکن است نمایش نتیجه‌های قبلی را به‌هم بریزد.</span></div>' : '') +
    '<div class="glass card"><div class="fg"><div class="fld"><label>عنوان *</label><input class="inp" value="' + esc(p.t) + '" oninput="PD.t=this.value;PDIRTY=true" maxlength="120" placeholder="مثلاً ارزیابی کلاس و روش تدریس"></div><div class="fld"><label>توضیح برای دانش‌آموز (اختیاری)</label><input class="inp" value="' + esc(p.d || '') + '" oninput="PD.d=this.value;PDIRTY=true" maxlength="300" placeholder="نظر صادقانه‌ات به بهتر شدن کلاس کمک می‌کند"></div></div>' +
    '<div class="fg"><div class="fld"><label>شروع (اختیاری)</label><input class="inp" type="datetime-local" value="' + toLocalInput(p.from) + '" onchange="PD.from=this.value?new Date(this.value).getTime():0;PDIRTY=true"></div><div class="fld"><label>پایان (اختیاری)</label><input class="inp" type="datetime-local" value="' + toLocalInput(p.to) + '" onchange="PD.to=this.value?new Date(this.value).getTime():0;PDIRTY=true"></div></div>' +
    '<div class="frm" style="gap:22px;margin:0"><label class="sw"><input type="checkbox" ' + (p.on !== false ? 'checked' : '') + ' onchange="PD.on=this.checked;PDIRTY=true"><i></i><span>فعال (قابل مشاهده برای دانش‌آموزان)</span></label><label class="sw"><input type="checkbox" ' + (p.anon ? 'checked' : '') + ' onchange="PD.anon=this.checked;PDIRTY=true"><i></i><span>ناشناس (نام پاسخ‌دهنده برای شما نمایش داده نمی‌شود)</span></label></div></div>' +
    '<div class="ph" style="margin:18px 0 8px"><div><h2>سؤال‌ها <span class="bdg" id="pqcount">' + fa(p.qs.length) + '</span></h2></div><div class="acts">' + Object.keys(PTYPES).map(k => '<button class="btn sm" onclick="A.pqAdd(\'' + k + '\')">' + ic('plus', 13) + ' ' + PTYPES[k] + '</button>').join('') + '</div></div><div id="pqe">' + p.qs.map(pqCard).join('') + '</div>' +
    '<div class="frm"><button class="btn pri" onclick="A.poSave()">' + ic('check', 16) + ' ذخیره‌ی نظرسنجی</button></div>';
}
function pqCard(x, i) {
  const has = x.k === 'one' || x.k === 'multi';
  return '<div class="qc" id="pq' + i + '"><div class="qh"><b>سؤال ' + fa(i + 1) + '</b><select onchange="A.pqKind(' + i + ',this.value)" style="width:auto;min-width:120px">' + Object.keys(PTYPES).map(k => '<option value="' + k + '"' + (x.k === k ? ' selected' : '') + '>' + PTYPES[k] + '</option>').join('') + '</select><button class="btn xs" onclick="A.pqMv(' + i + ',-1)" ' + (i === 0 ? 'disabled' : '') + ' aria-label="بالا">' + ic('up', 14) + '</button><button class="btn xs" onclick="A.pqMv(' + i + ',1)" ' + (i === PD.qs.length - 1 ? 'disabled' : '') + ' aria-label="پایین">' + ic('down', 14) + '</button><button class="btn xs dg" onclick="A.pqDel(' + i + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div>' +
    '<textarea class="inp" rows="2" placeholder="متن سؤال" oninput="PD.qs[' + i + '].q=this.value;PDIRTY=true" maxlength="500">' + esc(x.q) + '</textarea>' +
    (has ? '<div class="lbl" style="margin:8px 0 4px">گزینه‌ها</div>' + x.o.map((o, j) => '<div class="qo"><span class="mut sm" style="width:26px">' + LET[j] + '</span><input class="inp" value="' + esc(o) + '" placeholder="گزینه ' + fa(j + 1) + '" oninput="PD.qs[' + i + '].o[' + j + ']=this.value;PDIRTY=true" maxlength="200">' + (x.o.length > 2 ? '<button class="btn xs dg" onclick="A.pqOdel(' + i + ',' + j + ')" aria-label="حذف گزینه">' + ic('x', 14) + '</button>' : '') + '</div>').join('') + '<div class="frm" style="margin:8px 0 0"><button class="btn xs" onclick="A.pqOadd(' + i + ')" ' + (x.o.length >= 8 ? 'disabled' : '') + '>' + ic('plus', 13) + ' گزینه</button></div>' : x.k === 'rate' ? '<p class="mut sm" style="margin:8px 0 0">دانش‌آموز از ۱ تا ۵ ستاره امتیاز می‌دهد.</p>' : '<p class="mut sm" style="margin:8px 0 0">پاسخ متنی آزاد (تا ۶۰۰ نویسه).</p>') + '</div>';
}
function rePQ(f) { const e = $('#pqe'); if (!e) return; e.innerHTML = PD.qs.map(pqCard).join(''); const c = $('#pqcount'); if (c) c.textContent = fa(PD.qs.length); if (f != null) { const t = $('#pq' + f); if (t) { t.scrollIntoView({ behavior: RED ? 'auto' : 'smooth', block: 'center' }); const ta = t.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); } } }
function ansTxt(q, v) { if (v == null) return ''; if (q.k === 'one') return q.o[v] || ''; if (q.k === 'multi') return arr(v).map(j => q.o[j]).filter(Boolean).join(' | '); return String(v); }
function poRes() {
  const p = pollOf(ST.poid); if (!p) { ST.pv = 'list'; return poList(); }
  const rs = pResp(p), n = rs.length, pct = S.st.length ? Math.round(n / S.st.length * 100) : 0;
  const names = p.anon ? [] : S.st.filter(s => !rs.some(r => r.sid == s.id));
  const qh = p.qs.map((q, i) => {
    const vals = rs.map(r => arr(r.a)[i]).filter(v => v != null);
    let b = '';
    if (q.k === 'one' || q.k === 'multi') {
      const c = q.o.map(() => 0); vals.forEach(v => (q.k === 'multi' ? arr(v) : [v]).forEach(j => { if (c[j] !== undefined) c[j]++; }));
      const tot = vals.length || 1; b = q.o.map((o, j) => { const pc = c[j] / tot * 100; return '<div class="bar"><div><span>' + esc(o) + '</span><span>' + fa(c[j]) + ' نفر · ' + fa(Math.round(pc)) + '٪</span></div><i><u data-w="' + pc + '" style="width:0"></u></i></div>'; }).join('');
    } else if (q.k === 'rate') {
      const c = [0, 0, 0, 0, 0]; vals.forEach(v => { if (v >= 1 && v <= 5) c[v - 1]++; }); const av = vals.length ? vals.reduce((x, y) => x + (+y), 0) / vals.length : null;
      b = '<div class="rateavg"><b>' + (av == null ? '—' : fa(Math.round(av * 10) / 10, { maximumFractionDigits: 1 })) + '</b><span>از ۵ · ' + fa(vals.length) + ' پاسخ</span></div>' + [5, 4, 3, 2, 1].map(k => { const pc = vals.length ? c[k - 1] / vals.length * 100 : 0; return '<div class="bar"><div><span>' + fa(k) + ' ستاره</span><span>' + fa(c[k - 1]) + '</span></div><i><u data-w="' + pc + '" style="width:0"></u></i></div>'; }).join('');
    } else {
      b = vals.length ? '<div class="list" style="max-height:260px;overflow:auto">' + vals.map(v => '<div class="it"><span class="n sm" style="white-space:pre-wrap">' + esc(v) + '</span></div>').join('') + '</div>' : '<div class="mut sm">پاسخی ثبت نشده.</div>';
    }
    return '<div class="glass card"><h3>' + fa(i + 1) + '. ' + esc(q.q) + ' <span class="bdg">' + PTYPES[q.k] + '</span></h3>' + b + '</div>';
  }).join('');
  return '<div class="ph"><div><h1>نتایج: ' + esc(p.t) + '</h1><p class="sub">' + fa(n) + ' پاسخ از ' + fa(S.st.length) + ' دانش‌آموز (' + fa(pct) + '٪)' + (p.anon ? ' · ناشناس' : '') + '</p></div><div class="acts"><button class="btn" onclick="A.poBack()">بازگشت</button><button class="btn" onclick="A.poCsv(' + p.id + ')" ' + (n ? '' : 'disabled') + '>' + ic('dl', 16) + ' CSV</button><button class="btn dg" onclick="A.poReset(' + p.id + ')" ' + (n ? '' : 'disabled') + '>پاک‌کردن پاسخ‌ها</button></div></div>' +
    '<div class="grid">' + stat('st', n, 'پاسخ‌دهنده از ' + fa(S.st.length)) + stat('check', pct, 'درصد مشارکت', { suf: '٪' }) + '</div>' + (qh || '') +
    (names.length && n ? '<div class="glass card"><h3>هنوز پاسخ نداده‌اند (' + fa(names.length) + ')</h3><p class="sub" style="font-size:13px;margin:0">' + names.map(s => esc(s.name)).join('، ') + '</p></div>' : '');
}
Object.assign(A, {
  poNew: () => { PD = { t: '', d: '', anon: false, on: true, from: 0, to: 0, qs: [newPQ('rate')] }; PDIRTY = false; ST.poid = 0; ST.pv = 'edit'; render(1); window.scrollTo(0, 0); },
  poTpl: () => {
    PD = { t: 'ارزیابی کلاس و روش تدریس', d: 'نظر صادقانه‌ی تو به بهتر شدن کلاس کمک می‌کند. این نظرسنجی ناشناس است.', anon: true, on: true, from: 0, to: 0, qs: [
      { k: 'rate', q: 'به‌طور کلی چقدر از کلاس راضی هستی؟', o: [] },
      { k: 'rate', q: 'توضیح مطالب توسط دبیر چقدر برایت قابل‌فهم است؟', o: [] },
      { k: 'one', q: 'سرعت تدریس چطور است؟', o: ['خیلی کند', 'مناسب', 'کمی تند', 'خیلی تند'] },
      { k: 'one', q: 'حجم تمرین‌ها و تکلیف‌ها چگونه است؟', o: ['کم است', 'مناسب است', 'زیاد است'] },
      { k: 'multi', q: 'کدام بخش‌های کلاس را بیشتر دوست داری؟', o: ['کارگاه عملی', 'توضیح مبحث', 'کوییز و آزمون', 'پروژه‌ها', 'بحث و پرسش‌وپاسخ'] },
      { k: 'text', q: 'پیشنهاد یا انتقادی برای بهتر شدن کلاس داری؟', o: [] }] };
    PDIRTY = true; ST.poid = 0; ST.pv = 'edit'; go('po'); ST.pv = 'edit'; render(1); window.scrollTo(0, 0);
  },
  poEdit: id => { const p = pollOf(id); if (!p) return; PD = JSON.parse(JSON.stringify(p)); PD.qs.forEach(x => { x.o = arr(x.o); if ((x.k === 'one' || x.k === 'multi') && x.o.length < 2) while (x.o.length < 2) x.o.push(''); }); PDIRTY = false; ST.poid = id; ST.pv = 'edit'; render(1); window.scrollTo(0, 0); },
  poBack: async () => { if (ST.pv === 'edit' && PDIRTY && !(await ask({ title: 'خروج بدون ذخیره', body: 'تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟', ok: 'خروج', danger: 1 }))) return; ST.pv = 'list'; render(1); window.scrollTo(0, 0); },
  poRes: async id => { ST.poid = id; ST.pv = 'res'; await loadPR(); render(1); window.scrollTo(0, 0); },
  pqAdd: k => { PD.qs.push(newPQ(k)); PDIRTY = true; rePQ(PD.qs.length - 1); },
  pqKind: (i, k) => { const x = PD.qs[i]; x.k = k; if (k === 'one' || k === 'multi') { x.o = x.o.length >= 2 ? x.o : ['', '']; } else x.o = []; PDIRTY = true; rePQ(); },
  pqDel: i => { PD.qs.splice(i, 1); if (!PD.qs.length) PD.qs.push(newPQ('rate')); PDIRTY = true; rePQ(); },
  pqMv: (i, d) => { const j = i + d; if (j < 0 || j >= PD.qs.length) return; const t = PD.qs[i]; PD.qs[i] = PD.qs[j]; PD.qs[j] = t; PDIRTY = true; rePQ(); },
  pqOadd: i => { if (PD.qs[i].o.length < 8) { PD.qs[i].o.push(''); PDIRTY = true; rePQ(); } },
  pqOdel: (i, j) => { const x = PD.qs[i]; if (x.o.length <= 2) return; x.o.splice(j, 1); PDIRTY = true; rePQ(); },
  poSave: () => {
    const p = PD; p.t = p.t.trim(); if (!p.t) { toast('عنوان نظرسنجی را بنویسید', { err: 1 }); return; }
    for (let i = 0; i < p.qs.length; i++) {
      const x = p.qs[i]; x.q = x.q.trim(); if (!x.q) { toast('متن سؤال ' + fa(i + 1) + ' خالی است', { err: 1 }); rePQ(i); return; }
      if (x.k === 'one' || x.k === 'multi') { x.o = x.o.map(s => s.trim()).filter(Boolean); if (x.o.length < 2) { toast('سؤال ' + fa(i + 1) + ' حداقل دو گزینه لازم دارد', { err: 1 }); rePQ(i); return; } } else x.o = [];
    }
    if (p.from && p.to && p.to <= p.from) { toast('زمان پایان باید بعد از شروع باشد', { err: 1 }); return; }
    const o = JSON.parse(JSON.stringify(p)); o.d = (o.d || '').trim();
    if (ST.poid) { const i = S.polls.findIndex(z => z.id == ST.poid); if (i > -1) S.polls[i] = o; else S.polls.push(o); } else { o.id = S.nid++; o.c = Date.now(); S.polls.push(o); confetti(); }
    save(); PDIRTY = false; ST.pv = 'list'; render(1); window.scrollTo(0, 0); toast('نظرسنجی ذخیره شد؛ دانش‌آموزان در اپ می‌بینند');
  },
  poDup: id => { const p = pollOf(id), c = JSON.parse(JSON.stringify(p)); c.id = S.nid++; c.t = p.t + ' (کپی)'; c.on = false; S.polls.push(c); save(); render(); toast('کپی ساخته شد؛ غیرفعال است'); },
  poTog: id => { const p = pollOf(id); p.on = p.on === false; save(); render(); toast(p.on === false ? 'نظرسنجی غیرفعال شد' : 'نظرسنجی فعال شد'); },
  poDel: async id => { const p = pollOf(id); if (await ask({ title: 'حذف نظرسنجی', body: 'نظرسنجی «' + p.t + '» حذف شود؟', ok: 'حذف', danger: 1 })) undoable('نظرسنجی حذف شد', () => { S.polls = S.polls.filter(z => z.id != id); }); },
  poReset: async id => { if (await ask({ title: 'پاک‌کردن پاسخ‌ها', body: 'همه‌ی پاسخ‌های این نظرسنجی حذف می‌شود و دانش‌آموزان می‌توانند دوباره پاسخ بدهند.', ok: 'پاک شود', danger: 1 })) { await api('/api/polls/reset', { body: JSON.stringify({ pid: id }) }); await loadPR(); render(); toast('پاسخ‌ها پاک شد'); } },
  poCsv: id => { const p = pollOf(id), rs = pResp(p); download('poll-' + id + '.csv', csv([['پاسخ‌دهنده', 'زمان'].concat(p.qs.map(q => q.q))].concat(rs.map(r => [p.anon ? 'ناشناس' : ((stById(r.sid) || {}).name || '—'), new Date(r.t).toLocaleString('fa-IR')].concat(p.qs.map((q, i) => ansTxt(q, arr(r.a)[i])))))), 'text/csv'); },
});

/* ---------- dashboard & settings extras ---------- */
const _vdash = V.dash;
V.dash = () => {
  const base = _vdash(); if (!S.st.length) return base;
  const on = S.st.filter(s => online(s.id)), mine = ACT.items.filter(x => x.c == CID).slice(0, 6);
  const live = '<div class="g2"><div class="glass card"><div class="ph" style="margin:0 0 8px"><h3 style="margin:0;flex:1">' + ic('globe', 16) + ' آنلاین الان (' + fa(on.length) + ')</h3><button class="btn sm" onclick="A.go(\'ac\')">گزارش فعالیت</button></div><div class="frm" style="gap:8px;margin:0">' + (on.map(s => '<span class="chip"><i class="dot onl"></i>' + esc(s.name) + '</span>').join('') || '<span class="mut sm">الان کسی در اپ نیست.</span>') + '</div></div>' +
    '<div class="glass card"><h3>' + ic('ac', 16) + ' آخرین فعالیت‌ها</h3><div class="list">' + (mine.map(x => { const k = ACK[x.k] || ACK.login; return '<div class="it"><span class="aci" style="color:' + k[2] + '">' + ic(k[0], 15) + '</span><span class="n sm">' + (x.n ? '<b>' + esc(x.n) + '</b> ' : '') + esc(fdig(x.x)) + '</span><small class="mut">' + pdt(x.t) + '</small></div>'; }).join('') || '<div class="empty">هنوز فعالیتی ثبت نشده.</div>') + '</div></div></div>';
  return base + live;
};
const _vset = V.set;
V.set = () => {
  const c = S.cfg, notif = window.Notification ? Notification.permission : 'denied';
  return _vset() +
    '<div class="glass card"><h3>تم رنگی</h3><p class="sub" style="font-size:13px">رنگ‌بندی پنل و اپ دانش‌آموز (روی همین دستگاه) را انتخاب کنید.</p><div class="accs">' + accSwatches('A.setAcc') + '</div></div>' +
    '<div class="g2"><div class="glass card"><h3>' + ic('vol', 16) + ' اعلان‌ها و صدا</h3><p class="sub" style="font-size:13px">وقتی دانش‌آموزی وارد شود، آزمون بدهد یا در نظرسنجی شرکت کند، با صدا و پیام خبر می‌گیرید (تا وقتی پنل باز است).</p><div class="list" style="gap:14px;margin-top:10px">' + sw('snd', ls('snd') !== '0', 'پخش صدای اعلان', "ls('snd',this.checked?'1':'0');if(this.checked)chime('ok')") +
    '<div class="frm" style="margin:0"><button class="btn" onclick="chime(\'ok\')">' + ic('vol', 15) + ' آزمایش صدا</button><button class="btn' + (ls('dn') === '1' && notif === 'granted' ? ' pri' : '') + '" onclick="A.enNotif()">' + ic('ac', 15) + ' اعلان روی دستگاه ' + (ls('dn') === '1' && notif === 'granted' ? '(فعال)' : '') + '</button></div></div></div>' +
    '<div class="glass card"><h3>' + ic('phone', 16) + ' دسترسی دانش‌آموزان در اپ</h3><div class="list" style="gap:14px;margin-top:10px">' + sw('sha', c.showAtt !== false, 'نمایش حضور و غیاب خودشان', "A.cfgB('showAtt',this.checked)") + sw('shr', c.showRank !== false, 'نمایش رتبه‌ی امتیاز خودشان', "A.cfgB('showRank',this.checked)") + sw('shp', c.polls !== false, 'نمایش بخش نظرسنجی‌ها', "A.cfgB('polls',this.checked)") + '</div></div></div>';
};
A.setAcc = k => { applyAcc(k); render(); };
A.enNotif = async () => {
  if (!window.Notification) { toast('این مرورگر اعلان سیستمی را پشتیبانی نمی‌کند', { err: 1 }); return; }
  const p = await Notification.requestPermission();
  if (p === 'granted') { ls('dn', '1'); toast('اعلان روی دستگاه فعال شد'); try { new Notification('پنل کلاس', { body: 'اعلان‌ها فعال شد.', icon: '/icons/icon-192.png' }); } catch (e) { } } else { ls('dn', '0'); toast('اجازه‌ی اعلان داده نشد', { err: 1 }); }
  render();
};

/* ---------- start ---------- */
/* start-up moved to panel4.js */
