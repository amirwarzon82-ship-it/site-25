<?php
// ربات تلگرام ادمین (استاد) — فقط توابع؛ از index.php فراخوانی می‌شود.
// ادمین‌ها از متغیر TELEGRAM_ADMIN_IDS خوانده می‌شوند (چند شناسه با کاما).

function tg_on() { return TG_TOKEN !== ''; }
function tg_admins() {
    $o = [];
    foreach (preg_split('/[\s,;،]+/u', (string)TG_ADMINS) as $x) { $x = trim(fa_digits($x)); if ($x !== '' && ctype_digit($x)) $o[] = $x; }
    return array_values(array_unique($o));
}
function tg_secret() { return substr(hash_hmac('sha256', 'tg-webhook', app_secret()), 0, 40); }
function tg_base() {
    if (PUBLIC_URL !== '') return rtrim(PUBLIC_URL, '/');
    $d = getenv('RAILWAY_PUBLIC_DOMAIN');
    if ($d) return 'https://' . $d;
    return '';
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function fa($s) { return strtr((string)$s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']); }
function num($x) { return $x === null ? '—' : fa(rtrim(rtrim(number_format((float)$x, 2, '.', ''), '0'), '.')); }

// ---------- Telegram API ----------
function tg_api($method, $params = [], $timeout = 12) {
    if (!tg_on()) return null;
    foreach ($params as $k => $v) if (is_array($v)) $params[$k] = json_encode($v, JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.telegram.org/bot' . TG_TOKEN . '/' . $method);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $params, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 5]);
    $r = curl_exec($ch); curl_close($ch);
    $j = $r ? json_decode($r, true) : null;
    return is_array($j) ? $j : null;
}
function B($t, $d, $style = null) { $b = ['text' => $t, 'callback_data' => $d]; if ($style) $b['style'] = $style; return $b; }
function KB($rows) { return ['inline_keyboard' => $rows]; }
function tg_send($chat, $text, $kb = null) {
    $p = ['chat_id' => $chat, 'text' => mb_substr($text, 0, 4000), 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($kb) $p['reply_markup'] = $kb;
    return tg_api('sendMessage', $p);
}
function tg_show($chat, $mid, $text, $kb = null) {   // ویرایش پیام قبلی؛ اگر نشد پیام جدید
    if ($mid) {
        $p = ['chat_id' => $chat, 'message_id' => $mid, 'text' => mb_substr($text, 0, 4000), 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
        if ($kb) $p['reply_markup'] = $kb;
        $r = tg_api('editMessageText', $p);
        if ($r && !empty($r['ok'])) return $r;
        if ($r && isset($r['description']) && strpos($r['description'], 'not modified') !== false) return $r;
    }
    return tg_send($chat, $text, $kb);
}
function tg_doc($chat, $path, $caption, $name = null) {
    $f = new CURLFile($path, 'application/octet-stream', $name ?: basename($path));
    return tg_api('sendDocument', ['chat_id' => $chat, 'document' => $f, 'caption' => $caption, 'parse_mode' => 'HTML'], 120);
}
function tg_set_webhook() {
    $base = tg_base();
    if (!tg_on() || $base === '') return ['ok' => false, 'description' => 'TOKEN یا آدرس سایت تنظیم نشده'];
    tg_api('setMyCommands', ['commands' => [['command' => 'start', 'description' => 'منوی اصلی'], ['command' => 'menu', 'description' => 'منوی اصلی'], ['command' => 'cancel', 'description' => 'لغو کار جاری']]]);
    return tg_api('setWebhook', ['url' => $base . '/tg/' . tg_secret(), 'secret_token' => tg_secret(), 'allowed_updates' => ['message', 'callback_query'], 'max_connections' => 10]);
}

// ---------- bot state file ----------
function tg_cfg() {
    global $DIR; $r = read_json($DIR . '/tg.json', []);
    foreach (['cls', 'st', 'mute', 'jobs', 'apk'] as $k) if (!isset($r[$k]) || !is_array($r[$k])) $r[$k] = [];
    return $r;
}
function tg_cfg_mut($fn) {
    global $DIR;
    return with_lock('tg', function () use ($fn, $DIR) {
        $r = read_json($DIR . '/tg.json', []);
        foreach (['cls', 'st', 'mute', 'jobs', 'apk'] as $k) if (!isset($r[$k]) || !is_array($r[$k])) $r[$k] = [];
        $x = $fn($r);
        write_raw($DIR . '/tg.json', json_encode($r, JSON_UNESCAPED_UNICODE));
        return $x;
    });
}
function tg_cur($chat) { $c = tg_cfg(); $reg = cls_reg(); $v = isset($c['cls'][$chat]) ? (int)$c['cls'][$chat] : 0; return in_array($v, $reg['ids'], true) ? $v : $reg['ids'][0]; }
function tg_step($chat, $s = null, $d = null) {
    tg_cfg_mut(function (&$r) use ($chat, $s, $d) { if ($s === null) unset($r['st'][$chat]); else $r['st'][$chat] = ['s' => $s, 'd' => $d]; });
}

// ---------- data helpers ----------
function tg_objfix(&$d) {
    foreach (['att', 'cfg'] as $k) if (isset($d[$k]) && is_array($d[$k]) && !count($d[$k])) $d[$k] = new stdClass();
    if (isset($d['att']) && is_array($d['att'])) foreach ($d['att'] as $k => $v) if (is_array($v) && !count($v)) unset($d['att'][$k]);
    if (isset($d['cfg']) && is_array($d['cfg']) && isset($d['cfg']['w']) && is_array($d['cfg']['w']) && !count($d['cfg']['w'])) $d['cfg']['w'] = new stdClass();
    foreach ($d['gr'] as $c => $g) foreach ($g['items'] as $i => $it) if (isset($it['sc']) && is_array($it['sc']) && !count($it['sc'])) $d['gr'][$c]['items'][$i]['sc'] = new stdClass();
    foreach ($d['st'] as $i => $s) if (is_array($s) && isset($s['badges']) && is_array($s['badges']) && !count($s['badges'])) unset($d['st'][$i]['badges']);
}
function tg_mut($cid, $fn) {
    return with_lock('state', function () use ($cid, $fn) {
        use_class($cid); $d = load_state();
        $mx = 0; foreach ($d['st'] as $x) if (is_array($x) && isset($x['id'])) $mx = max($mx, (int)$x['id']); if (!isset($d['nid']) || (int)$d['nid'] <= $mx) $d['nid'] = $mx + 1;
        $res = $fn($d);
        tg_objfix($d);
        $d['rev'] = (isset($d['rev']) ? (int)$d['rev'] : 0) + 1;
        write_raw(p_state($cid), enc($d));
        return $res;
    });
}
function tg_read($cid) { use_class($cid); $d = load_state(); $r = res_load(); apply_links($d, $r); return [$d, $r]; }
function tg_clsname($cid) { use_class($cid); $d = load_state(); $c = cfg_of($d); return (string)$c['cls']; }
function tg_today() { $t = new DateTime('now', new DateTimeZone('Asia/Tehran')); return $t->format('Y-m-d'); }
function tg_shamsi($ts) { return fa(date('H:i', (int)($ts / 1000) + 12600)); }
function tg_sname($d, $sid) { $s = find_student($d, $sid); return $s ? (string)$s['name'] : '؟'; }

// ---------- push notifications to admins ----------
function tg_push($kind, $text, $sid, $name, $cid) {
    if (!tg_on()) return;
    $ic = ['login' => '🟢', 'login_fail' => '🔴', 'quiz_start' => '📝', 'quiz_done' => '✅', 'poll' => '📊', 'hw' => '📚', 'msg' => '💬'];
    $cf = tg_cfg(); $adm = tg_admins(); if (!$adm) return;
    $cn = ''; if (count(cls_reg()['ids']) > 1) { $cn = ' <i>(' . h(tg_clsname($cid)) . ')</i>'; use_class($cid); }
    $kb = null;
    if ($kind === 'msg') $kb = KB([[B('📥 باز کردن پیام‌ها', 'i', 'primary')]]);
    elseif ($kind === 'hw') $kb = KB([[B('📚 تکالیف', 'w', 'primary')]]);
    elseif ($kind === 'quiz_done') $kb = KB([[B('📝 تصحیح تشریحی‌ها', 'q:gp', 'success')]]);
    foreach ($adm as $a) {
        if (!empty($cf['mute'][$a])) continue;
        if ($kind === 'login' && !empty($cf['mute'][$a . 'l'])) continue;
        $p = ['chat_id' => $a, 'text' => ($ic[$kind] ?? '🔔') . ' ' . ($name !== '' ? '<b>' . h($name) . '</b> ' : '') . h($text) . $cn, 'parse_mode' => 'HTML'];
        if ($kb) $p['reply_markup'] = json_encode($kb, JSON_UNESCAPED_UNICODE);
        tg_api('sendMessage', $p, 3);
    }
}

// ---------- entry ----------
function tg_webhook($key) {
    if (!tg_on() || !hash_equals(tg_secret(), (string)$key)) { http_response_code(404); exit; }
    $hs = isset($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN']) ? $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] : '';
    if (!hash_equals(tg_secret(), $hs)) { http_response_code(403); exit; }
    $u = json_decode(file_get_contents('php://input'), true);
    http_response_code(200); header('Content-Type: application/json'); echo '{"ok":true}';
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { @ob_flush(); @flush(); }
    if (!is_array($u)) exit;
    try { tg_update($u); } catch (Throwable $e) { error_log('tg: ' . $e->getMessage()); }
    exit;
}
function tg_update($u) {
    $adm = tg_admins();
    if (isset($u['callback_query'])) {
        $q = $u['callback_query']; $from = (string)$q['from']['id']; $chat = (string)$q['message']['chat']['id'];
        if (!in_array($from, $adm, true)) { tg_api('answerCallbackQuery', ['callback_query_id' => $q['id'], 'text' => 'دسترسی ندارید', 'show_alert' => true]); return; }
        tg_api('answerCallbackQuery', ['callback_query_id' => $q['id']]);
        tg_cb($chat, (int)$q['message']['message_id'], (string)$q['data']);
        return;
    }
    if (!isset($u['message'])) return;
    $m = $u['message']; $from = isset($m['from']['id']) ? (string)$m['from']['id'] : ''; $chat = (string)$m['chat']['id'];
    if (!in_array($from, $adm, true)) {
        tg_send($chat, "⛔️ این ربات فقط مخصوص استاد است.\nشناسه‌ی عددی شما: <code>" . h($from) . "</code>\n(اگر استاد هستید این عدد را در متغیر <code>TELEGRAM_ADMIN_IDS</code> بگذارید.)");
        return;
    }
    $text = isset($m['text']) ? trim($m['text']) : '';
    if ($text === '/start' || $text === '/menu' || $text === 'منو') { tg_step($chat); tg_menu($chat, 0); return; }
    if ($text === '/cancel') { tg_step($chat); tg_send($chat, 'لغو شد.', KB([[B('🏠 منوی اصلی', 'm', 'primary')]])); return; }
    $cf = tg_cfg(); $st = isset($cf['st'][$chat]) ? $cf['st'][$chat] : null;
    if ($st) { tg_input($chat, $st, $m); return; }
    tg_menu($chat, 0);
}

// ---------- screens ----------
function tg_menu($chat, $mid) {
    $cid = tg_cur($chat); list($d, $r) = tg_read($cid); $cfg = cfg_of($d);
    $n = now_ms(); $on = 0; $sn = read_json($GLOBALS['SEEN'], []);
    foreach ($d['st'] as $s) if (is_array($s) && isset($sn[$cid . '-' . $s['id']]) && $n - $sn[$cid . '-' . $s['id']] < 120000) $on++;
    $pend = 0; foreach ($r['a'] as $a) if (!empty($a['pend']) && $a['st'] !== 'run') $pend++;
    $un = tg_unread($cid);
    $t = "🎓 <b>پنل استاد</b>\n" . h($cfg['school']) . ' — ' . h($cfg['cls']) . "\n\n👥 دانش‌آموز: " . fa(count($d['st'])) . '   🟢 آنلاین: ' . fa($on) . "\n💬 پیام خوانده‌نشده: " . fa($un) . '   📝 منتظر تصحیح: ' . fa($pend) . "\n\nیک بخش را انتخاب کنید:";
    $kb = KB([
        [B('📊 داشبورد', 'd', 'primary'), B('🏫 کلاس‌ها', 'c', 'primary')],
        [B('👥 دانش‌آموزان', 's', 'success'), B('✅ حضور و غیاب', 'a', 'success')],
        [B('📝 نمرات', 'g', 'success'), B('🧩 کوییزها', 'q', 'success')],
        [B('📢 اطلاعیه‌ها', 'n', 'primary'), B('📚 تکالیف', 'w', 'primary')],
        [B('💬 پیام‌ها' . ($un ? ' (' . fa($un) . ')' : ''), 'i', $un ? 'danger' : 'primary'), B('🔔 فعالیت‌ها', 'f', 'primary')],
        [B('💾 پشتیبان‌گیری', 'b', 'success'), B('⚙️ تنظیمات', 'o', 'primary')],
        [B('📱 ساخت اپ اندروید', 'p', 'danger')],
    ]);
    tg_show($chat, $mid, $t, $kb);
}
function tg_unread($cid) {
    use_class($cid); $mr = msg_load(); $last = [];
    foreach ($mr['m'] as $x) $last[(int)$x['sid']] = $x;
    $n = 0; foreach ($last as $x) if ($x['from'] === 's') $n++;
    return $n;
}
function tg_back($extra = []) { return KB(array_merge($extra, [[B('🏠 منوی اصلی', 'm', 'primary')]])); }

function tg_cb($chat, $mid, $data) {
    $p = explode(':', $data); $a = $p[0]; $cid = tg_cur($chat);
    switch ($a) {
        case 'm': tg_step($chat); tg_menu($chat, $mid); return;
        case 'd': return tg_dash($chat, $mid, $cid);
        case 'c': return tg_classes($chat, $mid, $p);
        case 's': return tg_students($chat, $mid, $cid, $p);
        case 'a': return tg_att($chat, $mid, $cid, $p);
        case 'g': return tg_grades($chat, $mid, $cid, $p);
        case 'q': return tg_quiz($chat, $mid, $cid, $p);
        case 'n': return tg_ann($chat, $mid, $cid, $p);
        case 'w': return tg_hw($chat, $mid, $cid, $p);
        case 'i': return tg_inbox($chat, $mid, $cid, $p);
        case 'f': return tg_feed($chat, $mid);
        case 'b': return tg_backup($chat, $mid, $p);
        case 'o': return tg_settings($chat, $mid, $cid, $p);
        case 'p': return tg_apk($chat, $mid, $p);
    }
    tg_menu($chat, $mid);
}

function tg_dash($chat, $mid, $cid) {
    list($d, $r) = tg_read($cid); $cfg = cfg_of($d);
    $day = $d['att'][tg_today()] ?? []; $c = ['p' => 0, 'a' => 0, 'l' => 0]; foreach ($day as $v) if (isset($c[$v])) $c[$v]++;
    $all = []; foreach ($d['st'] as $s) { $f = final_of($d, $s['id']); if ($f !== null) $all[] = $f; }
    $t = "📊 <b>داشبورد " . h($cfg['cls']) . "</b>\n\n👥 دانش‌آموزان: " . fa(count($d['st'])) . "\n🧩 کوییز: " . fa(count($d['quizzes'])) . '   📚 تکلیف: ' . fa(count($d['hw'])) . '   📢 اطلاعیه: ' . fa(count($d['ann'])) .
        "\n\n✅ حضور امروز: " . fa($c['p']) . '   ❌ غایب: ' . fa($c['a']) . '   ⏰ تأخیر: ' . fa($c['l']) . "\n📈 میانگین نمره‌ی نهایی کلاس: <b>" . num(avg_of($all)) . "</b> از ۲۰\n💬 پیام خوانده‌نشده: " . fa(tg_unread($cid));
    tg_show($chat, $mid, $t, tg_back([[B('🔄 تازه‌سازی', 'd', 'success')]]));
}
function tg_classes($chat, $mid, $p) {
    if (isset($p[1])) { $id = (int)$p[1]; tg_cfg_mut(function (&$r) use ($chat, $id) { $r['cls'][$chat] = $id; }); return tg_menu($chat, $mid); }
    $reg = cls_reg(); $rows = []; $cur = tg_cur($chat);
    foreach ($reg['ids'] as $c) $rows[] = [B(($c == $cur ? '✅ ' : '🏫 ') . tg_clsname($c), 'c:' . $c, $c == $cur ? 'success' : 'primary')];
    tg_show($chat, $mid, "🏫 <b>کلاس‌ها</b>\nکلاسی که می‌خواهید مدیریت کنید را انتخاب کنید:", tg_back($rows));
}

// ----- students -----
function tg_students($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l';
    if ($sub === 'l') {
        list($d) = tg_read($cid); $rows = []; $sn = read_json($GLOBALS['SEEN'], []); $n = now_ms();
        foreach ($d['st'] as $s) { $on = isset($sn[$cid . '-' . $s['id']]) && $n - $sn[$cid . '-' . $s['id']] < 120000; $rows[] = [B(($on ? '🟢 ' : (!empty($s['off']) ? '⛔️ ' : '👤 ')) . $s['name'], 's:i:' . $s['id'])]; }
        $rows[] = [B('➕ افزودن دانش‌آموز', 's:a', 'success')];
        return tg_show($chat, $mid, "👥 <b>دانش‌آموزان</b> (" . fa(count($d['st'])) . ")\n🟢 آنلاین  ⛔️ مسدود", tg_back($rows));
    }
    if ($sub === 'a') { tg_step($chat, 'stadd', ['c' => $cid]); return tg_show($chat, $mid, "➕ نام دانش‌آموز (یا چند نام، هر کدام در یک خط) را بفرستید.\nنام کاربری و رمز خودکار ساخته می‌شود.\n\n/cancel برای لغو", null); }
    $id = (int)($p[2] ?? 0);
    if ($sub === 'i') {
        list($d, $r) = tg_read($cid); $s = find_student($d, $id); if (!$s) return tg_students($chat, $mid, $cid, ['s', 'l']);
        $ac = att_counts($d, $id); $tot = $ac['p'] + $ac['a'] + $ac['l'];
        $t = "👤 <b>" . h($s['name']) . "</b>" . (!empty($s['off']) ? ' ⛔️ مسدود' : '') . "\n\n🔑 نام کاربری: <code>" . h($s['user'] ?? '') . "</code>\n🔐 رمز: <code>" . h($s['code'] ?? '') . "</code>\n\n";
        foreach (['quiz' => 'کوییز', 'cont' => 'مستمر', 'exam' => 'آزمون', 'hw' => 'تمرین'] as $k => $nm) $t .= '• ' . $nm . ': ' . num(avg_of(scores_of($d, $k, $id))) . "\n";
        $t .= "\n📈 نمره‌ی نهایی: <b>" . num(final_of($d, $id)) . "</b>\n✅ حضور: " . fa($ac['p']) . ' از ' . fa($tot) . '   ⭐ امتیاز: ' . num(pts_of($d, $id));
        $kb = [[B(!empty($s['off']) ? '✅ رفع مسدودی' : '⛔️ مسدود کردن', 's:t:' . $id, !empty($s['off']) ? 'success' : 'danger'), B('🔄 رمز جدید', 's:r:' . $id, 'primary')], [B('🗑 حذف', 's:x:' . $id, 'danger'), B('⬅️ لیست', 's:l')]];
        return tg_show($chat, $mid, $t, tg_back($kb));
    }
    if ($sub === 't') { tg_mut($cid, function (&$d) use ($id) { foreach ($d['st'] as $i => $s) if ((int)$s['id'] === $id) { if (!empty($s['off'])) unset($d['st'][$i]['off']); else $d['st'][$i]['off'] = 1; } }); return tg_students($chat, $mid, $cid, ['s', 'i', $id]); }
    if ($sub === 'r') { tg_mut($cid, function (&$d) use ($id) { foreach ($d['st'] as $i => $s) if ((int)$s['id'] === $id) $d['st'][$i]['code'] = (string)random_int(100000, 999999); }); return tg_students($chat, $mid, $cid, ['s', 'i', $id]); }
    if ($sub === 'x') return tg_show($chat, $mid, '⚠️ حذف دانش‌آموز و همه‌ی نمره‌هایش؟ این کار برگشت ندارد.', KB([[B('🗑 بله، حذف شود', 's:X:' . $id, 'danger'), B('انصراف', 's:i:' . $id, 'success')]]));
    if ($sub === 'X') {
        tg_mut($cid, function (&$d) use ($id) {
            $d['st'] = array_values(array_filter($d['st'], function ($s) use ($id) { return (int)$s['id'] !== $id; }));
            foreach ($d['att'] as $k => $day) unset($d['att'][$k][$id]);
            $d['pts'] = array_values(array_filter($d['pts'], function ($x) use ($id) { return (int)$x['sid'] !== $id; }));
            foreach ($d['gr'] as $c => $g) foreach ($g['items'] as $i => $it) unset($d['gr'][$c]['items'][$i]['sc'][$id]);
        });
        return tg_students($chat, $mid, $cid, ['s', 'l']);
    }
}

// ----- attendance -----
function tg_att($chat, $mid, $cid, $p) {
    $day = tg_today(); $sub = $p[1] ?? 'l';
    if ($sub === 'c') { $id = (int)$p[2]; tg_mut($cid, function (&$d) use ($id, $day) { $o = ['', 'p', 'a', 'l']; $cur = $d['att'][$day][$id] ?? ''; $n = $o[(array_search($cur, $o) + 1) % 4]; if ($n === '') unset($d['att'][$day][$id]); else $d['att'][$day][$id] = $n; }); }
    if ($sub === 'all') tg_mut($cid, function (&$d) use ($day) { foreach ($d['st'] as $s) $d['att'][$day][$s['id']] = 'p'; });
    if ($sub === 'clr') tg_mut($cid, function (&$d) use ($day) { unset($d['att'][$day]); });
    list($d) = tg_read($cid); $rows = []; $m = ['' => '▫️', 'p' => '✅', 'a' => '❌', 'l' => '⏰']; $cnt = ['p' => 0, 'a' => 0, 'l' => 0];
    foreach ($d['st'] as $s) { $v = $d['att'][$day][$s['id']] ?? ''; if ($v) $cnt[$v]++; $rows[] = [B($m[$v] . ' ' . $s['name'], 'a:c:' . $s['id'], $v === 'p' ? 'success' : ($v === 'a' ? 'danger' : ($v === 'l' ? 'primary' : null)))]; }
    array_unshift($rows, [B('✅ همه حاضر', 'a:all', 'success'), B('🧹 پاک‌کردن', 'a:clr', 'danger')]);
    tg_show($chat, $mid, "✅ <b>حضور و غیاب امروز</b> (" . fa($day) . ")\nروی نام بزنید: ▫️ ← ✅ حاضر ← ❌ غایب ← ⏰ تأخیر\n\nحاضر " . fa($cnt['p']) . ' · غایب ' . fa($cnt['a']) . ' · تأخیر ' . fa($cnt['l']), tg_back($rows));
}

// ----- grades -----
function tg_grades($chat, $mid, $cid, $p) {
    global $CATS; $sub = $p[1] ?? 'l';
    if ($sub === 'l') {
        $rows = []; foreach ($CATS as $k => $nm) $rows[] = [B('📂 ' . $nm, 'g:c:' . $k, 'primary')];
        $rows[] = [B('📈 جدول نمره‌ی نهایی', 'g:f', 'success')];
        return tg_show($chat, $mid, "📝 <b>نمرات</b>\nیک دسته را انتخاب کنید:", tg_back($rows));
    }
    if ($sub === 'f') {
        list($d) = tg_read($cid); $t = "📈 <b>نمره‌ی نهایی</b>\n\n"; $rows = [];
        foreach ($d['st'] as $s) $rows[] = [$s['name'], final_of($d, $s['id'])];
        usort($rows, function ($a, $b) { return ($b[1] ?? -1) <=> ($a[1] ?? -1); });
        foreach ($rows as $i => $x) $t .= fa($i + 1) . '. ' . h($x[0]) . ' — <b>' . num($x[1]) . "</b>\n";
        return tg_show($chat, $mid, $t, tg_back([[B('⬅️ نمرات', 'g')]]));
    }
    $cat = $p[2] ?? 'quiz'; if (!isset($CATS[$cat])) $cat = 'quiz';
    if ($sub === 'c') {
        list($d) = tg_read($cid); $rows = [];
        foreach ($d['gr'][$cat]['items'] as $it) $rows[] = [B(($it['qz'] ?? 0 ? '🧩 ' : '📄 ') . $it['t'], 'g:i:' . $cat . ':' . $it['id'])];
        $rows[] = [B('➕ ستون جدید', 'g:n:' . $cat, 'success'), B('⬅️ نمرات', 'g')];
        return tg_show($chat, $mid, '📂 <b>' . h($CATS[$cat]) . '</b> — یک ستون را انتخاب کنید', tg_back($rows));
    }
    if ($sub === 'n') { tg_step($chat, 'gnew', ['c' => $cid, 'cat' => $cat]); return tg_show($chat, $mid, "➕ عنوان ستون جدید (مثلاً «آزمون فصل ۲») را بفرستید.\n\n/cancel برای لغو"); }
    $iid = (int)($p[3] ?? 0);
    if ($sub === 'i') {
        list($d) = tg_read($cid); $it = null; foreach ($d['gr'][$cat]['items'] as $x) if ((int)$x['id'] === $iid) $it = $x; if (!$it) return tg_grades($chat, $mid, $cid, ['g', 'c', $cat]);
        $t = '📄 <b>' . h($it['t']) . "</b> (" . h($CATS[$cat]) . ")\n\n"; $v = [];
        foreach ($d['st'] as $s) { $x = $it['sc'][$s['id']] ?? ''; $t .= h($s['name']) . ': <b>' . ($x === '' ? '—' : num($x)) . "</b>\n"; if ($x !== '') $v[] = (float)$x; }
        $t .= "\nمیانگین: <b>" . num(avg_of($v)) . '</b>' . (!empty($it['qz']) ? "\n🔗 نمره‌ها خودکار از کوییز می‌آیند." : '');
        $kb = []; if (empty($it['qz'])) $kb[] = [B('✍️ ورود نمره‌ها', 'g:s:' . $cat . ':' . $iid, 'success')];
        $kb[] = [B('⬅️ ستون‌ها', 'g:c:' . $cat)];
        return tg_show($chat, $mid, $t, tg_back($kb));
    }
    if ($sub === 's') { list($d) = tg_read($cid); if (!$d['st']) return tg_show($chat, $mid, 'دانش‌آموزی نیست.', tg_back()); tg_step($chat, 'gseq', ['c' => $cid, 'cat' => $cat, 'it' => $iid, 'i' => 0]); return tg_gseq($chat, $mid); }
    if ($sub === 'k') {   // رد کردن در ورود ترتیبی
        $cf = tg_cfg(); $st = $cf['st'][$chat] ?? null; if (!$st || $st['s'] !== 'gseq') return tg_menu($chat, $mid);
        $st['d']['i']++; tg_step($chat, 'gseq', $st['d']); return tg_gseq($chat, $mid);
    }
}
function tg_gseq($chat, $mid) {
    $cf = tg_cfg(); $st = $cf['st'][$chat]; $dd = $st['d']; list($d) = tg_read($dd['c']);
    if (!isset($d['st'][$dd['i']])) { tg_step($chat); return tg_show($chat, $mid, '✅ ورود نمره‌ها تمام شد.', tg_back([[B('📝 نمرات', 'g', 'success')]])); }
    $s = $d['st'][$dd['i']]; $cur = '—'; foreach ($d['gr'][$dd['cat']]['items'] as $it) if ((int)$it['id'] === (int)$dd['it']) $cur = isset($it['sc'][$s['id']]) ? num($it['sc'][$s['id']]) : '—';
    tg_show($chat, $mid, '✍️ نمره‌ی <b>' . h($s['name']) . '</b> را بفرستید (۰ تا ۲۰)\nنمره‌ی فعلی: ' . $cur . "\n" . fa($dd['i'] + 1) . ' از ' . fa(count($d['st'])), KB([[B('⏭ رد شدن', 'g:k:' . $dd['cat'] . ':' . $dd['it'], 'primary'), B('✖️ پایان', 'm', 'danger')]]));
}

// ----- quizzes -----
function tg_quiz($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l'; list($d, $r) = tg_read($cid);
    if ($sub === 'l') {
        $rows = []; foreach (array_slice(array_reverse($d['quizzes']), 0, 12) as $q) $rows[] = [B((qz_on($q) ? '🟢 ' : '⚪️ ') . $q['t'], 'q:i:' . $q['id'])];
        $rows[] = [B('📝 تصحیح پاسخ‌های تشریحی', 'q:gp', 'success')];
        return tg_show($chat, $mid, "🧩 <b>کوییزها</b>\n🟢 فعال  ⚪️ غیرفعال\n(ساخت کوییز از پنل وب انجام می‌شود)", tg_back($rows));
    }
    if ($sub === 'gp') {   // لیست منتظر تصحیح
        $rows = []; foreach ($r['a'] as $a) if (!empty($a['pend']) && $a['st'] !== 'run') { $q = find_quiz($d, $a['qid']); $rows[] = [B('📝 ' . $a['n'] . ' — ' . ($q ? $q['t'] : '؟'), 'q:ga:' . $a['id'], 'danger')]; }
        $rows = array_slice($rows, 0, 30);
        return tg_show($chat, $mid, $rows ? '📝 <b>منتظر تصحیح</b> (' . fa(count($rows)) . ')' : '✅ پاسخ تشریحی منتظر تصحیحی نیست.', tg_back(array_merge($rows, [[B('⬅️ کوییزها', 'q')]])));
    }
    if ($sub === 'ga') {
        $aid = (int)$p[2]; $a = null; foreach ($r['a'] as $x) if ((int)$x['id'] === $aid) $a = $x; if (!$a) return tg_quiz($chat, $mid, $cid, ['q', 'gp']);
        $q = find_quiz($d, $a['qid']); if (!$q) return tg_quiz($chat, $mid, $cid, ['q', 'gp']);
        $rows = []; $t = '📝 <b>' . h($a['n']) . '</b> — ' . h($q['t']) . "\nنمره‌ی فعلی: " . num($a['sc']) . " از ۲۰\n\n";
        foreach ($a['qo'] as $orig) {
            $qq = $q['qs'][$orig] ?? null; if (!$qq || !is_desc($qq)) continue; $da = $a['da'][$orig] ?? []; $g = $a['gd'][$orig] ?? null;
            $t .= '❓ ' . h(mb_substr($qq['q'], 0, 200)) . "\n✍️ " . (!empty($da['x']) ? h(mb_substr($da['x'], 0, 600)) : '<i>(متن ندارد)</i>') . (!empty($da['img']) ? "\n🖼 عکس برگه در پیام بعد" : '') . "\n🎯 نمره: " . ($g === null ? 'تصحیح نشده' : num($g)) . ' از ' . num(qw($qq)) . "\n\n";
            $rows[] = [B('🎯 نمره‌ی «' . mb_substr($qq['q'], 0, 18) . '»', 'q:gs:' . $aid . ':' . $orig, 'success')];
        }
        tg_show($chat, $mid, $t, tg_back(array_merge($rows, [[B('⬅️ لیست', 'q:gp')]])));
        foreach ($a['qo'] as $orig) { $da = $a['da'][$orig] ?? []; if (!empty($da['img']) && up_valid($da['img']) && is_file(up_dir() . '/' . $da['img'])) tg_api('sendPhoto', ['chat_id' => $chat, 'photo' => new CURLFile(up_dir() . '/' . $da['img'], 'image/jpeg', 'answer.jpg'), 'caption' => 'پاسخ ' . $a['n']], 60); }
        return;
    }
    if ($sub === 'gs') { tg_step($chat, 'qsc', ['c' => $cid, 'aid' => (int)$p[2], 'o' => (int)$p[3]]); return tg_send($chat, "🎯 نمره‌ی این سؤال را بفرستید (عدد).\n/cancel برای لغو"); }
    $id = (int)($p[2] ?? 0); $q = find_quiz($d, $id);
    if (!$q) return tg_quiz($chat, $mid, $cid, ['q', 'l']);
    if ($sub === 't') { tg_mut($cid, function (&$dd) use ($id) { foreach ($dd['quizzes'] as $i => $x) if ((int)$x['id'] === $id) $dd['quizzes'][$i]['on'] = !qz_on($x); }); return tg_quiz($chat, $mid, $cid, ['q', 'i', $id]); }
    if ($sub === 'r') {
        $best = []; foreach ($r['a'] as $a) if ((int)$a['qid'] === $id && $a['st'] !== 'run') { $s = (int)$a['sid']; if (!isset($best[$s]) || $a['sc'] > $best[$s]['sc']) $best[$s] = $a; }
        uasort($best, function ($x, $y) { return $y['sc'] <=> $x['sc']; }); $t = '📊 <b>نتایج ' . h($q['t']) . "</b>\n\n"; $i = 0;
        foreach ($best as $a) $t .= fa(++$i) . '. ' . h($a['n']) . ' — <b>' . num($a['sc']) . '</b>' . (!empty($a['pend']) ? ' ⏳' : '') . "\n";
        if (!$best) $t .= 'هنوز کسی شرکت نکرده.';
        return tg_show($chat, $mid, $t, tg_back([[B('⬅️ کوییز', 'q:i:' . $id)]]));
    }
    $att = 0; foreach ($r['a'] as $a) if ((int)$a['qid'] === $id && $a['st'] !== 'run') $att++;
    $t = '🧩 <b>' . h($q['t']) . "</b>\n\nوضعیت: " . (qz_on($q) ? '🟢 فعال' : '⚪️ غیرفعال') . "\nسؤال: " . fa(count($q['qs'])) . '   زمان: ' . fa((int)$q['m']) . " دقیقه\nشرکت‌کننده: " . fa($att);
    tg_show($chat, $mid, $t, tg_back([[B(qz_on($q) ? '⏸ غیرفعال کن' : '▶️ فعال کن', 'q:t:' . $id, qz_on($q) ? 'danger' : 'success'), B('📊 نتایج', 'q:r:' . $id, 'primary')], [B('⬅️ کوییزها', 'q')]]));
}

// ----- announcements -----
function tg_ann($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l'; $id = (int)($p[2] ?? 0);
    if ($sub === 'new') { tg_step($chat, 'annt', ['c' => $cid]); return tg_show($chat, $mid, "📢 عنوان اطلاعیه را بفرستید.\n/cancel برای لغو"); }
    if ($sub === 'p') tg_mut($cid, function (&$d) use ($id) { foreach ($d['ann'] as $i => $x) if ((int)$x['id'] === $id) $d['ann'][$i]['pin'] = empty($x['pin']); });
    if ($sub === 'h') tg_mut($cid, function (&$d) use ($id) { foreach ($d['ann'] as $i => $x) if ((int)$x['id'] === $id) $d['ann'][$i]['hide'] = empty($x['hide']); });
    if ($sub === 'd') tg_mut($cid, function (&$d) use ($id) { $d['ann'] = array_values(array_filter($d['ann'], function ($x) use ($id) { return (int)$x['id'] !== $id; })); });
    list($d) = tg_read($cid); $rows = []; $t = "📢 <b>اطلاعیه‌ها</b>\n\n";
    foreach (array_slice(array_reverse($d['ann']), 0, 8) as $x) {
        $t .= (!empty($x['pin']) ? '📌 ' : '') . (!empty($x['hide']) ? '🙈 ' : '') . '<b>' . h($x['t']) . "</b>\n";
        $rows[] = [B(!empty($x['pin']) ? '📍 برداشتن سنجاق' : '📌 سنجاق', 'n:p:' . $x['id'], 'primary'), B(!empty($x['hide']) ? '👁 نمایش' : '🙈 پنهان', 'n:h:' . $x['id']), B('🗑', 'n:d:' . $x['id'], 'danger')];
    }
    array_unshift($rows, [B('➕ اطلاعیه‌ی جدید', 'n:new', 'success')]);
    tg_show($chat, $mid, $t, tg_back($rows));
}

// ----- homework -----
function tg_hw($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l'; use_class($cid); list($d) = tg_read($cid); $hr = hw_load();
    if ($sub === 'l') {
        $rows = []; foreach (array_slice(array_reverse($d['hw']), 0, 12) as $h) { $n = 0; foreach ($hr['r'] as $x) if ((int)$x['hid'] === (int)$h['id']) $n++; $rows[] = [B('📚 ' . $h['t'] . ' (' . fa($n) . '/' . fa(count($d['st'])) . ')', 'w:i:' . $h['id'])]; }
        return tg_show($chat, $mid, "📚 <b>تکالیف</b>\n(تعریف تکلیف جدید از پنل وب انجام می‌شود)", tg_back($rows));
    }
    if ($sub === 'i') {
        $hid = (int)$p[2]; $rows = []; $t = '';
        foreach ($d['hw'] as $h) if ((int)$h['id'] === $hid) $t = '📚 <b>' . h($h['t']) . "</b>\n\n";
        foreach ($hr['r'] as $x) if ((int)$x['hid'] === $hid) $rows[] = [B(($x['sc'] !== null ? '✅ ' : '⏳ ') . tg_sname($d, $x['sid']) . ($x['sc'] !== null ? ' — ' . num($x['sc']) : ''), 'w:s:' . $x['id'], $x['sc'] === null ? 'primary' : 'success')];
        return tg_show($chat, $mid, $t . ($rows ? 'تحویل‌ها:' : 'هنوز تحویلی نیست.'), tg_back(array_merge($rows, [[B('⬅️ تکالیف', 'w')]])));
    }
    $sid2 = (int)$p[2]; $sb = null; foreach ($hr['r'] as $x) if ((int)$x['id'] === $sid2) $sb = $x; if (!$sb) return tg_hw($chat, $mid, $cid, ['w', 'l']);
    if ($sub === 'sc') { tg_step($chat, 'hwsc', ['c' => $cid, 'id' => $sid2]); return tg_send($chat, "🎯 نمره‌ی تکلیف را بفرستید (۰ تا ۲۰). اگر بعدش یک خط بازخورد بنویسید هم ثبت می‌شود، مثلاً:\n<code>18 آفرین، فقط ریسپانسیو را کامل کن</code>\n/cancel برای لغو"); }
    tg_show($chat, $mid, '📚 <b>' . h(tg_sname($d, $sb['sid'])) . "</b>" . (!empty($sb['late']) ? ' ⏰ با تأخیر' : '') . "\n\n" . h($sb['x']) . "\n\n🎯 نمره: " . ($sb['sc'] === null ? '—' : num($sb['sc'])) . (!empty($sb['f']) ? "\n💬 " . h($sb['f']) : ''), tg_back([[B('🎯 ثبت نمره', 'w:sc:' . $sid2, 'success'), B('⬅️ برگشت', 'w:i:' . $sb['hid'])]]));
}

// ----- inbox -----
function tg_inbox($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l'; use_class($cid); list($d) = tg_read($cid); $mr = msg_load();
    if ($sub === 'l') {
        $last = []; foreach ($mr['m'] as $x) $last[(int)$x['sid']] = $x; $rows = [];
        foreach (array_reverse($last, true) as $sid => $x) $rows[] = [B(($x['from'] === 's' ? '🔴 ' : '✅ ') . tg_sname($d, $sid), 'i:c:' . $sid, $x['from'] === 's' ? 'danger' : null)];
        return tg_show($chat, $mid, "💬 <b>پیام‌ها</b>\n🔴 منتظر پاسخ شما", tg_back(array_slice($rows, 0, 20)));
    }
    $sid = (int)$p[2];
    if ($sub === 'r') { tg_step($chat, 'msgr', ['c' => $cid, 'sid' => $sid]); return tg_send($chat, '✍️ پاسخ خود را برای <b>' . h(tg_sname($d, $sid)) . "</b> بفرستید.\n/cancel برای لغو"); }
    $t = '💬 <b>' . h(tg_sname($d, $sid)) . "</b>\n\n";
    foreach (array_slice(array_values(array_filter($mr['m'], function ($x) use ($sid) { return (int)$x['sid'] === $sid; })), -8) as $x) $t .= ($x['from'] === 's' ? '👤 ' : '🎓 ') . h($x['x']) . ' <i>' . tg_shamsi($x['t']) . "</i>\n\n";
    tg_show($chat, $mid, $t, tg_back([[B('↩️ پاسخ', 'i:r:' . $sid, 'success'), B('⬅️ پیام‌ها', 'i')]]));
}

// ----- activity feed -----
function tg_feed($chat, $mid) {
    global $ACT; $r = read_json($ACT, []); $a = $r['a'] ?? []; $t = "🔔 <b>آخرین فعالیت‌ها</b>\n\n";
    foreach (array_slice($a, 0, 14) as $x) $t .= tg_shamsi($x['t']) . ' ' . ($x['n'] !== '' ? '<b>' . h($x['n']) . '</b> ' : '') . h($x['x']) . "\n";
    if (!$a) $t .= 'فعالیتی ثبت نشده.';
    tg_show($chat, $mid, $t, tg_back([[B('🔄 تازه‌سازی', 'f', 'success')]]));
}

// ----- backups -----
function tg_backup($chat, $mid, $p) {
    $sub = $p[1] ?? 'l';
    if ($sub === 's') {
        $n = with_lock('state', function () { return bk_make('manual'); });
        tg_show($chat, $mid, '⏳ در حال ارسال فایل پشتیبان…', null);
        tg_doc($chat, bk_dir() . '/' . $n, '💾 پشتیبان کامل کلاس‌ها — ' . fa(tg_today()), 'class-backup-' . tg_today() . '.json');
        return tg_send($chat, 'این فایل را نگه دارید؛ از «پنل وب ← پشتیبان‌گیری ← بازیابی» می‌توانید برگردانید.', tg_back());
    }
    $l = bk_list(); $t = "💾 <b>پشتیبان‌گیری</b>\n\nتعداد نسخه‌های ذخیره‌شده روی سرور: " . fa(count($l)) . "\n";
    foreach (array_slice($l, 0, 5) as $x) $t .= '• ' . $x['kind'] . ' — ' . fa(date('Y/m/d H:i', (int)($x['t'] / 1000) + 12600)) . "\n";
    tg_show($chat, $mid, $t, tg_back([[B('📤 ساخت و ارسال فایل پشتیبان', 'b:s', 'success')]]));
}

// ----- settings -----
function tg_settings($chat, $mid, $cid, $p) {
    $sub = $p[1] ?? 'l'; $cf = tg_cfg();
    if ($sub === 't') { $k = $p[2]; if (in_array($k, ['showGrades', 'board', 'showAtt', 'showRank', 'polls'], true)) tg_mut($cid, function (&$d) use ($k) { $c = cfg_of($d); $d['cfg'][$k] = empty($c[$k]); }); }
    if ($sub === 'mu') tg_cfg_mut(function (&$r) use ($chat) { if (!empty($r['mute'][$chat])) unset($r['mute'][$chat]); else $r['mute'][$chat] = 1; });
    if ($sub === 'ml') tg_cfg_mut(function (&$r) use ($chat) { $k = $chat . 'l'; if (!empty($r['mute'][$k])) unset($r['mute'][$k]); else $r['mute'][$k] = 1; });
    if ($sub === 'cn') { tg_step($chat, 'rname', ['c' => $cid]); return tg_send($chat, "✏️ نام جدید کلاس را بفرستید.\n/cancel برای لغو"); }
    if ($sub === 'pw') { tg_step($chat, 'pw', []); return tg_send($chat, "🔐 رمز جدید پنل وب را بفرستید (حداقل ۸ کاراکتر). پیام شما بعد از ثبت پاک می‌شود و همه‌ی نشست‌های وب بسته می‌شوند.\n/cancel برای لغو"); }
    list($d) = tg_read($cid); $c = cfg_of($d); $cf = tg_cfg();
    $tg = function ($k, $nm) use ($c) { return [B(($c[$k] ? '🟢 ' : '⚪️ ') . $nm, 'o:t:' . $k, $c[$k] ? 'success' : null)]; };
    $rows = [$tg('showGrades', 'نمایش نمره به دانش‌آموز'), $tg('showAtt', 'نمایش حضور و غیاب'), $tg('showRank', 'نمایش رتبه'), $tg('board', 'تابلوی برترین‌ها'), $tg('polls', 'نظرسنجی‌ها'),
        [B(empty($cf['mute'][$chat]) ? '🔔 اعلان‌های ربات: روشن' : '🔕 اعلان‌های ربات: خاموش', 'o:mu', empty($cf['mute'][$chat]) ? 'success' : 'danger')],
        [B(empty($cf['mute'][$chat . 'l']) ? '🟢 اعلان ورود دانش‌آموز: روشن' : '⚪️ اعلان ورود دانش‌آموز: خاموش', 'o:ml')],
        [B('✏️ نام کلاس', 'o:cn', 'primary'), B('🔐 رمز پنل وب', 'o:pw', 'danger')]];
    tg_show($chat, $mid, "⚙️ <b>تنظیمات</b> — " . h($c['cls']) . "\nادمین‌های تعریف‌شده‌ی ربات: " . fa(count(tg_admins())), tg_back($rows));
}

// ---------- text / photo input (conversation steps) ----------
function tg_input($chat, $st, $m) {
    $s = $st['s']; $dd = $st['d']; $text = isset($m['text']) ? trim($m['text']) : '';
    $done = function ($msg, $kb = null) use ($chat) { tg_step($chat); tg_send($chat, $msg, $kb ?: tg_back()); };
    if ($s === 'stadd') {
        $names = array_filter(array_map('trim', preg_split('/\r?\n/', $text))); $cid = $dd['c']; $out = [];
        $max = defined('MAX_STUDENTS') ? MAX_STUDENTS : 30;
        tg_mut($cid, function (&$d) use ($names, $cid, &$out, $max) {
            $used = users_taken($cid); foreach ($d['st'] as $x) if (!empty($x['user'])) $used[] = strtolower($x['user']);
            foreach ($names as $nm) {
                if (count($d['st']) >= $max) { $out[] = '⚠️ سقف ' . fa($max) . ' نفر پر شد'; break; }
                do { $u = 's' . random_int(1000, 9999); } while (in_array($u, $used, true)); $used[] = $u;
                $code = (string)random_int(100000, 999999);
                $d['st'][] = ['id' => $d['nid']++, 'name' => mb_substr($nm, 0, 60), 'user' => $u, 'code' => $code];
                $out[] = '👤 ' . h($nm) . "\n   <code>" . $u . '</code> / <code>' . $code . '</code>';
            }
        });
        return $done("✅ ثبت شد:\n\n" . implode("\n", $out), tg_back([[B('👥 دانش‌آموزان', 's', 'success')]]));
    }
    if ($s === 'gnew') {
        if ($text === '') return tg_send($chat, 'عنوان را به‌صورت متن بفرستید.');
        tg_mut($dd['c'], function (&$d) use ($dd, $text) { $d['gr'][$dd['cat']]['items'][] = ['id' => $d['nid']++, 't' => mb_substr($text, 0, 80), 'sc' => []]; });
        return $done('✅ ستون «' . h($text) . '» ساخته شد.', tg_back([[B('📝 نمرات', 'g', 'success')]]));
    }
    if ($s === 'gseq') {
        $v = str_replace(['٫', ','], '.', fa_digits($text));
        if ($v === '' || !is_numeric($v)) return tg_send($chat, '⚠️ فقط عدد بفرستید (مثلاً 17.5) یا «رد شدن» را بزنید.');
        $v = max(0, min(20, round((float)$v, 2))); list($d0) = tg_read($dd['c']); $sid = $d0['st'][$dd['i']]['id'] ?? 0;
        tg_mut($dd['c'], function (&$d) use ($dd, $sid, $v) { foreach ($d['gr'][$dd['cat']]['items'] as $i => $it) if ((int)$it['id'] === (int)$dd['it']) $d['gr'][$dd['cat']]['items'][$i]['sc'][$sid] = $v; });
        $dd['i']++; tg_step($chat, 'gseq', $dd); return tg_gseq($chat, 0);
    }
    if ($s === 'qsc') {
        $v = str_replace(['٫', ','], '.', fa_digits($text)); if ($v === '' || !is_numeric($v)) return tg_send($chat, '⚠️ فقط عدد بفرستید.');
        use_class($dd['c']); list($d) = tg_read($dd['c']);
        $res = with_lock('results', function () use ($dd, $d, $v) {
            $r = res_load();
            foreach ($r['a'] as $i => $a) if ((int)$a['id'] === (int)$dd['aid']) {
                $q = find_quiz($d, $a['qid']); if (!$q || !isset($q['qs'][$dd['o']]) || !is_desc($q['qs'][$dd['o']])) return null;
                $r['a'][$i]['gd'][$dd['o']] = round(max(0, min(qw($q['qs'][$dd['o']]), (float)$v)), 2);
                rescore($r['a'][$i], $q); res_save($r); return $r['a'][$i];
            }
            return null;
        });
        if (!$res) return $done('پاسخ پیدا نشد.');
        return $done('✅ ثبت شد. نمره‌ی کل آزمون: <b>' . num($res['sc']) . '</b> از ۲۰' . (!empty($res['pend']) ? "\n⏳ هنوز سؤال تشریحی تصحیح‌نشده دارد." : ''), tg_back([[B('📝 ادامه‌ی تصحیح', 'q:ga:' . $dd['aid'], 'success')]]));
    }
    if ($s === 'annt') { if ($text === '') return tg_send($chat, 'عنوان را به‌صورت متن بفرستید.'); tg_step($chat, 'annb', ['c' => $dd['c'], 't' => $text]); return tg_send($chat, "✍️ حالا متن اطلاعیه را بفرستید (یا بنویسید «-» برای بدون متن)."); }
    if ($s === 'annb') {
        tg_mut($dd['c'], function (&$d) use ($dd, $text) { $d['ann'][] = ['id' => $d['nid']++, 't' => mb_substr($dd['t'], 0, 120), 'b' => $text === '-' ? '' : mb_substr($text, 0, 1500), 'd' => now_ms(), 'pin' => false]; });
        return $done('✅ اطلاعیه منتشر شد و دانش‌آموزان در اپ اعلان می‌گیرند.', tg_back([[B('📢 اطلاعیه‌ها', 'n', 'success')]]));
    }
    if ($s === 'hwsc') {
        $parts = preg_split('/\s+/', $text, 2); $v = str_replace(['٫', ','], '.', fa_digits($parts[0] ?? ''));
        if ($v === '' || !is_numeric($v)) return tg_send($chat, '⚠️ اول یک عدد بفرستید.');
        use_class($dd['c']); $f = isset($parts[1]) ? mb_substr(trim($parts[1]), 0, 600) : null;
        with_lock('hwres', function () use ($dd, $v, $f) { $r = hw_load(); foreach ($r['r'] as $i => $x) if ((int)$x['id'] === (int)$dd['id']) { $r['r'][$i]['sc'] = max(0, min(20, round((float)$v, 2))); if ($f !== null) $r['r'][$i]['f'] = $f; } hw_save($r); });
        return $done('✅ نمره‌ی تکلیف ثبت شد.', tg_back([[B('📚 تکالیف', 'w', 'success')]]));
    }
    if ($s === 'msgr') {
        if ($text === '') return tg_send($chat, 'پاسخ را به‌صورت متن بفرستید.');
        use_class($dd['c']);
        with_lock('msgs', function () use ($dd, $text) { $r = msg_load(); foreach ($r['m'] as $i => $x) if ((int)$x['sid'] === (int)$dd['sid']) $r['m'][$i]['r'] = 1; $r['m'][] = ['id' => $r['nid']++, 'sid' => (int)$dd['sid'], 'from' => 't', 't' => now_ms(), 'x' => mb_substr($text, 0, 800), 'r' => 1]; msg_save($r); });
        return $done('✅ پاسخ فرستاده شد.', tg_back([[B('💬 پیام‌ها', 'i', 'success')]]));
    }
    if ($s === 'rname') { if ($text === '') return tg_send($chat, 'نام را بفرستید.'); tg_mut($dd['c'], function (&$d) use ($text) { $d['cfg']['cls'] = mb_substr($text, 0, 60); }); return $done('✅ نام کلاس تغییر کرد.'); }
    if ($s === 'pw') {
        if (!empty($m['message_id'])) tg_api('deleteMessage', ['chat_id' => $chat, 'message_id' => $m['message_id']]);
        if (mb_strlen($text) < 8) return tg_send($chat, '⚠️ رمز باید حداقل ۸ کاراکتر باشد. دوباره بفرستید.');
        global $SETTINGS, $SET; $set = $SETTINGS; $set['hash'] = password_hash($text, PASSWORD_DEFAULT); $set['sv'] = bin2hex(random_bytes(6));
        with_lock('settings', function () use ($set, $SET) { write_raw($SET, enc($set)); });
        return $done('✅ رمز پنل وب تغییر کرد و نشست‌های قبلی بسته شد.');
    }
    if ($s === 'apkdom') {
        $dom = trim($text); if ($dom === '' || strpos($dom, ' ') !== false || strlen($dom) > 200) return tg_send($chat, '⚠️ آدرس سایت را بفرستید، مثل: <code>class.example.ir</code>');
        if (!preg_match('~^https?://~i', $dom)) $dom = 'https://' . $dom; $dom = rtrim($dom, '/');
        if (!filter_var($dom, FILTER_VALIDATE_URL)) return tg_send($chat, '⚠️ آدرس معتبر نیست.');
        tg_cfg_mut(function (&$r) use ($chat, $dom) { $r['apk'][$chat]['dom'] = $dom; }); tg_step($chat);
        return tg_send($chat, '✅ آدرس ذخیره شد: <code>' . h($dom) . '</code>', tg_apk_kb($chat));
    }
    if ($s === 'apkname') {
        if ($text === '' || mb_strlen($text) > 30) return tg_send($chat, '⚠️ یک نام کوتاه (حداکثر ۳۰ حرف) بفرستید.');
        tg_cfg_mut(function (&$r) use ($chat, $text) { $r['apk'][$chat]['name'] = $text; }); tg_step($chat);
        return tg_send($chat, '✅ نام اپ ذخیره شد.', tg_apk_kb($chat));
    }
    if ($s === 'apkicon') {
        $fid = null; $size = 0;
        if (!empty($m['photo'])) { $ph = end($m['photo']); $fid = $ph['file_id']; $size = $ph['file_size'] ?? 0; }
        elseif (!empty($m['document']) && strpos($m['document']['mime_type'] ?? '', 'image/') === 0) { $fid = $m['document']['file_id']; $size = $m['document']['file_size'] ?? 0; }
        if (!$fid) return tg_send($chat, '⚠️ لطفاً یک عکس بفرستید (بهتر است مربع و ۵۱۲×۵۱۲ یا بزرگ‌تر؛ به‌صورت «فایل» بفرستید تا کیفیتش حفظ شود).');
        if ($size > 5000000) return tg_send($chat, '⚠️ حجم عکس بیشتر از ۵ مگابایت است.');
        tg_cfg_mut(function (&$r) use ($chat, $fid) { $r['apk'][$chat]['icon'] = $fid; }); tg_step($chat);
        return tg_send($chat, '✅ آیکون ذخیره شد.', tg_apk_kb($chat));
    }
    if ($s === 'notifico') {
        $fid = null; $size = 0;
        if (!empty($m['photo'])) { $ph = end($m['photo']); $fid = $ph['file_id']; $size = $ph['file_size'] ?? 0; }
        elseif (!empty($m['document']) && strpos($m['document']['mime_type'] ?? '', 'image/') === 0) { $fid = $m['document']['file_id']; $size = $m['document']['file_size'] ?? 0; }
        if (!$fid) return tg_send($chat, '⚠️ لطفاً یک عکس بفرستید. بهتر است به‌صورت «File/فایل» و PNG با پس‌زمینه‌ی شفاف باشد.');
        if ($size > 3000000) return tg_send($chat, '⚠️ حجم عکس بیشتر از ۳ مگابایت است.');
        $fi = tg_api('getFile', ['file_id' => $fid]);
        if (!$fi || empty($fi['ok'])) return tg_send($chat, '❌ دریافت عکس از تلگرام ناموفق بود؛ دوباره بفرستید.');
        $img = tg_download($fi['result']['file_path']);
        $info = $img ? @getimagesizefromstring($img) : false;
        if (!$info || !in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP], true)) return tg_send($chat, '⚠️ فقط عکس PNG، JPG یا WEBP قابل قبول است.');
        global $DIR;
        $dst = $DIR . '/notif-icon.img';
        with_lock('settings', function () use ($dst, $img) { write_raw($dst, $img); });
        tg_step($chat);
        return tg_send($chat, "✅ آیکون اعلان ذخیره شد.\nنیازی به ساخت دوباره‌ی اپ نیست؛ دفعه‌ی بعد که اپ باز شود، اعلان‌ها با آیکون جدید نمایش داده می‌شوند." . ((min($info[0], $info[1]) < 96) ? "\n⚠️ عکس کوچک است (کمتر از ۹۶ پیکسل)؛ ممکن است تار دیده شود." : ''), tg_apk_kb($chat));
    }
    tg_step($chat); tg_menu($chat, 0);
}

// ---------- APK builder (GitHub Actions) ----------
function tg_download($path) {
    $ch = curl_init('https://api.telegram.org/file/bot' . TG_TOKEN . '/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40, CURLOPT_FOLLOWLOCATION => false]);
    $r = curl_exec($ch); curl_close($ch);
    return ($r !== false && strlen($r) > 100) ? $r : null;
}
function tg_apk_kb($chat) {
    $a = tg_cfg()['apk'][$chat] ?? [];
    return KB([[B(empty($a['dom']) ? '🌐 ثبت دامنه' : '🌐 تغییر دامنه', 'p:dom', 'primary'), B(empty($a['icon']) ? '🖼 ارسال آیکون' : '🖼 تغییر آیکون', 'p:ico', 'primary')],
        [B('✏️ نام اپ', 'p:nm'), B(is_file($GLOBALS['DIR'] . '/notif-icon.img') ? '🔔 تغییر آیکون اعلان' : '🔔 آیکون اعلان', 'p:nic', 'primary')],
        ($GLOBALS['DIR'] && is_file($GLOBALS['DIR'] . '/notif-icon.img')) ? [B('🗑 حذف آیکون اعلان', 'p:nicd', 'danger')] : [B('ℹ️ راهنمای آیکون اعلان', 'p:nih')],
        [B('🚀 بساز و بفرست', 'p:go', 'success')], [B('🏠 منوی اصلی', 'm', 'danger')]]);
}
function tg_apk($chat, $mid, $p) {
    $sub = $p[1] ?? 'l'; $cf = tg_cfg(); $a = $cf['apk'][$chat] ?? [];
    if ($sub === 'dom') { tg_step($chat, 'apkdom', []); return tg_send($chat, "🌐 آدرس سایت را بفرستید (دامنه‌ی خودتان یا آدرس Railway)، مثل:\n<code>class.example.ir</code>\n/cancel برای لغو"); }
    if ($sub === 'ico') { tg_step($chat, 'apkicon', []); return tg_send($chat, "🖼 عکس آیکون اپ را بفرستید.\n💡 به‌صورت «File/فایل» بفرستید تا کیفیت حفظ شود. عکس مربع و حداقل ۵۱۲×۵۱۲ بهترین است.\n/cancel برای لغو"); }
    if ($sub === 'nic') { tg_step($chat, 'notifico', []); return tg_send($chat, "🔔 عکس آیکون اعلان اندروید را بفرستید.\n💡 به‌صورت «File/فایل» و ترجیحاً PNG با پس‌زمینه‌ی شفاف و مربع (حداقل ۱۹۲×۱۹۲) بفرستید.\nاین آیکون بدون ساخت دوباره‌ی اپ، روی همه‌ی گوشی‌ها اعمال می‌شود.\n/cancel برای لغو"); }
    if ($sub === 'nicd') { global $DIR; @unlink($DIR . '/notif-icon.img'); return tg_show($chat, $mid, '🗑 آیکون اعلان حذف شد؛ آیکون پیش‌فرض اپ استفاده می‌شود.', tg_apk_kb($chat)); }
    if ($sub === 'nih') return tg_show($chat, $mid, "ℹ️ <b>آیکون اعلان</b>\n\nآیکونی که در نوار اعلان‌های اندروید کنار پیام‌های اپ دیده می‌شود.\n• اندروید فقط شکل (سیلوئت) آیکون کوچک را سفید نشان می‌دهد؛ پس لوگوی ساده با پس‌زمینه‌ی شفاف بهترین نتیجه را دارد.\n• خود عکس رنگی هم کنار متن اعلان نمایش داده می‌شود.\n• بدون ساخت دوباره‌ی اپ و فقط با باز شدن اپ اعمال می‌شود.", tg_apk_kb($chat));
    if ($sub === 'nm') { tg_step($chat, 'apkname', []); return tg_send($chat, "✏️ نام اپ (زیر آیکون روی گوشی) را بفرستید.\n/cancel برای لغو"); }
    if ($sub === 'go') return tg_apk_go($chat, $mid);
    $base = tg_base(); if (empty($a['dom']) && $base !== '') { tg_cfg_mut(function (&$r) use ($chat, $base) { $r['apk'][$chat]['dom'] = $base; }); $a['dom'] = $base; }
    $ready = GH_TOKEN !== '' && GH_REPO !== '';
    $t = "📱 <b>ساخت اپ اندروید</b>\n\nاپ را همین‌جا برایتان می‌سازم و فایل APK را در همین چت می‌فرستم؛ نیازی به آپلود دستی نیست.\n\n🌐 دامنه: " . (empty($a['dom']) ? '<i>ثبت نشده</i>' : '<code>' . h($a['dom']) . '</code>') . "\n🖼 آیکون: " . (empty($a['icon']) ? '<i>ثبت نشده (آیکون پیش‌فرض)</i>' : 'ثبت شد ✅') . "\n🔔 آیکون اعلان: " . (is_file($GLOBALS['DIR'] . '/notif-icon.img') ? 'ثبت شد ✅' : '<i>پیش‌فرض</i>') . "\n✏️ نام اپ: " . h($a['name'] ?? 'کلاس من') .
        ($ready ? '' : "\n\n⚠️ برای ساخت خودکار باید در Railway دو متغیر <code>GITHUB_TOKEN</code> و <code>GITHUB_REPO</code> تنظیم شود (راهنما در README).") . "\n\nساخت حدود ۴ تا ۸ دقیقه طول می‌کشد.";
    tg_show($chat, $mid, $t, tg_apk_kb($chat));
}
function gh($method, $path, $body = null, $raw = false, $timeout = 30) {
    $ch = curl_init('https://api.github.com' . $path);
    $h = ['Authorization: Bearer ' . GH_TOKEN, 'Accept: application/vnd.github+json', 'User-Agent: class-panel-bot', 'X-GitHub-Api-Version: 2022-11-28'];
    $o = [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_HTTPHEADER => $h, CURLOPT_FOLLOWLOCATION => true];
    if ($body !== null) { $o[CURLOPT_POSTFIELDS] = json_encode($body); $o[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json'; }
    curl_setopt_array($ch, $o); $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($raw) return [$code, $r];
    return [$code, $r ? json_decode($r, true) : null];
}
function tg_apk_go($chat, $mid) {
    $a = tg_cfg()['apk'][$chat] ?? [];
    if (GH_TOKEN === '' || GH_REPO === '') return tg_show($chat, $mid, "⚠️ ساخت خودکار هنوز فعال نشده.\nدر Railway این دو متغیر را بسازید و دوباره امتحان کنید:\n<code>GITHUB_TOKEN</code> (توکن GitHub با دسترسی repo و workflow)\n<code>GITHUB_REPO</code> (مثلاً <code>amirali/class-panel</code>)", tg_back([[B('⬅️ برگشت', 'p')]]));
    $dom = $a['dom'] ?? tg_base(); if ($dom === '') return tg_show($chat, $mid, '⚠️ اول دامنه را ثبت کنید.', tg_apk_kb($chat));
    tg_show($chat, $mid, '⏳ در حال آماده‌سازی…', null);
    $job = 'j' . date('His') . random_int(100, 999); $br = 'apk-input';
    // 1) شاخه‌ی ورودی
    list($c1, $ref) = gh('GET', '/repos/' . GH_REPO . '/git/ref/heads/' . $br);
    if ($c1 === 404) {
        list($c2, $base) = gh('GET', '/repos/' . GH_REPO . '/git/ref/heads/' . GH_BRANCH);
        if ($c2 !== 200) return tg_send($chat, '❌ به مخزن GitHub دسترسی ندارم. GITHUB_TOKEN و GITHUB_REPO را بررسی کنید.', tg_back());
        list($c3) = gh('POST', '/repos/' . GH_REPO . '/git/refs', ['ref' => 'refs/heads/' . $br, 'sha' => $base['object']['sha']]);
        if ($c3 >= 300) return tg_send($chat, '❌ ساخت شاخه‌ی ورودی ناموفق بود (کد ' . $c3 . ').', tg_back());
    } elseif ($c1 !== 200) return tg_send($chat, '❌ دسترسی به GitHub ناموفق (کد ' . $c1 . '). توکن را بررسی کنید.', tg_back());
    // 2) آیکون
    $hasIcon = false;
    if (!empty($a['icon'])) {
        $fi = tg_api('getFile', ['file_id' => $a['icon']]);
        if ($fi && !empty($fi['ok'])) {
            $ch = curl_init('https://api.telegram.org/file/bot' . TG_TOKEN . '/' . $fi['result']['file_path']); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]); $img = curl_exec($ch); curl_close($ch);
            if ($img && strlen($img) > 100) {
                list($cg, $ex) = gh('GET', '/repos/' . GH_REPO . '/contents/apk-input/icon.png?ref=' . $br);
                $body = ['message' => 'icon ' . $job, 'content' => base64_encode($img), 'branch' => $br]; if ($cg === 200 && isset($ex['sha'])) $body['sha'] = $ex['sha'];
                list($cu) = gh('PUT', '/repos/' . GH_REPO . '/contents/apk-input/icon.png', $body, false, 60);
                $hasIcon = $cu < 300;
            }
        }
    }
    // 3) اجرای workflow
    list($cd, $rd) = gh('POST', '/repos/' . GH_REPO . '/actions/workflows/build-apk.yml/dispatches', ['ref' => GH_BRANCH, 'inputs' => ['domain' => $dom, 'app_name' => $a['name'] ?? 'کلاس من', 'job' => $job, 'use_icon' => $hasIcon ? 'yes' : 'no']]);
    if ($cd !== 204) return tg_send($chat, '❌ شروع ساخت ناموفق بود (کد ' . $cd . '). مطمئن شوید فایل workflow در مخزن هست و توکن دسترسی workflow دارد.', tg_back());
    tg_cfg_mut(function (&$r) use ($chat, $job) { $r['jobs'][$job] = ['chat' => $chat, 't' => time(), 'run' => 0, 'n' => 0]; });
    tg_send($chat, "🚀 ساخت اپ شروع شد!\nدامنه: <code>" . h($dom) . '</code>' . ($hasIcon ? "\nآیکون سفارشی ✅" : '') . "\n\nوقتی آماده شد فایل APK را همین‌جا می‌فرستم (حدود ۴ تا ۸ دقیقه).", tg_back());
}
// هر چند ثانیه از entrypoint صدا زده می‌شود (tg-cron.php)
function tg_cron() {
    if (!tg_on() || GH_TOKEN === '' || GH_REPO === '') return;
    $cf = tg_cfg(); if (!$cf['jobs']) return;
    foreach ($cf['jobs'] as $job => $j) {
        $drop = function () use ($job) { tg_cfg_mut(function (&$r) use ($job) { unset($r['jobs'][$job]); }); };
        if (time() - $j['t'] > 2400) { tg_send($j['chat'], '⌛️ ساخت اپ بیش از حد طول کشید و متوقف شد. بعداً دوباره امتحان کنید.'); $drop(); continue; }
        list($c, $runs) = gh('GET', '/repos/' . GH_REPO . '/actions/workflows/build-apk.yml/runs?event=workflow_dispatch&per_page=15');
        if ($c !== 200 || empty($runs['workflow_runs'])) continue;
        $run = null; foreach ($runs['workflow_runs'] as $x) if (strpos((string)($x['name'] ?? '') . ' ' . (string)($x['display_title'] ?? ''), $job) !== false) { $run = $x; break; }
        if (!$run || $run['status'] !== 'completed') continue;
        if ($run['conclusion'] !== 'success') { tg_send($j['chat'], "❌ ساخت اپ ناموفق بود.\nگزارش: " . h($run['html_url'])); $drop(); continue; }
        list($ca, $arts) = gh('GET', '/repos/' . GH_REPO . '/actions/runs/' . $run['id'] . '/artifacts'); $art = null;
        foreach (($arts['artifacts'] ?? []) as $x) if ($x['name'] === 'ClassApp-' . $job) $art = $x;
        if (!$art) { tg_send($j['chat'], '❌ فایل APK در خروجی ساخت پیدا نشد.'); $drop(); continue; }
        list($cz, $zip) = gh('GET', '/repos/' . GH_REPO . '/actions/artifacts/' . $art['id'] . '/zip', null, true, 120);
        $apk = $cz === 200 ? tg_zip_first($zip, '.apk') : null;
        if (!$apk) { tg_send($j['chat'], '❌ دانلود فایل ساخته‌شده ناموفق بود.'); $drop(); continue; }
        $tmp = sys_get_temp_dir() . '/class-app-' . $job . '.apk'; file_put_contents($tmp, $apk);
        $r = tg_doc($j['chat'], $tmp, "📱 اپ شما آماده است!\nنصب: فایل را باز کنید و اجازه‌ی «نصب از منبع ناشناس» را بدهید.", 'ClassApp.apk');
        @unlink($tmp);
        if (!$r || empty($r['ok'])) tg_send($j['chat'], '⚠️ ارسال فایل ناموفق بود. از اینجا دانلود کنید: ' . h($run['html_url']));
        $drop();
    }
}
// خواندن اولین فایل با پسوند مشخص از zip بدون نیاز به افزونه‌ی zip
function tg_zip_first($z, $ext) {
    $n = strlen($z); $e = strrpos($z, "PK\x05\x06"); if ($e === false) return null;
    $cnt = unpack('v', substr($z, $e + 10, 2))[1]; $off = unpack('V', substr($z, $e + 16, 4))[1]; $p = $off;
    for ($i = 0; $i < $cnt; $i++) {
        if (substr($z, $p, 4) !== "PK\x01\x02") return null;
        $meth = unpack('v', substr($z, $p + 10, 2))[1]; $csz = unpack('V', substr($z, $p + 20, 4))[1]; $nl = unpack('v', substr($z, $p + 28, 2))[1]; $el = unpack('v', substr($z, $p + 30, 2))[1]; $cl = unpack('v', substr($z, $p + 32, 2))[1];
        $lho = unpack('V', substr($z, $p + 42, 4))[1]; $name = substr($z, $p + 46, $nl);
        if (substr($name, -strlen($ext)) === $ext) {
            $lnl = unpack('v', substr($z, $lho + 26, 2))[1]; $lel = unpack('v', substr($z, $lho + 28, 2))[1];
            $data = substr($z, $lho + 30 + $lnl + $lel, $csz);
            return $meth === 8 ? @gzinflate($data) : ($meth === 0 ? $data : null);
        }
        $p += 46 + $nl + $el + $cl;
    }
    return null;
}
