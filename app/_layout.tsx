import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { VistoriaProvider, useVistoria } from '@/src/context/VistoriaContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Guarda de rota. O provider restaura a sessão do SecureStore antes de liberar
 * o app; enquanto isso, nenhuma tela autenticada é montada.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { usuarioLogado, isCarregando, erroBoot } = useVistoria();
  const segments = useSegments();
  const naTelaDeLogin = (segments[0] as string) === 'login';

  if (isCarregando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Restaurando sessão segura...</Text>
      </View>
    );
  }

  if (erroBoot) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Falha ao iniciar</Text>
        <Text style={styles.errorText}>{erroBoot}</Text>
        <Text style={styles.errorHint}>
          Feche e abra o app novamente. Se o problema persistir, verifique o
          armazenamento local do dispositivo.
        </Text>
      </View>
    );
  }

  if (!usuarioLogado && !naTelaDeLogin) {
    return <Redirect href={'/login' as any} />;
  }

  if (usuarioLogado && naTelaDeLogin) {
    if (usuarioLogado.isSindico()) {
      return <Redirect href={'/(tabs)/sindico' as any} />;
    }
    if (usuarioLogado.isCondomino()) {
      return <Redirect href={'/(tabs)/condomino' as any} />;
    }
    return <Redirect href={'/(tabs)' as any} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <VistoriaProvider>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </VistoriaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#060911',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: '#F87171',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#F8FAFC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
});
