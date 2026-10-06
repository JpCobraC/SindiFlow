import React from 'react';
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

import { useVistoria } from '@/src/context/VistoriaContext';

export default function SyncScreen() {
  const {
    outboxPendentes,
    auditLogs,
    isOnline,
    isSimulandoErro503,
    toggleRede,
    toggleErro503,
    sincronizarOutbox,
  } = useVistoria();

  const handleDispararSync = async () => {
    try {
      const res = await sincronizarOutbox();
      Alert.alert(
        '✓ Sincronização Executada!',
        `Total de itens processados: ${res.totalItens}\nSucessos (200 OK): ${res.sucessos}\nFalhas: ${res.falhas}`
      );
    } catch (err: any) {
      Alert.alert(
        'Bloqueio Arquitetural (§1.3)',
        err?.message || 'Falha na detecção de conectividade.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Banner Mock */}
        <View style={styles.mockBanner}>
          <View style={styles.mockBannerLeft}>
            <View style={[styles.networkDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.mockBannerText}>
              ⚡ 100% Mock In-Memory ({isOnline ? 'Online Wi-Fi' : 'Offline Subsolo G2'})
            </Text>
          </View>
          <View style={styles.outboxPill}>
            <Text style={styles.outboxPillText}>{outboxPendentes.length} na Outbox</Text>
          </View>
        </View>

        {/* Header */}
        <Text style={styles.title}>Motor Outbox & Resiliência</Text>
        <Text style={styles.subtitle}>
          Padrão transacional local com retry exponencial para áreas subterrâneas
        </Text>

        {/* Painel de Controle de Rede e Falha */}
        <View style={styles.controlPanel}>
          <View style={styles.controlRow}>
            <View>
              <Text style={styles.controlTitle}>Conexão de Rede (expo-network)</Text>
              <Text style={styles.controlDesc}>
                {isOnline
                  ? 'Wi-Fi ativo — Pronto para envio remoto'
                  : 'Subsolo G2 — Sem conectividade celular'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleRede}
              trackColor={{ false: '#334155', true: '#059669' }}
              thumbColor={isOnline ? '#10B981' : '#94A3B8'}
            />
          </View>

          <View style={[styles.controlRow, { borderTopWidth: 1, borderTopColor: '#232E48', paddingTop: 12 }]}>
            <View>
              <Text style={styles.controlTitle}>Simular Falha HTTP 503 no Supabase</Text>
              <Text style={styles.controlDesc}>
                {isSimulandoErro503
                  ? 'Backend responderá com erro (testa backoff)'
                  : 'Backend operando normalmente (200 OK)'}
              </Text>
            </View>
            <Switch
              value={isSimulandoErro503}
              onValueChange={toggleErro503}
              trackColor={{ false: '#334155', true: '#DC2626' }}
              thumbColor={isSimulandoErro503 ? '#EF4444' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Status da Fila Outbox */}
        <View style={styles.outboxStatusCard}>
          <View style={styles.outboxStatusHeader}>
            <Text style={styles.outboxStatusLabel}>Fila Transacional em Memória</Text>
            <Text style={styles.outboxStatusCount}>
              {outboxPendentes.length} pacote(s) pendente(s)
            </Text>
          </View>
          <Text style={styles.backoffFormula}>
            Fórmula de Retry: T = 2^(tentativas) × 1000ms (1s → 2s → 4s → 8s → 16s)
          </Text>

          <TouchableOpacity
            style={[styles.syncBtn, outboxPendentes.length === 0 && styles.syncBtnDisabled]}
            onPress={handleDispararSync}>
            <Text style={styles.syncBtnText}>
              🔄 Disparar Sincronização Agora ({outboxPendentes.length} pendentes)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Itens na Outbox */}
        <Text style={styles.sectionTitle}>Eventos na Fila Outbox</Text>
        {outboxPendentes.length === 0 ? (
          <View style={styles.emptyOutboxBox}>
            <Text style={styles.emptyOutboxText}>
              ✓ Todos os eventos sincronizados com sucesso na nuvem!
            </Text>
          </View>
        ) : (
          outboxPendentes.map((item) => (
            <View key={item.id} style={styles.outboxItemCard}>
              <View style={styles.outboxItemHeader}>
                <Text style={styles.outboxTabela}>{item.tabela.toUpperCase()}</Text>
                <Text style={styles.outboxOpBadge}>{item.operacao}</Text>
              </View>
              <Text style={styles.outboxPayloadId}>ID Evento: {item.id}</Text>
              <View style={styles.outboxItemFooter}>
                <Text style={styles.outboxRetryText}>
                  Tentativas: {item.tentativas} • Backoff: {Math.pow(2, item.tentativas)}s
                </Text>
                <Text style={styles.outboxTimeText}>
                  {new Date(item.dataCriacao).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Logs de Auditoria do Mock */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Logs de Auditoria do Domínio ({auditLogs.length})
        </Text>
        <View style={styles.logContainer}>
          {auditLogs.slice(0, 8).map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text
                  style={[
                    styles.logTag,
                    log.tipo === 'SUCESSO' && styles.logTagSuccess,
                    log.tipo === 'BLOQUEIO' && styles.logTagBlock,
                    log.tipo === 'FALHA' && styles.logTagFail,
                  ]}>
                  {log.tipo}
                </Text>
                <Text style={styles.logTime}>{log.horario}</Text>
              </View>
              <Text style={styles.logMsg}>{log.mensagem}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060911',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  mockBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  mockBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  mockBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  outboxPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  outboxPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  controlPanel: {
    backgroundColor: '#151D30',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  controlDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  outboxStatusCard: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  outboxStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outboxStatusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  outboxStatusCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38BDF8',
  },
  backoffFormula: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#10B981',
    marginTop: 4,
    marginBottom: 14,
  },
  syncBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  syncBtnDisabled: {
    backgroundColor: '#1E293B',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  emptyOutboxBox: {
    backgroundColor: '#151D30',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  emptyOutboxText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  outboxItemCard: {
    backgroundColor: '#151D30',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#232E48',
    marginBottom: 8,
  },
  outboxItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outboxTabela: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  outboxOpBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0E1322',
    color: '#10B981',
  },
  outboxPayloadId: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  outboxItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#232E48',
  },
  outboxRetryText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  outboxTimeText: {
    fontSize: 10,
    color: '#64748B',
  },
  logContainer: {
    backgroundColor: '#0E1322',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232E48',
    padding: 12,
    gap: 8,
  },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A2338',
    paddingBottom: 6,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logTag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#1E293B',
    color: '#94A3B8',
  },
  logTagSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10B981',
  },
  logTagBlock: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
  },
  logTagFail: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#F59E0B',
  },
  logTime: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  logMsg: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 15,
  },
});
