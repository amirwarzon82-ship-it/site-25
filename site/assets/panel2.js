'use strict';
/* =====================================================================
   Teacher panel — quizzes, students, announcements, reports, backup,
   settings, command palette, start-up
   ===================================================================== */

/* =====================================================================
   QUIZZES
   ===================================================================== */
let QD = null, QDIRTY = false;
const newQ = () => ({ q: '', o: ['', '', '', ''], c: 0, e: '' });
const newDesc = () => ({ q: '', k: 'desc', w: 1, o: [], c: 0, e: '' });
const toLocalInput = ms => { if (!ms) return ''; const d = new Date(ms); return iso(d) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const qAttempts = q => RES.filter(a => a.qid == q.id);
function bestPerStudent(q) { const m = {}; qAttempts(q).forEach(a => { if (m[a.sid] === undefined || a.sc > m[a.sid]) m[a.sid] = a.sc; }); return m; }
function showPage(p, sub) { page = p; if (sub) ST.qv = sub; history.replaceState(null, '', '#/' + p); render(1); window.scrollTo(0, 0); }

V.qz = () => ST.qv === 'edit' ? qEdit() : ST.qv === 'res' ? qRes() : qList();
function qList() {
  const head = '<div class="ph"><div><h1>کوییزها</h1><p class="sub">کوییز بسازید؛ دانش‌آموزان آن را در اپ یا صفحه‌ی <b>/app</b> می‌بینند، با زمان‌سنج پاسخ می‌دهند و نمره بلافاصله ثبت می‌شود.</p></div><div class="acts"><button class="btn pri" onclick="A.newQuiz()">' + ic('plus', 16) + ' کوییز جدید</button></div></div>';
  if (!S.quizzes.length) return head + empty('qz', 'هنوز کوییزی نساخته‌اید.', '<p style="margin-top:12px"><button class="btn pri" onclick="A.newQuiz()">ساخت اولین کوییز</button></p>');
  return head + '<div class="g2">' + S.quizzes.slice().reverse().map(q => {
    const st = qStatus(q), at = qAttempts(q), best = Object.values(bestPerStudent(q)), av = avg(best);
    return '<div class="glass card hv"><div class="ph" style="margin:0 0 6px"><div><h3 style="margin:0">' + esc(q.t) + '</h3>' + (q.d ? '<p class="sub" style="margin:2px 0 0;font-size:13px">' + esc(q.d) + '</p>' : '') + '</div><span class="bdg ' + QSTAT[st][1] + '">' + QSTAT[st][0] + '</span></div>' +
      '<div class="frm" style="margin:8px 0;gap:6px"><span class="chip">' + ic('list', 14) + fa(q.qs.length) + ' سؤال</span><span class="chip">' + ic('clock', 14) + fa(q.m) + ' دقیقه</span><span class="chip">' + (q.at > 0 ? fa(q.at) + ' بار تلاش' : 'تلاش نامحدود') + '</span>' + (q.from ? '<span class="chip">شروع: ' + pdt(q.from) + '</span>' : '') + (q.to ? '<span class="chip">پایان: ' + pdt(q.to) + '</span>' : '') + '</div>' +
      '<div class="frm" style="margin:6px 0 10px;gap:14px"><span class="mut sm">' + fa(at.length) + ' پاسخ از ' + fa(best.length) + ' نفر</span>' + (av != null ? '<span class="sm">میانگین: <b class="' + lvlc(av) + '">' + fmt(av) + '</b></span>' : '') + '</div>' +
      '<div class="frm" style="margin:0;gap:6px"><button class="btn sm pri" onclick="A.qRes(' + q.id + ')">' + ic('gr', 14) + ' نتایج</button><button class="btn sm" onclick="A.editQuiz(' + q.id + ')">' + ic('edit', 14) + ' ویرایش</button><button class="btn sm" onclick="A.dupQuiz(' + q.id + ')">' + ic('copy', 14) + ' کپی</button><button class="btn sm" onclick="A.togQuiz(' + q.id + ')">' + (q.on === false ? 'فعال‌سازی' : 'غیرفعال') + '</button><button class="btn sm dg" onclick="A.delQuiz(' + q.id + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div></div>';
  }).join('') + '</div>';
}
function qEdit() {
  const q = QD;
  return '<div class="ph"><div><h1>' + (ST.qid ? 'ویرایش کوییز' : 'کوییز جدید') + '</h1><p class="sub">تنظیمات را مشخص کنید، سؤال‌ها را بنویسید و گزینه‌ی درست را علامت بزنید.</p></div><div class="acts"><button class="btn" onclick="A.qBack()">بازگشت</button><button class="btn pri" onclick="A.saveQuiz()">' + ic('check', 16) + ' ذخیره‌ی کوییز</button></div></div>' +
    (ST.qid && qAttempts({ id: ST.qid }).length ? '<div class="warn">' + ic('alert', 20) + '<span>این کوییز پاسخ ثبت‌شده دارد. نمره‌های ثبت‌شده تغییر نمی‌کند، اما عوض‌کردن تعداد یا ترتیب سؤال‌ها ممکن است «مرور پاسخ» قبلی دانش‌آموزان را ناقص کند.</span></div>' : '') +
    '<div class="glass card"><div class="fg"><div class="fld"><label>عنوان کوییز *</label><input class="inp" value="' + esc(q.t) + '" oninput="A.qd(\'t\',this.value)" maxlength="120" placeholder="مثلاً کوییز فصل ۱: HTML"></div><div class="fld"><label>مدت (دقیقه)</label><input class="inp" type="number" min="1" max="600" value="' + q.m + '" oninput="A.qd(\'m\',this.value)"></div><div class="fld"><label>تعداد دفعات مجاز (۰ = نامحدود)</label><input class="inp" type="number" min="0" max="20" value="' + q.at + '" oninput="A.qd(\'at\',this.value)"></div></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>توضیح برای دانش‌آموز (اختیاری)</label><input class="inp" value="' + esc(q.d) + '" oninput="A.qd(\'d\',this.value)" maxlength="300" placeholder="مثلاً مباحث جلسه ۱ تا ۳"></div>' +
    '<div class="fg"><div class="fld"><label>شروع (اختیاری)</label><input class="inp" type="datetime-local" value="' + toLocalInput(q.from) + '" onchange="A.qdt(\'from\',this.value)"></div><div class="fld"><label>پایان (اختیاری)</label><input class="inp" type="datetime-local" value="' + toLocalInput(q.to) + '" onchange="A.qdt(\'to\',this.value)"></div><div class="fld"><label>نمایش پاسخ‌ها بعد از آزمون</label><select onchange="A.qd(\'rv\',this.value)"><option value="full"' + (q.rv === 'full' ? ' selected' : '') + '>مرور کامل + پاسخ درست</option><option value="score"' + (q.rv === 'score' ? ' selected' : '') + '>مرور بدون پاسخ درست</option><option value="none"' + (q.rv === 'none' ? ' selected' : '') + '>فقط نمره</option></select></div></div>' +
    '<div class="frm" style="gap:22px;margin:0"><label class="sw"><input type="checkbox" ' + (q.on !== false ? 'checked' : '') + ' onchange="A.qd(\'on\',this.checked)"><i></i><span>فعال (قابل مشاهده برای دانش‌آموزان)</span></label><label class="sw"><input type="checkbox" ' + (q.sh ? 'checked' : '') + ' onchange="A.qd(\'sh\',this.checked)"><i></i><span>ترتیب سؤال‌ها تصادفی</span></label><label class="sw"><input type="checkbox" ' + (q.so ? 'checked' : '') + ' onchange="A.qd(\'so\',this.checked)"><i></i><span>ترتیب گزینه‌ها تصادفی</span></label></div></div>' +
    lkCard(q) + '<div class="ph" style="margin:18px 0 8px"><div><h2>سؤال‌ها <span class="bdg" id="qcount">' + fa(q.qs.length) + '</span></h2></div><div class="acts"><button class="btn" onclick="A.bulkQ()">' + ic('file', 16) + ' افزودن از متن</button><button class="btn pri" onclick="A.addQ()">' + ic('plus', 16) + ' سؤال جدید</button> <button class="btn" onclick="A.addDesc()">' + ic('plus', 16) + ' تشریحی</button></div></div><div id="qe">' + QD.qs.map(qCard).join('') + '</div>' +
    '<div class="frm"><button class="btn pri" onclick="A.saveQuiz()">' + ic('check', 16) + ' ذخیره‌ی کوییز</button><button class="btn" onclick="A.addQ()">' + ic('plus', 16) + ' سؤال جدید</button> <button class="btn" onclick="A.addDesc()">' + ic('plus', 16) + ' سؤال تشریحی</button></div>';
}
const LET = ['الف', 'ب', 'ج', 'د', 'ه', 'و'];
function qCard(x, i) {
  const desc = x.k === 'desc';
  const head = '<div class="qc" id="qq' + i + '"><div class="qh"><b>سؤال ' + fa(i + 1) + '</b><button class="btn xs" onclick="A.qmv(' + i + ',-1)" ' + (i === 0 ? 'disabled' : '') + ' aria-label="بالا">' + ic('up', 14) + '</button><button class="btn xs" onclick="A.qmv(' + i + ',1)" ' + (i === QD.qs.length - 1 ? 'disabled' : '') + ' aria-label="پایین">' + ic('down', 14) + '</button><button class="btn xs" onclick="A.qdup(' + i + ')" aria-label="کپی">' + ic('copy', 14) + '</button><button class="btn xs dg" onclick="A.qdel(' + i + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div>' +
    '<div class="frm" style="margin:0 0 8px"><select class="inp w" onchange="A.qk(' + i + ',this.value)" aria-label="نوع سؤال"><option value="mc"' + (desc ? '' : ' selected') + '>چندگزینه‌ای (تستی)</option><option value="desc"' + (desc ? ' selected' : '') + '>تشریحی (متن یا عکس برگه)</option></select><label class="mut sm" style="display:flex;align-items:center;gap:6px">بارم<input class="inp" type="text" inputmode="decimal" dir="ltr" value="' + (+x.w > 0 ? +x.w : 1) + '" style="width:84px" onchange="A.qw(' + i + ',this.value)"></label></div>' +
    '<textarea class="inp" rows="2" placeholder="متن سؤال" oninput="QD.qs[' + i + '].q=this.value;QDIRTY=true" maxlength="1000">' + esc(x.q) + '</textarea>';
  if (desc) return head + '<p class="mut sm" style="margin:10px 2px 6px;line-height:1.9">دانش‌آموز پاسخ را تایپ می‌کند یا از برگه‌ی خودش عکس می‌فرستد. شما در «نتایج» پاسخ را می‌بینید و نمره (از بارم همین سؤال) می‌دهید؛ نمره‌ی آزمون بعد از تصحیح محاسبه می‌شود.</p><input class="inp" value="' + esc(x.e || '') + '" placeholder="پاسخ نمونه / راهنمای تصحیح (اختیاری؛ بعد از تصحیح به دانش‌آموز نشان داده می‌شود)" oninput="QD.qs[' + i + '].e=this.value;QDIRTY=true" maxlength="600"></div>';
  return head + '<div class="lbl" style="margin:8px 0 4px">گزینه‌ها (گزینه‌ی درست را با دایره انتخاب کنید)</div>' +
    x.o.map((o, j) => '<div class="qo' + (x.c === j ? ' ok' : '') + '"><input type="radio" name="qc' + i + '" ' + (x.c === j ? 'checked' : '') + ' onchange="A.qc(' + i + ',' + j + ')" aria-label="گزینه‌ی درست"><span class="mut sm" style="width:26px">' + LET[j] + '</span><input class="inp" value="' + esc(o) + '" placeholder="گزینه ' + fa(j + 1) + '" oninput="QD.qs[' + i + '].o[' + j + ']=this.value;QDIRTY=true" maxlength="300">' + (x.o.length > 2 ? '<button class="btn xs dg" onclick="A.qodel(' + i + ',' + j + ')" aria-label="حذف گزینه">' + ic('x', 14) + '</button>' : '') + '</div>').join('') +
    '<div class="frm" style="margin:8px 0 0"><button class="btn xs" onclick="A.qoadd(' + i + ')" ' + (x.o.length >= 6 ? 'disabled' : '') + '>' + ic('plus', 13) + ' گزینه</button><input class="inp w" value="' + esc(x.e || '') + '" placeholder="توضیح پاسخ (اختیاری؛ بعد از آزمون نشان داده می‌شود)" oninput="QD.qs[' + i + '].e=this.value;QDIRTY=true" maxlength="600"></div></div>';
}
function reQE(focusIdx) { const e = $('#qe'); if (!e) return; e.innerHTML = QD.qs.map(qCard).join(''); const c = $('#qcount'); if (c) c.textContent = fa(QD.qs.length); if (focusIdx != null) { const t = $('#qq' + focusIdx); if (t) { t.scrollIntoView({ behavior: RED ? 'auto' : 'smooth', block: 'center' }); const ta = t.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); } } }
function parseBulk(txt) {
  const out = [], blocks = txt.replace(/\r/g, '').split(/\n\s*\n/);
  blocks.forEach(b => {
    const ls = b.split('\n').map(l => l.trim()).filter(Boolean); if (ls.length < 3) return;
    const strip = l => l.replace(/^(\d+|[۰-۹]+|[A-Da-dآ-ی])\s*[\.\)\-–:]\s*/, '').replace(/^[-•·]\s*/, '');
    const q = { q: strip(ls[0]).replace(/^\s*سؤال\s*[\d۰-۹]*\s*[:：]?\s*/, ''), o: [], c: 0, e: '' }; let found = false;
    ls.slice(1).forEach(l => {
      if (/^(توضیح|دلیل)\s*[:：]/.test(l)) { q.e = l.replace(/^[^:：]*[:：]\s*/, ''); return; }
      let mark = false; if (/\*\s*$/.test(l) || /^\*/.test(l) || /^✓|✓$/.test(l)) { mark = true; l = l.replace(/^\*\s*|\s*\*$|^✓\s*|\s*✓$/g, ''); }
      l = strip(l); if (!l || q.o.length >= 6) return; q.o.push(l); if (mark) { q.c = q.o.length - 1; found = true; }
    });
    if (q.q && q.o.length >= 2) { q._nf = !found; out.push(q); }
  });
  return out;
}
Object.assign(A, {
  newQuiz: () => { QD = { t: '', d: '', m: 15, at: 1, from: 0, to: 0, on: true, sh: false, so: true, rv: 'full', lk: true, lkc: 'quiz', lkm: 'best', qs: [newQ()] }; QDIRTY = false; ST.qid = 0; showPage('qz', 'edit'); },
  editQuiz: id => { const q = quizOf(id); if (!q) return; QD = JSON.parse(JSON.stringify(q)); if (QD.rv === undefined) QD.rv = 'full'; if (QD.at === undefined) QD.at = 1; { const lk = findLink(id); QD.lk = !!lk; if (lk) { QD.lkc = lk.c; QD.lkm = lk.i.qm || 'best'; } else { QD.lkc = 'quiz'; QD.lkm = 'best'; } } QD.qs.forEach(x => { x.o = arr(x.o); if (x.k !== 'desc') { while (x.o.length < 2) x.o.push(''); } x.c = +x.c || 0; if (!(+x.w > 0)) x.w = 1; }); QDIRTY = false; ST.qid = id; showPage('qz', 'edit'); },
  qBack: async () => { if (ST.qv === 'edit' && QDIRTY && !(await ask({ title: 'خروج بدون ذخیره', body: 'تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟', ok: 'خروج', danger: 1 }))) return; ST.qv = 'list'; render(1); window.scrollTo(0, 0); },
  qd: (k, v) => { QDIRTY = true; if (k === 'm') v = Math.max(1, Math.min(600, parseInt(v) || 1)); if (k === 'at') v = Math.max(0, Math.min(20, parseInt(v) || 0)); QD[k] = v; },
  qdt: (k, v) => { QDIRTY = true; QD[k] = v ? new Date(v).getTime() : 0; },
  addQ: () => { QD.qs.push(newQ()); QDIRTY = true; reQE(QD.qs.length - 1); },
  addDesc: () => { QD.qs.push(newDesc()); QDIRTY = true; reQE(QD.qs.length - 1); },
  qk: (i, k) => { const x = QD.qs[i]; QDIRTY = true; if (k === 'desc') { x.k = 'desc'; x.o = []; x.w = +x.w > 0 ? x.w : 1; } else { delete x.k; x.o = ['', '', '', '']; x.c = 0; } reQE(i); },
  qw: (i, v) => { QDIRTY = true; const n = numIn(v); QD.qs[i].w = n == null || n <= 0 ? 1 : Math.max(0.01, Math.min(100, Math.round(n * 100) / 100)); },
  qdel: async i => { const x = QD.qs[i]; if ((x.q || x.o.some(Boolean)) && !(await ask({ title: 'حذف سؤال', body: 'سؤال ' + fa(i + 1) + ' حذف شود؟', ok: 'حذف', danger: 1 }))) return; QD.qs.splice(i, 1); if (!QD.qs.length) QD.qs.push(newQ()); QDIRTY = true; reQE(); },
  qdup: i => { QD.qs.splice(i + 1, 0, JSON.parse(JSON.stringify(QD.qs[i]))); QDIRTY = true; reQE(i + 1); },
  qmv: (i, d) => { const j = i + d; if (j < 0 || j >= QD.qs.length) return; const t = QD.qs[i]; QD.qs[i] = QD.qs[j]; QD.qs[j] = t; QDIRTY = true; reQE(); },
  qc: (i, j) => { QD.qs[i].c = j; QDIRTY = true; $$('#qq' + i + ' .qo').forEach((e, k) => e.classList.toggle('ok', k === j)); },
  qoadd: i => { if (QD.qs[i].o.length < 6) { QD.qs[i].o.push(''); QDIRTY = true; reQE(); } },
  qodel: (i, j) => { const x = QD.qs[i]; if (x.o.length <= 2) return; x.o.splice(j, 1); if (x.c === j) x.c = 0; else if (x.c > j) x.c--; QDIRTY = true; reQE(); },
  bulkQ: () => {
    const m = modal({ title: 'افزودن سؤال از متن', cls: 'wide', html: '<p class="mut sm" style="line-height:2">هر سؤال یک بلوک است و بین بلوک‌ها یک خط خالی بگذارید. خط اول متن سؤال، خط‌های بعدی گزینه‌ها؛ در انتهای گزینه‌ی درست <b>*</b> بگذارید. خط «توضیح: …» اختیاری است.</p><pre dir="rtl" class="mut sm" style="background:var(--fill);padding:10px 14px;border-radius:12px;white-space:pre-wrap;margin-bottom:10px">HTML مخفف چیست؟\nHyper Text Markup Language *\nHigh Tech Modern Language\nHome Tool Markup Language\nتوضیح: زبان نشانه‌گذاری صفحات وب\n\nکدام تگ برای لینک است؟\n&lt;img&gt;\n&lt;a&gt; *\n&lt;p&gt;</pre><textarea class="inp" id="bkt" rows="10" placeholder="سؤال‌ها را اینجا بچسبانید…" style="min-height:180px"></textarea><div class="ph acts" style="margin:14px 0 0;justify-content:flex-end"><span class="mut sm" id="bkn" style="flex:1"></span><button class="btn pri" id="bka">افزودن</button></div>' });
    const t = m.box.querySelector('#bkt'); t.oninput = () => { const n = parseBulk(t.value).length; m.box.querySelector('#bkn').textContent = n ? fa(n) + ' سؤال شناسایی شد' : ''; };
    m.box.querySelector('#bka').onclick = () => { const r = parseBulk(t.value); if (!r.length) { toast('سؤالی شناسایی نشد؛ قالب را بررسی کنید', { err: 1 }); return; } const nf = r.filter(x => x._nf).length; r.forEach(x => { delete x._nf; }); if (QD.qs.length === 1 && !QD.qs[0].q && !QD.qs[0].o.some(Boolean)) QD.qs = []; QD.qs.push(...r); QDIRTY = true; m.close(); reQE(); toast(fa(r.length) + ' سؤال اضافه شد' + (nf ? ' · برای ' + fa(nf) + ' سؤال گزینه‌ی درست علامت نخورده (پیش‌فرض: الف)' : ''), nf ? { err: 1 } : {}); };
  },
  saveQuiz: () => {
    const q = QD; q.t = q.t.trim();
    if (!q.t) { toast('عنوان کوییز را بنویسید', { err: 1 }); return; }
    for (let i = 0; i < q.qs.length; i++) {
      const x = q.qs[i], o = x.o.map(s => s.trim()); x.q = x.q.trim();
      if (!x.q) { toast('متن سؤال ' + fa(i + 1) + ' خالی است', { err: 1 }); reQE(i); return; }
      if (x.k === 'desc') { x.o = []; x.c = 0; x.w = +x.w > 0 ? +x.w : 1; x.e = (x.e || '').trim(); continue; }
      delete x.w;
      const filled = o.filter(Boolean); if (filled.length < 2) { toast('سؤال ' + fa(i + 1) + ' حداقل دو گزینه لازم دارد', { err: 1 }); reQE(i); return; }
      if (!o[x.c]) { toast('گزینه‌ی درست سؤال ' + fa(i + 1) + ' خالی است', { err: 1 }); reQE(i); return; }
      if (o.some(s => !s)) { /* drop empty options, keep correct index */ const keep = []; let nc = 0; o.forEach((s, j) => { if (s) { if (j === x.c) nc = keep.length; keep.push(s); } }); x.o = keep; x.c = nc; } else x.o = o;
      x.e = (x.e || '').trim();
    }
    if (q.from && q.to && q.to <= q.from) { toast('زمان پایان باید بعد از شروع باشد', { err: 1 }); return; }
    const o = JSON.parse(JSON.stringify(q)); o.d = (o.d || '').trim();
    if (ST.qid) { const i = S.quizzes.findIndex(z => z.id == ST.qid); if (i > -1) S.quizzes[i] = o; else S.quizzes.push(o); }
    else { o.id = S.nid++; S.quizzes.push(o); confetti(); }
    ensureLink(o); syncLinks(); save(); QDIRTY = false; ST.qv = 'list'; render(1); window.scrollTo(0, 0); toast('کوییز ذخیره شد');
  },
  dupQuiz: id => { const q = quizOf(id), c = JSON.parse(JSON.stringify(q)); c.id = S.nid++; c.t = q.t + ' (کپی)'; c.on = false; S.quizzes.push(c); save(); render(); toast('کپی ساخته شد؛ غیرفعال است'); },
  togQuiz: id => { const q = quizOf(id); q.on = q.on === false; save(); render(); toast(q.on === false ? 'کوییز غیرفعال شد' : 'کوییز فعال شد'); },
  delQuiz: async id => { const q = quizOf(id), n = qAttempts(q).length; if (await ask({ title: 'حذف کوییز', body: 'کوییز «' + q.t + '» حذف شود؟' + (n ? ' ' + fa(n) + ' پاسخ ثبت‌شده‌ی دانش‌آموزان نیز بی‌استفاده می‌شود.' : ''), ok: 'حذف', danger: 1 })) { undoable('کوییز حذف شد', () => { S.quizzes = S.quizzes.filter(z => z.id != id); }); } },
  qRes: async id => { ST.qid = id; ST.qv = 'res'; await loadRes(); showPage('qz', 'res'); },
});

