package com.shyface

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

class FaceDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FaceDetectorModule"

    private fun decodeWithExif(path: String): Bitmap? {
        val bitmap = BitmapFactory.decodeFile(path) ?: return null
        val exif = ExifInterface(path)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            else -> return bitmap
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        bitmap.recycle()
        return rotated
    }

    @ReactMethod
    fun detect(uri: String, promise: Promise) {
        try {
            val path = uri.removePrefix("file://")
            val bitmap = decodeWithExif(path)
                ?: return promise.reject("INVALID_URI", "Cannot load image from URI: $uri")

            val image = InputImage.fromBitmap(bitmap, 0)

            val options = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                // shared/config/constants.ts の FACE_DETECTION_MIN_FACE_SIZE(0.1) と同値
                // 画像の短辺の 10% 未満の顔（誤検出の可能性が高い）を除外する
                .setMinFaceSize(0.1f)
                .build()

            val detector = FaceDetection.getClient(options)

            detector.process(image)
                .addOnSuccessListener { faces ->
                    val results = Arguments.createArray()
                    for (face in faces) {
                        val box = Arguments.createMap()
                        box.putDouble("x", face.boundingBox.left.toDouble())
                        box.putDouble("y", face.boundingBox.top.toDouble())
                        box.putDouble("width", face.boundingBox.width().toDouble())
                        box.putDouble("height", face.boundingBox.height().toDouble())
                        results.pushMap(box)
                    }
                    promise.resolve(results)
                }
                .addOnFailureListener { e: Exception ->
                    promise.reject("DETECTION_FAILED", e.message ?: "Unknown error", e)
                }
        } catch (e: Exception) {
            promise.reject("DETECTION_FAILED", e.message, e)
        }
    }
}
