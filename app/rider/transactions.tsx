import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, View } from "react-native";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SectionHeader } from "@/components/SectionHeader";
import { useWalletTransactions } from "@/lib/wallet-transactions";
import { type WalletTransaction } from "@/lib/api";
import { theme } from "@/theme";

function formatAmount(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-NG", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent activity";
  }

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${dayLabel}, ${timeLabel}`;
}

function formatReference(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTypeLabel(type: string): string {
  switch (type) {
    case "FIAT_ONRAMP":
    case "CRYPTO_DEPOSIT":
      return "Wallet deposit";
    case "RIDE_PAYMENT":
      return "Ride payment";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "DRIVER_PAYOUT":
      return "Driver payout";
    case "REFUND":
      return "Refund";
    default:
      return type.toLowerCase().replace(/_/g, " ");
  }
}

function getTransactionIcon(transaction: WalletTransaction): keyof typeof MaterialIcons.glyphMap {
  if (transaction.type === "FIAT_ONRAMP" || transaction.type === "CRYPTO_DEPOSIT") {
    return "south-west";
  }

  if (transaction.type === "RIDE_PAYMENT") {
    return "local-taxi";
  }

  if (transaction.type === "WITHDRAWAL") {
    return "north-east";
  }

  return transaction.direction === "CREDIT" ? "add-circle-outline" : "remove-circle-outline";
}

function getTransactionAmountColor(transaction: WalletTransaction): string {
  return transaction.direction === "CREDIT" ? theme.colors.green : theme.colors.black;
}

function getTransactionSignedAmount(transaction: WalletTransaction): string {
  const prefix = transaction.direction === "CREDIT" ? "+" : "-";
  return `${prefix}${formatAmount(transaction.displayCurrency, transaction.amountNgn)}`;
}

function getTransactionMeta(transaction: WalletTransaction): string {
  const metadata = transaction.metadata ?? {};
  const source =
    transaction.type === "FIAT_ONRAMP" || transaction.type === "CRYPTO_DEPOSIT"
      ? "Deposit"
      : transaction.type === "RIDE_PAYMENT"
        ? "Ride"
        : "Wallet";

  if (typeof metadata["amountLocal"] === "number" && typeof metadata["localCurrency"] === "string") {
    return `${source} • ${metadata["localCurrency"]} ${Number(metadata["amountLocal"]).toLocaleString("en-NG")}`;
  }

  return `${source} • Ref ${formatReference(transaction.referenceId)}`;
}

export default function RiderTransactionsScreen() {
  const router = useRouter();
  const { items, isLoading, error, refresh } = useWalletTransactions(40);

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons color={theme.colors.black} name="arrow-back" size={18} />
        <AppText variant="monoSmall">Back to wallet</AppText>
      </Pressable>
      <SectionHeader
        subtitle="Deposits, ride payments, and every wallet movement tied to your account."
        title="Transactions"
        titleVariant="h1"
      />

      <Pressable onPress={() => void refresh()} style={styles.refreshPill}>
        <MaterialIcons color={theme.colors.black} name="refresh" size={16} />
        <AppText variant="bodySmall">Refresh ledger</AppText>
      </Pressable>

      <View style={styles.list}>
        {isLoading && items.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Loading wallet transactions...
          </AppText>
        ) : null}

        {error ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            {error}
          </AppText>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            No wallet transactions yet.
          </AppText>
        ) : null}

        {items.map((transaction) => (
          <AppCard key={transaction.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons
                color={theme.colors.black}
                name={getTransactionIcon(transaction)}
                size={18}
              />
            </View>
            <View style={styles.copy}>
              <AppText variant="label">{formatTypeLabel(transaction.type)}</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {getTransactionMeta(transaction)}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {formatWhen(transaction.createdAt)}
              </AppText>
            </View>
            <View style={styles.amountWrap}>
              <AppText
                variant="mono"
                color={getTransactionAmountColor(transaction)}
                style={styles.amountText}
              >
                {getTransactionSignedAmount(transaction)}
              </AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Balance {formatAmount(transaction.displayCurrency, transaction.balanceAfterNgn)}
              </AppText>
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  refreshPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  list: {
    gap: theme.spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  amountWrap: {
    alignItems: "flex-end",
    gap: 4,
    maxWidth: 124,
  },
  amountText: {
    textAlign: "right",
  },
});
