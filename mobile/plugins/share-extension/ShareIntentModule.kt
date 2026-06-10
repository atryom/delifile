package com.delifile.app

import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class ShareIntentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ShareIntent"

    @ReactMethod
    fun getSharedData(promise: Promise) {
        val activity = reactContext.currentActivity
        val intent = activity?.intent

        if (intent?.action != Intent.ACTION_SEND) {
            promise.resolve(null)
            return
        }

        val type = intent.type ?: run { promise.resolve(null); return }
        val map = Arguments.createMap()

        if (type.startsWith("text/")) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (text == null) { promise.resolve(null); return }
            map.putString("type", "text")
            map.putString("text", text)
            promise.resolve(map)
        } else {
            val uri: Uri? = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
            if (uri == null) { promise.resolve(null); return }

            Thread {
                try {
                    val ctx = reactContext.applicationContext
                    val fileName = getFileName(ctx, uri) ?: "shared_file"
                    val cacheFile = File(ctx.cacheDir, "shared_${System.currentTimeMillis()}_$fileName")
                    ctx.contentResolver.openInputStream(uri)?.use { ins ->
                        FileOutputStream(cacheFile).use { out -> ins.copyTo(out) }
                    }
                    map.putString("type", "file")
                    map.putString("uri", "file://${cacheFile.absolutePath}")
                    map.putString("fileName", fileName)
                    map.putString("mimeType", type)
                    promise.resolve(map)
                } catch (_: Exception) {
                    promise.resolve(null)
                }
            }.start()
        }
    }

    @ReactMethod
    fun clearSharedData(promise: Promise) {
        // Nullify intent action so next getSharedData() returns null
        reactContext.currentActivity?.runOnUiThread {
            reactContext.currentActivity?.intent?.action = null
        }
        promise.resolve(null)
    }

    private fun getFileName(context: android.content.Context, uri: Uri): String? {
        if (uri.scheme == "content") {
            val cursor: Cursor? = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val idx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) return it.getString(idx)
                }
            }
        }
        return uri.lastPathSegment
    }
}
