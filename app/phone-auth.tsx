import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TextInput, View, useColorScheme } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { CrossShape, RingStack } from '@/components/decorative-shapes';
import { FlowHeader } from '@/components/flow-header';
import { theme } from '@/theme';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [phone, setPhone] = useState('801 234 5678');
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? theme.colors.black : theme.colors.offWhite;
  const textColor = isDark ? theme.colors.offWhite : theme.colors.black;
  const mutedColor = isDark ? '#AAA39B' : theme.colors.mutedLight;
  const borderColor = isDark ? '#2F2F2F' : theme.colors.black;
  const fieldBackground = isDark ? '#151515' : theme.colors.white;
  const prefixBackground = isDark ? '#25160D' : theme.colors.orangeLight;

  return (
    <AppScreen backgroundColor={backgroundColor} scroll contentStyle={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={backgroundColor} />
      <RingStack color={isDark ? 'rgba(255,92,0,0.16)' : 'rgba(255,92,0,0.08)'} width={88} height={88} style={styles.rings} />
      <CrossShape color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,13,13,0.12)'} style={styles.cross} />
      <Animated.View entering={FadeInDown.duration(420)} style={styles.content}>
        <FlowHeader
          showBack
          overline="PHONE VERIFY"
          title={"What's your\nnumber?"}
          subtitle="We'll send a one-time code to verify your phone."
          progress={{ count: 5, active: 2 }}
          light={isDark}
        />

        <View style={[styles.phoneField, { borderColor, backgroundColor: fieldBackground }]}>
          <View style={[styles.prefix, { backgroundColor: prefixBackground, borderRightColor: borderColor }]}>
            <AppText style={styles.flag}>🇳🇬</AppText>
            <AppText variant="mono" color={textColor}>
              +234
            </AppText>
          </View>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setPhone}
            selectionColor={theme.colors.orange}
            placeholderTextColor={mutedColor}
            style={[styles.input, { color: textColor }]}
            value={phone}
          />
        </View>

        <AppText variant="bodySmall" color={mutedColor}>
          No spam. Ever. Pinky promise.
        </AppText>

        <AppButton title="Send code ↗" onPress={() => router.push('/otp-verify')} />

        <AppText variant="bodySmall" color={mutedColor} style={styles.terms}>
          By continuing you agree to our Terms.
        </AppText>
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.xl,
  },
  rings: {
    position: 'absolute',
    top: 20,
    right: 8,
  },
  cross: {
    position: 'absolute',
    bottom: 58,
    right: 22,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: theme.borders.thick,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRightWidth: theme.borders.thick,
  },
  flag: {
    fontSize: 15,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.typography.mono,
    letterSpacing: 1.8,
  },
  terms: {
    textAlign: 'center',
  },
});