function qRes() {
  const q = quizOf(ST.qid); if (!q) { ST.qv = 'list'; return qList(); }
  const at = qAttempts(q), best = bestPerStudent(q), sids = Object.keys(best), vals = sids.map(k => best[k]), pass = S.cfg.pass;
  const hist = [0, 0, 0, 0, 0]; vals.forEach(x => { hist[Math.min(4, Math.floor(x / 4))]++; }); const mx = Math.max(1, ...hist), lab = ['۰–۴', '۴–۸', '۸–۱۲', '۱۲–۱۶', '۱۶–۲۰'];
  const items = q.qs.map((x, i) => { const n = at.length, ok = at.filter(a => a.ok && a.ok[i] == 1).length, p = n ? ok / n * 100 : null; return { i, x, p };}).filter(t => t.x.k !== 'desc').map(t => { return t; });
  const rows = S.st.map(s => ({ s, n: at.filter(a => a.sid == s.id).length, b: best[s.id], last: Math.max(0, ...at.filter(a => a.sid == s.id).map(a => a.e)) })).sort((a, b) => (b.b == null ? -1 : b.b) - (a.b == null ? -1 : a.b));
  return '<div class="ph"><div><h1>نتایج: ' + esc(q.t) + '</h1><p class="sub">' + fa(at.length) + ' پاسخ ثبت‌شده از ' + fa(sids.length) + ' دانش‌آموز · ' + fa(q.qs.length) + ' سؤال</p></div><div class="acts"><button class="btn" onclick="A.qBack()">بازگشت</button><button class="btn" onclick="A.qCsv(' + q.id + ')" ' + (at.length ? '' : 'disabled') + '>' + ic('dl', 16) + ' CSV</button><button class="btn pri" onclick="A.qToGrade(' + q.id + ')" ' + (at.length ? '' : 'disabled') + '>' + ic('gr', 16) + ' انتقال به ستون نمره</button></div></div>' +
    '<div class="grid">' + stat('st', sids.length, 'شرکت‌کننده از ' + fa(S.st.length)) + stat('gr', avg(vals), 'میانگین (بهترین نمره)', { dec: 1 }) + stat('star', vals.length ? Math.max(...vals) : null, 'بالاترین نمره', { dec: 1 }) + stat('check', vals.length ? Math.round(vals.filter(v => v >= pass).length / vals.length * 100) : null, 'درصد قبولی', { suf: '٪' }) + '</div>' +
    '<div class="g2"><div class="glass card"><h3>توزیع نمره‌ها</h3><div class="trend">' + hist.map((n, i) => '<div><span>' + fa(n) + '</span><u style="height:' + Math.max(4, n / mx * 100) + 'px' + (i < 2 ? ';background:linear-gradient(180deg,var(--r),var(--y))' : '') + '"></u>' + lab[i] + '</div>').join('') + '</div></div>' +
    '<div class="glass card"><h3>درصد پاسخ درست هر سؤال</h3><p class="sub" style="font-size:12.5px;margin-bottom:6px">سؤال‌های قرمز برای کلاس سخت بوده‌اند.</p><div style="max-height:230px;overflow:auto">' + (at.length ? items.map(t => '<div class="bar"><div><span>' + fa(t.i + 1) + '. ' + esc(t.x.q.length > 46 ? t.x.q.slice(0, 46) + '…' : t.x.q) + '</span><span>' + fa(Math.round(t.p)) + '٪</span></div><i><u class="' + (t.p < 40 ? 'rd' : '') + '" data-w="' + t.p + '" style="width:0"></u></i></div>').join('') : '<div class="empty">هنوز پاسخی ثبت نشده است.</div>') + '</div></div></div>' +
    '<div class="glass card"><h3>دانش‌آموزان</h3><div class="list">' + rows.map(r => '<div class="it"><span class="av ' + avc(r.s.id) + '">' + esc(initial(r.s.name)) + '</span><span class="n">' + esc(r.s.name) + '</span>' + (r.n ? '<span class="mut sm">' + fa(r.n) + ' تلاش · ' + pdt(r.last) + '</span><span class="bdg ' + lvlc(r.b) + '">' + fmt(r.b) + '</span>' : '<span class="bdg wn">شرکت نکرده</span>') + '</div>').join('') + '</div></div>' +
    (at.length ? '<div class="glass card" style="margin-top:14px"><div class="ph" style="margin:0 0 8px"><h3 style="margin:0;flex:1">همه‌ی پاسخ‌های ثبت‌شده</h3><button class="btn sm dg" onclick="A.qResAll(' + q.id + ')">حذف همه</button></div><p class="sub" style="font-size:12.5px">با حذف یک پاسخ، دانش‌آموز می‌تواند دوباره امتحان بدهد (اگر تعداد دفعات اجازه دهد).</p><div class="list">' + at.slice().sort((a, b) => b.e - a.e).map(a => '<div class="it"><span class="n">' + esc(a.n) + '</span><span class="mut sm">' + pdt(a.e) + (a.e && a.s ? ' · ' + fa(Math.max(1, Math.round((a.e - a.s) / 60000))) + ' دقیقه' : '') + (a.st === 'exp' ? ' · پایان زمان' : '') + '</span><span class="bdg ' + lvlc(a.sc) + '">' + fmt(a.sc) + '</span><span class="mut sm">' + fa(a.c) + '/' + fa(a.t) + '</span>' + (a.pend ? '<span class="bdg wn">منتظر تصحیح</span>' : '') + (q.qs.some(z => z.k === 'desc') ? '<button class="btn xs ' + (a.pend ? 'pri' : '') + '" onclick="A.gradeAtt(' + a.id + ')">' + (a.pend ? 'تصحیح' : 'مشاهده') + '</button>' : '') + '<button class="btn xs dg" onclick="A.qResOne(' + a.id + ')" aria-label="حذف">' + ic('trash', 13) + '</button></div>').join('') + '</div></div>' : '');
}
Object.assign(A, {
  qCsv: id => { const q = quizOf(id), at = qAttempts(q); download('quiz-' + id + '.csv', csv([['نام', 'نمره (از ۲۰)', 'درست', 'تعداد سؤال', 'زمان پایان', 'وضعیت']].concat(at.map(a => [a.n, a.sc, a.c, a.t, new Date(a.e).toLocaleString('fa-IR'), a.st === 'exp' ? 'پایان زمان' : 'ثبت‌شده']))), 'text/csv'); },
  qToGrade: async id => {
    const q = quizOf(id), best = bestPerStudent(q);
    if (await ask({ title: 'انتقال به نمرات', body: 'بهترین نمره‌ی هر دانش‌آموز در یک ستون جدید زیر «کوییز کلاسی» ثبت می‌شود و بعد می‌توانید آن را دستی هم ویرایش کنید.', ok: 'انتقال' })) {
      const sc = {}; Object.keys(best).forEach(k => { sc[k] = Math.round(best[k] * 100) / 100; });
      S.gr.quiz.items.push({ id: S.nid++, t: q.t, sc }); save(); ST.gcat = 'quiz'; toast('ستون جدید در نمرات ساخته شد'); go('gr');
    }
  },
  qResAll: async id => { if (await ask({ title: 'حذف همه‌ی پاسخ‌ها', body: 'همه‌ی پاسخ‌های این کوییز برای همیشه حذف شود؟ (قبل از آن یک نسخه‌ی پشتیبان دانلود کنید.)', ok: 'حذف', danger: 1 })) { await api('/api/results/delete', { body: JSON.stringify({ qid: id }) }); await loadRes(); render(); toast('پاسخ‌ها حذف شد'); } },
  qResOne: async id => { if (await ask({ title: 'حذف پاسخ', body: 'این پاسخ حذف شود؟', ok: 'حذف', danger: 1 })) { await api('/api/results/delete', { body: JSON.stringify({ id }) }); await loadRes(); render(); toast('حذف شد'); } },
});

