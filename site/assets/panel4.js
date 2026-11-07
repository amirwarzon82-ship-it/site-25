'use strict';
/* =====================================================================
   Teacher panel v5 — homework, messages, weekly schedule, badges,
   printing (grades / quizzes / attendance / polls / homework), parent
   report text, start-up
   ===================================================================== */
Object.assign(ICP, {
  ms: '<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
  hw: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
  sch: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M13 14h3M8 17.5h3"/>',
});
PG.length = 0;
PG.push(['dash', 'داشبورد', 'dash'], ['att', 'حضور و غیاب', 'att'], ['gr', 'نمرات', 'gr'], ['qz', 'کوییزها', 'qz'], ['po', 'نظرسنجی‌ها', 'po'], ['hw', 'تکالیف', 'hw'], ['st', 'دانش‌آموزان', 'st'], ['sch', 'برنامه‌ی هفتگی', 'sch'],
  ['ann', 'اطلاعیه‌ها', 'ann'], ['ms', 'پیام‌ها', 'ms'], ['ac', 'گزارش فعالیت', 'ac'], ['rep', 'گزارش‌ها', 'rep'], ['cl', 'کلاس‌ها', 'cl'], ['bk', 'پشتیبان‌گیری', 'bk'], ['set', 'تنظیمات', 'set']);

