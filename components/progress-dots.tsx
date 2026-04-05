import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

type ProgressDotsProps = {
  count: number;
  active: number;
  activeColor?: string;
  inactiveColor?: string;
};

export function ProgressDots({
  count,
  active,
  activeColor = theme.colors.orange,
  inactiveColor = theme.colors.offWhite,
}: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === active ? activeColor : inactiveColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
});