/* =====================================================================
   STUDENTS
   ===================================================================== */
V.st = () => {
  const head = '<div class="ph"><div><h1>دانش‌آموزان</h1><p class="sub">هر دانش‌آموز با «شناسه» و «کد شخصی» وارد اپ می‌شود. روی هر کارت بزنید تا پرونده‌اش باز شود.</p></div><div class="acts"><button class="btn" onclick="A.printCards()" ' + (S.st.length ? '' : 'disabled') + '>' + ic('print', 16) + ' کارت‌های ورود</button><button class="btn" onclick="A.bulkS()">' + ic('ul', 16) + ' افزودن گروهی</button></div></div>';
  const add = '<div class="frm"><input class="inp w" id="sn" placeholder="نام دانش‌آموز؛ چند نام را با ویرگول جدا کنید" onkeydown="if(event.key===\'Enter\')A.addS()"><button class="btn pri" onclick="A.addS()">' + ic('plus', 16) + ' افزودن</button></div>';
  if (!S.st.length) return head + add + empty('st', 'هنوز دانش‌آموزی اضافه نشده است.');
  return head + add + '<div class="frm" style="align-items:center"><input class="inp w" placeholder="جستجو…" value="' + esc(ST.sq) + '" oninput="A.sq(this.value)" aria-label="جستجو"><div class="seg">' + [['name', 'نام'], ['avg', 'میانگین'], ['pts', 'امتیاز'], ['abs', 'غیبت']].map(x => '<button class="' + (ST.ssort === x[0] ? 'on' : '') + '" onclick="A.ssort(\'' + x[0] + '\')">' + x[1] + '</button>').join('') + '</div><span class="chip">' + fa(S.st.length) + ' نفر</span></div><div class="sg" id="slist">' + stCards() + '</div>';
};
function stCards() {
  const q = norm_fa(ST.sq); let l = S.st.filter(s => !q || norm_fa(s.name).includes(q) || String(s.id).includes(q));
  const k = ST.ssort; l = l.slice().sort((a, b) => k === 'avg' ? (allAvg(b.id) ?? -1) - (allAvg(a.id) ?? -1) : k === 'pts' ? pts(b.id) - pts(a.id) : k === 'abs' ? attOf(b.id).a - attOf(a.id).a : a.name.localeCompare(b.name, 'fa'));
  return l.map(s => { const p = pts(s.id), a = allAvg(s.id), ab = attOf(s.id).a; return '<div class="glass card hv sc2" onclick="A.openS(' + s.id + ')" tabindex="0" onkeydown="if(event.key===\'Enter\')A.openS(' + s.id + ')"><div class="hd"><span class="av ' + avc(s.id) + '">' + esc(initial(s.name)) + '</span><b>' + esc(s.name) + '</b></div><div class="mt"><span class="bdg" title="شناسه ورود">شناسه ' + fa(s.id, { useGrouping: false }) + '</span><span class="bdg ' + lvlc(a) + '">میانگین ' + fmt(a) + '</span><span class="bdg ' + (ab >= 3 ? 'mi' : '') + '">غیبت ' + fa(ab) + '</span><span class="bdg ' + (p < 0 ? 'mi' : p > 0 ? 'pl' : '') + '">' + (p > 0 ? '+' : '') + fa(p) + '</span></div></div>'; }).join('') || '<div class="glass empty" style="grid-column:1/-1">موردی پیدا نشد.</div>';
}
function addNames(txt) {
  const names = txt.split(/[,،\n;\t]/).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean), seen = new Set(S.st.map(s => norm_fa(s.name))); let n = 0, dup = 0;
  names.forEach(nm => { nm = nm.slice(0, 60); if (seen.has(norm_fa(nm))) { dup++; return; } seen.add(norm_fa(nm)); S.st.push({ id: S.nid++, name: nm, code: genCode() }); n++; });
  if (n) save(); return { n, dup };
}
Object.assign(A, {
  sq: v => { ST.sq = v; const e = $('#slist'); if (e) e.innerHTML = stCards(); },
  ssort: k => { ST.ssort = k; render(); },
  addS: () => { const r = addNames($('#sn').value); if (!r.n && !r.dup) { toast('نام را بنویسید', { err: 1 }); return; } render(); toast(r.n ? fa(r.n) + ' دانش‌آموز اضافه شد' + (r.dup ? ' · ' + fa(r.dup) + ' نام تکراری نادیده گرفته شد' : '') : 'این نام‌ها قبلاً ثبت شده‌اند', r.n ? {} : { err: 1 }); },
  bulkS: () => {
    const m = modal({ title: 'افزودن گروهی دانش‌آموزان', html: '<p class="mut sm" style="line-height:1.9">لیست نام‌ها را بچسبانید (هر نام در یک خط) یا یک فایل متنی / CSV انتخاب کنید. از هر خط، ستون اول برداشته می‌شود.</p><textarea class="inp" id="bsn" rows="9" placeholder="علی رضایی\nمریم احمدی\n…" style="min-height:170px"></textarea><div class="ph acts" style="margin:14px 0 0"><label class="btn">' + ic('ul', 16) + ' انتخاب فایل<input type="file" id="bsf" accept=".txt,.csv" hidden></label><span style="flex:1" class="mut sm" id="bsc"></span><button class="btn pri" id="bsa">افزودن</button></div>' });
    const t = m.box.querySelector('#bsn'), up = () => { const n = t.value.split(/\n/).map(x => x.split(',')[0].trim()).filter(Boolean).length; m.box.querySelector('#bsc').textContent = n ? fa(n) + ' نام' : ''; };
    t.oninput = up; m.box.querySelector('#bsf').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { t.value = String(r.result).replace(/^﻿/, ''); up(); }; r.readAsText(f, 'utf-8'); };
    m.box.querySelector('#bsa').onclick = () => { const txt = t.value.split(/\n/).map(x => x.split(',')[0].trim()).filter(Boolean).join('\n'); const r = addNames(txt); if (!r.n && !r.dup) { toast('نامی وارد نشده', { err: 1 }); return; } m.close(); render(); toast(fa(r.n) + ' دانش‌آموز اضافه شد' + (r.dup ? ' · ' + fa(r.dup) + ' تکراری' : '')); };
  },
  printCards: () => {
    const url = (INFO.base || location.origin) + '/app';
    printHtml(S.st.map(s => '<div class="pc"><b>' + esc(S.cfg.cls) + '</b><br>' + esc(s.name) + '<br>شناسه: <b>' + esc(s.id) + '</b><br>کد شخصی: <span class="big">' + esc(s.code) + '</span><br><small dir="ltr">' + esc(url) + '</small></div>').join(''));
  },
  openS: id => {
    const s = stById(id); if (!s) return; const c = attOf(id), p = pts(id), fo = finalOf(id);
    const rank = S.st.map(x => ({ id: x.id, f: finalOf(x.id) })).filter(x => x.f != null).sort((a, b) => b.f - a.f).findIndex(x => x.id == id) + 1;
    const dates = Object.keys(S.att).sort().slice(-14), mine = RES.filter(a => a.sid == id).sort((a, b) => b.e - a.e).slice(0, 6);
    const log = S.pts.map((x, i) => ({ x, i })).filter(o => o.x.sid == id).slice(-6).reverse();
    const m = modal({
      cls: 'wide', title: '<span style="display:flex;gap:12px;align-items:center"><span class="av ' + avc(id) + '" onclick="A.pickAv(' + id + ')" style="cursor:pointer" title="تغییر عکس">' + esc(initial(s.name)) + '</span>' + esc(s.name) + '</span>',
      html: '<div class="frm" style="gap:8px;align-items:center"><span class="chip">شناسه: <b>' + esc(s.id) + '</b></span><span class="chip">کد: <b dir="ltr" id="scode">' + esc(s.code) + '</b></span><button class="btn xs" id="sCp">' + ic('copy', 13) + ' کپی</button><button class="btn xs" id="sNc">' + ic('refresh', 13) + ' کد جدید</button><button class="btn xs" id="sRn">' + ic('edit', 13) + ' نام</button></div>' +
        '<div class="frm" style="gap:8px"><span class="chip">حاضر <b>' + fa(c.p) + '</b></span><span class="chip">غایب <b>' + fa(c.a) + '</b></span><span class="chip">تأخیر <b>' + fa(c.l) + '</b></span><span class="chip">امتیاز <b class="' + (p < 0 ? 'mi' : 'pl') + '">' + fa(p) + '</b></span><span class="chip">نمره‌ی نهایی <b>' + fmt(fo) + '</b></span>' + (rank ? '<span class="chip">رتبه <b>' + fa(rank) + '</b> از ' + fa(S.st.length) + '</span>' : '') + '</div>' +
        '<div class="g2" style="margin-bottom:6px"><div>' + CK.map(k => bar(CATS[k], catAvg(k, id))).join('') + '</div><div><div class="lbl">حضور در ۱۴ جلسه‌ی اخیر</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin:8px 0 12px">' + (dates.map(d => '<span class="hm ' + ((S.att[d] || {})[id] || '') + '" title="' + pdate(d) + '"></span>').join('') || '<span class="mut sm">جلسه‌ای ثبت نشده</span>') + '</div><div class="lbl">آخرین امتیازها</div><div class="list" style="margin-top:6px">' + (log.map(o => '<div class="it" style="padding:4px 12px"><span class="n sm">' + (o.x.v > 0 ? 'مثبت' : 'منفی') + ' · ' + pdate(o.x.d) + '</span><button class="btn xs dg" data-pd="' + o.i + '" aria-label="حذف">' + ic('x', 12) + '</button></div>').join('') || '<span class="mut sm">—</span>') + '</div></div></div>' +
        (mine.length ? '<div class="lbl" style="margin:8px 0 6px">آخرین کوییزها</div><div class="list">' + mine.map(a => { const q = quizOf(a.qid); return '<div class="it" style="padding:5px 12px"><span class="n sm">' + esc(q ? q.t : 'کوییز حذف‌شده') + '</span><span class="mut sm">' + pdt(a.e) + '</span><span class="bdg ' + lvlc(a.sc) + '">' + fmt(a.sc) + '</span></div>'; }).join('') + '</div>' : '') +
        '<div class="fld" style="margin-top:12px"><label>یادداشت خصوصی استاد (برای دانش‌آموز دیده نمی‌شود)</label><textarea class="inp" id="snote" rows="2" maxlength="600">' + esc(s.note || '') + '</textarea></div>' +
        '<div class="ph acts" style="margin:16px 0 0"><button class="btn" id="sCard">' + ic('print', 16) + ' کارنامه</button><span style="flex:1"></span><button class="btn dg" id="sDel">' + ic('trash', 16) + ' حذف دانش‌آموز</button></div>'
    });
    const b = m.box;
    b.querySelector('#sCp').onclick = () => copy(s.code);
    b.querySelector('#sNc').onclick = async () => { if (await ask({ title: 'کد جدید', body: 'کد ورود قبلی ' + s.name + ' از کار می‌افتد. ادامه می‌دهید؟', ok: 'ساخت کد جدید' })) { s.code = genCode(); save(); m.close(); render(); A.openS(id); toast('کد جدید ساخته شد'); } };
    b.querySelector('#sRn').onclick = async () => { const t = await askText({ title: 'تغییر نام', label: 'نام دانش‌آموز', value: s.name, max: 60 }); if (t) { s.name = t; save(); m.close(); render(); A.openS(id); } };
    b.querySelector('#snote').onchange = e => { s.note = e.target.value.trim(); if (!s.note) delete s.note; save(); toast('یادداشت ذخیره شد'); };
    b.querySelectorAll('[data-pd]').forEach(x => x.onclick = () => { S.pts.splice(+x.dataset.pd, 1); save(); m.close(); render(); A.openS(id); });
    b.querySelector('#sCard').onclick = () => printHtml(cardHtml(s, rankMap()));
    b.querySelector('#sDel').onclick = async () => { if (await ask({ title: 'حذف دانش‌آموز', body: s.name + ' با همه‌ی حضور و غیاب، نمره‌ها و امتیازهایش حذف شود؟', ok: 'حذف', danger: 1 })) { m.close(); undoable('دانش‌آموز حذف شد', () => { S.st = S.st.filter(x => x.id != id); for (const d in S.att) { delete S.att[d][id]; if (!Object.keys(S.att[d]).length) delete S.att[d]; } S.pts = S.pts.filter(x => x.sid != id); CK.forEach(k => S.gr[k].items.forEach(i => { delete i.sc[id]; })); }); } };
  },
});

