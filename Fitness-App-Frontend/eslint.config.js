// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      '.expo-bundle-check/**',
      'android/**',
      'ios/**',
      'node_modules/**',
    ],
  },
  {
    rules: {
      // These React Compiler rules currently flag valid React Native and
      // Reanimated patterns such as Animated.Value and shared values.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
