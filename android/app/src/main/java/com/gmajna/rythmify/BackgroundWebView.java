package com.gmajna.rythmify;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;

import com.getcapacitor.CapacitorWebView;

/**
 * Keeps the page "visible" to Chromium after the app goes to the background.
 * Without this the embedded YouTube player and timers are paused as soon as the screen turns off.
 */
public class BackgroundWebView extends CapacitorWebView {
    public BackgroundWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        if (visibility != View.GONE) super.onWindowVisibilityChanged(View.VISIBLE);
    }
}
