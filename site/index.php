<?php
// Class panel v3 - PHP 7.2+ (no Java, no database: flat JSON files).
// Data format is backward compatible with the old data.json.
require __DIR__ . '/config.php';
header_remove('X-Powered-By');
@ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_WARNING);
define('APP_VER', '5.0');
if (!defined('MAX_STUDENTS')) define('MAX_STUDENTS', 30);   // حداکثر دانش‌آموز در هر کلاس
define('DEFAULT_PASS', 'change-this-strong-password');
define('DEFAULT_SECRET', 'put-a-long-random-string-here-sdf8923kjsdf09sd8f');
require __DIR__ . '/tgbot.php';

// ---------- data directory ----------
function pick_dir() {
    $cands = [];
    if (defined('DATA_DIR') && DATA_DIR) $cands[] = DATA_DIR;
    $cands[] = dirname(__DIR__) . '/class-data';
    foreach ($cands as $d) {
        if (!is_dir($d)) @mkdir($d, 0750, true);
        if (is_dir($d) && is_writable($d)) return $d;
    }
    $d = __DIR__ . '/data';
    if (!is_dir($d)) @mkdir($d, 0750, true);
    @file_put_contents($d . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    return $d;
}
$DIR = pick_dir();
// اگر SESSION_SECRET تنظیم نشده باشد، یک کلید تصادفی در پوشه‌ی داده ساخته می‌شود (کلید پیش‌فرض عمومی است و امن نیست)
function app_secret() {
    static $k = null; global $DIR;
    if ($k !== null) return $k;
    $k = SESSION_SECRET;
    if ($k === DEFAULT_SECRET || strlen($k) < 16) {
        $f = $DIR . '/.secret'; $v = is_file($f) ? trim((string)@file_get_contents($f)) : '';
        if (strlen($v) < 32) { $v = bin2hex(random_bytes(32)); @file_put_contents($f, $v, LOCK_EX); @chmod($f, 0600); }
        $k = $v;
    }
    return $k;
}
$FILE = $DIR . '/data.json'; $LOGS = $DIR . '/logins.json'; $FAILS = $DIR . '/fails.json';
$RES = $DIR . '/results.json'; $SET = $DIR . '/settings.json'; $BK = $DIR . '/backups';
$CLS_FILE = $DIR . '/classes.json'; $PRS = $DIR . '/pollres.json'; $ACT = $DIR . '/activity.json'; $SEEN = $DIR . '/seen.json'; $HWR = $DIR . '/hwres.json'; $MSG = $DIR . '/msgs.json'; $CID = 1;
$EMPTY = '{"st":[],"att":{},"pts":[],"nid":1,"gr":{"quiz":{"items":[]},"cont":{"items":[]},"exam":{"items":[]},"hw":{"items":[]}},"quizzes":[],"ann":[],"polls":[],"hw":[],"sched":[],"cfg":{},"rev":0}';
$CATS = ['quiz' => 'کوییز کلاسی', 'cont' => 'نمره مستمر', 'exam' => 'آزمون', 'hw' => 'تمرین'];

// ---------- helpers ----------
function now_ms() { return (int)round(microtime(true) * 1000); }
function out($code, $obj, $headers = []) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $h) header($h, false);
    echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function raw_file($f, $default) { $s = is_file($f) ? @file_get_contents($f) : false; return ($s === false || $s === '') ? $default : $s; }
function read_json($f, $default) { $v = json_decode(raw_file($f, ''), true); return $v === null ? $default : $v; }
function write_raw($f, $s) { $t = $f . '.' . getmypid() . '.tmp'; file_put_contents($t, $s, LOCK_EX); rename($t, $f); }
function enc($v) { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function body_json($max = 5000000) {
    $s = file_get_contents('php://input');
    if (strlen($s) > $max) out(413, ['error' => 'too_big']);
    if ($s === '' || $s === false) return [[], '{}'];
    $v = json_decode($s, true);
    if ($v === null && trim($s) !== 'null') out(400, ['error' => 'bad_request']);
    return [$v, $s];
}
function with_lock($name, $fn) {
    global $DIR;
    $fh = fopen($DIR . '/' . $name . '.lock', 'c');
    flock($fh, LOCK_EX);
    try { $r = $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
    return $r;
}
function s_str($v, $max) { $v = is_scalar($v) ? (string)$v : ''; return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max); }

// settings (password override etc.)
$SETTINGS = read_json($SET, []); if (!is_array($SETTINGS)) $SETTINGS = [];
$SV = isset($SETTINGS['sv']) ? (string)$SETTINGS['sv'] : '';
function admin_user() { global $SETTINGS; return !empty($SETTINGS['user']) ? $SETTINGS['user'] : ADMIN_USER; }
function check_pass($p) { global $SETTINGS; if (!empty($SETTINGS['hash'])) return password_verify($p, $SETTINGS['hash']); return same($p, ADMIN_PASS); }
function weak_pass() { global $SETTINGS; return empty($SETTINGS['hash']) && (ADMIN_PASS === DEFAULT_PASS || strlen(ADMIN_PASS) < 6); }

function sign($v) { global $SV; return hash_hmac('sha256', $v, app_secret() . $SV); }
function same($a, $b) { return hash_equals(hash('sha256', (string)$a, true), hash('sha256', (string)$b, true)); }
function mk($p) { return $p . '.' . sign($p); }
function token_of() {
    $a = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');
    if (!$a && function_exists('getallheaders')) { foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $a = $v; }
    $b = preg_replace('/^Bearer /', '', $a);
    if ($b) return $b;
    return isset($_COOKIE['sid']) ? $_COOKIE['sid'] : '';
}
function who() {
    $t = token_of(); if (!$t) return null;
    $i = strrpos($t, '.'); if ($i === false) return null;
    $p = substr($t, 0, $i);
    if (!hash_equals(sign($p), substr($t, $i + 1))) return null;
    $a = explode('|', $p);
    return ((float)end($a)) > now_ms() ? $a : null;
}
function client_ip() {
    // پشت پروکسی Railway آخرین مقدار X-Forwarded-For را خود پروکسی اضافه کرده؛ مقدار اول را کاربر می‌تواند جعل کند
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) return trim($_SERVER['HTTP_X_REAL_IP']);
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) { $p = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']); return trim(end($p)); }
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
}
function is_https() {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') || (isset($_SERVER['HTTP_CF_VISITOR']) && strpos($_SERVER['HTTP_CF_VISITOR'], 'https') !== false);
}
function admin_cookie() {
    $sec = is_https() ? '; Secure' : '';
    return 'Set-Cookie: sid=' . mk('a|' . (now_ms() + 7 * 86400000)) . '; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800' . $sec;
}

// brute-force limiter stored in a file
function fails_load() { global $FAILS; $f = read_json($FAILS, []); $n = now_ms(); foreach ($f as $k => $v) if ($n - $v['t'] > 900000) unset($f[$k]); return $f; }
function too_many($k) { $f = fails_load(); return isset($f[$k]) && $f[$k]['n'] >= 5 && now_ms() - $f[$k]['t'] < 900000; }
function add_fail($k) { global $FAILS; $f = fails_load(); $f[$k] = ['n' => (isset($f[$k]) ? $f[$k]['n'] : 0) + 1, 't' => now_ms()]; write_raw($FAILS, json_encode($f)); }
function clear_fail($k) { global $FAILS; $f = fails_load(); if (isset($f[$k])) { unset($f[$k]); write_raw($FAILS, json_encode($f)); } }

// ---------- state helpers (read side, assoc arrays) ----------
function load_state() {
    global $FILE, $EMPTY, $CATS;
    $d = json_decode(raw_file($FILE, $EMPTY), true);
    if (!is_array($d)) $d = json_decode($EMPTY, true);
    foreach (['st', 'pts', 'quizzes', 'ann', 'polls', 'hw', 'sched'] as $k) if (!isset($d[$k]) || !is_array($d[$k])) $d[$k] = [];
    foreach (['att', 'cfg', 'gr'] as $k) if (!isset($d[$k]) || !is_array($d[$k])) $d[$k] = [];
    foreach ($CATS as $c => $_) if (!isset($d['gr'][$c]) || !is_array($d['gr'][$c]) || !isset($d['gr'][$c]['items']) || !is_array($d['gr'][$c]['items'])) $d['gr'][$c] = ['items' => []];
    return $d;
}
function cfg_of($d) {
    $def = ['cls' => 'کارگاه طراحی سایت', 'school' => 'هنرستان خوارزمی', 'teacher' => 'استاد تقی‌زاده', 'showGrades' => true, 'board' => false, 'showAtt' => true, 'showRank' => true, 'polls' => true, 'w' => ['quiz' => 1, 'cont' => 1, 'exam' => 1, 'hw' => 1]];
    $c = is_array($d['cfg']) ? $d['cfg'] : [];
    $o = array_merge($def, $c);
    $o['w'] = array_merge($def['w'], isset($c['w']) && is_array($c['w']) ? $c['w'] : []);
    return $o;
}
function find_student($d, $id) { foreach ($d['st'] as $s) if (is_array($s) && isset($s['id']) && (string)$s['id'] === (string)$id) return $s; return null; }
function find_quiz($d, $id) { foreach ($d['quizzes'] as $q) if (is_array($q) && isset($q['id']) && (string)$q['id'] === (string)$id) return $q; return null; }
function pts_of($d, $sid) { $t = 0; foreach ($d['pts'] as $p) if (isset($p['sid']) && (string)$p['sid'] === (string)$sid) $t += (float)$p['v']; return $t; }
function scores_of($d, $cat, $sid) {
    $v = [];
    foreach ($d['gr'][$cat]['items'] as $i) { if (isset($i['sc']) && is_array($i['sc']) && isset($i['sc'][$sid]) && $i['sc'][$sid] !== '') $v[] = (float)$i['sc'][$sid]; }
    return $v;
}
function avg_of($a) { return count($a) ? array_sum($a) / count($a) : null; }
function rnd($x, $n = 2) { return $x === null ? null : round($x, $n); }
function att_counts($d, $sid) {
    $c = ['p' => 0, 'a' => 0, 'l' => 0];
    foreach ($d['att'] as $day) if (is_array($day) && isset($day[$sid]) && isset($c[$day[$sid]])) $c[$day[$sid]]++;
    return $c;
}
function final_of($d, $sid) {
    global $CATS; $cfg = cfg_of($d); $num = 0; $den = 0;
    foreach ($CATS as $k => $_) { $a = avg_of(scores_of($d, $k, $sid)); if ($a === null) continue; $w = max(0, (float)$cfg['w'][$k]); $num += $a * $w; $den += $w; }
    return $den > 0 ? $num / $den : null;
}
function qz_status($q, $n) {
    $f = isset($q['from']) ? (float)$q['from'] : 0; $t = isset($q['to']) ? (float)$q['to'] : 0;
    if ($f > 0 && $n < $f) return 'soon';
    if ($t > 0 && $n > $t) return 'closed';
    return 'open';
}
function qz_on($q) { return !isset($q['on']) || $q['on']; }

