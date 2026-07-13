import { Stack } from 'expo-router';
import { DriverSessionProvider } from '@/lib/driver-session';

export default function DriverLayout() {
  return (
    <DriverSessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DriverSessionProvider>
  );
}
