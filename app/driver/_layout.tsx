import { Stack } from 'expo-router';
import { DriverSessionProvider } from '@/lib/driver-session';

export default function DriverLayout() {
  return (
    <DriverSessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="incoming-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="navigation" />
        <Stack.Screen name="arrived" />
        <Stack.Screen name="active-trip" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="payout" />
        <Stack.Screen name="withdraw" />
        <Stack.Screen name="docs" />
      </Stack>
    </DriverSessionProvider>
  );
}