// ---------- classes (multi-class) ----------
function cls_reg() {
    global $CLS_FILE;
    $r = read_json($CLS_FILE, []);
    if (!is_array($r) || empty($r['ids']) || !is_array($r['ids'])) $r = ['nid' => 2, 'ids' => [1]];
    $r['ids'] = array_values(array_map('intval', $r['ids']));
    if (!isset($r['nid']) || (int)$r['nid'] <= max($r['ids'])) $r['nid'] = max($r['ids']) + 1;
    return $r;
}
function cls_save($r) { global $CLS_FILE; write_raw($CLS_FILE, enc($r)); }
function p_state($c) { global $DIR; return (int)$c === 1 ? $DIR . '/data.json' : $DIR . '/class-' . (int)$c . '.json'; }
function p_res($c) { global $DIR; return (int)$c === 1 ? $DIR . '/results.json' : $DIR . '/results-' . (int)$c . '.json'; }
function p_poll($c) { global $DIR; return (int)$c === 1 ? $DIR . '/pollres.json' : $DIR . '/pollres-' . (int)$c . '.json'; }
function p_hw($c) { global $DIR; return (int)$c === 1 ? $DIR . '/hwres.json' : $DIR . '/hwres-' . (int)$c . '.json'; }
function p_msg($c) { global $DIR; return (int)$c === 1 ? $DIR . '/msgs.json' : $DIR . '/msgs-' . (int)$c . '.json'; }
function use_class($c) { global $FILE, $RES, $PRS, $HWR, $MSG, $CID; $CID = (int)$c; $FILE = p_state($CID); $RES = p_res($CID); $PRS = p_poll($CID); $HWR = p_hw($CID); $MSG = p_msg($CID); }
function hw_load() {
    global $HWR; $r = read_json($HWR, []);
    if (!is_array($r)) $r = [];
    if (!isset($r['nid'])) $r['nid'] = 1;
    if (!isset($r['r']) || !is_array($r['r'])) $r['r'] = [];
    return $r;
}
function hw_save($r) { global $HWR; write_raw($HWR, enc($r)); }
function msg_load() {
    global $MSG; $r = read_json($MSG, []);
    if (!is_array($r)) $r = [];
    if (!isset($r['nid'])) $r['nid'] = 1;
    if (!isset($r['m']) || !is_array($r['m'])) $r['m'] = [];
    return $r;
}
function msg_save($r) { global $MSG; write_raw($MSG, enc($r)); }
function valid_cid($c) { $r = cls_reg(); $c = (int)$c; return in_array($c, $r['ids'], true) ? $c : $r['ids'][0]; }

