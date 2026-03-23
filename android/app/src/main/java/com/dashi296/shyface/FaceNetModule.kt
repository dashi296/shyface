package com.dashi296.shyface

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

class FaceNetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FaceNetModule"

    private val interpreter: Interpreter by lazy {
        val assetManager = reactApplicationContext.assets
        val fileDescriptor = assetManager.openFd("models/android/facenet.tflite")
        val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = fileDescriptor.startOffset
        val declaredLength = fileDescriptor.declaredLength
        val modelBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
        Interpreter(modelBuffer)
    }

    @ReactMethod
    fun extractEmbedding(uri: String, promise: Promise) {
        try {
            val path = uri.removePrefix("file://")
            val bitmap = decodeWithExif(path)
                ?: return promise.reject("INVALID_URI", "Cannot load image: $uri")

            val embedding = runInference(bitmap)
            val result = Arguments.createArray()
            embedding.forEach { result.pushDouble(it.toDouble()) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INFERENCE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun extractAll(uris: ReadableArray, promise: Promise) {
        try {
            val allEmbeddings = Arguments.createArray()
            for (i in 0 until uris.size()) {
                val uri = uris.getString(i) ?: continue
                val path = uri.removePrefix("file://")
                val bitmap = decodeWithExif(path)
                    ?: return promise.reject("INVALID_URI", "Cannot load image: $uri")

                val embedding = runInference(bitmap)
                val row = Arguments.createArray()
                embedding.forEach { row.pushDouble(it.toDouble()) }
                allEmbeddings.pushArray(row)
            }
            promise.resolve(allEmbeddings)
        } catch (e: Exception) {
            promise.reject("INFERENCE_FAILED", e.message, e)
        }
    }

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
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun runInference(bitmap: Bitmap): FloatArray {
        val resized = Bitmap.createScaledBitmap(bitmap, 160, 160, true)
        val inputBuffer = ByteBuffer.allocateDirect(4 * 160 * 160 * 3)
        inputBuffer.order(ByteOrder.nativeOrder())
        val pixels = IntArray(160 * 160)
        resized.getPixels(pixels, 0, 160, 0, 0, 160, 160)
        for (pixel in pixels) {
            inputBuffer.putFloat(((pixel shr 16 and 0xFF) - 128f) / 128f)
            inputBuffer.putFloat(((pixel shr 8 and 0xFF) - 128f) / 128f)
            inputBuffer.putFloat(((pixel and 0xFF) - 128f) / 128f)
        }

        val output = Array(1) { FloatArray(128) }
        // `interpreter.run` conflicts with Kotlin's stdlib `run` extension in Kotlin 2.x.
        // Use runForMultipleInputsOutputs to avoid the ambiguity.
        val outputMap = hashMapOf<Int, Any>(0 to output)
        interpreter.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputMap)
        return output[0]
    }
}
