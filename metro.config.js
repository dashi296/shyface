// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

// TFLite モデルファイルをアセットとして扱う（react-native-fast-tflite）
config.resolver.assetExts.push('tflite');

module.exports = config;
