/**
 * SindiFlow — Tela de Login
 * Camada: UI (App/Expo Router)
 *
 * Tela de autenticação com Supabase Auth (e-mail/senha).
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 * Conformidade com §1.2: sessão em expo-secure-store, nunca AsyncStorage.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useVistoria } from '@/src/context/VistoriaContext';

export default function LoginScreen() {
  const { fazerLogin } = useVistoria();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o e-mail.');
      return;
    }
    if (!senha.trim()) {
      Alert.alert('Campo obrigatório', 'Informe a senha.');
      return;
    }

    setCarregando(true);
    try {
      await fazerLogin(email.trim(), senha);
    } catch (err: any) {
      Alert.alert(
        'Falha na autenticação',
        err?.message || 'E-mail ou senha inválidos.'
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoiding}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>SindiFlow</Text>
            <Text style={styles.subtitle}>Vistoria Predial Preventiva</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar</Text>
            <Text style={styles.cardSubtitle}>
              Digite seu e-mail e senha cadastrados no sistema.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor="#8B949E"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#8B949E"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.btnLogin}
              onPress={handleLogin}
              disabled={carregando}
            >
              <Text style={styles.btnLoginText}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </Text>
            </TouchableOpacity>
          </View>

          {carregando && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#38BDF8" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060911',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38BDF8',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F0F6FC',
    fontSize: 14,
  },
  btnLogin: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnLoginText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  loadingContainer: {
    marginTop: 16,
  },
});
