#!/bin/sh
set -e

# ۱) فقط یک MPM (prefork) باید فعال باشد؛ هر MPM دیگری را از همه‌جا خاموش می‌کنیم
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
for f in $(grep -rl 'LoadModule mpm_\(event\|worker\)_module' /etc/apache2 2>/dev/null || true); do
  sed -i 's/^\([[:space:]]*LoadModule mpm_\(event\|worker\)_module\)/# \1/' "$f" || true
done
a2enmod mpm_prefork >/dev/null 2>&1 || true

# ۲) Railway پورت را در PORT می‌دهد
PORT="${PORT:-8080}"
echo "Listen ${PORT}" > /etc/apache2/ports.conf

# ۳) پوشه‌ی داده (Volume)
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
chown -R www-data:www-data "$DATA_DIR" || true
chmod 750 "$DATA_DIR" || true

# ۴) هشدارهای مفید در لاگ
if command -v mountpoint >/dev/null 2>&1; then
  if ! mountpoint -q "$DATA_DIR"; then
    echo "WARNING: $DATA_DIR is not a mounted Volume. Data will be LOST on every redeploy. Attach a Railway Volume at $DATA_DIR."
  fi
fi
if [ -z "$ADMIN_PASS" ]; then echo "WARNING: ADMIN_PASS is not set (default password in use)."; fi
if [ -z "$SESSION_SECRET" ]; then echo "WARNING: SESSION_SECRET is not set."; fi

# ۵) تست تنظیمات Apache (فقط برای نمایش در لاگ؛ اگر مشکل باشد دلیلش دیده می‌شود)
echo "--- Apache config test ---"
apache2ctl -t 2>&1 || echo "WARNING: Apache config test failed, see messages above."
echo "--- Enabled MPM modules ---"
ls /etc/apache2/mods-enabled | grep -i mpm || true

# ۶) ربات تلگرام: ثبت وب‌هوک + بررسی دوره‌ای ساخت اپ (فقط اگر TELEGRAM_BOT_TOKEN تنظیم شده باشد)
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  (sleep 5; su -s /bin/sh www-data -c "php /var/www/html/tg-setup.php" >/tmp/tg-setup.log 2>&1; cat /tmp/tg-setup.log) &
  if [ -n "$GITHUB_TOKEN" ]; then
    (while true; do sleep 20; su -s /bin/sh www-data -c "php /var/www/html/tg-cron.php" >/dev/null 2>&1; done) &
  fi
fi

echo "Class Panel listening on :${PORT}, data in ${DATA_DIR}"
exec "$@"
