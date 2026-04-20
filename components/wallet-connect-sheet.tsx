import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';

type WalletProvider = 'WalletConnect' | 'MetaMask' | 'Coinbase';

type WalletConnectSheetProps = {
  visible: boolean;
  connecting?: WalletProvider | null;
  onClose: () => void;
  onConnect: (provider: WalletProvider) => void;
};

const walletOptions: {
  id: WalletProvider;
  label: string;
  subtitle: string;
  accent: string;
}[] = [
  {
    id: 'WalletConnect',
    label: 'WalletConnect',
    subtitle: 'Scan or deep-link to your wallet app',
    accent: '#3B82F6',
  },
  {
    id: 'MetaMask',
    label: 'MetaMask',
    subtitle: 'Use your browser wallet or mobile app',
    accent: '#F6851B',
  },
  {
    id: 'Coinbase',
    label: 'Coinbase Wallet',
    subtitle: 'Fast connect for Coinbase Wallet users',
    accent: '#0052FF',
  },
];

export function WalletConnectSheet({
  visible,
  connecting,
  onClose,
  onConnect,
}: WalletConnectSheetProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(240)} exiting={FadeOutDown.duration(180)} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.markWrap}>
            <View style={styles.markCircleOuter}>
              <View style={styles.markCircleInner} />
            </View>
          </View>
          <View style={styles.copy}>
            <AppText variant="monoSmall" color={theme.colors.muted} style={styles.eyebrow}>
              CONNECT WALLET
            </AppText>
            <AppText variant="h3" style={styles.title}>
              Choose your wallet
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted} style={styles.subtitle}>
              Connect first, then continue to phone verification.
            </AppText>
          </View>
        </View>

        <View style={styles.optionList}>
          {walletOptions.map((option) => {
            const isConnecting = connecting === option.id;

            return (
              <Pressable
                key={option.id}
                disabled={Boolean(connecting)}
                onPress={() => onConnect(option.id)}
                style={[
                  styles.optionCard,
                  isConnecting ? styles.optionCardActive : null,
                ]}>
                <View style={[styles.optionIcon, { backgroundColor: option.accent }]}>
                  <AppText variant="label" color={theme.colors.white}>
                    {option.label.slice(0, 1)}
                  </AppText>
                </View>
                <View style={styles.optionText}>
                  <AppText variant="h3">{option.label}</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {option.subtitle}
                  </AppText>
                </View>
                <AppText variant="monoSmall" color={isConnecting ? theme.colors.orange : theme.colors.muted}>
                  {isConnecting ? 'CONNECTING' : 'READY'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <AppButton title="Close" variant="ghost" onPress={onClose} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.3)',
  },
  sheet: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: theme.colors.offWhite,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  markWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
  },
  markCircleOuter: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    borderWidth: 2.5,
    borderColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCircleInner: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  copy: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  eyebrow: {
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  title: {
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  subtitle: {
    lineHeight: 15,
  },
  optionList: {
    gap: theme.spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
  },
  optionCardActive: {
    backgroundColor: theme.colors.orangeLight,
    borderColor: theme.colors.orange,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    paddingTop: theme.spacing.xs,
  },
});