// ---------- accounts, activity log, presence ----------
function fa_digits($s) {
    return strtr((string)$s, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']);
}
/** عدد ورودی را (با ارقام فارسی/عربی و جداکننده‌ی «٫» یا «,» یا «،») به float تبدیل می‌کند؛ نامعتبر → null */
function num_in($v) {
    if ($v === null || is_bool($v) || is_array($v)) return null;
    if (is_int($v) || is_float($v)) return is_finite((float)$v) ? (float)$v : null;
    $t = str_replace(['٫', ',', '،', '/', ' '], ['.', '.', '.', '.', ''], fa_digits(trim((string)$v)));
    if ($t === '' || !preg_match('/^\d*\.?\d+$/', $t)) return null;
    return (float)$t;
}
function pwh($s) { return substr(hash_hmac('sha256', (string)(isset($s['code']) ? $s['code'] : ''), app_secret()), 0, 10); }
function find_account($user) {
    $user = strtolower(trim(fa_digits($user)));
    if ($user === '') return null;
    $reg = cls_reg();
    foreach ($reg['ids'] as $c) {
        $d = json_decode(raw_file(p_state($c), ''), true);
        if (!is_array($d) || !isset($d['st']) || !is_array($d['st'])) continue;
        foreach ($d['st'] as $s) {
            if (!is_array($s) || !isset($s['id'])) continue;
            $u = isset($s['user']) ? strtolower(trim((string)$s['user'])) : '';
            if (($u !== '' && $u === $user) || ($u === '' && (string)$s['id'] === $user)) return [$c, $s];
        }
    }
    return null;
}
function users_taken($except) {
    $o = []; $reg = cls_reg();
    foreach ($reg['ids'] as $c) {
        if ((int)$c === (int)$except) continue;
        $d = json_decode(raw_file(p_state($c), ''), true);
        if (!is_array($d) || empty($d['st']) || !is_array($d['st'])) continue;
        foreach ($d['st'] as $s) if (is_array($s) && !empty($s['user'])) $o[] = strtolower(trim((string)$s['user']));
    }
    return $o;
}
function act_log($kind, $text, $sid, $name) {
    global $ACT, $CID;
    $logged = with_lock('activity', function () use ($kind, $text, $sid, $name, $ACT, $CID) {
        $r = read_json($ACT, []); if (!is_array($r)) $r = [];
        if (!isset($r['nid'])) $r['nid'] = 1;
        if (!isset($r['a']) || !is_array($r['a'])) $r['a'] = [];
        $n = now_ms();
        if ($kind === 'login' || $kind === 'login_fail') {
            foreach (array_slice($r['a'], 0, 40) as $x) {
                if ($x['k'] === $kind && (int)$x['sid'] === (int)$sid && (int)$x['c'] === (int)$CID && $n - $x['t'] < 300000) return false;
            }
        }
        array_unshift($r['a'], ['id' => $r['nid']++, 't' => $n, 'c' => (int)$CID, 'sid' => (int)$sid, 'n' => (string)$name, 'k' => $kind, 'x' => (string)$text]);
        $r['a'] = array_slice($r['a'], 0, 600);
        write_raw($ACT, enc($r));
        return true;
    });
    if ($logged && function_exists('tg_push')) { try { tg_push($kind, $text, $sid, $name, $CID); } catch (Throwable $e) { } }
}
function seen_touch($sid) {
    global $SEEN, $CID;
    $k = $CID . '-' . (int)$sid;
    $s = read_json($SEEN, []); if (!is_array($s)) $s = [];
    if (isset($s[$k]) && now_ms() - (float)$s[$k] < 40000) return;
    with_lock('seen', function () use ($SEEN, $k) {
        $s = read_json($SEEN, []); if (!is_array($s)) $s = [];
        $s[$k] = now_ms();
        write_raw($SEEN, enc($s));
    });
}

// ---------- polls / surveys ----------
function pr_load() {
    global $PRS;
    $r = read_json($PRS, []);
    if (!is_array($r)) $r = [];
    if (!isset($r['nid'])) $r['nid'] = 1;
    if (!isset($r['r']) || !is_array($r['r'])) $r['r'] = [];
    return $r;
}
function pr_save($r) { global $PRS; write_raw($PRS, enc($r)); }
function find_poll($d, $id) { foreach ($d['polls'] as $p) if (is_array($p) && isset($p['id']) && (string)$p['id'] === (string)$id) return $p; return null; }
function poll_public($p, $n, $done) {
    $qs = [];
    foreach ((isset($p['qs']) && is_array($p['qs']) ? $p['qs'] : []) as $q) {
        $qs[] = ['k' => isset($q['k']) ? (string)$q['k'] : 'one', 'q' => (string)(isset($q['q']) ? $q['q'] : ''), 'o' => isset($q['o']) && is_array($q['o']) ? array_values(array_map('strval', $q['o'])) : []];
    }
    return ['id' => $p['id'], 't' => (string)$p['t'], 'd' => isset($p['d']) ? (string)$p['d'] : '', 'anon' => !empty($p['anon']), 'status' => qz_status($p, $n), 'from' => isset($p['from']) ? (float)$p['from'] : 0, 'to' => isset($p['to']) ? (float)$p['to'] : 0, 'done' => $done, 'qs' => $qs];
}

// quiz scores that feed the main grade table automatically (item has "qz" = quiz id)
function apply_links(&$d, $r) {
    global $CATS; $n = now_ms();
    foreach ($CATS as $cat => $_) {
        foreach ($d['gr'][$cat]['items'] as $k => $it) {
            if (!is_array($it) || empty($it['qz'])) continue;
            $m = isset($it['qm']) ? $it['qm'] : 'best'; $by = [];
            foreach ($r['a'] as $a) {
                if ((string)$a['qid'] !== (string)$it['qz']) continue;
                $stt = att_state($a, $n); if ($stt !== 'done' && $stt !== 'exp') continue;
                if (!empty($a['pend'])) continue;
                $by[(int)$a['sid']][] = $a;
            }
            $sc = [];
            foreach ($by as $sid => $list) {
                usort($list, function ($x, $y) { return $x['e'] <=> $y['e']; });
                if ($m === 'last') { $v = (float)$list[count($list) - 1]['sc']; }
                elseif ($m === 'first') { $v = (float)$list[0]['sc']; }
                elseif ($m === 'avg') { $t = 0; foreach ($list as $a) $t += (float)$a['sc']; $v = $t / count($list); }
                else { $v = 0; foreach ($list as $i => $a) if ($i === 0 || (float)$a['sc'] > $v) $v = (float)$a['sc']; }
                $sc[$sid] = round($v, 2);
            }
            $d['gr'][$cat]['items'][$k]['sc'] = $sc;
        }
    }
}

// ---------- descriptive questions + uploads ----------
function qw($qq) { $w = isset($qq['w']) ? (float)$qq['w'] : 1; return $w > 0 ? $w : 1; }
function is_desc($qq) { return is_array($qq) && isset($qq['k']) && $qq['k'] === 'desc'; }
function rescore(&$a, $q) {
    $tot = 0; $got = 0; $c = 0; $pend = false;
    foreach ($a['qo'] as $k => $orig) {
        if (!isset($q['qs'][$orig])) continue;
        $qq = $q['qs'][$orig]; $w = qw($qq); $tot += $w;
        if (is_desc($qq)) {
            $g = isset($a['gd'][$orig]) ? $a['gd'][$orig] : null;
            if ($g === null) { if (!empty($a['da'][$orig]['x']) || !empty($a['da'][$orig]['img'])) $pend = true; }
            else { $got += min($w, max(0, (float)$g)); if ((float)$g >= $w) $c++; }
        } elseif (!empty($a['ok'][$orig])) { $got += $w; $c++; }
    }
    $a['c'] = $c; $a['pend'] = $pend; $a['sc'] = $tot > 0 ? round($got / $tot * 20, 2) : 0;
}
function up_dir() { global $DIR; $d = $DIR . '/uploads'; if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
function av_dir() { global $DIR; $d = $DIR . '/avatars'; if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
// data-URL JPEG -> bytes (null if invalid)
function jpeg_from_dataurl($s, $max) {
    if (!is_string($s) || strpos($s, 'data:image/jpeg;base64,') !== 0) return null;
    $b = base64_decode(substr($s, 23), true);
    if ($b === false || strlen($b) < 200 || strlen($b) > $max || substr($b, 0, 2) !== "\xFF\xD8") return null;
    $i = @getimagesizefromstring($b);
    if (!$i || $i[2] !== IMAGETYPE_JPEG || $i[0] > 4000 || $i[1] > 4000) return null;
    return $b;
}
function send_jpeg($f) {
    if (!is_file($f)) out(404, ['error' => 'not_found']);
    header('Content-Type: image/jpeg'); header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($f)); readfile($f); exit;
}
function av_ver($key) { $f = av_dir() . '/' . $key . '.jpg'; return is_file($f) ? (int)filemtime($f) : 0; }
function up_valid($n) { return is_string($n) && preg_match('/^q[0-9]+-[0-9]+-[0-9]+\.jpg$/', $n); }

// ---------- results (quiz attempts) ----------
function res_load() {
    global $RES;
    $r = read_json($RES, []);
    if (!is_array($r)) $r = [];
    if (!isset($r['nid'])) $r['nid'] = 1;
    if (!isset($r['a']) || !is_array($r['a'])) $r['a'] = [];
    return $r;
}
function res_save($r) { global $RES; write_raw($RES, enc($r)); }
define('GRACE_MS', 45000);
function att_state($a, $n) {
    if ($a['st'] === 'run' && $n > (float)$a['dl'] + GRACE_MS) return 'exp';
    return $a['st'];
}
function public_attempt($a, $n) {
    return ['id' => $a['id'], 'qid' => $a['qid'], 'sid' => $a['sid'], 'n' => $a['n'], 's' => $a['s'], 'e' => $a['e'], 'st' => att_state($a, $n), 'sc' => $a['sc'], 'c' => $a['c'], 't' => $a['t'], 'ok' => isset($a['ok']) ? $a['ok'] : [], 'pend' => !empty($a['pend'])];
}
function review_of($a, $q) {
    // returns display-order review using the stored permutation; null if quiz changed shape
    if (!$q || !isset($a['qo']) || !isset($a['po'])) return null;
    $rv = isset($q['rv']) ? $q['rv'] : 'full';
    if ($rv === 'none') return null;
    $out = [];
    foreach ($a['qo'] as $k => $orig) {
        if (!isset($q['qs'][$orig]) || !isset($a['po'][$orig])) return null;
        $qq = $q['qs'][$orig]; $po = $a['po'][$orig]; $opts = [];
        if (is_desc($qq)) {
            $da = isset($a['da'][$orig]) ? $a['da'][$orig] : [];
            $g = isset($a['gd'][$orig]) ? $a['gd'][$orig] : null;
            $out[] = ['q' => (string)$qq['q'], 'k' => 'desc', 'o' => [], 'pick' => null, 'right' => null, 'ok' => $g !== null && (float)$g >= qw($qq), 'e' => $rv === 'full' && isset($qq['e']) ? (string)$qq['e'] : '',
                'x' => isset($da['x']) ? (string)$da['x'] : '', 'img' => !empty($da['img']) ? (string)$da['img'] : '', 'pts' => $g, 'w' => qw($qq)];
            continue;
        }
        foreach ($po as $j) { if (!isset($qq['o'][$j])) return null; $opts[] = (string)$qq['o'][$j]; }
        $pick = isset($a['ans'][$k]) && is_int($a['ans'][$k]) && $a['ans'][$k] >= 0 && $a['ans'][$k] < count($po) ? $a['ans'][$k] : null;
        $right = array_search((int)$qq['c'], $po, true);
        $out[] = ['q' => (string)$qq['q'], 'o' => $opts, 'pick' => $pick, 'right' => $rv === 'full' ? ($right === false ? null : $right) : null, 'ok' => !empty($a['ok'][$orig]), 'e' => $rv === 'full' && isset($qq['e']) ? (string)$qq['e'] : ''];
    }
    return $out;
}
function result_body($a, $q) {
    $n = now_ms(); $rv = $q && isset($q['rv']) ? $q['rv'] : 'full';
    $t = max(1, (int)$a['t']);
    return ['ok' => 1, 'aid' => $a['id'], 'attemptId' => $a['id'], 'title' => $q ? (string)$q['t'] : '', 'sc' => (float)$a['sc'], 'c' => (int)$a['c'], 't' => (int)$a['t'], 'pct' => (int)round($a['c'] / $t * 100), 'pend' => !empty($a['pend']), 'exp' => att_state($a, $n) === 'exp', 'rv' => $rv, 'review' => review_of($a, $q)];
}

// ---------- backups ----------
function bk_dir() {
    global $BK;
    if (!is_dir($BK)) { @mkdir($BK, 0750, true); @file_put_contents($BK . '/.htaccess', "Require all denied\n"); }
    return $BK;
}
function bk_build() {
    global $EMPTY;
    $reg = cls_reg(); $ex = []; $first = null; $tot = ['st' => 0, 'qz' => 0, 'at' => 0];
    foreach ($reg['ids'] as $i => $c) {
        $st = raw_file(p_state($c), $EMPTY); $rs = raw_file(p_res($c), '{"nid":1,"a":[]}'); $ps = raw_file(p_poll($c), '{"nid":1,"r":[]}'); $hw = raw_file(p_hw($c), '{"nid":1,"r":[]}'); $mg = raw_file(p_msg($c), '{"nid":1,"m":[]}');
        $d = json_decode($st, true); $r = json_decode($rs, true);
        $tot['st'] += is_array($d) && isset($d['st']) && is_array($d['st']) ? count($d['st']) : 0;
        $tot['qz'] += is_array($d) && isset($d['quizzes']) && is_array($d['quizzes']) ? count($d['quizzes']) : 0;
        $tot['at'] += is_array($r) && isset($r['a']) && is_array($r['a']) ? count($r['a']) : 0;
        if ($i === 0) $first = [$st, $rs, $ps, $hw, $mg];
        else $ex[] = '{"id":' . (int)$c . ',"state":' . $st . ',"results":' . $rs . ',"pollres":' . $ps . ',"hwres":' . $hw . ',"msgres":' . $mg . '}';
    }
    $meta = ['app' => 'class-panel', 'v' => 4, 't' => now_ms(), 'st' => $tot['st'], 'qz' => $tot['qz'], 'at' => $tot['at'], 'cl' => count($reg['ids'])];
    return '{"meta":' . enc($meta) . ',"full":1,"fid":' . (int)$reg['ids'][0] . ',"state":' . $first[0] . ',"results":' . $first[1] . ',"pollres":' . $first[2] . ',"hwres":' . $first[3] . ',"msgres":' . $first[4] . ',"extra":[' . implode(',', $ex) . ']}';
}
function bk_make($prefix) {
    $dir = bk_dir();
    $name = $prefix . '-' . date('Ymd-His') . '-' . substr(md5(uniqid('', true)), 0, 4) . '.json';
    write_raw($dir . '/' . $name, bk_build());
    $limits = ['auto' => 15, 'manual' => 40, 'safe' => 10];
    $files = glob($dir . '/' . $prefix . '-*.json'); sort($files);
    $lim = isset($limits[$prefix]) ? $limits[$prefix] : 20;
    while (count($files) > $lim) @unlink(array_shift($files));
    return $name;
}
function bk_list() {
    $o = [];
    foreach (glob(bk_dir() . '/*.json') as $f) {
        $b = basename($f); $kind = explode('-', $b)[0];
        $h = @file_get_contents($f, false, null, 0, 500); $meta = [];
        if ($h && preg_match('/"meta":(\{[^}]*\})/', $h, $m)) { $x = json_decode($m[1], true); if (is_array($x)) $meta = $x; }
        $o[] = ['name' => $b, 'kind' => $kind, 't' => filemtime($f) * 1000, 'size' => filesize($f), 'st' => isset($meta['st']) ? $meta['st'] : null, 'qz' => isset($meta['qz']) ? $meta['qz'] : null, 'at' => isset($meta['at']) ? $meta['at'] : null];
    }
    usort($o, function ($a, $b) { return $b['t'] <=> $a['t']; });
    return $o;
}
function bk_valid_name($n) { return is_string($n) && preg_match('/^(auto|manual|safe)-[0-9]{8}-[0-9]{6}-[a-f0-9]{4}\.json$/', $n); }
function max_id($o) {
    $m = 0;
    $walk = function ($a) use (&$m) { if (is_array($a)) foreach ($a as $x) if (is_object($x) && isset($x->id) && is_numeric($x->id)) $m = max($m, (int)$x->id); };
    $walk($o->st); $walk($o->quizzes); $walk($o->ann); if (isset($o->polls)) $walk($o->polls); if (isset($o->hw)) $walk($o->hw); if (isset($o->sched)) $walk($o->sched);
    foreach (['quiz', 'cont', 'exam', 'hw'] as $c) if (isset($o->gr->$c->items)) $walk($o->gr->$c->items);
    return $m;
}
function restore_one_state($state) {
    if (!is_object($state) || !isset($state->st) || !is_array($state->st)) out(400, ['error' => 'bad_file']);
    foreach (['pts', 'quizzes', 'ann', 'polls', 'hw', 'sched'] as $k) if (!isset($state->$k) || !is_array($state->$k)) $state->$k = [];
    foreach (['att', 'cfg'] as $k) if (!isset($state->$k) || !is_object($state->$k)) $state->$k = new stdClass();
    if (!isset($state->gr) || !is_object($state->gr)) $state->gr = new stdClass();
    foreach (['quiz', 'cont', 'exam', 'hw'] as $c) {
        if (!isset($state->gr->$c) || !is_object($state->gr->$c)) $state->gr->$c = new stdClass();
        if (!isset($state->gr->$c->items) || !is_array($state->gr->$c->items)) $state->gr->$c->items = [];
    }
    $state->nid = max(isset($state->nid) ? (int)$state->nid : 1, max_id($state) + 1);
    return $state;
}
function restore_files($c, $state, $res, $pres, $hw = null, $msg = null) {
    $cur = json_decode(raw_file(p_state($c), ''), true);
    $state->rev = (is_array($cur) && isset($cur['rev']) ? (int)$cur['rev'] : 0) + 1;
    write_raw(p_state($c), enc($state));
    if ($res && is_object($res)) {
        if (!isset($res->a) || !is_array($res->a)) $res->a = [];
        if (!isset($res->nid)) $res->nid = 1;
        with_lock('results', function () use ($res, $c) { write_raw(p_res($c), enc($res)); });
    }
    if ($pres && is_object($pres)) {
        if (!isset($pres->r) || !is_array($pres->r)) $pres->r = [];
        if (!isset($pres->nid)) $pres->nid = 1;
        with_lock('pollres', function () use ($pres, $c) { write_raw(p_poll($c), enc($pres)); });
    }
    if ($hw && is_object($hw)) {
        if (!isset($hw->r) || !is_array($hw->r)) $hw->r = [];
        if (!isset($hw->nid)) $hw->nid = 1;
        with_lock('hwres', function () use ($hw, $c) { write_raw(p_hw($c), enc($hw)); });
    }
    if ($msg && is_object($msg)) {
        if (!isset($msg->m) || !is_array($msg->m)) $msg->m = [];
        if (!isset($msg->nid)) $msg->nid = 1;
        with_lock('msgs', function () use ($msg, $c) { write_raw(p_msg($c), enc($msg)); });
    }
}
// $o: decoded (non-assoc) backup. A full multi-class backup replaces every class;
// a legacy / single-class file (or the "wipe" request) replaces the current class only.
function restore_obj($o) {
    global $CID;
    if (!is_object($o)) out(400, ['error' => 'bad_file']);
    if (isset($o->full) && isset($o->state) && is_object($o->state)) {
        $fid = isset($o->fid) ? max(1, (int)$o->fid) : 1;
        $items = [[$fid, $o->state, isset($o->results) ? $o->results : null, isset($o->pollres) ? $o->pollres : null, isset($o->hwres) ? $o->hwres : null, isset($o->msgres) ? $o->msgres : null]];
        if (isset($o->extra) && is_array($o->extra)) {
            foreach ($o->extra as $x) {
                if (is_object($x) && isset($x->id) && isset($x->state) && (int)$x->id > 0 && (int)$x->id !== $fid) {
                    $items[] = [(int)$x->id, $x->state, isset($x->results) ? $x->results : null, isset($x->pollres) ? $x->pollres : null, isset($x->hwres) ? $x->hwres : null, isset($x->msgres) ? $x->msgres : null];
                }
            }
        }
        foreach ($items as $k => $it) $items[$k][1] = restore_one_state($it[1]);
        return with_lock('state', function () use ($items) {
            bk_make('safe');
            $ids = []; $ns = 0; $nq = 0;
            foreach ($items as $it) {
                $ids[] = $it[0]; $ns += count($it[1]->st); $nq += count($it[1]->quizzes);
                restore_files($it[0], $it[1], $it[2], $it[3], $it[4], $it[5]);
            }
            $old = cls_reg();
            foreach ($old['ids'] as $c) if (!in_array($c, $ids, true)) { @unlink(p_state($c)); @unlink(p_res($c)); @unlink(p_poll($c)); @unlink(p_hw($c)); @unlink(p_msg($c)); }
            cls_save(['nid' => max($ids) + 1, 'ids' => $ids]);
            return ['ok' => 1, 'st' => $ns, 'qz' => $nq, 'cl' => count($ids)];
        });
    }
    $state = null; $res = null; $pres = null; $hwr = null; $msr = null;
    if (isset($o->state) && is_object($o->state)) { $state = $o->state; if (isset($o->results) && is_object($o->results)) $res = $o->results; if (isset($o->pollres) && is_object($o->pollres)) $pres = $o->pollres; if (isset($o->hwres) && is_object($o->hwres)) $hwr = $o->hwres; if (isset($o->msgres) && is_object($o->msgres)) $msr = $o->msgres; }
    elseif (isset($o->st) && is_array($o->st)) { $state = $o; }
    if (!$state) out(400, ['error' => 'bad_file']);
    $state = restore_one_state($state); $c = $CID;
    return with_lock('state', function () use ($state, $res, $pres, $hwr, $msr, $c) {
        if (raw_file(p_state($c), '') !== '') bk_make('safe');
        restore_files($c, $state, $res, $pres, $hwr, $msr);
        return ['ok' => 1, 'st' => count($state->st), 'qz' => count($state->quizzes), 'at' => $res ? count($res->a) : null, 'rev' => $state->rev];
    });
}

if (defined('TG_CLI')) return;   // tg-setup.php فقط توابع را می‌خواهد

// ---------- routing ----------
set_exception_handler(function ($e) { out(500, ['error' => 'server_error']); });
$u = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$u = rtrim($u, '/'); if ($u === '') $u = '/';
if (substr($u, -10) === '/index.php') $u = substr($u, 0, -9) ?: '/';
$method = $_SERVER['REQUEST_METHOD'];
$ip = client_ip();
$w = who(); $isA = $w && $w[0] === 'a';
$isS = $w && $w[0] === 's' && count($w) === 5;

// ----- telegram webhook -----
if (strpos($u, '/tg/') === 0) { tg_webhook(substr($u, 4)); }

// ----- public: آیکون اعلان اندروید (از ربات تلگرام تغییر می‌کند؛ محتوای حساس ندارد) -----
if ($u === '/api/notif-icon' && ($method === 'GET' || $method === 'HEAD')) {
    $nf = $DIR . '/notif-icon.img';
    if (!is_file($nf)) { http_response_code(404); header('Cache-Control: no-store'); exit; }
    $inf = @getimagesize($nf);
    $etag = '"' . md5_file($nf) . '"';
    header('ETag: ' . $etag); header('Cache-Control: no-cache'); header('X-Content-Type-Options: nosniff');
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) { http_response_code(304); exit; }
    header('Content-Type: ' . (($inf && !empty($inf['mime'])) ? $inf['mime'] : 'image/png'));
    header('Content-Length: ' . filesize($nf));
    if ($method !== 'HEAD') readfile($nf);
    exit;
}

// ----- auth: teacher -----
if ($u === '/api/login' && $method === 'POST') {
    if (too_many($ip)) out(429, ['error' => 'too_many']);
    if (empty($SETTINGS['hash']) && ADMIN_PASS === DEFAULT_PASS) out(403, ['error' => 'setup_required']);   // رمز پیش‌فرض عمومی است؛ ورود با آن ممنوع
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $okU = same(strtolower(trim(isset($b['user']) ? (string)$b['user'] : '')), strtolower(admin_user()));
    $okP = check_pass(isset($b['pass']) ? (string)$b['pass'] : '');
    if ($okU && $okP) { clear_fail($ip); out(200, ['ok' => 1], [admin_cookie()]); }
    add_fail($ip); out(401, ['error' => 'bad_credentials']);
}
if ($u === '/api/logout') out(200, ['ok' => 1], ['Set-Cookie: sid=; Max-Age=0; Path=/']);

// ----- auth: student (username + password; works for every class) -----
if ($u === '/api/student/login' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $uid = trim(fa_digits(isset($b['user']) ? $b['user'] : (isset($b['id']) ? $b['id'] : '')));
    $pw = trim(fa_digits(isset($b['pass']) ? $b['pass'] : (isset($b['code']) ? $b['code'] : '')));
    $key = $ip . '|' . strtolower($uid);
    if (too_many($key)) out(429, ['error' => 'too_many']);
    $acc = find_account($uid);
    $plat = (isset($b['platform']) && $b['platform'] === 'android') ? 'android' : 'web';
    if ($acc) use_class($acc[0]);
    if ($acc && !empty($acc[1]['code']) && same($pw, fa_digits(trim((string)$acc[1]['code'])))) {
        $st = $acc[1];
        if (!empty($st['off'])) out(403, ['error' => 'blocked']);
        clear_fail($key);
        with_lock('logins', function () use ($st, $plat, $acc) {
            global $LOGS;
            $logs = read_json($LOGS, []); if (!is_array($logs)) $logs = [];
            array_unshift($logs, ['n' => $st['name'], 'p' => $plat, 't' => now_ms(), 'c' => (int)$acc[0]]);
            write_raw($LOGS, enc(array_slice($logs, 0, 200)));
        });
        act_log('login', $plat === 'android' ? 'با اپ اندروید وارد شد' : 'وارد حساب خود شد', $st['id'], $st['name']);
        seen_touch($st['id']);
        out(200, ['ok' => 1, 'name' => $st['name'], 'token' => mk('s|' . (int)$acc[0] . '|' . $st['id'] . '|' . pwh($st) . '|' . (now_ms() + 30 * 86400000))]);
    }
    if ($acc) act_log('login_fail', 'رمز اشتباه وارد کرد', $acc[1]['id'], $acc[1]['name']);
    add_fail($key); out(401, ['error' => 'bad_credentials']);
}
if (strpos($u, '/api/student/') === 0) {
    if (!$isS) out(401, ['error' => 'auth']);
    $cr = cls_reg(); if (!in_array((int)$w[1], $cr['ids'], true)) out(401, ['error' => 'auth']);
    use_class((int)$w[1]);
    $data = load_state(); $me = find_student($data, $w[2]);
    if (!$me || !hash_equals(pwh($me), (string)$w[3]) || !empty($me['off'])) out(401, ['error' => 'auth']);
    $sid = (int)$me['id'];

    if ($u === '/api/student/me') out(200, ['name' => $me['name']]);

    if ($u === '/api/student/home') {
        global $CATS;
        $cfg = cfg_of($data); $n = now_ms(); $r = res_load();
        apply_links($data, $r); seen_touch($sid);
        $mine = [];
        foreach ($r['a'] as $a) if ((int)$a['sid'] === $sid) $mine[] = $a;
        $qs = [];
        foreach ($data['quizzes'] as $q) {
            if (!qz_on($q)) continue;
            $used = 0; $best = null; $last = null; $running = false;
            foreach ($mine as $a) {
                if ((string)$a['qid'] !== (string)$q['id']) continue;
                $stt = att_state($a, $n); $used++;
                if ($stt === 'run') $running = true;
                if ($stt === 'done' || $stt === 'exp') {
                    if ($best === null || $a['sc'] > $best) $best = (float)$a['sc'];
                    if ($last === null || $a['e'] > $last['en']) $last = ['id' => $a['id'], 'sc' => (float)$a['sc'], 'c' => (int)$a['c'], 't' => (int)$a['t'], 'en' => $a['e']];
                }
            }
            $qs[] = ['id' => $q['id'], 't' => (string)$q['t'], 'd' => isset($q['d']) ? (string)$q['d'] : '', 'm' => (int)$q['m'], 'n' => count($q['qs']), 'at' => isset($q['at']) ? (int)$q['at'] : 1, 'used' => $used, 'best' => $best, 'last' => $last, 'status' => qz_status($q, $n), 'from' => isset($q['from']) ? (float)$q['from'] : 0, 'to' => isset($q['to']) ? (float)$q['to'] : 0, 'running' => $running];
        }
        $ann = array_values(array_filter($data['ann'], function ($x) { return is_array($x) && empty($x['hide']); }));
        usort($ann, function ($a, $b) { $pa = !empty($a['pin']) ? 1 : 0; $pb = !empty($b['pin']) ? 1 : 0; return $pb <=> $pa ?: ((float)$b['d'] <=> (float)$a['d']); });
        $ann = array_map(function ($x) { return ['id' => $x['id'], 't' => (string)$x['t'], 'b' => isset($x['b']) ? (string)$x['b'] : '', 'd' => (float)$x['d'], 'pin' => !empty($x['pin'])]; }, array_slice($ann, 0, 20));
        $sg = !empty($cfg['showGrades']);
        $cats = []; $grades = [];
        if ($sg) {
            foreach ($CATS as $k => $nm) {
                $cats[] = ['k' => $k, 'name' => $nm, 'avg' => rnd(avg_of(scores_of($data, $k, $sid)))];
                foreach ($data['gr'][$k]['items'] as $i) if (isset($i['sc']) && is_array($i['sc']) && isset($i['sc'][$sid]) && $i['sc'][$sid] !== '') $grades[] = ['cat' => $k, 'catName' => $nm, 'title' => (string)$i['t'], 'sc' => (float)$i['sc'][$sid]];
            }
        }
        $all = [];
        foreach ($CATS as $k => $_) $all = array_merge($all, scores_of($data, $k, $sid));
        $ac = att_counts($data, $sid); $tot = $ac['p'] + $ac['a'] + $ac['l'];
        $totals = [];
        foreach ($data['st'] as $s) if (is_array($s) && isset($s['id'])) $totals[] = ['id' => $s['id'], 'n' => $s['name'], 'p' => pts_of($data, $s['id'])];
        usort($totals, function ($a, $b) { return $b['p'] <=> $a['p']; });
        $rank = null; foreach ($totals as $i => $t) if ((int)$t['id'] === $sid) $rank = $i + 1;
        $board = [];
        if (!empty($cfg['board'])) foreach (array_slice($totals, 0, 5) as $t) if ($t['p'] > 0) $board[] = ['n' => $t['n'], 'pts' => $t['p']];
        $hist = [];
        foreach (array_reverse($mine) as $a) {
            $stt = att_state($a, $n); if ($stt === 'run') continue;
            $q = find_quiz($data, $a['qid']);
            $hist[] = ['id' => $a['id'], 'qid' => $a['qid'], 'title' => $q ? (string)$q['t'] : 'کوییز حذف‌شده', 'sc' => (float)$a['sc'], 'c' => (int)$a['c'], 't' => (int)$a['t'], 'en' => $a['e'], 'exp' => $stt === 'exp', 'pend' => !empty($a['pend'])];
            if (count($hist) >= 30) break;
        }
        $polls = [];
        if (!isset($cfg['polls']) || $cfg['polls']) {
            $pr = pr_load();
            foreach ($data['polls'] as $p) {
                if (!is_array($p) || !qz_on($p) || empty($p['qs'])) continue;
                $done = false;
                foreach ($pr['r'] as $x) if ((string)$x['pid'] === (string)$p['id'] && (int)$x['sid'] === $sid) { $done = true; break; }
                $polls[] = poll_public($p, $n, $done);
            }
        }
        $hws = []; $hr = hw_load();
        foreach ($data['hw'] as $h) {
            if (!is_array($h) || !qz_on($h)) continue;
            $mine = null;
            foreach ($hr['r'] as $x) if ((string)$x['hid'] === (string)$h['id'] && (int)$x['sid'] === $sid) { $mine = $x; break; }
            $due = isset($h['due']) ? (float)$h['due'] : 0;
            $hws[] = ['id' => $h['id'], 't' => (string)$h['t'], 'd' => isset($h['d']) ? (string)$h['d'] : '', 'due' => $due, 'link' => isset($h['link']) ? (string)$h['link'] : '', 'c' => isset($h['c']) ? (float)$h['c'] : 0, 'late' => $due > 0 && $n > $due,
                'sub' => $mine ? ['x' => (string)$mine['x'], 't' => $mine['t'], 'f' => isset($mine['f']) ? (string)$mine['f'] : '', 'sc' => isset($mine['sc']) ? $mine['sc'] : null, 'late' => !empty($mine['late'])] : null];
        }
        $sched = [];
        foreach ($data['sched'] as $x) if (is_array($x) && isset($x['t'])) $sched[] = ['day' => (int)(isset($x['day']) ? $x['day'] : 0), 'time' => (string)(isset($x['time']) ? $x['time'] : ''), 't' => (string)$x['t']];
        $badges = isset($me['badges']) && is_array($me['badges']) ? array_values($me['badges']) : [];
        $msgs = []; $mr = msg_load();
        foreach ($mr['m'] as $x) if ((int)$x['sid'] === $sid) $msgs[] = ['id' => $x['id'], 'from' => $x['from'], 'x' => (string)$x['x'], 't' => $x['t']];
        $msgs = array_slice($msgs, -40);
        $showAtt = !isset($cfg['showAtt']) || $cfg['showAtt']; $showRank = !isset($cfg['showRank']) || $cfg['showRank'];
        out(200, ['av' => av_ver('s' . $CID . '-' . $sid), 'name' => $me['name'], 'id' => $sid, 'user' => isset($me['user']) ? (string)$me['user'] : '', 'now' => $n,
            'cfg' => ['cls' => $cfg['cls'], 'school' => $cfg['school'], 'teacher' => $cfg['teacher'], 'showGrades' => $sg, 'board' => !empty($cfg['board']), 'showAtt' => $showAtt, 'showRank' => $showRank, 'polls' => !isset($cfg['polls']) || !empty($cfg['polls'])],
            'ann' => $ann, 'quizzes' => $qs, 'polls' => $polls, 'hw' => $hws, 'sched' => $sched, 'badges' => $badges, 'msgs' => $msgs,
            'me' => ['avg' => $sg ? rnd(avg_of($all)) : null, 'cats' => $cats, 'final' => $sg ? rnd(final_of($data, $sid)) : null, 'att' => $showAtt ? ['p' => $ac['p'], 'a' => $ac['a'], 'l' => $ac['l'], 'pct' => $tot ? (int)round($ac['p'] / $tot * 100) : null] : null, 'pts' => pts_of($data, $sid), 'rank' => $showRank ? $rank : null, 'count' => count($totals)],
            'grades' => $grades, 'board' => $board, 'attempts' => $hist]);
    }

    if ($u === '/api/student/quiz/start' && $method === 'POST') {
        list($b) = body_json(); if (!is_array($b)) $b = [];
        $q = find_quiz($data, isset($b['id']) ? $b['id'] : '');
        if (!$q || !qz_on($q) || empty($q['qs'])) out(404, ['error' => 'not_found']);
        $n = now_ms(); $stt = qz_status($q, $n);
        if ($stt !== 'open') out(403, ['error' => $stt]);
        $res = with_lock('results', function () use ($q, $sid, $me, $n) {
            $r = res_load(); $cnt = 0; $run = null;
            foreach ($r['a'] as $i => $a) {
                if ((int)$a['sid'] !== $sid || (string)$a['qid'] !== (string)$q['id']) continue;
                if ($a['st'] === 'run') {
                    if ($n <= (float)$a['dl'] + GRACE_MS) { $run = $a; $cnt++; continue; }
                    $r['a'][$i]['st'] = 'exp'; $r['a'][$i]['e'] = (int)$a['dl']; $r['a'][$i]['sc'] = 0; $r['a'][$i]['c'] = 0; $r['a'][$i]['ok'] = [];
                }
                $cnt++;
            }
            if ($run) { res_save($r); return ['a' => $run, 'resumed' => true]; }
            $at = isset($q['at']) ? (int)$q['at'] : 1;
            if ($at > 0 && $cnt >= $at) { res_save($r); return ['err' => 'no_attempts']; }
            $nq = count($q['qs']); $qo = range(0, $nq - 1); $po = [];
            if (!empty($q['sh'])) shuffle($qo);
            foreach ($q['qs'] as $i => $qq) { if (is_desc($qq) || empty($qq['o'])) { $po[$i] = []; continue; } $p = range(0, count($qq['o']) - 1); if (!empty($q['so'])) shuffle($p); $po[$i] = $p; }
            $a = ['id' => $r['nid']++, 'qid' => (int)$q['id'], 'sid' => $sid, 'n' => (string)$me['name'], 's' => $n, 'e' => 0, 'dl' => $n + (int)$q['m'] * 60000, 'st' => 'run', 'qo' => $qo, 'po' => $po, 'ans' => [], 'sc' => null, 'c' => 0, 't' => $nq, 'ok' => []];
            $r['a'][] = $a;
            res_save($r);
            return ['a' => $a, 'resumed' => false];
        });
        if (isset($res['err'])) out(403, ['error' => $res['err']]);
        if (empty($res['resumed'])) act_log('quiz_start', 'آزمون «' . s_str($q['t'], 60) . '» را شروع کرد', $sid, $me['name']);
        $a = $res['a']; $qs = [];
        foreach ($a['qo'] as $orig) {
            if (!isset($q['qs'][$orig])) continue;
            $qq = $q['qs'][$orig]; $opts = [];
            foreach ($a['po'][$orig] as $j) $opts[] = (string)$qq['o'][$j];
            $qs[] = ['q' => (string)$qq['q'], 'o' => $opts, 'k' => is_desc($qq) ? 'desc' : 'mc', 'w' => qw($qq)];
        }
        out(200, ['aid' => $a['id'], 'title' => (string)$q['t'], 'm' => (int)$q['m'], 'serverNow' => $n, 'deadline' => (float)$a['dl'], 'resumed' => $res['resumed'], 'qs' => $qs]);
    }

    if ($u === '/api/student/quiz/submit' && $method === 'POST') {
        list($b) = body_json(20000000); if (!is_array($b)) $b = [];
        $aid = isset($b['aid']) ? (int)$b['aid'] : 0; $ans = isset($b['ans']) && is_array($b['ans']) ? array_values($b['ans']) : [];
        $res = with_lock('results', function () use ($aid, $sid, $ans, $data) {
            $r = res_load(); $n = now_ms();
            foreach ($r['a'] as $i => $a) {
                if ((int)$a['id'] !== $aid || (int)$a['sid'] !== $sid) continue;
                if ($a['st'] !== 'run') return ['err' => 'already_done'];
                $q = find_quiz($data, $a['qid']);
                $late = $n > (float)$a['dl'] + GRACE_MS;
                $clean = []; $ok = []; $da = []; $t = count($a['qo']);
                foreach ($a['qo'] as $k => $orig) {
                    $qq = $q && isset($q['qs'][$orig]) ? $q['qs'][$orig] : null;
                    if ($qq && is_desc($qq)) {
                        $clean[$k] = null; $ok[$orig] = 0;
                        $v = isset($ans[$k]) && is_array($ans[$k]) ? $ans[$k] : [];
                        if (!$late) {
                            $x = trim(s_str(isset($v['x']) ? $v['x'] : '', 3000)); $img = '';
                            $jb = isset($v['img']) ? jpeg_from_dataurl($v['img'], 1800000) : null;
                            if ($jb !== null) { global $CID; $img = 'q' . (int)$CID . '-' . (int)$a['id'] . '-' . (int)$orig . '.jpg'; file_put_contents(up_dir() . '/' . $img, $jb, LOCK_EX); }
                            if ($x !== '' || $img !== '') $da[$orig] = ['x' => $x, 'img' => $img];
                        }
                        continue;
                    }
                    $v = isset($ans[$k]) && is_numeric($ans[$k]) ? (int)$ans[$k] : null;
                    $po = $a['po'][$orig];
                    if ($v !== null && ($v < 0 || $v >= count($po))) $v = null;
                    if ($late) $v = null;
                    $clean[$k] = $v;
                    $good = $q && $qq && $v !== null && (int)$po[$v] === (int)$qq['c'];
                    $ok[$orig] = $good ? 1 : 0;
                }
                $r['a'][$i]['ans'] = $clean; $r['a'][$i]['ok'] = $ok; $r['a'][$i]['da'] = $da; $r['a'][$i]['gd'] = [];
                $r['a'][$i]['st'] = $late ? 'exp' : 'done'; $r['a'][$i]['e'] = $n;
                if ($q) rescore($r['a'][$i], $q);
                res_save($r);
                return ['a' => $r['a'][$i], 'q' => $q];
            }
            return ['err' => 'nf'];
        });
        if (isset($res['err'])) $res['err'] === 'already_done' ? out(409, ['error' => 'already_done']) : out(404, ['error' => 'not_found']);
        act_log('quiz_done', 'آزمون «' . s_str($res['q'] ? $res['q']['t'] : '', 60) . '» را تمام کرد؛ ' . (!empty($res['a']['pend']) ? 'پاسخ‌های تشریحی منتظر تصحیح شماست' : 'نمره ' . round((float)$res['a']['sc'], 2) . ' از ۲۰'), $sid, $me['name']);
        out(200, result_body($res['a'], $res['q']));
    }

    if ($u === '/api/student/poll/submit' && $method === 'POST') {
        list($b) = body_json(); if (!is_array($b)) $b = [];
        $p = find_poll($data, isset($b['id']) ? $b['id'] : '');
        if (!$p || !qz_on($p) || empty($p['qs'])) out(404, ['error' => 'not_found']);
        $n = now_ms(); $stt = qz_status($p, $n);
        if ($stt !== 'open') out(403, ['error' => $stt]);
        $ans = isset($b['a']) && is_array($b['a']) ? array_values($b['a']) : [];
        $clean = []; $any = false;
        foreach ($p['qs'] as $i => $q) {
            $v = isset($ans[$i]) ? $ans[$i] : null; $k = isset($q['k']) ? $q['k'] : 'one'; $no = isset($q['o']) && is_array($q['o']) ? count($q['o']) : 0;
            if ($k === 'one') { $v = (is_numeric($v) && (int)$v >= 0 && (int)$v < $no) ? (int)$v : null; }
            elseif ($k === 'multi') {
                $t = [];
                if (is_array($v)) foreach ($v as $x) if (is_numeric($x) && (int)$x >= 0 && (int)$x < $no && !in_array((int)$x, $t, true)) $t[] = (int)$x;
                sort($t); $v = count($t) ? $t : null;
            }
            elseif ($k === 'rate') { $v = (is_numeric($v) && (int)$v >= 1 && (int)$v <= 5) ? (int)$v : null; }
            else { $v = is_scalar($v) ? trim(s_str($v, 600)) : ''; if ($v === '') $v = null; }
            if ($v !== null) $any = true;
            $clean[$i] = $v;
        }
        if (!$any) out(400, ['error' => 'empty']);
        $res = with_lock('pollres', function () use ($p, $sid, $clean, $n) {
            $r = pr_load();
            foreach ($r['r'] as $x) if ((string)$x['pid'] === (string)$p['id'] && (int)$x['sid'] === $sid) return 'dup';
            $r['r'][] = ['id' => $r['nid']++, 'pid' => (int)$p['id'], 'sid' => $sid, 't' => $n, 'a' => $clean];
            pr_save($r);
            return 'ok';
        });
        if ($res === 'dup') out(409, ['error' => 'already_done']);
        if (!empty($p['anon'])) act_log('poll', 'یک نفر در نظرسنجی ناشناس «' . s_str($p['t'], 60) . '» شرکت کرد', 0, '');
        else act_log('poll', 'در نظرسنجی «' . s_str($p['t'], 60) . '» شرکت کرد', $sid, $me['name']);
        out(200, ['ok' => 1]);
    }

    if ($u === '/api/student/hw/submit' && $method === 'POST') {
        list($b) = body_json(); if (!is_array($b)) $b = [];
        $h = null; $hid = isset($b['id']) ? (string)$b['id'] : '';
        foreach ($data['hw'] as $x) if (is_array($x) && isset($x['id']) && (string)$x['id'] === $hid) $h = $x;
        if (!$h || !qz_on($h)) out(404, ['error' => 'not_found']);
        $txt = trim(s_str(isset($b['x']) ? $b['x'] : '', 1500));
        $n = now_ms(); $due = isset($h['due']) ? (float)$h['due'] : 0; $late = ($due > 0 && $n > $due) ? 1 : 0;
        $res = with_lock('hwres', function () use ($h, $sid, $txt, $n, $late) {
            $r = hw_load();
            foreach ($r['r'] as $i => $x) {
                if ((string)$x['hid'] === (string)$h['id'] && (int)$x['sid'] === $sid) {
                    if (isset($x['sc'])) return 'locked';
                    $r['r'][$i]['x'] = $txt; $r['r'][$i]['t'] = $n; $r['r'][$i]['late'] = $late;
                    hw_save($r); return 'upd';
                }
            }
            $r['r'][] = ['id' => $r['nid']++, 'hid' => (int)$h['id'], 'sid' => $sid, 't' => $n, 'x' => $txt, 'late' => $late, 'f' => '', 'sc' => null];
            hw_save($r); return 'new';
        });
        if ($res === 'locked') out(409, ['error' => 'locked']);
        act_log('hw', 'تکلیف «' . s_str($h['t'], 60) . '» را تحویل داد' . ($late ? ' (با تأخیر)' : ''), $sid, $me['name']);
        out(200, ['ok' => 1]);
    }
    if ($u === '/api/student/msg' && $method === 'POST') {
        list($b) = body_json(); if (!is_array($b)) $b = [];
        $txt = trim(s_str(isset($b['x']) ? $b['x'] : '', 800));
        if ($txt === '') out(400, ['error' => 'empty']);
        $res = with_lock('msgs', function () use ($sid, $txt) {
            $r = msg_load(); $n = now_ms(); $c = 0;
            foreach ($r['m'] as $x) if ((int)$x['sid'] === $sid && $x['from'] === 's' && $n - $x['t'] < 3600000) $c++;
            if ($c >= 20) return 'flood';
            $r['m'][] = ['id' => $r['nid']++, 'sid' => $sid, 'from' => 's', 't' => $n, 'x' => $txt, 'r' => 0];
            if (count($r['m']) > 1500) $r['m'] = array_slice($r['m'], -1500);
            msg_save($r); return 'ok';
        });
        if ($res === 'flood') out(429, ['error' => 'too_many']);
        act_log('msg', 'برای شما پیام فرستاد: «' . s_str($txt, 80) . '»', $sid, $me['name']);
        out(200, ['ok' => 1]);
    }
    if ($u === '/api/student/avatar') {
        if ($method === 'POST') {
            list($b) = body_json(300000); if (!is_array($b)) $b = [];
            $jb = jpeg_from_dataurl(isset($b['img']) ? $b['img'] : '', 200000);
            if ($jb === null) out(400, ['error' => 'bad_image']);
            file_put_contents(av_dir() . '/s' . (int)$CID . '-' . $sid . '.jpg', $jb, LOCK_EX);
            out(200, ['ok' => 1, 'av' => av_ver('s' . (int)$CID . '-' . $sid)]);
        }
        if ($method === 'DELETE') { @unlink(av_dir() . '/s' . (int)$CID . '-' . $sid . '.jpg'); out(200, ['ok' => 1]); }
        send_jpeg(av_dir() . '/s' . (int)$CID . '-' . $sid . '.jpg');
    }
    if ($u === '/api/student/upload') {   // عکس پاسخ خود دانش‌آموز
        $nm = isset($_GET['n']) ? $_GET['n'] : '';
        if (!up_valid($nm)) out(404, ['error' => 'not_found']);
        $pp = explode('-', substr($nm, 1, -4)); $r = res_load(); $okk = false;
        foreach ($r['a'] as $a) if ((int)$a['id'] === (int)$pp[1] && (int)$a['sid'] === $sid && (int)$pp[0] === (int)$CID) $okk = true;
        if (!$okk) out(404, ['error' => 'not_found']);
        send_jpeg(up_dir() . '/' . $nm);
    }
    if ($u === '/api/student/attempt') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0; $r = res_load();
        foreach ($r['a'] as $a) if ((int)$a['id'] === $id && (int)$a['sid'] === $sid && att_state($a, now_ms()) !== 'run') out(200, result_body($a, find_quiz($data, $a['qid'])));
        out(404, ['error' => 'not_found']);
    }
    out(404, ['error' => 'not_found']);
}

