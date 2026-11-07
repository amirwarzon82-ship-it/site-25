/* color themes shared by teacher panel, student web app and the Android app */
(function () {
  var ACC = {
    aurora: ['آرورا', '#5eead4', '#a78bfa'],
    ocean: ['اقیانوس', '#38bdf8', '#6366f1'],
    sunset: ['غروب', '#fb923c', '#ec4899'],
    forest: ['جنگل', '#4ade80', '#22d3ee'],
    rose: ['رز', '#f472b6', '#a78bfa'],
    gold: ['طلایی', '#fbbf24', '#f87171'],
    mono: ['مینیمال', '#e2e8f0', '#94a3b8']
  };
  window.ACCS = ACC;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  window.curAcc = function () { var a = get('acc'); return ACC[a] ? a : 'aurora'; };
  window.syncBars = function () {
    setTimeout(function () {
      try {
        var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        var m = document.querySelector('meta[name=theme-color]'); if (m && bg) m.setAttribute('content', bg);
        if (window.Android && Android.setBars && bg) Android.setBars(bg);
      } catch (e) { }
    }, 80);
  };
  window.applyAcc = function (k) {
    if (!ACC[k]) k = 'aurora'; set('acc', k);
    document.documentElement.setAttribute('data-acc', k);
    window.dispatchEvent(new Event('accchange')); window.syncBars();
  };
  window.accSwatches = function (fn) {
    var c = window.curAcc();
    return Object.keys(ACC).map(function (k) {
      return '<button type="button" class="acc' + (c === k ? ' on' : '') + '" style="--c1:' + ACC[k][1] + ';--c2:' + ACC[k][2] + '" title="' + ACC[k][0] + '" aria-label="تم ' + ACC[k][0] + '" onclick="' + fn + '(\'' + k + '\')"></button>';
    }).join('');
  };
  document.documentElement.setAttribute('data-acc', window.curAcc());
  window.addEventListener('load', window.syncBars);
})();
