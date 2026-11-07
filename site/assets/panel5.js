/* =====================================================================
   Teacher panel v6 — profile photos + grading of descriptive answers
   طراحی و توسعه: امیرعلی ساقی · 2026
   ===================================================================== */
const AV = { t: 0, s: {} };
function paintAv() {
  let st = document.getElementById('avs'); if (!st) { st = document.createElement('style'); st.id = 'avs'; document.head.appendChild(st); }
  let css = '';
  if (AV.t) css += '.av.tav{background-image:url(/api/avatar?w=t&v=' + AV.t + ')}';
  Object.keys(AV.s).forEach(id => { css += '.av.u' + id + '{background-image:url(/api/avatar?w=' + id + '&c=' + CID + '&v=' + AV.s[id] + ')}'; });
  st.textContent = css;
}
async function loadAv() {
  const r = await api('/api/avatars'); if (r.status !== 200) return;
  AV.t = +r.data.t || 0; AV.s = (r.data.s && typeof r.data.s === 'object' && !Array.isArray(r.data.s)) ? r.data.s : {};
  paintAv(); if (S && !modalOpen() && !typing()) render();
}
/* عکس را وسط‌چین و مربع می‌کند و به JPEG کوچک تبدیل می‌کند */
function shrinkImg(file, px, sq, q) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      let sw = img.width, sh = img.height, sx = 0, sy = 0, dw, dh;
      if (sq) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; dw = dh = Math.min(px, m); }
      else { const k = Math.min(1, px / Math.max(sw, sh)); dw = Math.round(sw * k); dh = Math.round(sh * k); }
      const c = document.createElement('canvas'); c.width = dw; c.height = dh;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, dw, dh); x.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
      URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', q || .85));
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad')); };
    img.src = u;
  });
}
function pickFile(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => { if (i.files && i.files[0]) cb(i.files[0]); }; i.click();
}
A.pickAv = who => pickFile(async f => {
  try {
    const img = await shrinkImg(f, 256, true, .85);
    const r = await api('/api/avatar?w=' + encodeURIComponent(who), { body: JSON.stringify({ img }) });
    if (r.status === 200) { toast('عکس پروفایل ذخیره شد'); await loadAv(); } else toast('ذخیره نشد؛ عکس دیگری امتحان کنید', { err: 1 });
  } catch (e) { toast('این فایل عکس معتبر نیست', { err: 1 }); }
});

/* ---------- تصحیح پاسخ‌های تشریحی ---------- */
A.gradeAtt = async id => {
  const r = await api('/api/attempt/detail?id=' + id);
  if (r.status !== 200) { toast('پاسخ پیدا نشد', { err: 1 }); return; }
  const d = r.data, mc = d.items.filter(x => x.k !== 'desc');
  const rows = d.items.filter(x => x.k === 'desc').map(x =>
    '<div class="glass card" style="margin-bottom:10px"><div class="lbl">سؤال</div><p style="margin:4px 0 10px;white-space:pre-wrap">' + esc(x.q) + '</p>' +
    '<div class="lbl">پاسخ دانش‌آموز</div>' + (x.x ? '<p style="margin:4px 0;white-space:pre-wrap;background:var(--fill);padding:10px 12px;border-radius:12px">' + esc(x.x) + '</p>' : '<p class="mut sm">پاسخ متنی ندارد.</p>') +
    (x.img ? '<a href="/api/upload?n=' + encodeURIComponent(x.img) + '" target="_blank" rel="noopener"><img class="avi" style="border-radius:14px;max-width:100%;max-height:340px;margin:8px 0;border:1px solid var(--gb)" src="/api/upload?n=' + encodeURIComponent(x.img) + '" alt="برگه‌ی دانش‌آموز"></a>' : '') +
    (x.e ? '<p class="mut sm" style="margin:6px 0">پاسخ نمونه: ' + esc(x.e) + '</p>' : '') +
    '<div class="frm" style="margin:8px 0 0;align-items:center"><label class="mut">نمره (از ' + fa(x.w) + ')</label><input class="inp" type="text" inputmode="decimal" dir="ltr" autocomplete="off" data-i="' + x.i + '" data-w="' + x.w + '" value="' + (x.pts == null ? '' : x.pts) + '" style="width:110px" placeholder="مثلاً ' + (x.w >= 1 ? '0.5' : '0.1') + '"><span class="mut sm" data-fb></span></div></div>').join('');
  const m = modal({ title: 'تصحیح: ' + esc(d.n), cls: 'wide', html: '<p class="mut sm" style="margin-bottom:10px">' + esc(d.title) + ' · نمره‌ی فعلی: <b>' + fmt(d.sc) + '</b> از ۲۰' + (mc.length ? ' · ' + fa(mc.length) + ' سؤال تستی خودکار تصحیح شده' : '') + '</p>' + rows + '<div class="ph acts" style="margin:12px 0 0;justify-content:flex-end"><button class="btn" data-n>بستن</button><button class="btn pri" data-s>ذخیره‌ی نمره‌ها</button></div>' });
  m.box.querySelector('[data-n]').onclick = () => m.close();
  // نمره‌ی اعشاری (مثل ۰.۱ یا ۱۷.۷۵): ارقام فارسی و «٫» هم پذیرفته می‌شود؛ بیشتر از بارم نمی‌شود
  m.box.querySelectorAll('input[data-i]').forEach(i => {
    const fb = i.parentNode.querySelector('[data-fb]');
    const chk = () => { const raw = i.value.trim(); if (!raw) { fb.textContent = ''; i.style.borderColor = ''; return; } const n = numIn(raw), w = +i.dataset.w; if (n == null) { fb.textContent = 'عدد معتبر نیست'; i.style.borderColor = 'var(--r)'; } else if (n > w) { fb.textContent = 'بیشتر از بارم؛ ' + fa(w) + ' ثبت می‌شود'; i.style.borderColor = 'var(--y)'; } else { fb.textContent = ''; i.style.borderColor = ''; } };
    i.addEventListener('input', chk); chk();
  });
  m.box.querySelector('[data-s]').onclick = async () => {
    const g = {}; let bad = null;
    m.box.querySelectorAll('input[data-i]').forEach(i => { const raw = i.value.trim(); if (!raw) { g[i.dataset.i] = ''; return; } const n = numIn(raw); if (n == null) { bad = bad || i; return; } g[i.dataset.i] = Math.round(Math.min(n, +i.dataset.w) * 100) / 100; });
    if (bad) { toast('نمره‌ی واردشده عدد معتبر نیست', { err: 1 }); bad.focus(); return; }
    const s = await api('/api/attempt/grade', { body: JSON.stringify({ id, g }) });
    if (s.status === 200) { m.close(); await loadRes(); render(); toast(s.data.pend ? 'ذخیره شد؛ هنوز سؤال تصحیح‌نشده دارد' : 'نمره‌ی نهایی آزمون: ' + fmt(s.data.sc)); }
    else toast('ذخیره نشد', { err: 1 });
  };
};
const _boot5 = typeof boot === 'function' ? boot : null;
window.addEventListener('load', () => { const t = setInterval(() => { if (typeof S !== 'undefined' && S) { clearInterval(t); loadAv(); } }, 600); setTimeout(() => clearInterval(t), 60000); });