// ----- teacher API -----
if (strpos($u, '/api/') === 0 && !$isA) out(401, ['error' => 'auth']);
use_class(valid_cid(isset($_GET['c']) ? $_GET['c'] : 0));

if ($u === '/api/classes' && $method === 'GET') {
    $reg = cls_reg(); $o = [];
    foreach ($reg['ids'] as $c) {
        $d = json_decode(raw_file(p_state($c), ''), true); if (!is_array($d)) $d = json_decode($EMPTY, true);
        $cf = isset($d['cfg']) && is_array($d['cfg']) ? $d['cfg'] : [];
        $r = json_decode(raw_file(p_res($c), ''), true);
        $o[] = ['id' => $c, 'name' => isset($cf['cls']) ? (string)$cf['cls'] : 'کلاس ' . $c, 'school' => isset($cf['school']) ? (string)$cf['school'] : '', 'teacher' => isset($cf['teacher']) ? (string)$cf['teacher'] : '',
            'st' => isset($d['st']) && is_array($d['st']) ? count($d['st']) : 0, 'qz' => isset($d['quizzes']) && is_array($d['quizzes']) ? count($d['quizzes']) : 0,
            'po' => isset($d['polls']) && is_array($d['polls']) ? count($d['polls']) : 0, 'at' => is_array($r) && isset($r['a']) && is_array($r['a']) ? count($r['a']) : 0];
    }
    out(200, ['list' => $o, 'cur' => $CID, 'max' => MAX_STUDENTS]);
}
if ($u === '/api/classes/add' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $name = trim(s_str(isset($b['name']) ? $b['name'] : '', 60));
    if ($name === '') out(400, ['error' => 'name']);
    $res = with_lock('state', function () use ($name, $EMPTY, $CID) {
        $reg = cls_reg();
        if (count($reg['ids']) >= 12) return ['err' => 'limit'];
        $src = json_decode(raw_file(p_state($CID), ''), true);
        $sc = is_array($src) && isset($src['cfg']) && is_array($src['cfg']) ? $src['cfg'] : [];
        $c = (int)$reg['nid']; $reg['nid'] = $c + 1; $reg['ids'][] = $c;
        $d = json_decode($EMPTY, true);
        $d['cfg'] = ['cls' => $name, 'school' => isset($sc['school']) ? $sc['school'] : '', 'teacher' => isset($sc['teacher']) ? $sc['teacher'] : '', 'showGrades' => true, 'board' => false, 'pass' => 10];
        $d['rev'] = 1;
        write_raw(p_state($c), enc($d)); cls_save($reg);
        return ['id' => $c];
    });
    if (isset($res['err'])) out(400, ['error' => $res['err']]);
    out(200, ['ok' => 1, 'id' => $res['id']]);
}
if ($u === '/api/classes/delete' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $id = isset($b['id']) ? (int)$b['id'] : 0;
    $res = with_lock('state', function () use ($id) {
        $reg = cls_reg();
        if (count($reg['ids']) < 2 || !in_array($id, $reg['ids'], true)) return 'bad';
        bk_make('safe');
        $reg['ids'] = array_values(array_filter($reg['ids'], function ($x) use ($id) { return $x !== $id; }));
        cls_save($reg); @unlink(p_state($id)); @unlink(p_res($id)); @unlink(p_poll($id)); @unlink(p_hw($id)); @unlink(p_msg($id));
        return 'ok';
    });
    if ($res !== 'ok') out(400, ['error' => 'bad']);
    out(200, ['ok' => 1]);
}
if ($u === '/api/taken') out(200, ['users' => users_taken($CID)]);
if ($u === '/api/activity') {
    $since = isset($_GET['since']) ? (int)$_GET['since'] : 0; $lim = min(400, max(1, isset($_GET['limit']) ? (int)$_GET['limit'] : 100));
    $r = read_json($ACT, []); $a = is_array($r) && isset($r['a']) && is_array($r['a']) ? $r['a'] : [];
    $last = $a ? (int)$a[0]['id'] : 0; $o = [];
    foreach ($a as $x) { if ((int)$x['id'] <= $since) break; $o[] = $x; if (count($o) >= $lim) break; }
    $sn = read_json($SEEN, []);
    out(200, ['last' => $last, 'items' => $o, 'seen' => (is_array($sn) && count($sn)) ? $sn : new stdClass()]);
}
if ($u === '/api/polls/results') {
    $d = load_state(); $r = pr_load(); $o = [];
    foreach ($r['r'] as $x) {
        $p = find_poll($d, $x['pid']); if (!$p) continue;
        $o[] = ['id' => $x['id'], 'pid' => $x['pid'], 'sid' => !empty($p['anon']) ? 0 : $x['sid'], 't' => $x['t'], 'a' => $x['a']];
    }
    out(200, ['r' => $o]);
}
if ($u === '/api/hw/results') { $r = hw_load(); out(200, ['r' => $r['r']]); }
if ($u === '/api/hw/review' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $id = isset($b['id']) ? (int)$b['id'] : 0; $f = trim(s_str(isset($b['f']) ? $b['f'] : '', 600));
    $nsc = isset($b['sc']) ? num_in($b['sc']) : null;
    $sc = $nsc !== null ? max(0, min(20, round($nsc, 2))) : null;
    with_lock('hwres', function () use ($id, $f, $sc) {
        $r = hw_load();
        foreach ($r['r'] as $i => $x) if ((int)$x['id'] === $id) { $r['r'][$i]['f'] = $f; $r['r'][$i]['sc'] = $sc; }
        hw_save($r);
    });
    out(200, ['ok' => 1]);
}
if ($u === '/api/hw/delete' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $id = isset($b['id']) ? (int)$b['id'] : 0; $hid = isset($b['hid']) ? (int)$b['hid'] : 0;
    with_lock('hwres', function () use ($id, $hid) {
        $r = hw_load();
        $r['r'] = array_values(array_filter($r['r'], function ($x) use ($id, $hid) { return $hid ? (int)$x['hid'] !== $hid : (int)$x['id'] !== $id; }));
        hw_save($r);
    });
    out(200, ['ok' => 1]);
}
if ($u === '/api/msgs') { $r = msg_load(); out(200, ['m' => $r['m']]); }
if ($u === '/api/msgs/reply' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $sid = isset($b['sid']) ? (int)$b['sid'] : 0; $txt = trim(s_str(isset($b['x']) ? $b['x'] : '', 800));
    if ($sid <= 0 || $txt === '') out(400, ['error' => 'empty']);
    with_lock('msgs', function () use ($sid, $txt) {
        $r = msg_load();
        foreach ($r['m'] as $i => $x) if ((int)$x['sid'] === $sid) $r['m'][$i]['r'] = 1;
        $r['m'][] = ['id' => $r['nid']++, 'sid' => $sid, 'from' => 't', 't' => now_ms(), 'x' => $txt, 'r' => 1];
        msg_save($r);
    });
    out(200, ['ok' => 1]);
}
if ($u === '/api/msgs/read' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $sid = isset($b['sid']) ? (int)$b['sid'] : 0;
    with_lock('msgs', function () use ($sid) {
        $r = msg_load();
        foreach ($r['m'] as $i => $x) if ((int)$x['sid'] === $sid) $r['m'][$i]['r'] = 1;
        msg_save($r);
    });
    out(200, ['ok' => 1]);
}

