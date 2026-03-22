package com.shyface

import android.graphics.BitmapFactory
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File

class FaceDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FaceDetectorModule"

    @ReactMethod
    fun detect(uri: String, promise: Promise) {
        try {
            val path = uri.removePrefix("file://")
            val bitmap = BitmapFactory.decodeFile(path)
                ?: return promise.reject("INVALID_URI", "Cannot load image from URI: $uri")

            val image = InputImage.fromBitmap(bitmap, 0)

            val options = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
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
