import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

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
            <SheetMark />
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
                <View style={styles.optionIcon}>
                  <WalletBrandIcon provider={option.id} />
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

function SheetMark() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d="M8 8.7C9.5 7.2 11 6.5 13 6.5C15 6.5 16.5 7.2 18 8.7"
        fill="none"
        stroke="#3B99FC"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <Path
        d="M8 17.3C9.5 18.8 11 19.5 13 19.5C15 19.5 16.5 18.8 18 17.3"
        fill="none"
        stroke="#3B99FC"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <Rect
        x="4.8"
        y="10.2"
        width="6.6"
        height="5.6"
        rx="2.6"
        fill="none"
        stroke="#3B99FC"
        strokeWidth="2.2"
      />
      <Rect
        x="14.6"
        y="10.2"
        width="6.6"
        height="5.6"
        rx="2.6"
        fill="none"
        stroke="#3B99FC"
        strokeWidth="2.2"
      />
    </Svg>
  );
}

function WalletBrandIcon({ provider }: { provider: WalletProvider }) {
  if (provider === 'WalletConnect') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M7.4 8.4C8.7 7.2 10.1 6.7 12 6.7C13.9 6.7 15.3 7.2 16.6 8.4"
          fill="none"
          stroke="#3B99FC"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <Path
          d="M7.4 15.6C8.7 16.8 10.1 17.3 12 17.3C13.9 17.3 15.3 16.8 16.6 15.6"
          fill="none"
          stroke="#3B99FC"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <Rect x="4.8" y="10" width="5.8" height="4.6" rx="2.2" fill="none" stroke="#3B99FC" strokeWidth="2" />
        <Rect x="13.4" y="10" width="5.8" height="4.6" rx="2.2" fill="none" stroke="#3B99FC" strokeWidth="2" />
      </Svg>
    );
  }

  if (provider === 'MetaMask') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M5.3 4.5L10.2 8.1L8.1 13L5.3 4.5Z" fill="#E17726" />
        <Path d="M18.7 4.5L15.9 13L13.8 8.1L18.7 4.5Z" fill="#E27625" />
        <Path d="M7.1 14.7L10.3 15.4L9.1 18L7.1 14.7Z" fill="#E27625" />
        <Path d="M14.9 18L13.7 15.4L16.9 14.7L14.9 18Z" fill="#E27625" />
        <Path d="M8.6 11.9L10.1 8.7L10.8 12.6L8.6 11.9Z" fill="#763E1A" />
        <Path d="M15.4 11.9L13.2 12.6L13.9 8.7L15.4 11.9Z" fill="#763E1A" />
        <Path d="M8.1 13L10.8 12.6L10.5 16.1L8.1 13Z" fill="#F6851B" />
        <Path d="M13.2 12.6L15.9 13L13.5 16.1L13.2 12.6Z" fill="#F6851B" />
        <Path d="M10.5 16.1L10.7 14.5H13.3L13.5 16.1L12 17.2L10.5 16.1Z" fill="#C0AD9E" />
        <Path d="M10.7 14.5L10.8 12.6L9 13.1L10.7 14.5Z" fill="#161616" />
        <Path d="M13.3 14.5L15 13.1L13.2 12.6L13.3 14.5Z" fill="#161616" />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="3" y="3" width="18" height="18" rx="6" fill="#0052FF" />
      <Path
        d="M15.6 12C15.6 14 14 15.6 12 15.6C10 15.6 8.4 14 8.4 12C8.4 10 10 8.4 12 8.4C14 8.4 15.6 10 15.6 12Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
      />
    </Svg>
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
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
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
    backgroundColor: theme.colors.white,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    paddingTop: theme.spacing.xs,
  },
});
