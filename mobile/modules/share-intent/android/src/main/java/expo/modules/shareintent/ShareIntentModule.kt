package expo.modules.shareintent

import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class ShareIntentModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ShareIntent")

        // Reads share data directly from the current activity's intent.
        // Works for both cold start (onCreate intent) and warm start (onNewIntent → setIntent).
        AsyncFunction("getSharedData") {
            val activity = appContext.currentActivity ?: return@AsyncFunction null
            val intent = activity.intent ?: return@AsyncFunction null
            if (intent.action != Intent.ACTION_SEND) return@AsyncFunction null
            val type = intent.type ?: return@AsyncFunction null

            if (type.startsWith("text/")) {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return@AsyncFunction null
                return@AsyncFunction mapOf("type" to "text", "text" to text)
            }

            val uri: Uri? = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
            uri ?: return@AsyncFunction null

            val ctx = appContext.reactContext ?: return@AsyncFunction null
            val fileName = getFileName(ctx, uri) ?: "shared_file"
            val cacheFile = File(ctx.cacheDir, "shared_${System.currentTimeMillis()}_$fileName")
            ctx.contentResolver.openInputStream(uri)?.use { ins ->
                FileOutputStream(cacheFile).use { out -> ins.copyTo(out) }
            }
            mapOf(
                "type" to "file",
                "uri" to "file://${cacheFile.absolutePath}",
                "fileName" to fileName,
                "mimeType" to type
            )
        }

        AsyncFunction("clearSharedData") {
            appContext.currentActivity?.runOnUiThread {
                appContext.currentActivity?.intent?.action = null
            }
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
