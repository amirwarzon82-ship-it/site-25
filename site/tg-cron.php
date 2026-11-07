<?php
// فقط خط فرمان: بررسی ساخت‌های APK در حال انجام (هر ~۲۰ ثانیه از entrypoint)
if (php_sapi_name() !== 'cli') { http_response_code(404); exit; }
define('TG_CLI', 1);
require __DIR__ . '/index.php';
try { tg_cron(); } catch (Throwable $e) { error_log('tg-cron: ' . $e->getMessage()); }
