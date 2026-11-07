/* loginfx.js v9 — جلوه‌ها و رفتار صفحه‌ی ورود (پنل استاد + اپ دانش‌آموز)
   API عمومی:  LGFX.success() → Promise (انیمیشن موفقیت)،  LGFX.fail(msg)،  LGFX.reset() */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  var c1 = [94, 234, 212], c2 = [167, 139, 250];
  var boxes = [];

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hex(v) {
    v = (v || '').trim(); if (v[0] !== '#') return null;
    if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    var n = parseInt(v.slice(1), 16); return isNaN(n) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    c1 = hex(cs.getPropertyValue('--a')) || c1; c2 = hex(cs.getPropertyValue('--v')) || c2;
  }
  window.addEventListener('accchange', function () { setTimeout(readColors, 120); });

  var SVG = {
    arrow: '<svg class="lba" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    check: '<svg class="lbk" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    cap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/></svg>',
    ok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    bolt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>'
  };

  function toFa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }

  function init(box) {
    if (!box || box._fx) return; box._fx = 1;
    var isTeacher = box.id === 'lg';
    var card = box.querySelector('.lgc'), form = box.querySelector('.lgform'), brand = box.querySelector('.lgbrand');
    if (!card || !form) return;
    boxes.push(box);

    /* --- لایه‌ی آرورا + بوم ذرات + حلقه‌های موفقیت + نور موشواره --- */
    var old = box.querySelector('.lgbg'); if (old) old.remove();
    var aur = document.createElement('div'); aur.className = 'lgaur'; aur.setAttribute('aria-hidden', 'true'); aur.innerHTML = '<i></i><i></i><i></i>';
    box.insertBefore(aur, box.firstChild);
    var cv = box.querySelector('.lgcv'); if (cv) cv.remove();
    cv = document.createElement('canvas'); cv.className = 'lgcv'; cv.setAttribute('aria-hidden', 'true'); box.insertBefore(cv, aur.nextSibling);
    var burst = document.createElement('div'); burst.className = 'lgburst'; burst.setAttribute('aria-hidden', 'true');
    var burst2 = document.createElement('div'); burst2.className = 'lgburst b2'; burst2.setAttribute('aria-hidden', 'true');
    box.appendChild(burst); box.appendChild(burst2);
    var spot = document.createElement('i'); spot.className = 'lgspot'; spot.setAttribute('aria-hidden', 'true'); card.insertBefore(spot, card.firstChild);

    /* --- کارت‌های شناور در پنل برند (فقط دسکتاپ) --- */
    if (brand && !brand.querySelector('.lgshow')) {
      var show = document.createElement('div'); show.className = 'lgshow'; show.setAttribute('aria-hidden', 'true');
      show.innerHTML = isTeacher
        ? '<div class="sc"><span class="sci">' + SVG.ok + '</span><span><b>' + toFa(96) + '٪ حضور</b><small>امروز در کلاس</small></span></div>' +
          '<div class="sc"><span class="sci">' + SVG.chart + '</span><span><b>میانگین ' + toFa('18.5') + '</b><small>نمرات این هفته</small></span></div>' +
          '<div class="sc"><span class="dot"></span><span><b>کوییز فعال</b><small>' + toFa(12) + ' نفر آنلاین</small></span></div>'
        : '<div class="sc"><span class="sci">' + SVG.chart + '</span><span><b>نمره‌ی ' + toFa(19) + '</b><small>کوییز آخر</small></span></div>' +
          '<div class="sc"><span class="sci">' + SVG.ok + '</span><span><b>تکلیف تحویل شد</b><small>همین حالا</small></span></div>' +
          '<div class="sc"><span class="sci">' + SVG.bolt + '</span><span><b>رتبه‌ی ' + toFa(3) + '</b><small>در کلاس</small></span></div>';
      var bf = brand.querySelector('.bfoot'); brand.insertBefore(show, bf || null);
    }

    /* --- دکمه: فلش، تیک موفقیت، اسپینر --- */
    var btn = form.querySelector('.lgb,.lgx');
    if (btn && !btn.querySelector('.lbt')) {
      var label = btn.textContent.trim();
      var spn = btn.querySelector('.spn');
      btn.innerHTML = '<span class="lbt">' + label + '</span>' + SVG.arrow + (spn ? '<i class="spn"></i>' : '<i class="spn"></i>') + SVG.check;
    }

    /* --- هشدار قطعی اینترنت + راهنمای فراموشی رمز --- */
    var errEl = form.querySelector('.lgerr');
    var net = document.createElement('div'); net.className = 'lgnet'; net.textContent = 'اینترنت قطع است؛ اتصال را بررسی کن';
    if (btn) form.insertBefore(net, btn); else form.appendChild(net);
    function netState() { net.classList.toggle('on', navigator.onLine === false); }
    window.addEventListener('online', netState); window.addEventListener('offline', netState); netState();

    var fg = document.createElement('button'); fg.type = 'button'; fg.className = 'lgfg'; fg.textContent = isTeacher ? 'رمز را فراموش کرده‌اید؟' : 'رمزم را فراموش کرده‌ام';
    var fh = document.createElement('div'); fh.className = 'lgfh'; fh.hidden = true;
    fh.innerHTML = isTeacher
      ? 'رمز استاد در تنظیمات سرور (متغیر <b dir="ltr">ADMIN_PASS</b> در Railway) ثبت شده است. از ربات تلگرام هم می‌توانید رمز را عوض کنید: <b>تنظیمات ← تغییر رمز</b>.'
      : 'نام کاربری و رمز را استاد به تو می‌دهد. اگر رمز یادت رفته، از استادت بخواه از بخش «دانش‌آموزان» رمز جدید بسازد.';
    fg.setAttribute('aria-expanded', 'false');
    fg.onclick = function () { fh.hidden = !fh.hidden; fg.setAttribute('aria-expanded', String(!fh.hidden)); };
    var after = btn ? btn.nextSibling : null;
    form.insertBefore(fg, after); form.insertBefore(fh, fg.nextSibling);

    /* --- فیلدها: enterkeyhint، حالت خطا پاک شود وقتی تایپ می‌کند --- */
    var ins = form.querySelectorAll('.fxw input');
    Array.prototype.forEach.call(ins, function (inp, k) {
      inp.setAttribute('enterkeyhint', k === ins.length - 1 ? 'go' : 'next');
      inp.addEventListener('input', function () {
        var w = inp.closest('.fxw'); if (w) w.classList.remove('err');
        if (errEl && errEl.textContent && !card.classList.contains('lg-ok')) errEl.textContent = '';
      });
    });

    /* --- ورودی‌های فرم با تأخیر پلکانی وارد می‌شوند --- */
    var kids = form.children, n = 0;
    Array.prototype.forEach.call(kids, function (el) { el.style.setProperty('--i', n++); });

    /* --- رنگ‌ها، سلام بر اساس ساعت، جمله‌های چرخان --- */
    readColors();
    var g = box.querySelector('[data-greet]');
    if (g) {
      var h = new Date().getHours(), w = h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 17 ? 'ظهر بخیر' : h < 20 ? 'عصر بخیر' : 'شب بخیر';
      g.textContent = w + (g.getAttribute('data-greet') ? '، ' + g.getAttribute('data-greet') : '');
    }
    var sub = box.querySelector('[data-phr]');
    if (sub && !reduce) {
      var ph = sub.getAttribute('data-phr').split('|'), pk = 0;
      setInterval(function () {
        if (!box.offsetWidth || document.hidden) return;
        sub.classList.add('out');
        setTimeout(function () { pk = (pk + 1) % ph.length; sub.textContent = ph[pk]; sub.classList.remove('out'); }, 350);
      }, 4200);
    }

    /* --- انتخاب تم رنگی و حالت روشن/تیره --- */
    var th = box.querySelector('.lgth');
    if (th && window.accSwatches) {
      var mode, paint = function () { var l = document.documentElement.getAttribute('data-theme') === 'light'; if (mode) mode.textContent = l ? '🌙' : '☀️'; };
      var tog = function () {
        var l = document.documentElement.getAttribute('data-theme') === 'light', nx = l ? 'dark' : 'light';
        try { localStorage.setItem('theme', nx); } catch (e) { }
        document.documentElement.setAttribute('data-theme', nx); window.syncBars && window.syncBars(); paint(); setTimeout(readColors, 120);
      };
      var build = function () {
        th.innerHTML = window.accSwatches('lgAcc') + '<button type="button" class="md" id="lgMode" aria-label="تغییر حالت روشن و تیره"></button>';
        mode = th.querySelector('#lgMode'); mode.onclick = tog; paint();
      };
      window.lgAcc = function (k) { window.applyAcc(k); build(); };
      build();
    }

    /* --- ذرات: سبک، فقط وقتی صفحه دیده می‌شود --- */
    var cx = cv.getContext('2d'), W = 0, H = 0, P = [], mx = -999, my = -999, last = 0, run = false;
    function size() {
      W = cv.width = box.clientWidth; H = cv.height = box.clientHeight;
      var cap = coarse ? 26 : 46, cnt = Math.min(cap, Math.floor(W * H / 16000)); P = [];
      for (var i = 0; i < cnt; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.5 + .6 });
    }
    function draw(t) {
      if (!run) return;
      if (!box.offsetWidth || document.hidden) { setTimeout(function () { requestAnimationFrame(draw); }, 400); return; }
      requestAnimationFrame(draw);
      if (t - last < 33) return; last = t;
      if (box.clientWidth !== W || box.clientHeight !== H) size();
      cx.clearRect(0, 0, W, H);
      var i, j, a, b, d;
      for (i = 0; i < P.length; i++) {
        a = P[i]; a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1;
        cx.beginPath(); cx.arc(a.x, a.y, a.r, 0, 6.283); cx.fillStyle = rgba(c1, .7); cx.fill();
        for (j = i + 1; j < P.length; j++) {
          b = P[j]; d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 110) { cx.strokeStyle = rgba(c2, .3 * (1 - d / 110)); cx.lineWidth = 1; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
        }
        d = Math.hypot(a.x - mx, a.y - my);
        if (d < 140) { cx.strokeStyle = rgba(c1, .5 * (1 - d / 140)); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mx, my); cx.stroke(); }
      }
    }
    size(); window.addEventListener('resize', size);
    if (!reduce) { run = true; requestAnimationFrame(draw); }

    /* --- حرکت موشواره: نور روی کارت + کمی چرخش سه‌بعدی (فقط ماوس) --- */
    box.addEventListener('pointermove', function (e) {
      var r = box.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
      var cr = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - cr.left) + 'px'); card.style.setProperty('--my', (e.clientY - cr.top) + 'px');
      if (!reduce && e.pointerType === 'mouse' && box.offsetWidth > 899) {
        var x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
        card.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg'); card.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
      }
    });
    box.addEventListener('pointerleave', function () { mx = my = -999; card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }

  /* ----- API عمومی ----- */
  function active() { for (var i = 0; i < boxes.length; i++) if (boxes[i].offsetWidth) return boxes[i]; return boxes[0]; }
  window.LGFX = {
    /** انیمیشن موفقیت؛ بعد از حدود ۷۰۰ میلی‌ثانیه resolve می‌شود */
    success: function () {
      var b = active(); if (!b) return Promise.resolve();
      var c = b.querySelector('.lgc'); if (c) c.classList.add('lg-ok'); b.classList.add('lg-ok');
      if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) { }
      return new Promise(function (res) { setTimeout(res, reduce ? 0 : 720); });
    },
    /** تکان خوردن فرم، هایلایت فیلدها و لرزش گوشی */
    fail: function (msg) {
      var b = active(); if (!b) return;
      var f = b.querySelector('.lgform'), e = b.querySelector('.lgerr');
      if (e && msg != null) e.textContent = msg;
      Array.prototype.forEach.call(b.querySelectorAll('.fxw'), function (w) { w.classList.remove('err'); void w.offsetWidth; w.classList.add('err'); });
      if (f) { f.classList.remove('lg-shake'); void f.offsetWidth; f.classList.add('lg-shake'); setTimeout(function () { f.classList.remove('lg-shake'); }, 520); }
      if (navigator.vibrate) try { navigator.vibrate([40, 30, 40]); } catch (x) { }
      var inp = b.querySelector('.fxw input[type=password], .fxw input[type=text]:last-of-type');
      if (inp) { try { inp.select(); } catch (x) { } }
    },
    /** برگرداندن صفحه به حالت اول (بعد از خروج از حساب) */
    reset: function () {
      boxes.forEach(function (b) {
        b.classList.remove('lg-ok'); var c = b.querySelector('.lgc'); if (c) c.classList.remove('lg-ok');
        Array.prototype.forEach.call(b.querySelectorAll('.fxw'), function (w) { w.classList.remove('err'); });
        var e = b.querySelector('.lgerr'); if (e) e.textContent = '';
      });
    }
  };

  function go() { Array.prototype.forEach.call(document.querySelectorAll('#lg,.lgw'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