/* ---------- printing ---------- */
const pHead = t => '<h1>' + esc(t) + '</h1><p>' + esc(S.cfg.cls) + ' · ' + esc(S.cfg.school) + ' · ' + esc(S.cfg.teacher) + ' · ' + pdate(Date.now(), { year: 'numeric', month: 'long', day: 'numeric' }) + '</p><br>';
const pTable = (heads, rows) => '<table><tr>' + heads.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
const r2 = x => x == null ? '—' : fmt(x);
Object.assign(A, {
  printGrades: cat => {
    if (!S.st.length) return;
    if (cat === 'sum' || !CK.includes(cat)) {
      const rm = rankMap();
      printHtml('<div class="rc">' + pHead('جدول نمره‌ی نهایی') + pTable(['رتبه', 'نام'].concat(CK.map(k => CATS[k])).concat(['نمره‌ی نهایی']), S.st.slice().sort((a, b) => (rm[a.id] || 999) - (rm[b.id] || 999)).map(s => [rm[s.id] ? fa(rm[s.id]) : '—', s.name].concat(CK.map(k => r2(catAvg(k, s.id)))).concat([r2(finalOf(s.id))]))) + '</div>');
      return;
    }
    const it = S.gr[cat].items;
    if (!it.length) { toast('این بخش ستونی ندارد', { err: 1 }); return; }
    printHtml('<div class="rc">' + pHead('نمرات ' + CATS[cat]) + pTable(['نام'].concat(it.map(i => i.t)).concat(['میانگین']), S.st.map(s => [s.name].concat(it.map(i => i.sc[s.id] === undefined ? '—' : fmt(i.sc[s.id]))).concat([r2(catAvg(cat, s.id))])).concat([['میانگین ستون'].concat(it.map(i => r2(avg(S.st.map(s => i.sc[s.id]).filter(x => x !== undefined && x !== '').map(Number))))).concat([''])])) + '</div>');
  },
  printAllGrades: () => {
    const cols = []; CK.forEach(k => S.gr[k].items.forEach(i => cols.push([CATS[k] + ': ' + i.t, i])));
    if (!cols.length) { toast('هنوز نمره‌ای ثبت نشده', { err: 1 }); return; }
    printHtml('<div class="rc">' + pHead('همه‌ی نمره‌ها') + pTable(['نام'].concat(cols.map(c => c[0])).concat(['نهایی']), S.st.map(s => [s.name].concat(cols.map(c => c[1].sc[s.id] === undefined ? '—' : fmt(c[1].sc[s.id]))).concat([r2(finalOf(s.id))]))) + '</div>');
  },
  printQuiz: async id => {
    await loadRes(); const q = quizOf(id); if (!q) return; const at = qAttempts(q), best = bestPerStudent(q);
    const rows = S.st.map(s => ({ s, b: best[s.id], n: at.filter(a => a.sid == s.id).length })).sort((a, b) => (b.b == null ? -1 : b.b) - (a.b == null ? -1 : a.b));
    const vals = Object.values(best), qs = q.qs.map((x, i) => { const n = at.length, ok = at.filter(a => a.ok && a.ok[i] == 1).length; return [fa(i + 1), x.q.length > 70 ? x.q.slice(0, 70) + '…' : x.q, n ? fa(Math.round(ok / n * 100)) + '٪' : '—']; });
    printHtml('<div class="rc">' + pHead('نتایج کوییز: ' + q.t) + '<p>شرکت‌کننده: ' + fa(vals.length) + ' از ' + fa(S.st.length) + ' · میانگین: ' + r2(avg(vals)) + ' · بالاترین: ' + r2(vals.length ? Math.max(...vals) : null) + ' · درصد قبولی: ' + (vals.length ? fa(Math.round(vals.filter(v => v >= S.cfg.pass).length / vals.length * 100)) + '٪' : '—') + '</p><br>' +
      pTable(['رتبه', 'نام', 'تعداد تلاش', 'بهترین نمره (از ۲۰)', 'وضعیت'], rows.map((r, i) => [r.b == null ? '—' : fa(i + 1), r.s.name, fa(r.n), r2(r.b), r.b == null ? 'شرکت نکرده' : r.b >= S.cfg.pass ? 'قبول' : 'مردود'])) + '<br><h2>درصد پاسخ درست هر سؤال</h2>' + pTable(['#', 'سؤال', 'درست'], qs) + '</div>');
  },
  printQuizSheets: async id => {
    await loadRes(); const q = quizOf(id); if (!q) return; const at = qAttempts(q); const out = [];
    S.st.forEach(s => {
      const mine = at.filter(a => a.sid == s.id); if (!mine.length) return; const a = mine.slice().sort((x, y) => y.sc - x.sc)[0];
      const wrong = q.qs.map((x, i) => ({ x, i })).filter(o => !(a.ok && a.ok[o.i] == 1));
      out.push('<div class="rc" style="page-break-after:always">' + pHead('برگه‌ی نتیجه: ' + q.t) + '<h2>' + esc(s.name) + '</h2><p>نمره: <b>' + fmt(a.sc) + '</b> از ۲۰ · ' + fa(a.c) + ' پاسخ درست از ' + fa(a.t) + ' سؤال</p><br>' +
        (wrong.length ? '<h3>سؤال‌هایی که باید مرور شوند:</h3>' + pTable(['#', 'سؤال', 'پاسخ درست'], wrong.map(o => [fa(o.i + 1), o.x.q, o.x.o[o.x.c]])) : '<p>همه‌ی پاسخ‌ها درست بود. آفرین!</p>') + '</div>');
    });
    if (!out.length) { toast('هنوز پاسخی ثبت نشده', { err: 1 }); return; }
    printHtml(out.join(''));
  },
  printAtt: () => {
    const ds = Object.keys(S.att).filter(d => Object.keys(S.att[d]).length).sort().slice(-24);
    if (!ds.length) { toast('هنوز حضور و غیابی ثبت نشده', { err: 1 }); return; }
    printHtml('<div class="rc">' + pHead('جدول حضور و غیاب') + pTable(['نام'].concat(ds.map(d => pdate(d, { day: 'numeric', month: 'numeric' }))).concat(['حضور٪', 'غیبت']), S.st.map(s => [s.name].concat(ds.map(d => ({ p: 'ح', a: 'غ', l: 'ت' }[(S.att[d] || {})[s.id]] || '·'))).concat([attPct(s.id) == null ? '—' : fa(attPct(s.id)), fa(attOf(s.id).a)])) ) + '<p>ح = حاضر · غ = غایب · ت = تأخیر</p></div>');
  },
  printPoll: id => {
    const p = pollOf(id); if (!p) return; const rs = pResp(p); let h = '<div class="rc">' + pHead('نتایج نظرسنجی: ' + p.t) + '<p>' + fa(rs.length) + ' پاسخ از ' + fa(S.st.length) + ' دانش‌آموز' + (p.anon ? ' · ناشناس' : '') + '</p><br>';
    p.qs.forEach((q, i) => {
      const vals = rs.map(r => arr(r.a)[i]).filter(v => v != null); h += '<h3>' + fa(i + 1) + '. ' + esc(q.q) + '</h3>';
      if (q.k === 'one' || q.k === 'multi') { const c = q.o.map(() => 0); vals.forEach(v => (q.k === 'multi' ? arr(v) : [v]).forEach(j => { if (c[j] !== undefined) c[j]++; })); h += pTable(['گزینه', 'تعداد', 'درصد'], q.o.map((o, j) => [o, fa(c[j]), vals.length ? fa(Math.round(c[j] / vals.length * 100)) + '٪' : '—'])); }
      else if (q.k === 'rate') h += '<p>میانگین: <b>' + r2(vals.length ? vals.reduce((a, b) => a + (+b), 0) / vals.length : null) + '</b> از ۵ (' + fa(vals.length) + ' پاسخ)</p>';
      else h += vals.length ? '<ul>' + vals.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : '<p>—</p>';
      h += '<br>';
    });
    printHtml(h + '</div>');
  },
  copyReport: id => {
    const s = stById(id); if (!s) return; const c = attOf(id), rm = rankMap(), lines = ['کارنامه‌ی ' + s.name, S.cfg.cls + (S.cfg.school ? ' · ' + S.cfg.school : ''), ''];
    CK.forEach(k => { const a = catAvg(k, id); if (a != null) lines.push(CATS[k] + ': ' + fmt(a) + ' از ۲۰'); });
    lines.push('نمره‌ی نهایی: ' + fmt(finalOf(id)) + (rm[id] ? ' (رتبه‌ی ' + fa(rm[id]) + ' از ' + fa(S.st.length) + ')' : '')); lines.push('حضور: ' + fa(c.p) + ' · غیبت: ' + fa(c.a) + ' · تأخیر: ' + fa(c.l)); lines.push('— ' + S.cfg.teacher);
    copy(lines.join('\n'));
  },
});
const _vgr = V.gr; V.gr = () => _vgr().replace('</p></div></div>', '</p></div><div class="acts"><button class="btn" onclick="A.printGrades(ST.gcat)">' + ic('print', 16) + ' چاپ این جدول</button><button class="btn" onclick="A.printAllGrades()">' + ic('print', 16) + ' چاپ همه‌ی نمره‌ها</button></div></div>');
const _vqz = V.qz; V.qz = () => { const h = _vqz(); return (ST.qv === 'res' && ST.qid) ? h.replace('<button class="btn" onclick="A.qCsv(', '<button class="btn" onclick="A.printQuiz(' + ST.qid + ')">' + ic('print', 16) + ' چاپ نتایج</button><button class="btn" onclick="A.printQuizSheets(' + ST.qid + ')">' + ic('print', 16) + ' برگه‌ی هر نفر</button><button class="btn" onclick="A.qCsv(') : h; };
const _vatt = V.att; V.att = () => _vatt().replace('<button class="btn" onclick="A.exportAtt()">', '<button class="btn" onclick="A.printAtt()">' + ic('print', 16) + ' چاپ</button><button class="btn" onclick="A.exportAtt()">');
const _vpo = V.po; V.po = () => { const h = _vpo(); return (ST.pv === 'res' && ST.poid) ? h.replace('<button class="btn" onclick="A.poCsv(', '<button class="btn" onclick="A.printPoll(' + ST.poid + ')">' + ic('print', 16) + ' چاپ</button><button class="btn" onclick="A.poCsv(') : h; };
const _vrep = V.rep; V.rep = () => {
  const b = _vrep(); if (!S.st.length) return b;
  const card = (ico, t, d, btns) => '<div class="glass card hv"><div class="stat"><div class="ic">' + ic(ico, 20) + '</div></div><h3>' + t + '</h3><p class="sub" style="font-size:13px;margin-bottom:12px">' + d + '</p><div class="frm" style="margin:0;gap:6px">' + btns + '</div></div>';
  return b + '<div class="ph" style="margin-top:22px"><div><h2>چاپ نمره‌ها و کوییزها</h2></div></div><div class="g3">' +
    card('gr', 'جدول نمره‌ی نهایی', 'رتبه، میانگین هر بخش و نمره‌ی نهایی.', '<button class="btn sm pri" onclick="A.printGrades(\'sum\')">' + ic('print', 14) + ' چاپ</button>') +
    CK.map(k => card('gr', 'نمرات ' + CATS[k], S.gr[k].items.length ? fa(S.gr[k].items.length) + ' ستون' : 'ستونی ندارد', '<button class="btn sm pri" onclick="A.printGrades(\'' + k + '\')" ' + (S.gr[k].items.length ? '' : 'disabled') + '>' + ic('print', 14) + ' چاپ</button>')).join('') +
    card('att', 'جدول حضور و غیاب', 'آخرین ۲۴ جلسه.', '<button class="btn sm pri" onclick="A.printAtt()">' + ic('print', 14) + ' چاپ</button>') +
    (S.quizzes.length ? card('qz', 'نتایج کوییزها', 'یک کوییز را انتخاب کنید.', S.quizzes.slice(-4).reverse().map(q => '<button class="btn sm" onclick="A.printQuiz(' + q.id + ')">' + esc(q.t.length > 18 ? q.t.slice(0, 18) + '…' : q.t) + '</button>').join('')) : '') + '</div>';
};

