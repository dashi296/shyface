package com.shyface

import com.facebook.react.bridge.*

// Mosaic processing is handled by Skia on the JS side.
// This module is a placeholder for future native migration.
class MosaicModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "MosaicModule"
}
