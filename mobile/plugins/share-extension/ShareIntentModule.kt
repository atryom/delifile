package com.delifile.app

import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class ShareIntentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ShareIntent"

    companion object {
        private var pendingData: Map<String, String?>? = null

        fun extractFromIntent(intent: Intent?, context: android.content.Context) {
            if (intent?.action != Intent.ACTION_SEND) return
            val type = intent.type ?: return

            if (type.startsWith("text/")) {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
                pendingData = mapOf("type" to "text", "text" to text)
            } else {
                val uri: Uri? = if (android.os.Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
                uri ?: return
                val fileName = getFileName(context, uri) ?: "shared_file"
                val cacheFile = File(context.cacheDir, "shared_${System.currentTimeMillis()}_$fileName")
                try {
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(cacheFile).use { output -> input.copyTo(output) }
                    }
                    pendingData = mapOf(
                        "type" to "file",
                        "uri" to "file://${cacheFile.absolutePath}",
                        "fileName" to fileName,
                        "mimeType" to type
                    )
                } catch (_: Exception) {}
            }
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

    @ReactMethod
    fun getSharedData(promise: Promise) {
        val data = pendingData
        if (data == null) { promise.resolve(null); return }
        val map = Arguments.createMap()
        data.forEach { (k, v) -> if (v != null) map.putString(k, v) else map.putNull(k) }
        promise.resolve(map)
    }

    @ReactMethod
    fun clearSharedData(promise: Promise) {
        pendingData?.get("uri")?.let { uri ->
            if (uri.startsWith("file://")) File(uri.removePrefix("file://")).delete()
        }
        pendingData = null
        promise.resolve(null)
    }
}
