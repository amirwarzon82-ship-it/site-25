package ir.classpanel.student;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Icon;
import android.media.RingtoneManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private static final String TAG = "ClassApp";
    private static final String PREFS = "classapp";
    private static final String KEY_SERVER = "server";
    private static final String CONNECT_URL = "file:///android_asset/connect.html";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";

    private static final int REQ_FILE = 71;
    private static final int REQ_MEDIA_PERM = 72;
    private static final String KEY_ASKED_MEDIA = "asked_media";
    private static final String KEY_ICON_ETAG = "icon_etag";
    private static final String KEY_ICON_CHECK = "icon_check";
    private static final String ICON_FILE = "notif_icon.img";

    private WebView web;
    private SharedPreferences prefs;
    private String failedUrl = null;

    // انتخاب فایل / گالری / دوربین
    private ValueCallback<Uri[]> filePathCallback = null;
    private WebChromeClient.FileChooserParams pendingParams = null;
    private Uri cameraUri = null;
    private File cameraFile = null;

    // آیکون اعلان (از ربات تلگرام تغییر می‌کند)
    private Bitmap iconColor = null;
    private Bitmap iconMask = null;
    private long iconLoadedAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0E2A);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " ClassApp/3.0");

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new AppClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }

            // دکمه‌ی «انتخاب عکس / ارسال برگه» در صفحه‌ی وب
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                pendingParams = params;
                if (shouldAskMediaPermission()) {
                    prefs.edit().putBoolean(KEY_ASKED_MEDIA, true).apply();
                    String perm = Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
                    requestPermissions(new String[]{perm}, REQ_MEDIA_PERM);
                } else {
                    launchChooser();
                }
                return true;
            }
        });
        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                startDownload(url, userAgent, contentDisposition, mimeType);
            }
        });

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
        if (getServerPref().length() == 0) {
            String def = normalize(getString(R.string.default_server));
            if (def != null) prefs.edit().putString(KEY_SERVER, def).apply();
        }

        boolean restored = false;
        if (savedInstanceState != null) {
            restored = web.restoreState(savedInstanceState) != null;
        }
        if (!restored) {
            loadStart();
        }
        refreshNotifIcon(true);
    }

    // ---------- file chooser (گالری، فایل‌ها، دوربین) ----------

    /** مجوز عکس‌ها فقط یک‌بار و درست زمانی که کاربر می‌خواهد عکس بفرستد پرسیده می‌شود. */
    private boolean shouldAskMediaPermission() {
        if (Build.VERSION.SDK_INT < 23) return false;
        if (prefs.getBoolean(KEY_ASKED_MEDIA, false)) return false;
        String perm = Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
        return checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED;
    }

    private boolean acceptsImages(WebChromeClient.FileChooserParams p) {
        if (p == null) return true;
        String[] t = p.getAcceptTypes();
        if (t == null || t.length == 0) return true;
        for (String x : t) {
            if (x == null) continue;
            String l = x.toLowerCase();
            if (l.length() == 0 || l.contains("image") || l.contains("*/*") || l.endsWith(".jpg") || l.endsWith(".png") || l.endsWith(".jpeg")) return true;
        }
        return false;
    }

    private Intent buildCameraIntent() {
        try {
            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (cam.resolveActivity(getPackageManager()) == null) return null;
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists()) dir.mkdirs();
            File f = File.createTempFile("photo_", ".jpg", dir);
            Uri u = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            cameraFile = f;
            cameraUri = u;
            cam.putExtra(MediaStore.EXTRA_OUTPUT, u);
            cam.setClipData(ClipData.newRawUri("", u));
            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return cam;
        } catch (Exception e) {
            Log.d(TAG, "camera intent failed: " + e);
            cameraFile = null;
            cameraUri = null;
            return null;
        }
    }

    private void launchChooser() {
        Intent content;
        try {
            content = pendingParams != null ? pendingParams.createIntent() : null;
        } catch (Exception e) {
            content = null;
        }
        if (content == null) {
            content = new Intent(Intent.ACTION_GET_CONTENT);
            content.addCategory(Intent.CATEGORY_OPENABLE);
            content.setType("*/*");
        }
        Intent chooser = Intent.createChooser(content, "انتخاب فایل یا عکس");
        cameraFile = null;
        cameraUri = null;
        if (acceptsImages(pendingParams)) {
            Intent cam = buildCameraIntent();
            if (cam != null) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            }
        }
        try {
            startActivityForResult(chooser, REQ_FILE);
        } catch (ActivityNotFoundException e) {
            finishChooser(null);
            Toast.makeText(this, "برنامه‌ای برای انتخاب فایل پیدا نشد", Toast.LENGTH_LONG).show();
        }
    }

    private void finishChooser(Uri[] result) {
        ValueCallback<Uri[]> cb = filePathCallback;
        filePathCallback = null;
        pendingParams = null;
        if (cb != null) cb.onReceiveValue(result);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_FILE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            boolean hasPicked = data != null && (data.getData() != null || data.getClipData() != null);
            if (hasPicked) {
                results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            } else if (cameraFile != null && cameraUri != null && cameraFile.length() > 0) {
                results = new Uri[]{cameraUri};
            }
        }
        if (results == null && cameraFile != null && cameraFile.length() == 0) {
            cameraFile.delete();
        }
        finishChooser(results);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_MEDIA_PERM) {
            // چه کاربر اجازه بدهد چه ندهد، انتخابگر سیستم (بدون نیاز به مجوز) باز می‌شود
            if (filePathCallback != null) launchChooser();
        }
    }

    // ---------- downloads ----------

    private void startDownload(String url, String ua, String cd, String mime) {
        if (url == null) return;
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            Toast.makeText(this, "دانلود از این نوع لینک در اپ ممکن نیست؛ از مرورگر استفاده کنید", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) r.addRequestHeader("cookie", cookie);
            if (ua != null) r.addRequestHeader("User-Agent", ua);
            if (mime != null && mime.length() > 0) r.setMimeType(mime);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, cd, mime));
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(r);
                Toast.makeText(this, "دانلود شروع شد", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {
                Log.d(TAG, "download failed");
            }
        }
    }

    // ---------- آیکون اعلان (قابل تغییر از ربات تلگرام، بدون ساخت دوباره‌ی اپ) ----------

    /** آیکون را از سرور می‌گیرد (حداکثر هر ۱۰ دقیقه یک‌بار) و در حافظه‌ی اپ نگه می‌دارد. */
    private void refreshNotifIcon(boolean force) {
        final String server = getServerPref();
        if (server.length() == 0) return;
        long now = System.currentTimeMillis();
        if (!force && now - prefs.getLong(KEY_ICON_CHECK, 0) < 600000L) return;
        prefs.edit().putLong(KEY_ICON_CHECK, now).apply();
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(server + "/api/notif-icon").openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(10000);
                    File f = new File(getFilesDir(), ICON_FILE);
                    String et = prefs.getString(KEY_ICON_ETAG, null);
                    if (et != null && f.exists()) c.setRequestProperty("If-None-Match", et);
                    int code = c.getResponseCode();
                    if (code == 200) {
                        InputStream in = c.getInputStream();
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        int total = 0;
                        while ((n = in.read(buf)) > 0) {
                            total += n;
                            if (total > 4000000) throw new Exception("too big");
                            bo.write(buf, 0, n);
                        }
                        in.close();
                        FileOutputStream fo = new FileOutputStream(f);
                        fo.write(bo.toByteArray());
                        fo.close();
                        prefs.edit().putString(KEY_ICON_ETAG, c.getHeaderField("ETag")).apply();
                        iconLoadedAt = 0;
                    } else if (code == 404) {
                        if (f.exists()) f.delete();
                        prefs.edit().remove(KEY_ICON_ETAG).apply();
                        iconColor = null;
                        iconMask = null;
                        iconLoadedAt = 0;
                    }
                } catch (Exception e) {
                    Log.d(TAG, "icon refresh failed: " + e);
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    private synchronized void loadNotifIcons() {
        File f = new File(getFilesDir(), ICON_FILE);
        if (!f.exists()) {
            iconColor = null;
            iconMask = null;
            return;
        }
        if (iconLoadedAt == f.lastModified() && iconColor != null) return;
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(f.getAbsolutePath(), o);
            int big = Math.max(o.outWidth, o.outHeight);
            int sample = 1;
            while (big / (sample * 2) >= 256) sample *= 2;
            o = new BitmapFactory.Options();
            o.inSampleSize = sample;
            Bitmap src = BitmapFactory.decodeFile(f.getAbsolutePath(), o);
            if (src == null) {
                iconColor = null;
                iconMask = null;
                return;
            }
            iconColor = fitSquare(src, 192, false);
            iconMask = makeMask(src, 96);
            iconLoadedAt = f.lastModified();
        } catch (Throwable t) {
            Log.d(TAG, "icon load failed: " + t);
            iconColor = null;
            iconMask = null;
        }
    }

    /** تصویر را بدون تغییر نسبت، وسطِ یک مربع شفاف می‌گذارد. */
    private static Bitmap fitSquare(Bitmap src, int n, boolean pad) {
        float k = Math.min((float) n / src.getWidth(), (float) n / src.getHeight());
        int w = Math.max(1, Math.round(src.getWidth() * k));
        int h = Math.max(1, Math.round(src.getHeight() * k));
        Bitmap sc = Bitmap.createScaledBitmap(src, w, h, true);
        Bitmap out = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        cv.drawBitmap(sc, (n - w) / 2f, (n - h) / 2f, null);
        return out;
    }

    /**
     * اندروید برای آیکون کوچک فقط کانال آلفا را می‌خواند. اگر عکس شفافیت دارد از همان استفاده می‌شود؛
     * اگر نه (مثل JPG)، فاصله‌ی رنگ هر نقطه با رنگ پس‌زمینه (گوشه‌ی عکس) به‌عنوان شکل در نظر گرفته می‌شود.
     */
    private static Bitmap makeMask(Bitmap src, int n) {
        float k = Math.min((float) n / src.getWidth(), (float) n / src.getHeight());
        int w = Math.max(1, Math.round(src.getWidth() * k));
        int h = Math.max(1, Math.round(src.getHeight() * k));
        Bitmap sc = Bitmap.createScaledBitmap(src, w, h, true).copy(Bitmap.Config.ARGB_8888, true);
        int[] px = new int[w * h];
        sc.getPixels(px, 0, w, 0, 0, w, h);
        boolean hasAlpha = false;
        for (int p : px) {
            if ((p >>> 24) < 245) {
                hasAlpha = true;
                break;
            }
        }
        int bg = px[0];
        int br = (bg >> 16) & 255, bgc = (bg >> 8) & 255, bb = bg & 255;
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            int a;
            if (hasAlpha) {
                a = p >>> 24;
            } else {
                int dr = Math.abs(((p >> 16) & 255) - br);
                int dg = Math.abs(((p >> 8) & 255) - bgc);
                int db = Math.abs((p & 255) - bb);
                a = Math.min(255, Math.max(dr, Math.max(dg, db)) * 3);
            }
            px[i] = (a << 24) | 0x00FFFFFF;
        }
        sc.setPixels(px, 0, w, 0, 0, w, h);
        Bitmap out = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        cv.drawBitmap(sc, (n - w) / 2f, (n - h) / 2f, null);
        return out;
    }

    // ---------- URL helpers ----------

    private String getServerPref() {
        String v = prefs.getString(KEY_SERVER, "");
        return v == null ? "" : v;
    }

    /** Returns a clean base address (no trailing slash, no /app) or null if invalid. */
    private static String normalize(String raw) {
        if (raw == null) return null;
        String u = raw.trim();
        if (u.length() == 0) return null;
        if (u.indexOf(' ') >= 0) return null;
        String low = u.toLowerCase();
        if (!(low.startsWith("http://") || low.startsWith("https://"))) {
            u = "https://" + u;
        }
        u = stripTail(u);
        if (u.toLowerCase().endsWith("/app")) {
            u = u.substring(0, u.length() - 4);
            u = stripTail(u);
        }
        Uri uri = Uri.parse(u);
        String host = uri.getHost();
        if (host == null || host.length() == 0 || host.indexOf('.') < 0 && !"localhost".equals(host)) {
            return null;
        }
        return u;
    }

    private static String stripTail(String u) {
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u;
    }

    private String appUrl() {
        return getServerPref() + "/app";
    }

    private void loadStart() {
        if (getServerPref().length() == 0) {
            web.loadUrl(CONNECT_URL);
        } else {
            web.loadUrl(appUrl());
        }
    }

    private boolean handleUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("file:///android_asset/")) return false;
        try {
            String server = getServerPref();
            if (server.length() > 0) {
                String host = Uri.parse(server).getHost();
                String h = Uri.parse(url).getHost();
                if (host != null && host.equalsIgnoreCase(h)) return false;
            }
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            Log.d(TAG, "cannot open " + url);
        }
        return true;
    }

    private void showOffline(String url) {
        if (url != null && url.startsWith("file:")) return;
        failedUrl = url;
        web.loadUrl(OFFLINE_URL);
    }

    // ---------- WebView client ----------

    private class AppClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl().toString());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                showOffline(request.getUrl().toString());
            }
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            if (Build.VERSION.SDK_INT < 23) {
                showOffline(failingUrl);
            }
        }
    }

    // ---------- JS bridge ----------

    private class Bridge {
        @JavascriptInterface
        public boolean isApp() {
            return true;
        }

        @JavascriptInterface
        public String getServer() {
            return getServerPref();
        }

        @JavascriptInterface
        public boolean saveServer(String url) {
            final String n = normalize(url);
            if (n == null) return false;
            prefs.edit().putString(KEY_SERVER, n).remove(KEY_ICON_ETAG).apply();
            failedUrl = null;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    web.loadUrl(appUrl());
                }
            });
            return true;
        }

        @JavascriptInterface
        public void changeServer() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    failedUrl = null;
                    web.loadUrl(CONNECT_URL);
                }
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (getServerPref().length() == 0) {
                        web.loadUrl(CONNECT_URL);
                    } else if (failedUrl != null) {
                        web.loadUrl(failedUrl);
                    } else {
                        web.loadUrl(appUrl());
                    }
                }
            });
        }

        @JavascriptInterface
        public void setBars(final String hex) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int c = Color.parseColor(hex.trim());
                        Window w = getWindow();
                        w.setStatusBarColor(c);
                        w.setNavigationBarColor(c);
                        web.setBackgroundColor(c);
                        boolean light = (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) > 150;
                        if (Build.VERSION.SDK_INT >= 23) {
                            View d = w.getDecorView();
                            int f = d.getSystemUiVisibility();
                            d.setSystemUiVisibility(light ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR));
                        }
                    } catch (Exception e) {
                        Log.d(TAG, "setBars failed");
                    }
                }
            });
        }

        @JavascriptInterface
        public void notify(String title, String body) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;
                if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return;
                if (Build.VERSION.SDK_INT >= 26) {
                    NotificationChannel ch = new NotificationChannel("class_alerts", "اعلان‌های کلاس", NotificationManager.IMPORTANCE_HIGH);
                    ch.enableVibration(true);
                    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    nm.createNotificationChannel(ch);
                }
                Intent open = new Intent(MainActivity.this, MainActivity.class);
                open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int flags = Build.VERSION.SDK_INT >= 23 ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE) : PendingIntent.FLAG_UPDATE_CURRENT;
                PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, open, flags);
                Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(MainActivity.this, "class_alerts") : new Notification.Builder(MainActivity.this);

                loadNotifIcons();
                refreshNotifIcon(false);
                if (Build.VERSION.SDK_INT >= 23 && iconMask != null) {
                    b.setSmallIcon(Icon.createWithBitmap(iconMask));
                } else {
                    b.setSmallIcon(R.drawable.ic_stat_notify);
                }
                if (iconColor != null) b.setLargeIcon(iconColor);
                if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFF14B8A6);

                String t = title == null ? "" : title;
                String x = body == null ? "" : body;
                b.setContentTitle(t).setContentText(x).setAutoCancel(true).setContentIntent(pi)
                        .setStyle(new Notification.BigTextStyle().bigText(x))
                        .setWhen(System.currentTimeMillis()).setShowWhen(true);
                if (Build.VERSION.SDK_INT < 26) {
                    b.setPriority(Notification.PRIORITY_HIGH);
                    b.setDefaults(Notification.DEFAULT_VIBRATE);
                    b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
                }
                nm.notify((int) (System.currentTimeMillis() % 100000), b.build());
            } catch (Exception e) {
                Log.d(TAG, "notify failed: " + e);
            }
        }

        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    } else {
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                }
            });
        }
    }

    // ---------- lifecycle ----------

    @Override
    public void onBackPressed() {
        String cur = web.getUrl();
        if (cur == null || cur.startsWith("file:")) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__onBack&&window.__onBack())===true", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if ("true".equals(value)) return;
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        refreshNotifIcon(false);
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
