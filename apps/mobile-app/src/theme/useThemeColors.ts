import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from './colors';

export function useThemeColors() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return isDark ? DarkColors : LightColors;
}
