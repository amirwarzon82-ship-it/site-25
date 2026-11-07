<?php
// === تنظیمات پنل — روی Railway همه‌ی مقدارها از Variables خوانده می‌شود ===
// فایل را ویرایش نکنید؛ در Railway این متغیرها را بسازید:
//   ADMIN_USER, ADMIN_PASS, SESSION_SECRET  (اجباری)
//   DATA_DIR (پیش‌فرض /data)، MAX_STUDENTS (اختیاری)
function cp_env($k, $d = '') {
    $v = getenv($k);
    if ($v === false || $v === '') $v = isset($_SERVER[$k]) ? $_SERVER[$k] : (isset($_ENV[$k]) ? $_ENV[$k] : '');
    return ($v === false || $v === '' || $v === null) ? $d : $v;
}
define('ADMIN_USER', cp_env('ADMIN_USER', 'teacher'));                                   // نام کاربری استاد
define('ADMIN_PASS', cp_env('ADMIN_PASS', 'change-this-strong-password'));               // رمز عبور قوی
define('SESSION_SECRET', cp_env('SESSION_SECRET', 'put-a-long-random-string-here-sdf8923kjsdf09sd8f')); // متن طولانی و تصادفی
define('DATA_DIR', cp_env('DATA_DIR', ''));                                              // مسیر Volume (روی Railway: /data)
if ((int)cp_env('MAX_STUDENTS', 0) > 0) define('MAX_STUDENTS', (int)cp_env('MAX_STUDENTS', 30));
// --- ربات تلگرام و ساخت اپ (اختیاری) ---
//   TELEGRAM_BOT_TOKEN  توکن ربات از @BotFather
//   TELEGRAM_ADMIN_IDS  شناسه‌ی عددی تلگرام ادمین‌ها، با کاما جدا شود (مثلاً 123456,789012)
//   GITHUB_TOKEN, GITHUB_REPO  برای ساخت خودکار APK (مثلاً user/class-panel)
//   PUBLIC_URL  آدرس سایت (اگر خالی باشد از دامنه‌ی Railway خوانده می‌شود)
define('TG_TOKEN', cp_env('TELEGRAM_BOT_TOKEN', ''));
define('TG_ADMINS', cp_env('TELEGRAM_ADMIN_IDS', ''));
define('GH_TOKEN', cp_env('GITHUB_TOKEN', ''));
define('GH_REPO', cp_env('GITHUB_REPO', ''));
define('GH_BRANCH', cp_env('GITHUB_BRANCH', 'main'));
define('PUBLIC_URL', cp_env('PUBLIC_URL', ''));
