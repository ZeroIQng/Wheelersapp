import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useAuth } from '@/lib/auth';
import { getAccessTokenWithRetry } from '@/lib/access-token';
import { getDriverStats, getDriverEarnings } from '@/lib/api';
import { useAppTheme } from '@/lib/theme-context';
import { theme } from '@/theme';

// ── Types ──────────────────────────────────────────────

type Quest = {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  rewardLabel: string;
  icon: 'rides' | 'streak' | 'earnings' | 'rating';
  active: boolean;
};

// ── Icons ──────────────────────────────────────────────

function TrophyIcon({ size = 22, color = theme.colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}

function CarIcon({ size = 18, color = theme.colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2" />
      <Circle cx="7.5" cy="17" r="2" />
      <Circle cx="16.5" cy="17" r="2" />
    </Svg>
  );
}

function FireIcon({ size = 18, color = theme.colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

function StarIcon({ size = 18, color = theme.colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

function DollarIcon({ size = 18, color = theme.colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="1" x2="12" y2="23" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function getQuestIcon(icon: Quest['icon']) {
  switch (icon) {
    case 'rides': return <CarIcon />;
    case 'streak': return <FireIcon />;
    case 'rating': return <StarIcon />;
    case 'earnings': return <DollarIcon />;
  }
}

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

// ── Component ──────────────────────────────────────────

export default function DriverQuestsScreen() {
  const { getAccessToken } = useAuth();
  const { isDark } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [todayRides, setTodayRides] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [rating, setRating] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) return;
      const [stats, earnings] = await Promise.all([
        getDriverStats({ accessToken }),
        getDriverEarnings({ accessToken, period: 'today' }),
      ]);
      setTodayRides(earnings.rideCount);
      setTotalRides(stats.totalRides);
      setRating(stats.rating);
      setTodayEarnings(earnings.totalEarningsNgn);
    } catch {
      // non-blocking
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Build quests based on real data
  const quests: Quest[] = [
    {
      id: 'daily-5',
      title: 'Daily Grind',
      description: 'Complete 5 rides today',
      target: 5,
      current: Math.min(todayRides, 5),
      rewardLabel: 'NGN 500 bonus',
      icon: 'rides',
      active: true,
    },
    {
      id: 'daily-10',
      title: 'Road Warrior',
      description: 'Complete 10 rides today',
      target: 10,
      current: Math.min(todayRides, 10),
      rewardLabel: 'NGN 1,500 bonus',
      icon: 'rides',
      active: true,
    },
    {
      id: 'earnings-10k',
      title: 'Big Earner',
      description: 'Earn NGN 10,000 today',
      target: 10000,
      current: Math.min(todayEarnings, 10000),
      rewardLabel: 'NGN 800 bonus',
      icon: 'earnings',
      active: true,
    },
    {
      id: 'rating-star',
      title: 'Five Star Driver',
      description: 'Maintain a 4.8+ rating',
      target: 4.8,
      current: rating,
      rewardLabel: 'Priority matching',
      icon: 'rating',
      active: rating > 0,
    },
    {
      id: 'lifetime-100',
      title: 'Century Club',
      description: 'Complete 100 total rides',
      target: 100,
      current: Math.min(totalRides, 100),
      rewardLabel: 'NGN 5,000 bonus',
      icon: 'streak',
      active: true,
    },
  ];

  const activeQuests = quests.filter((q) => q.active);
  const completedCount = activeQuests.filter((q) => q.current >= q.target).length;

  return (
    <AppScreen
      scroll
      contentStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.orange}
          colors={[theme.colors.orange]}
        />
      }
    >
      <AppText variant="h1">Quests</AppText>

      {/* Summary banner */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <View style={[styles.summaryBanner, isDark && { backgroundColor: theme.colors.darkSurface }]}>
          <View style={styles.trophyWrap}>
            <TrophyIcon size={28} />
          </View>
          <View style={styles.summaryText}>
            <AppText variant="h3">
              {completedCount}/{activeQuests.length} completed
            </AppText>
            <AppText variant="bodySmall" color={theme.colors.muted}>
              Complete quests to earn bonuses and perks
            </AppText>
          </View>
        </View>
      </Animated.View>

      {/* Today's stats mini row */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, isDark && { backgroundColor: theme.colors.darkSurface }]}>
          <AppText variant="bodySmall" color={theme.colors.muted}>Rides today</AppText>
          <AppText variant="h3" color={theme.colors.orange}>{todayRides}</AppText>
        </View>
        <View style={[styles.statChip, isDark && { backgroundColor: theme.colors.darkSurface }]}>
          <AppText variant="bodySmall" color={theme.colors.muted}>Earned</AppText>
          <AppText variant="h3" color={theme.colors.orange}>{formatNgn(todayEarnings)}</AppText>
        </View>
      </View>

      {/* Quest cards */}
      <View style={styles.questList}>
        {activeQuests.map((quest, i) => {
          const isComplete = quest.current >= quest.target;
          const progress = quest.target > 0 ? Math.min(quest.current / quest.target, 1) : 0;

          return (
            <Animated.View key={quest.id} entering={FadeInDown.delay(150 + i * 80).duration(400)}>
              <AppCard
                style={styles.questCard}
                borderColor={isComplete ? theme.colors.green : undefined}
              >
                <View style={styles.questTop}>
                  <View style={[
                    styles.questIconWrap,
                    isComplete && { backgroundColor: theme.colors.successLight, borderColor: theme.colors.green },
                  ]}>
                    {getQuestIcon(quest.icon)}
                  </View>
                  <View style={styles.questInfo}>
                    <AppText variant="h3">{quest.title}</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      {quest.description}
                    </AppText>
                  </View>
                  {isComplete && (
                    <View style={styles.completeBadge}>
                      <AppText variant="monoSmall" color={theme.colors.white}>DONE</AppText>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(progress * 100)}%`,
                        backgroundColor: isComplete ? theme.colors.green : theme.colors.orange,
                      },
                    ]}
                  />
                </View>

                <View style={styles.questBottom}>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {quest.icon === 'rating'
                      ? `${quest.current.toFixed(1)} / ${quest.target}`
                      : quest.icon === 'earnings'
                        ? `${formatNgn(quest.current)} / ${formatNgn(quest.target)}`
                        : `${quest.current} / ${quest.target}`
                    }
                  </AppText>
                  <View style={styles.rewardChip}>
                    <AppText variant="monoSmall" color={theme.colors.orange}>
                      {quest.rewardLabel}
                    </AppText>
                  </View>
                </View>
              </AppCard>
            </Animated.View>
          );
        })}
      </View>
    </AppScreen>
  );
}

// ── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
  },

  // Summary banner
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  trophyWrap: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 4,
    ...theme.shadows.subtle,
  },

  // Quest list
  questList: {
    gap: 12,
  },
  questCard: {
    gap: theme.spacing.md,
  },
  questTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  questIconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.xs,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questInfo: {
    flex: 1,
    gap: 2,
  },
  completeBadge: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  // Progress
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: theme.colors.black,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Bottom
  questBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardChip: {
    backgroundColor: theme.colors.orangeLight,
    borderRadius: theme.radii.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
