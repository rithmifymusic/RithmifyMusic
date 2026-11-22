package com.gmajna.rythmify;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaControlsPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        // Radio, podcasts and the YouTube player must be able to start without a tap on the page itself.
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        askToIgnoreBatteryOptimizations();
    }

    /** Without this exemption many phones kill background playback after a few minutes with the screen off. */
    private void askToIgnoreBatteryOptimizations() {
        SharedPreferences prefs = getSharedPreferences("rythmify", MODE_PRIVATE);
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        if (prefs.getBoolean("batteryAsked", false) || power.isIgnoringBatteryOptimizations(getPackageName())) return;
        prefs.edit().putBoolean("batteryAsked", true).apply();
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {
            // Some devices do not offer this dialog; playback still works with the foreground service.
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        Intent service = new Intent(this, PlaybackService.class);
        ContextCompat.startForegroundService(this, service);
    }

    @Override
    public void onStop() {
        super.onStop();
        // Playback must continue with the screen off; make sure the WebView was not paused by the lifecycle.
        WebView webView = getBridge().getWebView();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    public void onDestroy() {
        if (isFinishing()) stopService(new Intent(this, PlaybackService.class));
        super.onDestroy();
    }
}