/* =====================================================================
   ANNOUNCEMENTS
   ===================================================================== */
V.ann = () => {
  const l = S.ann.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.d - a.d);
  return '<div class="ph"><div><h1>اطلاعیه‌ها</h1><p class="sub">پیام‌هایی که دانش‌آموزان در صفحه‌ی اصلی اپ می‌بینند: تکلیف، تغییر ساعت کلاس، یادآوری امتحان…</p></div></div>' +
    '<div class="glass card"><div class="fld" style="margin-bottom:10px"><label>عنوان</label><input class="inp" id="at" maxlength="100" placeholder="مثلاً جلسه‌ی بعد امتحان داریم"></div><div class="fld" style="margin-bottom:10px"><label>متن (اختیاری)</label><textarea class="inp" id="ab" rows="3" maxlength="1500" placeholder="جزئیات…"></textarea></div><div class="frm" style="margin:0;align-items:center"><label class="sw"><input type="checkbox" id="ap"><i></i><span>سنجاق کن (بالای لیست)</span></label><span style="flex:1"></span><button class="btn pri" onclick="A.addAnn()">' + ic('ann', 16) + ' انتشار</button></div></div>' +
    '<div class="list" style="margin-top:14px">' + (l.map(a => '<div class="glass card hv"><div class="ph" style="margin:0"><div><h3 style="margin:0">' + (a.pin ? ic('pin', 15) + ' ' : '') + esc(a.t) + (a.hide ? ' <span class="bdg wn">مخفی</span>' : '') + '</h3><p class="sub" style="margin:4px 0 0;font-size:13px;white-space:pre-wrap">' + esc(a.b || '') + '</p><small class="mut">' + pdt(a.d) + '</small></div><div class="acts"><button class="btn sm" onclick="A.annPin(' + a.id + ')">' + (a.pin ? 'برداشتن سنجاق' : 'سنجاق') + '</button><button class="btn sm" onclick="A.annHide(' + a.id + ')">' + (a.hide ? 'نمایش' : 'مخفی') + '</button><button class="btn sm" onclick="A.annEdit(' + a.id + ')">' + ic('edit', 14) + '</button><button class="btn sm dg" onclick="A.annDel(' + a.id + ')" aria-label="حذف">' + ic('trash', 14) + '</button></div></div></div>').join('') || empty('ann', 'اطلاعیه‌ای منتشر نشده است.')) + '</div>';
};
Object.assign(A, {
  addAnn: () => { const t = $('#at').value.trim(); if (!t) { toast('عنوان را بنویسید', { err: 1 }); $('#at').focus(); return; } S.ann.push({ id: S.nid++, t, b: $('#ab').value.trim(), d: Date.now(), pin: $('#ap').checked }); save(); render(); toast('اطلاعیه منتشر شد'); },
  annPin: id => { const a = S.ann.find(x => x.id == id); a.pin = !a.pin; save(); render(); },
  annHide: id => { const a = S.ann.find(x => x.id == id); a.hide = !a.hide; save(); render(); toast(a.hide ? 'برای دانش‌آموزان مخفی شد' : 'نمایش داده می‌شود'); },
  annDel: async id => { if (await ask({ title: 'حذف اطلاعیه', body: 'این اطلاعیه حذف شود؟', ok: 'حذف', danger: 1 })) undoable('اطلاعیه حذف شد', () => { S.ann = S.ann.filter(x => x.id != id); }); },
  annEdit: id => {
    const a = S.ann.find(x => x.id == id), m = modal({ title: 'ویرایش اطلاعیه', html: '<div class="fld" style="margin-bottom:10px"><label>عنوان</label><input class="inp" id="eat" value="' + esc(a.t) + '" maxlength="100"></div><div class="fld"><label>متن</label><textarea class="inp" id="eab" rows="4" maxlength="1500">' + esc(a.b || '') + '</textarea></div><div class="ph acts" style="margin:14px 0 0;justify-content:flex-end"><button class="btn pri" id="eas">ذخیره</button></div>' });
    m.box.querySelector('#eas').onclick = () => { const t = m.box.querySelector('#eat').value.trim(); if (!t) return; a.t = t; a.b = m.box.querySelector('#eab').value.trim(); save(); m.close(); render(); toast('ذخیره شد'); };
  },
});