if ($u === '/api/polls/reset' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $pid = isset($b['pid']) ? (int)$b['pid'] : 0; $id = isset($b['id']) ? (int)$b['id'] : 0;
    with_lock('pollres', function () use ($pid, $id) {
        $r = pr_load();
        $r['r'] = array_values(array_filter($r['r'], function ($x) use ($pid, $id) { return $pid ? (int)$x['pid'] !== $pid : (int)$x['id'] !== $id; }));
        pr_save($r);
    });
    out(200, ['ok' => 1]);
}


if ($u === '/api/state') {
    if ($method === 'PUT') {
        list($v, $s) = body_json();
        $o = json_decode($s);                           // objects stay objects ({} never becomes [])
        if (!is_object($o) || !isset($o->st) || !is_array($o->st)) out(400, ['error' => 'bad_request']);
        $cc = json_decode(raw_file($FILE, ''), true); $curN = is_array($cc) && isset($cc['st']) && is_array($cc['st']) ? count($cc['st']) : 0;
        if (count($o->st) > MAX_STUDENTS && count($o->st) > $curN) out(422, ['error' => 'too_many_students', 'max' => MAX_STUDENTS]);
        $taken = users_taken($CID); $seenU = [];
        foreach ($o->st as $sx) {
            if (!is_object($sx)) continue;
            $uu = isset($sx->user) ? strtolower(trim((string)$sx->user)) : '';
            if ($uu === '') continue;
            if (in_array($uu, $taken, true) || isset($seenU[$uu])) out(422, ['error' => 'dup_user', 'user' => $uu]);
            $seenU[$uu] = 1;
        }
        $res = with_lock('state', function () use ($o, $FILE, $EMPTY) {
            $curRaw = raw_file($FILE, ''); $cur = $curRaw !== '' ? json_decode($curRaw, true) : null;
            $curRev = is_array($cur) && isset($cur['rev']) ? (int)$cur['rev'] : 0;
            $inRev = isset($o->rev) ? (int)$o->rev : 0;
            if ($curRaw !== '' && $inRev !== $curRev) return ['conflict' => $curRev];
            if ($curRaw !== '') {
                $shrunk = is_array($cur) && isset($cur['st']) && count($cur['st']) >= 4 && count($o->st) < count($cur['st']) / 2;
                $auto = glob(bk_dir() . '/auto-*.json'); $newest = 0; foreach ($auto as $f) $newest = max($newest, filemtime($f));
                if ($shrunk) bk_make('safe');
                elseif (time() - $newest > 6 * 3600) bk_make('auto');
            }
            $o->rev = $curRev + 1;
            write_raw($FILE, enc($o));
            return ['rev' => $o->rev];
        });
        if (isset($res['conflict'])) out(409, ['error' => 'conflict', 'rev' => $res['conflict']]);
        out(200, ['ok' => 1, 'rev' => $res['rev']]);
    }
    header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    echo raw_file($FILE, $EMPTY); exit;
}
if ($u === '/api/logins') out(200, read_json($LOGS, []));
if ($u === '/api/results') {
    $r = res_load(); $n = now_ms(); $o = [];
    foreach ($r['a'] as $a) { $p = public_attempt($a, $n); if ($p['st'] === 'run') continue; $o[] = $p; }
    out(200, ['attempts' => $o]);
}
if ($u === '/api/attempt/detail') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0; $r = res_load(); $d = load_state();
    foreach ($r['a'] as $a) {
        if ((int)$a['id'] !== $id) continue;
        $q = find_quiz($d, $a['qid']); if (!$q) out(404, ['error' => 'no_quiz']);
        $items = [];
        foreach ($a['qo'] as $k => $orig) {
            if (!isset($q['qs'][$orig])) continue;
            $qq = $q['qs'][$orig]; $da = isset($a['da'][$orig]) ? $a['da'][$orig] : [];
            $it = ['i' => (int)$orig, 'q' => (string)$qq['q'], 'k' => is_desc($qq) ? 'desc' : 'mc', 'w' => qw($qq), 'e' => isset($qq['e']) ? (string)$qq['e'] : ''];
            if (is_desc($qq)) { $it['x'] = isset($da['x']) ? (string)$da['x'] : ''; $it['img'] = !empty($da['img']) ? (string)$da['img'] : ''; $it['pts'] = isset($a['gd'][$orig]) ? $a['gd'][$orig] : null; }
            else { $it['ok'] = !empty($a['ok'][$orig]); }
            $items[] = $it;
        }
        out(200, ['id' => $a['id'], 'n' => $a['n'], 'sid' => $a['sid'], 'sc' => $a['sc'], 'pend' => !empty($a['pend']), 'title' => (string)$q['t'], 'items' => $items]);
    }
    out(404, ['error' => 'not_found']);
}
if ($u === '/api/attempt/grade' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    $id = isset($b['id']) ? (int)$b['id'] : 0; $g = isset($b['g']) && is_array($b['g']) ? $b['g'] : [];
    $d = load_state();
    $res = with_lock('results', function () use ($id, $g, $d) {
        $r = res_load();
        foreach ($r['a'] as $i => $a) {
            if ((int)$a['id'] !== $id) continue;
            $q = find_quiz($d, $a['qid']); if (!$q) return null;
            if (!isset($r['a'][$i]['gd']) || !is_array($r['a'][$i]['gd'])) $r['a'][$i]['gd'] = [];
            foreach ($g as $orig => $v) {
                $orig = (int)$orig; if (!isset($q['qs'][$orig]) || !is_desc($q['qs'][$orig])) continue;
                $nv = num_in($v);
                if ($nv === null) { unset($r['a'][$i]['gd'][$orig]); continue; }
                $r['a'][$i]['gd'][$orig] = round(max(0, min(qw($q['qs'][$orig]), $nv)), 2);
            }
            rescore($r['a'][$i], $q); res_save($r);
            return ['sc' => $r['a'][$i]['sc'], 'pend' => $r['a'][$i]['pend']];
        }
        return null;
    });
    if (!$res) out(404, ['error' => 'not_found']);
    out(200, ['ok' => 1] + $res);
}
if ($u === '/api/upload') {
    $nm = isset($_GET['n']) ? $_GET['n'] : ''; if (!up_valid($nm)) out(404, ['error' => 'not_found']);
    send_jpeg(up_dir() . '/' . $nm);
}
if ($u === '/api/avatars') {
    $o = ['t' => av_ver('t'), 's' => new stdClass()]; $m = [];
    $d = load_state();
    foreach ($d['st'] as $s2) if (is_array($s2) && isset($s2['id'])) { $v = av_ver('s' . $CID . '-' . $s2['id']); if ($v) $m[(string)$s2['id']] = $v; }
    if ($m) $o['s'] = $m;
    out(200, $o);
}
if ($u === '/api/avatar') {   // ?w=t یا ?w=<id دانش‌آموز>
    $w2 = isset($_GET['w']) ? $_GET['w'] : 't';
    $key = $w2 === 't' ? 't' : 's' . (int)$CID . '-' . (int)$w2;
    if ($method === 'POST') {
        list($b) = body_json(300000); if (!is_array($b)) $b = [];
        $jb = jpeg_from_dataurl(isset($b['img']) ? $b['img'] : '', 200000);
        if ($jb === null) out(400, ['error' => 'bad_image']);
        file_put_contents(av_dir() . '/' . $key . '.jpg', $jb, LOCK_EX);
        out(200, ['ok' => 1, 'v' => av_ver($key)]);
    }
    if ($method === 'DELETE') { @unlink(av_dir() . '/' . $key . '.jpg'); out(200, ['ok' => 1]); }
    send_jpeg(av_dir() . '/' . $key . '.jpg');
}
if ($u === '/api/results/delete' && $method === 'POST') {
    list($b) = body_json(); $id = isset($b['id']) ? (int)$b['id'] : 0; $all = isset($b['qid']) ? (int)$b['qid'] : 0;
    with_lock('results', function () use ($id, $all) {
        $r = res_load();
        $r['a'] = array_values(array_filter($r['a'], function ($a) use ($id, $all) { return $all ? (int)$a['qid'] !== $all : (int)$a['id'] !== $id; }));
        res_save($r);
    });
    out(200, ['ok' => 1]);
}
if ($u === '/api/info') {
    $size = 0; foreach (glob($DIR . '/*.json') as $f) $size += filesize($f);
    $bl = bk_list(); $auto = null; foreach ($bl as $x) if ($x['kind'] === 'auto') { $auto = $x['t']; break; }
    $base = (is_https() ? 'https' : 'http') . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost');
    out(200, ['ver' => APP_VER, 'max' => MAX_STUDENTS, 'php' => PHP_VERSION, 'base' => $base, 'https' => is_https(), 'weak' => weak_pass(), 'user' => admin_user(), 'size' => $size, 'backups' => count($bl), 'lastAuto' => $auto, 'writable' => is_writable($DIR), 'apk' => is_file(__DIR__ . '/class-app.apk')]);
}
if ($u === '/api/password' && $method === 'POST') {
    list($b) = body_json(); if (!is_array($b)) $b = [];
    if (too_many('pw|' . $ip)) out(429, ['error' => 'too_many']);
    if (!check_pass(isset($b['old']) ? (string)$b['old'] : '')) { add_fail('pw|' . $ip); out(401, ['error' => 'bad_credentials']); }
    $new = isset($b['new']) ? (string)$b['new'] : ''; $user = trim(isset($b['user']) ? (string)$b['user'] : '');
    if (strlen($new) < 8) out(400, ['error' => 'short']);
    if ($user === '' || strlen($user) > 40) $user = admin_user();
    $set = $SETTINGS; $set['hash'] = password_hash($new, PASSWORD_DEFAULT); $set['user'] = $user; $set['sv'] = bin2hex(random_bytes(6));
    with_lock('settings', function () use ($set, $SET) { write_raw($SET, enc($set)); });
    $SV = $set['sv'];                                  // new key: every old session dies, this one gets a fresh cookie
    clear_fail('pw|' . $ip);
    out(200, ['ok' => 1], [admin_cookie()]);
}

