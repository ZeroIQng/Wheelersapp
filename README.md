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
  rider/
    _layout.tsx
    active-trip.tsx
    trip-rating.tsx
    wallet.tsx
  driver/
    _layout.tsx
    dashboard.tsx
    incoming-request.tsx
    navigation.tsx
    arrived.tsx
    active-trip.tsx
    payout.tsx
    earnings.tsx
components/
  app-badge.tsx
  app-button.tsx
  app-card.tsx
  app-screen.tsx
  app-text.tsx
  decorative-shapes.tsx
  flow-header.tsx
  EarningsBarChart.tsx
  InstructionCard.tsx
  MapMock.tsx
  MetricCard.tsx
  progress-dots.tsx
  RideRequestSheet.tsx
  SectionHeader.tsx
  static-map.tsx
  StatusPill.tsx
  TripProgressBar.tsx
  WalletBalanceCard.tsx
data/
  mock.ts
constants/
  theme.ts
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
- `data/mock.ts` now drives Batch 1 and Batch 2 rider and driver flows, including wallet, payout, request, and earnings states.
- `constants/theme.ts` is the centralized design token source. `theme.ts` re-exports it for the existing `@/theme` imports.
- Rider and driver Batch 2 screens live under `app/rider` and `app/driver` and are connected from the existing flow:
  - Rider: `splash -> role-selection -> phone-auth -> otp-verify -> kyc -> rider-home -> destination-search -> ride-selection -> matching -> driver-found -> rider/active-trip -> rider/trip-rating -> rider/wallet`
  - Driver: `role-selection (drive) -> driver/dashboard -> driver/incoming-request -> driver/navigation -> driver/arrived -> driver/active-trip -> driver/payout -> driver/earnings`
- Fonts load before the router mounts, so headings and labels render with the intended brand typography from first paint.
