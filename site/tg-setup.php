<?php
// فقط از خط فرمان (entrypoint) اجرا می‌شود: ثبت وب‌هوک ربات تلگرام
if (php_sapi_name() !== 'cli') { http_response_code(404); exit; }
define('TG_CLI', 1);
require __DIR__ . '/index.php';
if (!tg_on()) { echo "Telegram bot: TELEGRAM_BOT_TOKEN not set, skipped\n"; exit(0); }
$r = tg_set_webhook();
echo 'Telegram webhook: ' . json_encode($r, JSON_UNESCAPED_UNICODE) . "\n";
if ($r && !empty($r['ok'])) foreach (tg_admins() as $a) { $f = $DIR . '/.tg-hello-' . $a; if (!is_file($f)) { @file_put_contents($f, '1'); tg_send($a, "✅ ربات پنل استاد فعال شد.\nبرای شروع /start را بزنید.", KB([[B('🏠 منوی اصلی', 'm', 'primary')]])); } }
