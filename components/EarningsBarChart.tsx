import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { EarningsBarDatum } from '@/data/mock';
import { theme } from '@/theme';

type EarningsBarChartProps = {
  data: EarningsBarDatum[];
};

export function EarningsBarChart({ data }: EarningsBarChartProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        {data.map((item, index) => (
          <Animated.View
            entering={FadeInDown.delay(index * 60).duration(300)}
            key={item.id}
            style={styles.column}>
            <View
              style={[
                styles.bar,
                {
                  height: `${item.value}%`,
                  backgroundColor: item.active ? theme.colors.orange : theme.colors.orangeLight,
                  borderColor: item.active ? theme.colors.black : theme.colors.orange,
                },
              ]}
            />
          </Animated.View>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((item) => (
          <AppText
            key={item.id}
            variant="bodySmall"
            color={item.active ? theme.colors.black : '#B8AEA5'}
            style={styles.label}>
            {item.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.xs,
  },
  chart: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    borderBottomWidth: theme.borders.thick,
    borderBottomColor: theme.colors.black,
  },
  column: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderWidth: theme.borders.regular,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    gap: 5,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
});
