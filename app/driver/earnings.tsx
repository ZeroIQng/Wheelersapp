import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EarningsBarChart } from '@/components/EarningsBarChart';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { dailyEarningsChart, earningsSummary } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverEarningsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(earningsSummary.activeTab);

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <SectionHeader
        actionLabel="Dashboard"
        onActionPress={() => router.replace('/driver/dashboard')}
        title="Earnings"
        titleVariant="h1"
      />

      <View style={styles.tabs}>
        {earningsSummary.tabs.map((tab) => {
          const active = tab === activeTab;

          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, active ? styles.tabActive : null]}>
              <AppText variant="bodySmall" color={active ? theme.colors.offWhite : theme.colors.muted}>
                {tab}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppCard style={styles.totalCard}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Total today
        </AppText>
        <AppText variant="display">{earningsSummary.total}</AppText>
        <AppText variant="bodySmall" color={theme.colors.green}>
          {earningsSummary.growth}
        </AppText>
      </AppCard>

      <View style={styles.metricsRow}>
        {earningsSummary.stats.map((metric) => (
          <MetricCard
            accent={metric.accent}
            backgroundColor={metric.id === 'rides' ? theme.colors.orangeLight : theme.colors.white}
            key={metric.id}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </View>

      <View style={styles.chartBlock}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          Daily breakdown
        </AppText>
        <EarningsBarChart data={dailyEarningsChart} />
      </View>

      <AppButton title="Withdraw earnings ↗" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tab: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: theme.borders.regular,
    borderColor: '#DDD1C7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  tabActive: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.black,
    ...theme.shadows.card,
  },
  totalCard: {
    gap: theme.spacing.xxs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chartBlock: {
    gap: theme.spacing.sm,
  },
});
