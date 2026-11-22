package com.gmajna.rythmify;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Foreground media service: keeps playback alive in the background and owns the notification and MediaSession. */
public class PlaybackService extends Service {
    static final String ACTION_UPDATE = "com.gmajna.rythmify.UPDATE";
    static final String ACTION_PREV = "com.gmajna.rythmify.PREV";
    static final String ACTION_TOGGLE = "com.gmajna.rythmify.TOGGLE";
    static final String ACTION_NEXT = "com.gmajna.rythmify.NEXT";
    static final String ACTION_LIKE = "com.gmajna.rythmify.LIKE";
    static final String ACTION_SHUFFLE = "com.gmajna.rythmify.SHUFFLE";

    private static final String CHANNEL_ID = "rythmify-playback";
    private static final int NOTIFICATION_ID = 1001;
    private static PlaybackService instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private MediaSessionCompat session;
    private String title = "";
    private String artist = "";
    private String coverUrl = "";
    private Bitmap cover;
    private boolean playing = false;
    private boolean liked = false;
    private boolean canLike = false;
    private boolean shuffle = false;
    private long positionMs = 0;
    private long durationMs = 0;
    private boolean foreground = false;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    static PlaybackService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        session = new MediaSessionCompat(this, "Rythmify");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { MediaControlsPlugin.emit("toggle"); }
            @Override public void onPause() { MediaControlsPlugin.emit("toggle"); }
            @Override public void onSkipToNext() { MediaControlsPlugin.emit("next"); }
            @Override public void onSkipToPrevious() { MediaControlsPlugin.emit("prev"); }
            @Override public void onSeekTo(long pos) { MediaControlsPlugin.emit("seek", pos / 1000.0); }
            @Override public void onCustomAction(String action, Bundle extras) {
                if (ACTION_LIKE.equals(action)) MediaControlsPlugin.emit("like");
                else if (ACTION_SHUFFLE.equals(action)) MediaControlsPlugin.emit("shuffle");
            }
        });
        session.setActive(true);
        publish();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_PREV.equals(action)) MediaControlsPlugin.emit("prev");
        else if (ACTION_TOGGLE.equals(action)) MediaControlsPlugin.emit("toggle");
        else if (ACTION_NEXT.equals(action)) MediaControlsPlugin.emit("next");
        else if (ACTION_LIKE.equals(action)) MediaControlsPlugin.emit("like");
        else if (ACTION_SHUFFLE.equals(action)) MediaControlsPlugin.emit("shuffle");
        else if (ACTION_UPDATE.equals(action)) {
            update(
                intent.getStringExtra("title"),
                intent.getStringExtra("artist"),
                intent.getStringExtra("cover"),
                intent.getBooleanExtra("playing", false),
                intent.getBooleanExtra("liked", false),
                intent.getBooleanExtra("canLike", false),
                intent.getBooleanExtra("shuffle", false),
                intent.getDoubleExtra("position", 0.0),
                intent.getDoubleExtra("duration", 0.0)
            );
        }
        return START_STICKY;
    }

    void update(String newTitle, String newArtist, String newCover, boolean isPlaying,
                boolean isLiked, boolean likeAllowed, boolean isShuffle, double position, double duration) {
        shuffle = isShuffle;
        title = newTitle == null ? "" : newTitle;
        artist = newArtist == null ? "" : newArtist;
        playing = isPlaying;
        liked = isLiked;
        canLike = likeAllowed;
        positionMs = (long) (Math.max(0, position) * 1000);
        durationMs = (long) (Math.max(0, duration) * 1000);
        String url = newCover == null ? "" : newCover;
        if (!url.equals(coverUrl)) {
            coverUrl = url;
            cover = null;
            loadCover(url);
        }
        main.post(this::publish);
    }

    private void loadCover(String url) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return;
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                try (InputStream stream = connection.getInputStream()) {
                    bitmap = squareThumbnail(BitmapFactory.decodeStream(stream));
                } finally {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
                // Without artwork the notification simply shows the text.
            }
            Bitmap result = bitmap;
            main.post(() -> {
                if (!url.equals(coverUrl)) return;
                cover = result;
                publish();
            });
        }).start();
    }

    /** MediaSession drops oversized bitmaps (and then the whole card loses its art), so crop to a small square. */
    private static Bitmap squareThumbnail(Bitmap source) {
        if (source == null) return null;
        int side = Math.min(source.getWidth(), source.getHeight());
        Bitmap square = Bitmap.createBitmap(source, (source.getWidth() - side) / 2, (source.getHeight() - side) / 2, side, side);
        int target = Math.min(side, 512);
        return target == side ? square : Bitmap.createScaledBitmap(square, target, target, true);
    }

    /** Keeps CPU and Wi-Fi awake while audio plays so streams do not stall when the screen is off. */
    private void updateLocks() {
        if (playing) {
            if (wakeLock == null) {
                PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
                wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Rythmify:playback");
                wakeLock.setReferenceCounted(false);
            }
            if (!wakeLock.isHeld()) wakeLock.acquire(6 * 60 * 60 * 1000L);
            if (wifiLock == null) {
                WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Rythmify:wifi");
                wifiLock.setReferenceCounted(false);
            }
            if (!wifiLock.isHeld()) wifiLock.acquire();
        } else {
            releaseLocks();
        }
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    private void publish() {
        updateLocks();
        MediaMetadataCompat.Builder metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs > 0 ? durationMs : -1);
        if (cover != null) {
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cover);
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cover);
        }
        session.setMetadata(metadata.build());
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        if (durationMs > 0) actions |= PlaybackStateCompat.ACTION_SEEK_TO;
        PlaybackStateCompat.Builder state = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                durationMs > 0 ? positionMs : PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f);
        // The two custom slots on the system media card, like Spotify's shuffle and heart.
        state.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
            ACTION_SHUFFLE, shuffle ? "Naključno vklopljeno" : "Naključno",
            shuffle ? R.drawable.ic_shuffle_on : R.drawable.ic_shuffle).build());
        if (canLike) {
            state.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_LIKE, liked ? "Odstrani všeček" : "Všeček",
                liked ? R.drawable.ic_heart : R.drawable.ic_heart_outline).build());
        }
        session.setPlaybackState(state.build());

        Notification notification = buildNotification();
        if (!foreground) {
            foreground = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(title.isEmpty() ? "Rythmify" : title)
            .setContentText(title.isEmpty() ? "Pripravljen za predvajanje" : artist)
            .setContentIntent(content)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        if (canLike) {
            builder.addAction(liked ? R.drawable.ic_heart : R.drawable.ic_heart_outline,
                liked ? "Odstrani všeček" : "Všeček", action(ACTION_LIKE, 4));
        }
        int first = canLike ? 1 : 0;
        builder
            .addAction(android.R.drawable.ic_media_previous, "Prejšnja", action(ACTION_PREV, 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Pavza" : "Predvajaj", action(ACTION_TOGGLE, 2))
            .addAction(android.R.drawable.ic_media_next, "Naslednja", action(ACTION_NEXT, 3))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(first, first + 1, first + 2));
        if (cover != null) builder.setLargeIcon(cover);
        return builder.build();
    }

    private PendingIntent action(String action, int code) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(action);
        return PendingIntent.getService(this, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Rythmify predvajanje", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Predvajanje glasbe in radia v ozadju");
        channel.setShowBadge(false);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        releaseLocks();
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
