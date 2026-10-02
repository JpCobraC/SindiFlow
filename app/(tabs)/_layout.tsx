import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#58A6FF',
        tabBarInactiveTintColor: '#8B949E',
        tabBarStyle: {
          backgroundColor: '#161B22',
          borderTopColor: '#30363D',
        },
        headerStyle: {
          backgroundColor: '#0D1117',
        },
        headerTintColor: '#F0F6FC',
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vistoria',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ocorrencias"
        options={{
          title: 'Ocorrências',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="warning" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Outbox Sync',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="sync" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Métricas',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