/* =====================================================================
   REPORTS
   ===================================================================== */
function rankMap() { const m = {}; S.st.map(s => ({ id: s.id, f: finalOf(s.id) })).filter(x => x.f != null).sort((a, b) => b.f - a.f).forEach((x, i) => { m[x.id] = i + 1; }); return m; }
function cardHtml(s, rm) {
  const c = attOf(s.id), fo = finalOf(s.id);
  return '<div class="rc" style="page-break-after:always;padding:10px 6px"><h1>کارنامه‌ی ' + esc(s.name) + '</h1><p>' + esc(S.cfg.cls) + ' · ' + esc(S.cfg.school) + ' · ' + esc(S.cfg.teacher) + '<br>تاریخ: ' + pdate(Date.now(), { year: 'numeric', month: 'long', day: 'numeric' }) + '</p><br><table><tr><th>بخش</th><th>تعداد نمره</th><th>میانگین (از ۲۰)</th></tr>' + CK.map(k => '<tr><td>' + CATS[k] + '</td><td>' + fa(scoresOf(k, s.id).length) + '</td><td>' + fmt(catAvg(k, s.id)) + '</td></tr>').join('') + '<tr><td><b>نمره‌ی نهایی</b></td><td></td><td><b>' + fmt(fo) + '</b></td></tr></table><br><table><tr><th>حاضر</th><th>غایب</th><th>تأخیر</th><th>امتیاز</th><th>رتبه</th></tr><tr><td>' + fa(c.p) + '</td><td>' + fa(c.a) + '</td><td>' + fa(c.l) + '</td><td>' + fa(pts(s.id)) + '</td><td>' + (rm && rm[s.id] ? fa(rm[s.id]) + ' از ' + fa(S.st.length) : '—') + '</td></tr></table></div>';
}
V.rep = () => {
  const card = (ico, t, d, btns) => '<div class="glass card hv"><div class="stat"><div class="ic">' + ic(ico, 20) + '</div></div><h3>' + t + '</h3><p class="sub" style="font-size:13px;margin-bottom:12px">' + d + '</p><div class="frm" style="margin:0;gap:6px">' + btns + '</div></div>';
  return '<div class="ph"><div><h1>گزارش‌ها</h1><p class="sub">خروجی چاپی یا فایل CSV (قابل‌باز شدن در اکسل) از اطلاعات کلاس.</p></div></div>' + (S.st.length ? '<div class="g3">' +
    card('rep', 'کارنامه‌ی کلاس', 'جدول میانگین بخش‌ها، نمره‌ی نهایی، حضور و امتیاز همه‌ی دانش‌آموزان.', '<button class="btn sm pri" onclick="A.classRep()">' + ic('print', 14) + ' چاپ</button><button class="btn sm" onclick="A.classCsv()">' + ic('dl', 14) + ' CSV</button>') +
    card('st', 'کارنامه‌ی تک‌تک دانش‌آموزان', 'برای هر نفر یک صفحه‌ی جدا برای تحویل یا چاپ.', '<button class="btn sm pri" onclick="A.allCards()">' + ic('print', 14) + ' چاپ همه</button>') +
    card('gr', 'همه‌ی نمره‌ها', 'همه‌ی ستون‌های نمره در یک فایل.', '<button class="btn sm pri" onclick="A.allGradesCsv()">' + ic('dl', 14) + ' CSV</button>') +
    card('att', 'حضور و غیاب', 'ماتریس همه‌ی جلسات و دانش‌آموزان.', '<button class="btn sm pri" onclick="A.exportAtt()">' + ic('dl', 14) + ' CSV</button>') +
    card('key', 'کارت‌های ورود', 'شناسه و کد شخصی هر دانش‌آموز برای برش و تحویل.', '<button class="btn sm pri" onclick="A.printCards()">' + ic('print', 14) + ' چاپ</button>') + '</div>' : empty('rep', 'برای گزارش‌گیری ابتدا دانش‌آموز اضافه کنید.'));
};
Object.assign(A, {
  allCards: () => { const rm = rankMap(); printHtml(S.st.map(s => cardHtml(s, rm)).join('')); },
  classRep: () => { const rm = rankMap(); printHtml('<div class="rc"><h1>کارنامه‌ی کلاس ' + esc(S.cfg.cls) + '</h1><p>' + esc(S.cfg.school) + ' · ' + esc(S.cfg.teacher) + ' · ' + pdate(Date.now(), { year: 'numeric', month: 'long', day: 'numeric' }) + '</p><br><table><tr><th>رتبه</th><th>نام</th>' + CK.map(k => '<th>' + CATS[k] + '</th>').join('') + '<th>نهایی</th><th>حضور٪</th><th>غیبت</th><th>امتیاز</th></tr>' + S.st.slice().sort((a, b) => (rm[a.id] || 999) - (rm[b.id] || 999)).map(s => '<tr><td>' + (rm[s.id] ? fa(rm[s.id]) : '—') + '</td><td>' + esc(s.name) + '</td>' + CK.map(k => '<td>' + fmt(catAvg(k, s.id)) + '</td>').join('') + '<td><b>' + fmt(finalOf(s.id)) + '</b></td><td>' + (attPct(s.id) == null ? '—' : fa(attPct(s.id))) + '</td><td>' + fa(attOf(s.id).a) + '</td><td>' + fa(pts(s.id)) + '</td></tr>').join('') + '</table></div>'); },
  classCsv: () => { const rm = rankMap(), r = x => x == null ? '' : Math.round(x * 100) / 100; download('class-report.csv', csv([['رتبه', 'نام', 'شناسه'].concat(CK.map(k => CATS[k])).concat(['نمره نهایی', 'درصد حضور', 'غیبت', 'تأخیر', 'امتیاز'])].concat(S.st.slice().sort((a, b) => (rm[a.id] || 999) - (rm[b.id] || 999)).map(s => [rm[s.id] || '', s.name, s.id].concat(CK.map(k => r(catAvg(k, s.id)))).concat([r(finalOf(s.id)), attPct(s.id) == null ? '' : attPct(s.id), attOf(s.id).a, attOf(s.id).l, pts(s.id)])))), 'text/csv'); },
  allGradesCsv: () => { const cols = []; CK.forEach(k => S.gr[k].items.forEach(i => cols.push([CATS[k] + ' — ' + i.t, i]))); download('all-grades.csv', csv([['نام'].concat(cols.map(c => c[0]))].concat(S.st.map(s => [s.name].concat(cols.map(c => c[1].sc[s.id] === undefined ? '' : c[1].sc[s.id]))))), 'text/csv'); },
});

