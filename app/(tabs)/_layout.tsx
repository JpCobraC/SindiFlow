import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserHeaderBar } from '@/components/UserHeaderBar';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <UserHeaderBar />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#58A6FF',
          tabBarInactiveTintColor: '#8B949E',
          tabBarStyle: {
            backgroundColor: '#161B22',
            borderTopColor: '#30363D',
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Vistoria',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="checklist" color={color} />,
          }}
        />
        <Tabs.Screen
          name="sindico"
          options={{
            title: 'Síndico',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="building.2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="condomino"
          options={{
            title: 'Condômino',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="person.2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ocorrencias"
          options={{
            title: 'Ocorrências',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="exclamationmark.triangle.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="sync"
          options={{
            title: 'Outbox',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="arrow.triangle.2.circlepath" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Indicadores',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
});
