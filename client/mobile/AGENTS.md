# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This app is on **Expo SDK 57** (React Native 0.86, React 19.2). Navigation is **Expo Router**
(file-based, routes live in `app/`). Shared types AND utils come from `@explivio/shared`, which ships
compiled JS (`dist/`) so Metro consumes it like any other package.

## Known follow-ups

- **Typed routes are disabled** (`app.json` → `experiments.typedRoutes: false`). Enabling them crashes
  `expo start` with `Cannot find module 'expo-router/_ctx-shared'`: a monorepo **hoisting** quirk —
  `@expo/cli` hoists to `client/node_modules` but `expo-router` stays nested in `mobile/node_modules`,
  so the CLI's typed-route generator can't resolve it. The app and navigation work fine without typed
  routes (hrefs are plain strings). Proper fix = a monorepo Metro/hoisting setup (`metro.config.js`
  with `watchFolders` + `nodeModulesPaths`, possibly `.npmrc` hoisting rules). Low priority for a few
  routes; revisit if the app grows or during a monorepo-hardening pass.