// ----- backup & restore -----
if ($u === '/api/backup') {
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="class-backup-' . date('Y-m-d') . '.json"');
    header('Cache-Control: no-store');
    echo bk_build(); exit;
}
if ($u === '/api/restore' && $method === 'POST') {
    $s = file_get_contents('php://input');
    if (strlen($s) > 40000000) out(413, ['error' => 'too_big']);
    $o = json_decode($s);
    out(200, restore_obj($o));
}
if ($u === '/api/backups') out(200, ['list' => bk_list()]);
if ($u === '/api/backups/create' && $method === 'POST') { $n = with_lock('state', function () { return bk_make('manual'); }); out(200, ['ok' => 1, 'name' => $n]); }
if ($u === '/api/backups/download') {
    $n = isset($_GET['name']) ? $_GET['name'] : '';
    if (!bk_valid_name($n) || !is_file(bk_dir() . '/' . $n)) out(404, ['error' => 'not_found']);
    header('Content-Type: application/json; charset=utf-8'); header('Content-Disposition: attachment; filename="' . $n . '"'); header('Cache-Control: no-store');
    readfile(bk_dir() . '/' . $n); exit;
}
if ($u === '/api/backups/restore' && $method === 'POST') {
    list($b) = body_json(); $n = isset($b['name']) ? $b['name'] : '';
    if (!bk_valid_name($n) || !is_file(bk_dir() . '/' . $n)) out(404, ['error' => 'not_found']);
    out(200, restore_obj(json_decode(file_get_contents(bk_dir() . '/' . $n))));
}
if ($u === '/api/backups/delete' && $method === 'POST') {
    list($b) = body_json(); $n = isset($b['name']) ? $b['name'] : '';
    if (!bk_valid_name($n)) out(404, ['error' => 'not_found']);
    @unlink(bk_dir() . '/' . $n); out(200, ['ok' => 1]);
}

// ----- pages -----
if ($u === '/') {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Frame-Options: DENY');
    readfile(__DIR__ . '/app.html'); exit;
}
if (($u === '/app' || $u === '/student.html') && is_file(__DIR__ . '/student.html')) {   // fallback when mod_rewrite is off
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile(__DIR__ . '/student.html'); exit;
}
out(404, ['error' => 'not_found']);
