import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let rideRequestSound: Audio.Sound | null = null;

/**
 * Play the ride request alert sound on loop until stopped.
 * Safe to call multiple times — will not stack sounds.
 */
export async function playRideRequestSound(): Promise<void> {
  try {
    // Stop any existing sound first
    await stopRideRequestSound();

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sounds/ride-request.wav'),
      {
        isLooping: true,
        volume: 1.0,
        shouldPlay: true,
      },
    );

    rideRequestSound = sound;
  } catch {
    // Non-blocking — sound is a nice-to-have
  }
}

/**
 * Stop the ride request sound if it's playing.
 */
export async function stopRideRequestSound(): Promise<void> {
  try {
    if (rideRequestSound) {
      await rideRequestSound.stopAsync();
      await rideRequestSound.unloadAsync();
      rideRequestSound = null;
    }
  } catch {
    rideRequestSound = null;
  }
}
