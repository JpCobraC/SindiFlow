import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserHeaderBar } from '@/components/UserHeaderBar';
import { useVistoria } from '@/src/context/VistoriaContext';

export default function TabLayout() {
  const { usuarioLogado } = useVistoria();
  const insets = useSafeAreaInsets();

  const role = usuarioLogado?.role;
  const isSindico = role === 'SINDICO' || role === 'ADMIN';
  const isInspetor = role === 'INSPETOR' || role === 'ADMIN';
  const isCondomino = role === 'CONDOMINO' || role === 'ADMIN';

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
            height: 60 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        {/* Vistoria Técnica: exclusiva para Inspetores e Admins */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Vistoria',
            href: isInspetor ? '/(tabs)' : null,
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="checklist" color={color} />,
          }}
        />
        {/* Painel do Síndico: exclusivo para Síndicos e Admins */}
        <Tabs.Screen
          name="sindico"
          options={{
            title: 'Síndico',
            href: isSindico ? '/(tabs)/sindico' : null,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="building.2.fill" color={color} />
            ),
          }}
        />
        {/* Portal do Condômino: para Condôminos e Admins */}
        <Tabs.Screen
          name="condomino"
          options={{
            title: 'Condômino',
            href: isCondomino ? '/(tabs)/condomino' : null,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="person.2.fill" color={color} />
            ),
          }}
        />
        {/* Ocorrências: comum para todos os usuários */}
        <Tabs.Screen
          name="ocorrencias"
          options={{
            title: 'Ocorrências',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="exclamationmark.triangle.fill" color={color} />
            ),
          }}
        />
        {/* Sincronização: para quem vistoria ou administra */}
        <Tabs.Screen
          name="sync"
          options={{
            title: 'Sincronização',
            href: (isSindico || isInspetor) ? '/(tabs)/sync' : null,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="arrow.triangle.2.circlepath" color={color} />
            ),
          }}
        />
        {/* Indicadores: para quem tem visão gerencial ou técnica */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Indicadores',
            href: (isSindico || isInspetor) ? '/(tabs)/explore' : null,
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
