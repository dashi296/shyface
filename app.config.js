const variant = process.env.EAS_BUILD_PROFILE ?? 'production'
const IS_DEV = variant === 'development'
const IS_PREVIEW = variant === 'preview'

const appName = IS_DEV ? 'shyface (Dev)' : IS_PREVIEW ? 'shyface (Preview)' : 'shyface'
const bundleId = IS_DEV
  ? 'com.dashi296.shyface.dev'
  : IS_PREVIEW
    ? 'com.dashi296.shyface.preview'
    : 'com.dashi296.shyface'
const scheme = IS_DEV ? 'shyface-dev' : IS_PREVIEW ? 'shyface-preview' : 'shyface'

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: appName,
  slug: 'shyface',
  version: '1.0.0',
  plugins: ['expo-router', 'expo-sqlite', 'react-native-vision-camera'],
  ios: {
    bundleIdentifier: bundleId,
    infoPlist: {
      NSCameraUsageDescription: 'Allow $(PRODUCT_NAME) to access your camera',
    },
    appleTeamId: '8P6M7BMMMT',
  },
  android: {
    package: bundleId,
    permissions: ['android.permission.CAMERA'],
  },
  scheme,
  extra: {
    router: {},
    eas: {
      projectId: '646fa1bb-9f61-4772-9a9b-9d8ada970ebc',
    },
  },
  owner: 'dashi296',
}