/* ---------- badges ---------- */
const BADGES = [['star', '⭐', 'پرتلاش'], ['target', '🎯', 'دقیق'], ['team', '🤝', 'همکار'], ['rocket', '🚀', 'پیشرفت چشمگیر'], ['bulb', '💡', 'خلاق'], ['trophy', '🏆', 'برتر کلاس']];
const _o3 = A.openS;
A.openS = id => {
  _o3(id); const s = stById(id), mb = $$('.mdl').pop(); if (!s || !mb) return; const fr = mb.querySelector('.frm'); if (!fr) return;
  fr.insertAdjacentHTML('afterend', '<div class="lbl" style="margin:2px 0 6px">نشان‌های تشویقی (برای دانش‌آموز اعلان می‌رود)</div><div class="frm bdgrow" style="gap:6px">' + BADGES.map(b => '<button class="btn sm' + (arr(s.badges).includes(b[0]) ? ' pri' : '') + '" data-bd="' + b[0] + '">' + b[1] + ' ' + b[2] + '</button>').join('') + '<span style="flex:1"></span><button class="btn sm" id="sRep">' + ic('copy', 13) + ' کپی متن کارنامه</button><button class="btn sm" id="sMsg">' + ic('ms', 13) + ' پیام</button></div>');
  mb.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => { s.badges = arr(s.badges); const k = b.dataset.bd, i = s.badges.indexOf(k); if (i > -1) s.badges.splice(i, 1); else s.badges.push(k); if (!s.badges.length) delete s.badges; save(); const m = $$('.mdl').pop(); if (m) m.remove(); render(); A.openS(id); toast(i > -1 ? 'نشان برداشته شد' : 'نشان داده شد'); });
  mb.querySelector('#sRep').onclick = () => A.copyReport(id);
  mb.querySelector('#sMsg').onclick = () => { const m = $$('.mdl').pop(); if (m) m.remove(); A.msOpen(id); };
};