/* =====================================================================
   BACKUP & RESTORE
   ===================================================================== */
let BKL = null;
const KIND = { auto: ['خودکار', ''], manual: ['دستی', 'pl'], safe: ['ایمنی', 'wn'] };
const sizeFmt = b => b > 1048576 ? fa(Math.round(b / 104857.6) / 10) + ' مگابایت' : fa(Math.max(1, Math.round(b / 1024))) + ' کیلوبایت';
V.bk = () => {
  const lb = +ls('lastDl') || 0;
  return '<div class="ph"><div><h1>پشتیبان‌گیری و بازیابی</h1><p class="sub">همه‌چیز از همین‌جا انجام می‌شود؛ نیازی به ورود به هاست نیست. پشتیبان شامل دانش‌آموزان، حضور و غیاب، نمره‌ها، کوییزها، اطلاعیه‌ها، تنظیمات و پاسخ‌های کوییز است.</p></div></div>' +
    '<div class="g2"><div class="glass card hv"><div class="stat"><div class="ic">' + ic('dl', 20) + '</div></div><h3>دانلود روی دستگاه خودتان</h3><p class="sub" style="font-size:13px">یک فایل کامل که می‌توانید در گوشی یا کامپیوتر نگه دارید. ' + (lb ? 'آخرین دانلود: <b>' + pdt(lb) + '</b>' : 'هنوز دانلود نکرده‌اید.') + '</p><button class="btn pri" onclick="A.dlBackup()">' + ic('dl', 16) + ' دانلود پشتیبان کامل</button></div>' +
    '<div class="glass card hv"><div class="stat"><div class="ic">' + ic('ul', 20) + '</div></div><h3>بازیابی از فایل</h3><p class="sub" style="font-size:13px">فایل پشتیبان را اینجا بکشید یا انتخاب کنید. قبل از جایگزینی، از اطلاعات فعلی یک نسخه‌ی ایمنی ساخته می‌شود.</p><label class="drop" id="drop" style="display:block">' + ic('ul', 26) + '<div style="margin-top:6px">فایل را اینجا رها کنید یا کلیک کنید</div><input type="file" id="bkf" accept=".json,application/json" hidden></label></div></div>' +
    '<div class="glass card"><div class="ph" style="margin:0 0 10px"><div><h3 style="margin:0">نسخه‌های ذخیره‌شده روی سرور</h3><p class="sub" style="font-size:13px;margin:2px 0 0">سایت به‌صورت خودکار هر چند ساعت یک‌بار (هنگام ذخیره‌ی تغییرات) و قبل از هر بازیابی یا حذف گروهی یک نسخه می‌سازد.</p></div><button class="btn" onclick="A.bkNow()">' + ic('plus', 16) + ' ساخت نسخه‌ی جدید</button></div><div class="list" id="bkl"><div class="skel"></div></div></div>' +
    '<div class="glass card" style="margin-top:14px;border-color:rgba(251,113,133,.4)"><h3 style="color:var(--r)">پاک‌سازی کامل</h3><p class="sub" style="font-size:13px">همه‌ی اطلاعات کلاس (دانش‌آموزان، نمره‌ها، کوییزها، پاسخ‌ها) را پاک می‌کند؛ مثلاً برای شروع ترم جدید. قبل از آن یک نسخه‌ی ایمنی ساخته می‌شود که از لیست بالا برمی‌گردد.</p><button class="btn dg" onclick="A.wipe()">' + ic('trash', 16) + ' پاک‌سازی همه‌چیز</button></div>';
};
async function loadBk() { const r = await api('/api/backups'); const e = $('#bkl'); if (!e) return; BKL = r.status === 200 ? arr(r.data.list) : []; e.innerHTML = BKL.length ? BKL.map(b => '<div class="it"><span class="bdg ' + (KIND[b.kind] || ['', ''])[1] + '">' + (KIND[b.kind] || [b.kind])[0] + '</span><span class="n sm">' + pdt(b.t) + '<br><small class="mut">' + (b.st != null ? fa(b.st) + ' دانش‌آموز · ' + fa(b.qz || 0) + ' کوییز · ' + fa(b.at || 0) + ' پاسخ · ' : '') + sizeFmt(b.size) + '</small></span><a class="btn sm" href="/api/backups/download?name=' + encodeURIComponent(b.name) + '">' + ic('dl', 14) + '</a><button class="btn sm" onclick="A.bkRestore(\'' + b.name + '\')">بازیابی</button><button class="btn sm dg" onclick="A.bkDel(\'' + b.name + '\')" aria-label="حذف">' + ic('trash', 14) + '</button></div>').join('') : '<div class="empty">هنوز نسخه‌ای روی سرور ساخته نشده است.</div>'; }
AFTER.bk = () => {
  loadBk();
  const dr = $('#drop'), fi = $('#bkf'); if (!dr) return;
  ['dragover', 'dragenter'].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.add('ov'); })); ['dragleave', 'drop'].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.remove('ov'); }));
  dr.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readBackup(f); }); fi.onchange = () => { if (fi.files[0]) readBackup(fi.files[0]); fi.value = ''; };
};
function readBackup(f) {
  if (f.size > 40e6) { toast('فایل خیلی بزرگ است', { err: 1 }); return; }
  const r = new FileReader(); r.onload = async () => {
    let o; try { o = JSON.parse(String(r.result).replace(/^﻿/, '')); } catch (e) { toast('این فایل پشتیبان معتبر نیست (JSON خراب است)', { err: 1 }); return; }
    const st = o && o.state ? o.state : o; if (!st || !Array.isArray(st.st)) { toast('این فایل، پشتیبان این پنل نیست', { err: 1 }); return; }
    const n = st.st.length, qn = arr(st.quizzes).length, an = o.results && Array.isArray(o.results.a) ? o.results.a.length : null, when = o.meta && o.meta.t ? pdt(o.meta.t) : '—';
    if (await ask({ title: 'بازیابی پشتیبان', html: 'اطلاعات فعلی با محتوای این فایل جایگزین می‌شود:<br><b>' + fa(n) + '</b> دانش‌آموز · <b>' + fa(qn) + '</b> کوییز' + (an != null ? ' · <b>' + fa(an) + '</b> پاسخ' : ' · (پاسخ‌های کوییز در این فایل نیست و دست‌نخورده می‌ماند)') + '<br>تاریخ پشتیبان: ' + when + (o.full ? '<br><b>این فایل شامل ' + fa((o.meta && o.meta.cl) || 1) + ' کلاس است؛ همه‌ی کلاس‌ها جایگزین می‌شوند.</b>' : '<br>فقط «کلاس فعلی» جایگزین می‌شود.') + '<br><br>از اطلاعات فعلی یک نسخه‌ی ایمنی ساخته می‌شود.', ok: 'بازیابی کن', danger: 1 })) {
      const res = await api('/api/restore', { raw: true, body: String(r.result).replace(/^﻿/, '') });
      if (res.status === 200) { dirty = false; await boot(false); toast('بازیابی انجام شد'); confetti(); } else toast('بازیابی ناموفق بود' + (res.status === 400 ? ' (فایل نامعتبر)' : ''), { err: 1 });
    }
  }; r.readAsText(f, 'utf-8');
}
Object.assign(A, {
  dlBackup: () => { ls('lastDl', String(Date.now())); const a = document.createElement('a'); a.href = '/api/backup'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => { if (page === 'bk') render(); }, 600); toast('دانلود پشتیبان شروع شد'); },
  bkNow: async () => { if (dirty) await flush(); const r = await api('/api/backups/create', { body: '{}' }); if (r.status === 200) { toast('نسخه‌ی جدید ساخته شد'); loadBk(); loadInfo(); } else toast('ساخت نسخه ناموفق بود', { err: 1 }); },
  bkRestore: async name => { const b = (BKL || []).find(x => x.name === name); if (await ask({ title: 'بازیابی این نسخه', html: 'اطلاعات فعلی با نسخه‌ی ' + (b ? pdt(b.t) : '') + ' جایگزین می‌شود. قبل از آن یک نسخه‌ی ایمنی ساخته می‌شود.', ok: 'بازیابی', danger: 1 })) { dirty = false; const r = await api('/api/backups/restore', { body: JSON.stringify({ name }) }); if (r.status === 200) { await boot(false); toast('بازیابی انجام شد'); } else toast('بازیابی ناموفق بود', { err: 1 }); } },
  bkDel: async name => { if (await ask({ title: 'حذف نسخه', body: 'این نسخه از روی سرور حذف شود؟', ok: 'حذف', danger: 1 })) { await api('/api/backups/delete', { body: JSON.stringify({ name }) }); loadBk(); } },
  wipe: async () => {
    const m = modal({ title: 'پاک‌سازی کامل', cls: 'sm', html: '<p class="mut" style="line-height:1.9">برای تأیید، کلمه‌ی <b>پاک‌سازی</b> را بنویسید.</p><input class="inp" id="wp" placeholder="پاک‌سازی"><div class="ph acts" style="margin:14px 0 0;justify-content:flex-end"><button class="btn dg" id="wy" disabled>پاک شود</button></div>' });
    const i = m.box.querySelector('#wp'), y = m.box.querySelector('#wy'); i.oninput = () => { y.disabled = i.value.trim() !== 'پاک‌سازی'; };
    y.onclick = async () => { y.disabled = true; const cfg = S.cfg, empty = { st: [], att: {}, pts: [], nid: 1, gr: { quiz: { items: [] }, cont: { items: [] }, exam: { items: [] }, hw: { items: [] } }, quizzes: [], ann: [], cfg }; const r = await api('/api/restore', { raw: true, body: JSON.stringify({ state: empty, results: { nid: 1, a: [] } }) }); m.close(); dirty = false; if (r.status === 200) { await boot(false); toast('همه‌چیز پاک شد؛ نسخه‌ی ایمنی در لیست پشتیبان‌هاست'); } else toast('ناموفق بود', { err: 1 }); };
  },
});

