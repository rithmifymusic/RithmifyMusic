package com.gmajna.rythmify;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridges the web player and the native media notification / lock-screen controls. */
@CapacitorPlugin(name = "MediaControls")
public class MediaControlsPlugin extends Plugin {
    private static MediaControlsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    static void emit(String action) {
        emit(action, 0);
    }

    static void emit(String action, double value) {
        MediaControlsPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("value", value);
        plugin.notifyListeners("media", data);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String cover = call.getString("cover", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        boolean liked = Boolean.TRUE.equals(call.getBoolean("liked", false));
        boolean canLike = Boolean.TRUE.equals(call.getBoolean("canLike", false));
        boolean shuffle = Boolean.TRUE.equals(call.getBoolean("shuffle", false));
        double position = call.getDouble("position", 0.0);
        double duration = call.getDouble("duration", 0.0);

        PlaybackService service = PlaybackService.getInstance();
        if (service != null) {
            service.update(title, artist, cover, playing, liked, canLike, shuffle, position, duration);
        } else {
            Intent intent = new Intent(getContext(), PlaybackService.class);
            intent.setAction(PlaybackService.ACTION_UPDATE);
            intent.putExtra("title", title);
            intent.putExtra("artist", artist);
            intent.putExtra("cover", cover);
            intent.putExtra("playing", playing);
            intent.putExtra("liked", liked);
            intent.putExtra("canLike", canLike);
            intent.putExtra("shuffle", shuffle);
            intent.putExtra("position", position);
            intent.putExtra("duration", duration);
            getContext().startForegroundService(intent);
        }
        call.resolve();
    }
}
