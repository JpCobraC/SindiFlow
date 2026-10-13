// Fallback for using MaterialIcons on Android.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';
import { SymbolWeight } from 'expo-symbols';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 *
 * O mapa é tipado por `satisfies Record<string, MaterialIconName>` e não por
 * `Partial<Record<SymbolViewProps['name'], ...>>`: no SDK 57 `SymbolViewProps['name']`
 * deixou de ser um simples `string` e passou a incluir variantes condicionais por
 * plataforma, o que quebrava `keyof typeof MAPPING` e impedia o typecheck de passar.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'checklist': 'assignment',
  'exclamationmark.triangle.fill': 'warning',
  'arrow.triangle.2.circlepath': 'sync',
  'chart.bar.fill': 'bar-chart',
} as const satisfies Record<string, MaterialIconName>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] ?? 'help-outline';
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
