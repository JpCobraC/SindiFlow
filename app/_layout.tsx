import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { VistoriaProvider, useVistoria } from '@/src/context/VistoriaContext';
import { humanizarErro } from '@/src/utils/error-messages';

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
  const abaAtual = segments[1] as string | undefined;

  if (isCarregando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Carregando sua conta...</Text>
      </View>
    );
  }

  if (erroBoot) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Não foi possível abrir o aplicativo</Text>
        <Text style={styles.errorText}>
          {humanizarErro(erroBoot, 'Ocorreu uma falha ao iniciar os dados locais.')}
        </Text>
        <Text style={styles.errorHint}>
          Feche e abra o app novamente. Se o problema continuar, entre em contato com a administração.
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

  if (usuarioLogado && (segments[0] as string) === '(tabs)' && usuarioLogado.role !== 'ADMIN') {
    if (usuarioLogado.isSindico()) {
      if (!abaAtual || abaAtual === 'index' || abaAtual === 'condomino') {
        return <Redirect href={'/(tabs)/sindico' as any} />;
      }
    } else if (usuarioLogado.isCondomino()) {
      if (abaAtual !== 'condomino' && abaAtual !== 'ocorrencias') {
        return <Redirect href={'/(tabs)/condomino' as any} />;
      }
    } else if (usuarioLogado.isInspetor()) {
      if (abaAtual === 'sindico' || abaAtual === 'condomino') {
        return <Redirect href={'/(tabs)' as any} />;
      }
    }
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <VistoriaProvider>
        <AuthGate>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
        <StatusBar style="auto" />
      </VistoriaProvider>
    </SafeAreaProvider>
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