/* =====================================================================
   SETTINGS
   ===================================================================== */
const sw = (id, on, label, fn) => '<label class="sw"><input type="checkbox" id="' + id + '" ' + (on ? 'checked' : '') + ' onchange="' + fn + '"><i></i><span>' + label + '</span></label>';
V.set = () => {
  const c = S.cfg, w = c.w, url = (INFO.base || location.origin) + '/app';
  return '<div class="ph"><div><h1>تنظیمات</h1><p class="sub">نام کلاس، وزن نمره‌ها، دسترسی دانش‌آموزان، ظاهر پنل و حساب کاربری.</p></div></div>' +
    '<div class="g2"><div class="glass card"><h3>اطلاعات کلاس</h3><div class="fld" style="margin-bottom:10px"><label>نام کلاس / درس</label><input class="inp" value="' + esc(c.cls) + '" oninput="A.cfg(\'cls\',this.value)" maxlength="60"></div><div class="fld" style="margin-bottom:10px"><label>نام مدرسه</label><input class="inp" value="' + esc(c.school) + '" oninput="A.cfg(\'school\',this.value)" maxlength="60"></div><div class="fld"><label>نام نمایشی استاد</label><input class="inp" value="' + esc(c.teacher) + '" oninput="A.cfg(\'teacher\',this.value)" maxlength="40"></div></div>' +
    '<div class="glass card"><h3>نمره‌ی نهایی</h3><p class="sub" style="font-size:13px">وزن هر بخش در میانگین وزنی نمره‌ی نهایی (۰ یعنی حساب نشود).</p><div class="fg" style="grid-template-columns:repeat(2,1fr)">' + CK.map(k => '<div class="fld"><label>' + CATS[k] + '</label><input class="inp" type="number" min="0" max="20" step="0.5" value="' + w[k] + '" onchange="A.cfgW(\'' + k + '\',this.value)"></div>').join('') + '</div><div class="fld"><label>نمره‌ی قبولی</label><input class="inp" type="number" min="1" max="20" step="0.5" value="' + c.pass + '" onchange="A.cfgPass(this.value)"></div></div></div>' +
    '<div class="g2"><div class="glass card"><h3>دسترسی دانش‌آموزان</h3><div class="list" style="gap:14px;margin-top:10px">' + sw('shg', c.showGrades, 'نمایش نمره‌های خودشان در اپ', 'A.cfgB(\'showGrades\',this.checked)') + sw('shb', c.board, 'نمایش جدول برترین‌ها (۵ نفر اول امتیاز)', 'A.cfgB(\'board\',this.checked)') + '</div></div>' +
    '<div class="glass card"><h3>ظاهر</h3><div class="seg" style="margin-top:6px">' + [['auto', 'خودکار'], ['dark', 'تیره'], ['light', 'روشن']].map(x => '<button class="' + (themePref() === x[0] ? 'on' : '') + '" onclick="A.setTheme(\'' + x[0] + '\')">' + x[1] + '</button>').join('') + '</div><p class="sub" style="font-size:13px;margin-top:12px">میان‌بر: <kbd>Ctrl</kbd> + <kbd>K</kbd> برای جستجو و رفتن سریع به هر بخش.</p></div></div>' +
    '<div class="g2"><div class="glass card"><h3>اپ دانش‌آموز</h3><p class="sub" style="font-size:13px">دانش‌آموزان می‌توانند این آدرس را در مرورگر باز کنند و «نصب روی صفحه‌ی اصلی» را بزنند، یا فایل APK را نصب کنند.</p><div class="frm" style="margin:0"><input class="inp w" readonly dir="ltr" value="' + esc(url) + '" onclick="this.select()"><button class="btn" onclick="copy(\'' + esc(url) + '\')">' + ic('copy', 16) + '</button></div>' + (INFO.apk ? '<p style="margin-top:12px"><a class="btn pri" href="/class-app.apk" download>' + ic('phone', 16) + ' دانلود APK اندروید</a></p>' : '<p class="sub" style="font-size:12.5px;margin-top:12px">برای فعال‌شدن لینک دانلود APK، فایل ساخته‌شده را با نام <b dir="ltr">class-app.apk</b> در پوشه‌ی اصلی سایت آپلود کنید.</p>') + '</div>' +
    '<div class="glass card"><h3>حساب کاربری</h3><div class="fld" style="margin-bottom:8px"><label>نام کاربری</label><input class="inp" id="pu" value="' + esc(INFO.user || '') + '" autocomplete="username"></div><div class="fld" style="margin-bottom:8px"><label>رمز فعلی</label><input class="inp" type="password" id="po" autocomplete="current-password"></div><div class="fld" style="margin-bottom:8px"><label>رمز جدید (حداقل ۸ نویسه)</label><input class="inp" type="password" id="pn" autocomplete="new-password"></div><div class="fld" style="margin-bottom:12px"><label>تکرار رمز جدید</label><input class="inp" type="password" id="pn2" autocomplete="new-password"></div><button class="btn pri" onclick="A.chPass()">' + ic('key', 16) + ' تغییر رمز</button><p class="sub" style="font-size:12px;margin-top:8px">با تغییر رمز، همه‌ی نشست‌های باز دیگر بسته می‌شوند.</p></div></div>' +
    '<div class="g2"><div class="glass card"><h3>آخرین ورودهای دانش‌آموزان</h3><div class="list" id="lgl"><div class="skel"></div></div></div><div class="glass card"><h3>وضعیت سیستم</h3><div class="list">' + [['نسخه‌ی پنل', INFO.ver], ['PHP', INFO.php], ['حجم داده‌ها', INFO.size != null ? sizeFmt(INFO.size) : '—'], ['اتصال امن (HTTPS)', INFO.https ? 'فعال' : 'غیرفعال'], ['نوشتن در پوشه‌ی داده', INFO.writable ? 'سالم' : 'خطا'], ['نسخه‌های پشتیبان روی سرور', fa(INFO.backups || 0)]].map(r => '<div class="it"><span class="n sm">' + r[0] + '</span><span class="bdg" dir="ltr">' + esc(r[1] == null ? '—' : r[1]) + '</span></div>').join('') + '</div>' + (INFO.https === false ? '<p class="sub" style="font-size:12px;margin-top:8px;color:var(--y)">سایت با HTTP باز شده؛ برای امنیت بیشتر در هاست SSL فعال کنید.</p>' : '') + '</div></div>';
};
AFTER.set = async () => { const r = await api('/api/logins'); const e = $('#lgl'); if (!e) return; const l = r.status === 200 ? arr(r.data) : []; e.innerHTML = l.length ? l.slice(0, 12).map(x => '<div class="it"><span class="av ' + avc(x.n && x.n.length) + '">' + esc(initial(x.n)) + '</span><span class="n sm">' + esc(x.n) + '</span><span class="bdg">' + (x.p === 'android' ? 'اپ اندروید' : 'وب') + '</span><small class="mut">' + pdt(x.t) + '</small></div>').join('') : '<div class="empty">هنوز ورودی ثبت نشده است.</div>'; };
Object.assign(A, {
  cfg: (k, v) => { S.cfg[k] = v; save(); buildNav(); },
  cfgB: (k, v) => { S.cfg[k] = !!v; save(); toast(v ? 'فعال شد' : 'غیرفعال شد'); },
  cfgW: (k, v) => { S.cfg.w[k] = Math.max(0, Math.min(20, parseFloat(v) || 0)); save(); toast('وزن ذخیره شد'); },
  cfgPass: v => { S.cfg.pass = Math.max(1, Math.min(20, parseFloat(v) || 10)); save(); toast('ذخیره شد'); },
  chPass: async () => {
    const u = $('#pu').value.trim(), o = $('#po').value, n = $('#pn').value, n2 = $('#pn2').value;
    if (!o) { toast('رمز فعلی را وارد کنید', { err: 1 }); return; } if (n.length < 8) { toast('رمز جدید حداقل ۸ نویسه باشد', { err: 1 }); return; } if (n !== n2) { toast('تکرار رمز یکسان نیست', { err: 1 }); return; }
    const r = await api('/api/password', { body: JSON.stringify({ user: u, old: o, new: n }) });
    if (r.status === 200) { toast('رمز تغییر کرد'); await loadInfo(); render(); } else toast(r.status === 401 ? 'رمز فعلی درست نیست' : r.status === 429 ? 'تلاش‌های زیاد؛ بعداً امتحان کنید' : 'تغییر رمز ناموفق بود', { err: 1 });
  },
});

