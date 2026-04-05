# Wheleers

Native Expo prototype rebuild of the Wheleers decentralized ride-hailing experience. The UI is implemented in React Native with `expo-router`, `expo-font`, `react-native-reanimated`, and `react-native-svg`. No WebViews or raw HTML are used.

## Stack

- Expo SDK 54
- Expo Router for file-based navigation
- Expo Font with Syne, DM Sans, and Space Mono
- React Native Reanimated for motion
- React Native SVG for decorative shapes

## Project structure

```text
app/
  _layout.tsx
  index.tsx
  splash.tsx
  role-selection.tsx
  phone-auth.tsx
  otp-verify.tsx
  kyc.tsx
  rider-home.tsx
  destination-search.tsx
  ride-selection.tsx
  matching.tsx
  driver-found.tsx
components/
  app-badge.tsx
  app-button.tsx
  app-card.tsx
  app-screen.tsx
  app-text.tsx
  decorative-shapes.tsx
  flow-header.tsx
  progress-dots.tsx
  static-map.tsx
data/
  mock.ts
theme.ts
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Expo dev server:

   ```bash
   npm run start
   ```

3. Open the app in Expo Go, iOS Simulator, or Android Emulator from the Expo CLI.

## Notes

- The map screens use a static native mock layout for now.
- Mock data drives ride types, recent places, driver info, fare, and ETA.
- Fonts load before the router mounts, so headings and labels render with the intended brand typography from first paint.
