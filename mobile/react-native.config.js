module.exports = {
  dependencies: {
    // Expo Router installs these optional peers for Drawer support. This app uses
    // Stack/Tabs only, so linking their native code is unnecessary and breaks
    // Windows release builds because Ninja continuously regenerates build.ninja.
    'react-native-reanimated': {
      platforms: {
        android: null,
      },
    },
    'react-native-worklets': {
      platforms: {
        android: null,
      },
    },
  },
};
