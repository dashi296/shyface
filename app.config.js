const IS_DEV = process.env.APP_VARIANT === 'development'

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: IS_DEV ? 'shyface (Dev)' : 'shyface',
  slug: 'shyface',
  version: '1.0.0',
  plugins: ['expo-router', 'expo-sqlite', 'react-native-vision-camera'],
  ios: {
    bundleIdentifier: IS_DEV ? 'com.dashi296.shyface.dev' : 'com.dashi296.shyface',
    infoPlist: {
      NSCameraUsageDescription: 'Allow $(PRODUCT_NAME) to access your camera',
    },
    appleTeamId: '8P6M7BMMMT',
  },
  android: {
    package: IS_DEV ? 'com.dashi296.shyface.dev' : 'com.dashi296.shyface',
    permissions: ['android.permission.CAMERA'],
  },
  scheme: IS_DEV ? 'shyface-dev' : 'shyface',
  extra: {
    router: {},
    eas: {
      projectId: '646fa1bb-9f61-4772-9a9b-9d8ada970ebc',
    },
  },
  owner: 'dashi296',
}