/* =====================================================================
   COMMAND PALETTE (Ctrl/Cmd + K)
   ===================================================================== */
A.pal = () => {
  if (!S || $('.pal')) return;
  const acts = PG.map(p => ({ t: p[1], k: 'برو به', ic: p[2], f: () => go(p[0]) })).concat([
    { t: 'ثبت حضور امروز', k: 'کار', ic: 'att', f: () => { ST.adate = iso(); ST.aview = 'day'; go('att'); } },
    { t: 'کوییز جدید', k: 'کار', ic: 'plus', f: () => A.newQuiz() },
    { t: 'دانلود پشتیبان', k: 'کار', ic: 'dl', f: () => A.dlBackup() },
    { t: 'تغییر تم', k: 'کار', ic: 'moon', f: () => A.theme() },
    { t: 'خروج', k: 'کار', ic: 'out', f: () => A.logout() }]);
  let sel = 0, list = [];
  const m = modal({ title: 'جستجو و دستورها', cls: 'pal', html: '<input class="inp" id="pq" placeholder="نام دانش‌آموز، بخش یا دستور…" autocomplete="off"><div class="list" id="pl" style="max-height:50vh;overflow:auto"></div>' });
  const draw = () => {
    const q = norm_fa($('#pq').value.trim());
    list = acts.filter(a => !q || norm_fa(a.t).includes(q)).slice(0, 9);
    if (q) list = list.concat(S.st.filter(s => norm_fa(s.name).includes(q) || String(s.id) === q).slice(0, 8).map(s => ({ t: s.name, k: 'دانش‌آموز', ic: 'st', f: () => A.openS(s.id) })));
    sel = Math.min(sel, Math.max(0, list.length - 1));
    $('#pl').innerHTML = list.map((a, i) => '<div class="it' + (i === sel ? ' sel' : '') + '" data-i="' + i + '" style="cursor:pointer">' + ic(a.ic, 18) + '<span class="n">' + esc(a.t) + '</span><small class="mut">' + a.k + '</small></div>').join('') || '<div class="empty">چیزی پیدا نشد.</div>';
    $$('#pl .it').forEach(e => e.onclick = () => run(+e.dataset.i));
  };
  const run = i => { const a = list[i]; if (!a) return; m.close(); setTimeout(a.f, 30); };
  const inp = $('#pq'); inp.oninput = () => { sel = 0; draw(); };
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(list.length - 1, sel + 1); draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); } else if (e.key === 'Enter') { e.preventDefault(); run(sel); } };
  draw(); inp.focus();
};
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (S && $('#lg').style.display !== 'grid') A.pal(); } });

/* =====================================================================
   START
   ===================================================================== */
/* start-up moved to panel3.js */
