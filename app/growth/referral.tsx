import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePrivy } from "@privy-io/expo";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { DecorativeBackground } from "@/components/DecorativeBackground";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  getReferralSummary,
  isBackendConfigured,
  type ReferralSummaryResponse,
} from "@/lib/api";
import { theme } from "@/theme";

function formatNgn(value: number | null | undefined): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  return `NGN ${Math.round(amount).toLocaleString("en-NG")}`;
}

export default function ReferralScreen() {
  const { getAccessToken, isReady, user } = usePrivy();
  const [summary, setSummary] = useState<ReferralSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!isBackendConfigured() || !isReady || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          throw new Error("Sign in again to load your referral code.");
        }

        const nextSummary = await getReferralSummary({ accessToken });
        if (!cancelled) {
          setSummary(nextSummary);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load your referral code.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isReady, user]);

  const referralCode = summary?.code ?? "";
  const shareMessage = useMemo(
    () =>
      referralCode
        ? `Use my Wheelers referral code ${referralCode} after onboarding and book your rides on Wheelers.`
        : "Join me on Wheelers.",
    [referralCode],
  );

  async function handleShare() {
    if (!referralCode) {
      Alert.alert("Referral code unavailable", "Try again in a moment.");
      return;
    }

    await Share.share({ message: shareMessage });
  }

  async function handleCopy() {
    if (!referralCode) {
      Alert.alert("Referral code unavailable", "Try again in a moment.");
      return;
    }

    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
      scroll
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="referral" />

      <View style={styles.headerRow}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">Referral rewards</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Share your code. Cashback is earned as ride discounts, not wallet
            cash.
          </AppText>
        </View>
      </View>

      <AppCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialIcons
            color={theme.colors.black}
            name="card-giftcard"
            size={30}
          />
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="monoSmall" color={theme.colors.orange}>
            YOUR CODE
          </AppText>
          <AppText variant="metric" style={styles.code}>
            {isLoading ? "LOADING" : referralCode || "UNAVAILABLE"}
          </AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Friends add this code after onboarding. Your own code cannot be used
            on your account.
          </AppText>
        </View>
      </AppCard>

      {errorMessage ? (
        <AppCard borderColor={theme.colors.danger} style={styles.noticeCard}>
          <AppText variant="bodyMedium" color={theme.colors.danger}>
            {errorMessage}
          </AppText>
        </AppCard>
      ) : null}

      <View style={styles.statsGrid}>
        <StatCard
          icon="account-balance-wallet"
          label="Available"
          value={formatNgn(summary?.availableCashbackNgn)}
        />
        <StatCard
          icon="ac-unit"
          label="Frozen"
          value={formatNgn(summary?.frozenCashbackNgn)}
        />
        <StatCard
          icon="directions-car"
          label="Ride referrals"
          value={String(summary?.qualifiedReferrals ?? 0)}
        />
        <StatCard
          icon="hourglass-empty"
          label="Pending"
          value={String(summary?.pendingReferrals ?? 0)}
        />
      </View>

      <AppCard style={styles.rulesCard}>
        <RuleRow text="If they take a ride within 30 days, you earn NGN 1,000 ride cashback." />
        <RuleRow text="If they do not ride after 30 days, you earn NGN 500." />
        <RuleRow text="Unused cashback freezes after 30 days. One fresh referral unlocks one frozen cashback." />
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          disabled={!referralCode}
          onPress={handleShare}
          style={styles.primaryAction}
          title="Share code"
        />
        <AppButton
          disabled={!referralCode}
          onPress={handleCopy}
          style={styles.secondaryAction}
          title={copied ? "Copied" : "Copy"}
          variant="inverse"
        />
      </View>
    </AppScreen>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <AppCard style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialIcons color={theme.colors.black} name={icon} size={18} />
      </View>
      <AppText variant="monoSmall" color={theme.colors.muted}>
        {label}
      </AppText>
      <AppText variant="h3">{value}</AppText>
    </AppCard>
  );
}

function RuleRow({ text }: { text: string }) {
  return (
    <View style={styles.ruleRow}>
      <View style={styles.ruleDot} />
      <AppText variant="bodySmall" color={theme.colors.muted} style={styles.ruleText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: "#FFF4EA",
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  code: {
    letterSpacing: 3,
  },
  noticeCard: {
    backgroundColor: theme.colors.dangerLight,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  statCard: {
    width: "48%",
    minHeight: 122,
    gap: 6,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  rulesCard: {
    gap: theme.spacing.sm,
  },
  ruleRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    marginTop: 7,
  },
  ruleText: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  primaryAction: {
    flex: 2,
  },
  secondaryAction: {
    flex: 1,
  },
});