/* ---------- homework ---------- */
let HWR = [], HD = null, HDIRTY = false;
const hwOf = id => S.hw.find(h => h.id == id);
const hwResp = h => HWR.filter(x => x.hid == h.id);
async function loadHW() { const r = await api('/api/hw/results'); if (r.status === 200) HWR = arr(r.data.r); }
V.hw = () => ST.hv === 'edit' ? hwEdit() : ST.hv === 'res' ? hwRes() : hwList();
AFTER.hw = async () => { if (ST.hv === 'edit') return; const n = HWR.length; await loadHW(); if (page === 'hw' && ST.hv !== 'edit' && !modalOpen() && !typing() && HWR.length !== n) render(); };
function hwList() {
  const head = '<div class="ph"><div><h1>تکالیف</h1><p class="sub">تکلیف با مهلت تحویل بسازید؛ دانش‌آموز در اپ پاسخ یا لینک کارش را می‌فرستد. شما نمره و بازخورد می‌دهید.</p></div><div class="acts"><button class="btn pri" onclick="A.hwNew()">' + ic('plus', 16) + ' تکلیف جدید</button></div></div>';
  if (!S.hw.length) return head + empty('hw', 'هنوز تکلیفی نساخته‌اید.', '<p style="margin-top:12px"><button class="btn pri" onclick="A.hwNew()">ساخت اولین تکلیف</button></p>');
  return head + '<div class="g2">' + S.hw.slice().reverse().map(h => {
    const rs = hwResp(h), late = rs.filter(x => x.late).length, past = h.due && Date.now() > h.due;
    return '<div class="glass card hv"><div class="ph" style="margin:0 0 6px"><div><h3 style="margin:0">' + esc(h.t) + '</h3>' + (h.d ? '<p class="sub" style="margin:2px 0 0;font-size:13px">' + esc(h.d) + '</p>' : '') + '</div><span class="bdg ' + (h.on === false ? '' : past ? 'wn' : 'pl') + '">' + (h.on === false ? 'غیرفعال' : past ? 'مهلت گذشته' : 'باز') + '</span></div>' +
      '<div class="frm" style="margin:8px 0;gap:6px"><span class="chip">' + ic('clock', 14) + (h.due ? 'مهلت: ' + pdt(h.due) : 'بدون مهلت') + '</span><span class="chip">' + fa(rs.length) + ' از ' + fa(S.st.length) + ' تحویل</span>' + (late ? '<span class="chip" style="color:var(--y)">' + fa(late) + ' با تأخیر</span>' : '') + '</div>' +
      '<div class="frm" style="margin:0;gap:6px"><button class="btn sm pri" onclick="A.hwRes(' + h.id + ')">' + ic('check', 14) + ' تحویل‌ها</button><button class="btn sm" onclick="A.hwEdit(' + h.id + ')">' + ic('edit', 14) + ' ویرایش</button><button class="btn sm" onclick="A.hwTog(' + h.id + ')">' + (h.on === false ? 'فعال‌سازی' : 'غیرفعال') + '</button><button class="btn sm dg" onclick="A.hwDel(' + h.id + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div></div>';
  }).join('') + '</div>';
}
function hwEdit() {
  const h = HD;
  return '<div class="ph"><div><h1>' + (ST.hid ? 'ویرایش تکلیف' : 'تکلیف جدید') + '</h1></div><div class="acts"><button class="btn" onclick="A.hwBack()">بازگشت</button><button class="btn pri" onclick="A.hwSave()">' + ic('check', 16) + ' ذخیره</button></div></div>' +
    '<div class="glass card"><div class="fg"><div class="fld"><label>عنوان *</label><input class="inp" value="' + esc(h.t) + '" oninput="HD.t=this.value;HDIRTY=true" maxlength="120" placeholder="مثلاً طراحی صفحه‌ی درباره‌ی من"></div><div class="fld"><label>مهلت تحویل (اختیاری)</label><input class="inp" type="datetime-local" value="' + toLocalInput(h.due) + '" onchange="HD.due=this.value?new Date(this.value).getTime():0;HDIRTY=true"></div></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>توضیح تکلیف</label><textarea class="inp" rows="4" oninput="HD.d=this.value;HDIRTY=true" maxlength="1500">' + esc(h.d || '') + '</textarea></div><div class="fld" style="margin-bottom:12px"><label>لینک راهنما (اختیاری)</label><input class="inp" dir="ltr" value="' + esc(h.link || '') + '" oninput="HD.link=this.value;HDIRTY=true" placeholder="https://…"></div>' +
    '<label class="sw"><input type="checkbox" ' + (h.on !== false ? 'checked' : '') + ' onchange="HD.on=this.checked;HDIRTY=true"><i></i><span>فعال (قابل مشاهده برای دانش‌آموزان)</span></label></div>';
}
function hwRes() {
  const h = hwOf(ST.hid); if (!h) { ST.hv = 'list'; return hwList(); }
  const rs = hwResp(h);
  const rows = S.st.map(s => {
    const r = rs.find(x => x.sid == s.id);
    if (!r) return '<div class="it"><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + '</span><span class="n">' + esc(s.name) + '</span><span class="bdg mi">تحویل نشده</span></div>';
    return '<div class="glass card" style="padding:12px 14px;margin-bottom:8px"><div class="ph" style="margin:0 0 6px;align-items:center"><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + '</span><b style="flex:1">' + esc(s.name) + '</b><span class="bdg ' + (r.late ? 'wn' : 'pl') + '">' + (r.late ? 'با تأخیر' : 'به‌موقع') + '</span><small class="mut">' + pdt(r.t) + '</small></div>' +
      '<div class="sub" style="white-space:pre-wrap;font-size:13.5px;margin-bottom:8px">' + (esc(r.x) || '<span class="mut">(بدون متن)</span>') + '</div><div class="frm" style="margin:0"><div class="fld" style="flex:0 0 110px"><label>نمره (از ۲۰)</label><input class="inp" id="hs' + r.id + '" type="text" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="مثلاً 17.5" value="' + (r.sc == null ? '' : r.sc) + '" onchange="A.hwRev(' + r.id + ')"></div><div class="fld"><label>بازخورد برای دانش‌آموز</label><input class="inp" id="hf' + r.id + '" value="' + esc(r.f || '') + '" maxlength="600" onchange="A.hwRev(' + r.id + ')"></div></div></div>';
  }).join('');
  return '<div class="ph"><div><h1>تحویل‌ها: ' + esc(h.t) + '</h1><p class="sub">' + fa(rs.length) + ' تحویل از ' + fa(S.st.length) + ' دانش‌آموز' + (h.due ? ' · مهلت: ' + pdt(h.due) : '') + '</p></div><div class="acts"><button class="btn" onclick="A.hwBack()">بازگشت</button><button class="btn" onclick="A.printHw(' + h.id + ')">' + ic('print', 16) + ' چاپ</button><button class="btn pri" onclick="A.hwToGrade(' + h.id + ')" ' + (rs.some(x => x.sc != null) ? '' : 'disabled') + '>' + ic('gr', 16) + ' انتقال نمره‌ها به «تمرین»</button></div></div>' + rows;
}
Object.assign(A, {
  hwNew: () => { HD = { t: '', d: '', link: '', due: 0, on: true }; HDIRTY = false; ST.hid = 0; ST.hv = 'edit'; render(1); window.scrollTo(0, 0); },
  hwEdit: id => { HD = JSON.parse(JSON.stringify(hwOf(id))); HDIRTY = false; ST.hid = id; ST.hv = 'edit'; render(1); window.scrollTo(0, 0); },
  hwBack: async () => { if (ST.hv === 'edit' && HDIRTY && !(await ask({ title: 'خروج بدون ذخیره', body: 'تغییرات ذخیره‌نشده از بین می‌رود.', ok: 'خروج', danger: 1 }))) return; ST.hv = 'list'; render(1); window.scrollTo(0, 0); },
  hwRes: async id => { ST.hid = id; ST.hv = 'res'; await loadHW(); render(1); window.scrollTo(0, 0); },
  hwSave: () => {
    const h = HD; h.t = h.t.trim(); if (!h.t) { toast('عنوان تکلیف را بنویسید', { err: 1 }); return; } h.d = (h.d || '').trim(); h.link = (h.link || '').trim();
    if (h.link && !/^https?:\/\//i.test(h.link)) { toast('لینک باید با http یا https شروع شود', { err: 1 }); return; }
    const o = JSON.parse(JSON.stringify(h));
    if (ST.hid) { const i = S.hw.findIndex(z => z.id == ST.hid); if (i > -1) S.hw[i] = o; else S.hw.push(o); } else { o.id = S.nid++; o.c = Date.now(); S.hw.push(o); confetti(); }
    save(); HDIRTY = false; ST.hv = 'list'; render(1); window.scrollTo(0, 0); toast('تکلیف ذخیره شد؛ دانش‌آموزان در اپ می‌بینند');
  },
  hwTog: id => { const h = hwOf(id); h.on = h.on === false; save(); render(); },
  hwDel: async id => { const h = hwOf(id); if (await ask({ title: 'حذف تکلیف', body: 'تکلیف «' + h.t + '» حذف شود؟', ok: 'حذف', danger: 1 })) undoable('تکلیف حذف شد', () => { S.hw = S.hw.filter(z => z.id != id); }); },
  hwRev: async rid => {
    const raw = $('#hs' + rid).value.trim(), f = $('#hf' + rid).value.trim(), r = HWR.find(x => x.id == rid); if (!r) return;
    const n = raw === '' ? null : numIn(raw);
    if (raw !== '' && n == null) { toast('نمره باید عدد باشد (مثلاً 17.5)', { err: 1 }); return; }
    const sc = n == null ? '' : Math.round(Math.max(0, Math.min(20, n)) * 100) / 100;
    const res = await api('/api/hw/review', { body: JSON.stringify({ id: rid, sc: sc, f: f }) });
    if (res.status === 200) { r.sc = n == null ? null : sc; r.f = f; $('#hs' + rid).value = n == null ? '' : sc; toast('ذخیره شد'); } else toast('ذخیره نشد', { err: 1 });
  },
  hwToGrade: async id => {
    const h = hwOf(id), rs = hwResp(h).filter(x => x.sc != null); if (!rs.length) return;
    if (!await ask({ title: 'انتقال به نمرات', body: 'نمره‌ی تکلیف در یک ستون جدید زیر «تمرین» ثبت می‌شود.', ok: 'انتقال' })) return;
    const sc = {}; rs.forEach(r => { sc[r.sid] = +r.sc; }); S.gr.hw.items.push({ id: S.nid++, t: h.t, sc }); save(); ST.gcat = 'hw'; toast('ستون جدید در نمرات ساخته شد'); go('gr');
  },
  printHw: id => { const h = hwOf(id), rs = hwResp(h); printHtml('<div class="rc">' + pHead('تحویل تکلیف: ' + h.t) + pTable(['نام', 'وضعیت', 'زمان تحویل', 'نمره', 'بازخورد'], S.st.map(s => { const r = rs.find(x => x.sid == s.id); return [s.name, r ? (r.late ? 'با تأخیر' : 'به‌موقع') : 'تحویل نشده', r ? pdt(r.t) : '—', r && r.sc != null ? fmt(r.sc) : '—', r ? (r.f || '') : '']; })) + '</div>'); },
});

/* ---------- messages ---------- */
let MS = [];
async function loadMS() { const r = await api('/api/msgs'); if (r.status === 200) { const n = MS.length; MS = arr(r.data.m); const un = MS.filter(x => x.from === 's' && !x.r).length; const ch = un !== MSG_UN || n !== MS.length; MSG_UN = un; if (ch) { refreshBadges(); if (page === 'ms' && !modalOpen() && !typing()) render(); } } }
V.ms = () => ST.msid ? msThread() : msList();
function msList() {
  const by = {}; MS.forEach(m => { (by[m.sid] = by[m.sid] || []).push(m); });
  const th = Object.keys(by).map(k => { const l = by[k], last = l[l.length - 1]; return { sid: +k, last, un: l.filter(x => x.from === 's' && !x.r).length }; }).sort((a, b) => b.last.t - a.last.t);
  const head = '<div class="ph"><div><h1>پیام‌ها</h1><p class="sub">دانش‌آموزان از داخل اپ برایتان پیام می‌فرستند و شما همین‌جا جواب می‌دهید.</p></div><div class="acts"><button class="btn" onclick="A.msNew()">' + ic('plus', 16) + ' پیام به دانش‌آموز</button></div></div>';
  return head + '<div class="list">' + (th.map(t => { const s = stById(t.sid); return '<button class="it clk clsit" onclick="A.msOpen(' + t.sid + ')"><span class="av ' + avc(t.sid) + '">' + esc(initial(s ? s.name : '؟')) + '</span><span class="n"><b>' + esc(s ? s.name : 'دانش‌آموز حذف‌شده') + '</b><br><small class="mut">' + (t.last.from === 't' ? 'شما: ' : '') + esc(t.last.x.slice(0, 70)) + '</small></span>' + (t.un ? '<span class="bdg pl">' + fa(t.un) + ' جدید</span>' : '') + '<small class="mut">' + pdt(t.last.t) + '</small></button>'; }).join('') || empty('ms', 'هنوز پیامی نیست.')) + '</div>';
}
function msThread() {
  const s = stById(ST.msid), l = MS.filter(m => m.sid == ST.msid);
  return '<div class="ph"><div><h1>' + esc(s ? s.name : 'دانش‌آموز') + '</h1></div><div class="acts"><button class="btn" onclick="A.msBack()">بازگشت</button></div></div><div class="glass card"><div class="msgs" id="msgs">' + (l.map(m => '<div class="bub ' + (m.from === 't' ? 'me' : 'th') + '"><div style="white-space:pre-wrap">' + esc(m.x) + '</div><small>' + pdt(m.t) + '</small></div>').join('') || '<div class="empty">پیامی نیست.</div>') + '</div><div class="frm" style="margin:12px 0 0"><textarea class="inp w" id="msx" rows="2" maxlength="800" placeholder="پاسخ…" style="min-height:56px"></textarea><button class="btn pri" onclick="A.msSend()">' + ic('check', 16) + ' ارسال</button></div></div>';
}
AFTER.ms = async () => { await loadMS(); const e = $('#msgs'); if (e) e.scrollTop = e.scrollHeight; };
Object.assign(A, {
  msOpen: async id => { ST.msid = id; page = 'ms'; history.replaceState(null, '', '#/ms'); await api('/api/msgs/read', { body: JSON.stringify({ sid: id }) }); MS.forEach(m => { if (m.sid == id) m.r = 1; }); MSG_UN = MS.filter(x => x.from === 's' && !x.r).length; refreshBadges(); render(1); const e = $('#msgs'); if (e) e.scrollTop = e.scrollHeight; },
  msBack: () => { ST.msid = 0; render(1); },
  msSend: async () => { const t = $('#msx').value.trim(); if (!t) return; const r = await api('/api/msgs/reply', { body: JSON.stringify({ sid: ST.msid, x: t }) }); if (r.status === 200) { await loadMS(); render(); const e = $('#msgs'); if (e) e.scrollTop = e.scrollHeight; } else toast('ارسال نشد', { err: 1 }); },
  msNew: () => {
    const m = modal({ title: 'پیام به دانش‌آموز', cls: 'sm', html: '<div class="fld" style="margin-bottom:10px"><label>دانش‌آموز</label><select id="mns">' + S.st.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + '</select></div><div class="fld"><label>پیام</label><textarea class="inp" id="mnx" rows="4" maxlength="800"></textarea></div><div class="ph acts" style="margin:14px 0 0;justify-content:flex-end"><button class="btn pri" id="mny">ارسال</button></div>' });
    m.box.querySelector('#mny').onclick = async () => { const t = m.box.querySelector('#mnx').value.trim(), sid = +m.box.querySelector('#mns').value; if (!t) return; const r = await api('/api/msgs/reply', { body: JSON.stringify({ sid, x: t }) }); if (r.status === 200) { m.close(); await loadMS(); A.msOpen(sid); toast('پیام ارسال شد'); } else toast('ارسال نشد', { err: 1 }); };
  },
});

/* ---------- weekly schedule ---------- */
const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
V.sch = () => {
  const l = S.sched.slice().sort((a, b) => a.day - b.day || String(a.time).localeCompare(b.time));
  return '<div class="ph"><div><h1>برنامه‌ی هفتگی</h1><p class="sub">ساعت و روز جلسه‌ها را بنویسید؛ دانش‌آموزان در صفحه‌ی اصلی اپ «برنامه‌ی امروز» را می‌بینند.</p></div></div>' +
    '<div class="glass card"><div class="frm" style="margin:0"><div class="fld" style="flex:0 0 150px"><label>روز</label><select id="sd">' + DAYS.map((d, i) => '<option value="' + i + '">' + d + '</option>').join('') + '</select></div><div class="fld" style="flex:0 0 130px"><label>ساعت</label><input class="inp" type="time" id="stm" value="08:00"></div><div class="fld"><label>عنوان</label><input class="inp" id="stt" maxlength="80" placeholder="مثلاً کارگاه طراحی سایت" onkeydown="if(event.key===\'Enter\')A.schAdd()"></div><button class="btn pri" onclick="A.schAdd()">' + ic('plus', 16) + ' افزودن</button></div></div>' +
    '<div class="g3" style="margin-top:14px">' + DAYS.map((d, i) => { const x = l.filter(z => z.day === i); return '<div class="glass card"><h3>' + d + '</h3><div class="list" style="margin-top:8px">' + (x.map(z => '<div class="it"><span class="bdg">' + fdig(z.time) + '</span><span class="n">' + esc(z.t) + '</span><button class="btn xs dg" onclick="A.schDel(' + z.id + ')" aria-label="حذف">' + ic('x', 13) + '</button></div>').join('') || '<span class="mut sm">—</span>') + '</div></div>'; }).join('') + '</div>';
};
Object.assign(A, {
  schAdd: () => { const t = $('#stt').value.trim(); if (!t) { toast('عنوان را بنویسید', { err: 1 }); $('#stt').focus(); return; } S.sched.push({ id: S.nid++, day: +$('#sd').value, time: $('#stm').value || '', t }); save(); render(); toast('به برنامه اضافه شد'); },
  schDel: id => { S.sched = S.sched.filter(x => x.id != id); save(); render(); },
});

/* ---------- polling for messages & start ---------- */
setInterval(() => { if (S && !document.hidden) loadMS(); }, 15000);
const _boot4 = actStart;
if (!/^#\/[a-z]+$/.test(location.hash)) history.replaceState(null, '', '#/dash');
boot().then(() => { if (S) loadMS(); });
