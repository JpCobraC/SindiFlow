import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface OutboxItemUI {
  id: string;
  tabela: string;
  operacao: 'INSERT' | 'UPDATE';
  tentativas: number;
  proximoRetryMs: number;
  status: 'PENDENTE' | 'SINCRONIZADO' | 'PROCESSANDO';
  descricao: string;
  dataCriacao: string;
}

interface AuditLog {
  id: string;
  evento: string;
  horario: string;
  status: 'SUCESSO' | 'FALHA' | 'INFO';
  mensagem: string;
}

export default function SyncScreen() {
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [fila, setFila] = useState<OutboxItemUI[]>([
    {
      id: 'out-101',
      tabela: 'vistorias',
      operacao: 'UPDATE',
      tentativas: 0,
      proximoRetryMs: 1000,
      status: 'PENDENTE',
      descricao: 'Vistoria Ed. Solar finalizada com GPS (-23.5612, -46.6537)',
      dataCriacao: '10:15',
    },
    {
      id: 'out-102',
      tabela: 'ocorrencias',
      operacao: 'INSERT',
      tentativas: 1,
      proximoRetryMs: 2000,
      status: 'PENDENTE',
      descricao: 'Ocorrência ALTA: Infiltração pilar Garagem G2 (Com Foto)',
      dataCriacao: '10:18',
    },
    {
      id: 'out-103',
      tabela: 'item_checklist',
      operacao: 'UPDATE',
      tentativas: 0,
      proximoRetryMs: 1000,
      status: 'PENDENTE',
      descricao: 'Item QGBT classificado como OK',
      dataCriacao: '10:20',
    },
  ]);

  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      evento: 'DETECCAO_REDE',
      horario: '10:14:02',
      status: 'INFO',
      mensagem: 'expo-network: Dispositivo sem conexão de dados (Subsolo)',
    },
    {
      id: 'log-2',
      evento: 'OUTBOX_QUEUE',
      horario: '10:15:30',
      status: 'INFO',
      mensagem: 'Item out-101 enfileirado na tabela outbox_events do SQLite',
    },
    {
      id: 'log-3',
      evento: 'RETRY_BACKOFF',
      horario: '10:18:45',
      status: 'FALHA',
      mensagem: 'Tentativa 1 falhou: Rede indisponível. Próximo retry em 2s',
    },
  ]);

  const handleForcarSync = () => {
    // Obrigação §1.3: Detecção de rede obrigatória
    if (!online) {
      Alert.alert(
        'Bloqueio Arquitetural (§1.3)',
        'Detecção de rede via expo-network retornou OFFLINE. O envio direto sem conexão é estritamente proibido.'
      );
      const novoLog: AuditLog = {
        id: `log-${Date.now()}`,
        evento: 'SYNC_BLOQUEADO',
        horario: new Date().toLocaleTimeString(),
        status: 'FALHA',
        mensagem: 'Tentativa de sync abortada: Sem conectividade de rede',
      };
      setLogs([novoLog, ...logs]);
      return;
    }

    setSyncing(true);

    setTimeout(() => {
      setSyncing(false);
      const sincronizados = fila.map((item) => ({
        ...item,
        status: 'SINCRONIZADO' as const,
      }));
      setFila(sincronizados);

      const novoLog: AuditLog = {
        id: `log-${Date.now()}`,
        evento: 'SUPABASE_SYNC',
        horario: new Date().toLocaleTimeString(),
        status: 'SUCESSO',
        mensagem: `Sincronizados com sucesso ${fila.length} eventos com o Supabase. Outbox atualizada.`,
      };
      setLogs([novoLog, ...logs]);

      Alert.alert(
        'Sincronização Concluída',
        `Todos os ${fila.length} eventos da outbox foram transmitidos com sucesso para a API do Supabase.`
      );
    }, 1200);
  };

  const pendentesCount = fila.filter((i) => i.status === 'PENDENTE').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Outbox & Sincronização</Text>
          <Text style={styles.subtitle}>
            Fila Offline Local (SQLite) com Retry Exponencial (§1.3)
          </Text>
        </View>

        {/* Toggle de Simulação de Rede */}
        <View style={styles.networkCard}>
          <View style={styles.networkInfo}>
            <View style={[styles.networkDot, online ? styles.dotOnline : styles.dotOffline]} />
            <View>
              <Text style={styles.networkTitle}>
                {online ? 'Rede Conectada (Wi-Fi / 4G)' : 'Sem Conexão (Modo Garagem/Subsolo)'}
              </Text>
              <Text style={styles.networkSubtitle}>
                {online ? 'Pronto para sincronização com Supabase' : 'Todas as escritas retidas na Outbox local'}
              </Text>
            </View>
          </View>
          <Switch
            value={online}
            onValueChange={setOnline}
            trackColor={{ false: '#30363D', true: '#238636' }}
            thumbColor={online ? '#3FB950' : '#8B949E'}
          />
        </View>

        {/* Card do Algoritmo de Retry Exponencial */}
        <View style={styles.backoffCard}>
          <Text style={styles.backoffTitle}>Algoritmo de Backoff Exponencial (§1.3)</Text>
          <View style={styles.backoffRow}>
            <View style={styles.backoffStep}>
              <Text style={styles.stepNum}>1s</Text>
              <Text style={styles.stepLabel}>1ª Falha</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.backoffStep}>
              <Text style={styles.stepNum}>2s</Text>
              <Text style={styles.stepLabel}>2ª Falha</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.backoffStep}>
              <Text style={styles.stepNum}>4s</Text>
              <Text style={styles.stepLabel}>3ª Falha</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.backoffStep}>
              <Text style={styles.stepNum}>8s</Text>
              <Text style={styles.stepLabel}>4ª Falha</Text>
            </View>
          </View>
        </View>

        {/* Botão de Sincronização */}
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnActive]}
          onPress={handleForcarSync}
          disabled={syncing}>
          <Text style={styles.syncBtnText}>
            {syncing ? '🔄 Sincronizando com Supabase...' : `Forçar Sincronização (${pendentesCount} pendentes)`}
          </Text>
        </TouchableOpacity>

        {/* Itens na Fila */}
        <Text style={styles.sectionTitle}>Fila de Eventos da SQLite ({fila.length})</Text>

        {fila.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTable}>
                {item.operacao} {item.tabela}
              </Text>
              <Text
                style={[
                  styles.statusTag,
                  item.status === 'SINCRONIZADO' ? styles.statusSync : styles.statusPending,
                ]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.itemDesc}>{item.descricao}</Text>
            <View style={styles.itemFooter}>
              <Text style={styles.footerText}>ID: {item.id}</Text>
              <Text style={styles.footerText}>Tentativas: {item.tentativas}/5</Text>
              <Text style={styles.footerText}>Próximo: {item.proximoRetryMs / 1000}s</Text>
            </View>
          </View>
        ))}

        {/* Log de Auditoria (§3.3) */}
        <Text style={styles.sectionTitle}>Log de Auditoria Local (sync_log)</Text>

        {logs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text
                style={[
                  styles.logStatus,
                  log.status === 'SUCESSO' && styles.logSuccess,
                  log.status === 'FALHA' && styles.logFail,
                  log.status === 'INFO' && styles.logInfo,
                ]}>
                [{log.status}] {log.evento}
              </Text>
              <Text style={styles.logTime}>{log.horario}</Text>
            </View>
            <Text style={styles.logMsg}>{log.mensagem}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D1117' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#F0F6FC' },
  subtitle: { fontSize: 13, color: '#8B949E', marginTop: 2 },
  networkCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  networkInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  networkDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  dotOnline: { backgroundColor: '#3FB950' },
  dotOffline: { backgroundColor: '#F85149' },
  networkTitle: { color: '#F0F6FC', fontWeight: 'bold', fontSize: 14 },
  networkSubtitle: { color: '#8B949E', fontSize: 11, marginTop: 2 },
  backoffCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  backoffTitle: { color: '#58A6FF', fontWeight: 'bold', fontSize: 12, marginBottom: 8 },
  backoffRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  backoffStep: { alignItems: 'center' },
  stepNum: { color: '#F0F6FC', fontWeight: 'bold', fontSize: 14 },
  stepLabel: { color: '#8B949E', fontSize: 10 },
  arrow: { color: '#8B949E', fontSize: 12 },
  syncBtn: {
    backgroundColor: '#238636',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  syncBtnActive: { backgroundColor: '#1F6FEB' },
  syncBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F0F6FC', marginBottom: 12, marginTop: 6 },
  itemCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTable: { color: '#58A6FF', fontWeight: 'bold', fontSize: 12 },
  statusTag: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusSync: { backgroundColor: 'rgba(63, 185, 80, 0.2)', color: '#3FB950' },
  statusPending: { backgroundColor: 'rgba(210, 153, 34, 0.2)', color: '#D29922' },
  itemDesc: { color: '#C9D1D9', fontSize: 13, marginBottom: 8 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#21262D', paddingTop: 6 },
  footerText: { color: '#8B949E', fontSize: 11 },
  logCard: {
    backgroundColor: '#0D1117',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  logStatus: { fontSize: 11, fontWeight: 'bold' },
  logSuccess: { color: '#3FB950' },
  logFail: { color: '#F85149' },
  logInfo: { color: '#58A6FF' },
  logTime: { color: '#6E7681', fontSize: 10 },
  logMsg: { color: '#8B949E', fontSize: 11 },
});
