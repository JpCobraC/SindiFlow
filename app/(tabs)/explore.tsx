import React from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVistoria } from '../../src/context/VistoriaContext';
import { GravidadeOcorrencia } from '../../src/domain/entities/ocorrencia.entity';

export default function MetricasScreen() {
  const {
    vistoriaAtiva,
    itensChecklist,
    ocorrencias,
    outboxPendentes,
    auditLogs,
    isOnline,
    reiniciarMock,
  } = useVistoria();

  const handleReset = () => {
    const confirmMsg = 'Deseja restaurar o estado inicial da demonstração (50% checklist, 2 ocorrências, 3 outbox)?';
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        reiniciarMock();
      }
    } else {
      Alert.alert('Reiniciar Mock', confirmMsg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: () => reiniciarMock() },
      ]);
    }
  };

  const totalItens = itensChecklist.length;
  const respondidos = itensChecklist.filter((i) => i.respondido).length;
  const percentual = totalItens > 0 ? Math.round((respondidos / totalItens) * 100) : 0;

  const ocorrenciasAltas = ocorrencias.filter(
    (o) => o.gravidade === GravidadeOcorrencia.ALTA
  ).length;

  // Categorias calculadas com base nos itens reais
  const categoriasMap = itensChecklist.reduce((acc, item) => {
    if (!acc[item.categoria]) {
      acc[item.categoria] = { total: 0, respondidos: 0, ok: 0 };
    }
    acc[item.categoria].total += 1;
    if (item.respondido) {
      acc[item.categoria].respondidos += 1;
      if (item.status === 'OK') acc[item.categoria].ok += 1;
    }
    return acc;
  }, {} as Record<string, { total: number; respondidos: number; ok: number }>);

  const categorias = Object.entries(categoriasMap).map(([nome, dados]) => {
    const taxa = dados.total > 0 ? Math.round((dados.respondidos / dados.total) * 100) : 0;
    return {
      nome,
      taxa,
      status: taxa === 100 ? 'CONFORME' : taxa >= 50 ? 'EM ANDAMENTO' : 'PENDENTE',
      detalhes: `${dados.respondidos}/${dados.total} itens`,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Auditoria & Conformidade</Text>
              <Text style={styles.subtitle}>NBR 5674 / NBR 16747 — Métricas em Memória</Text>
            </View>
            <TouchableOpacity style={styles.btnReset} onPress={handleReset}>
              <Text style={styles.btnResetText}>Reiniciar Mock</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status da Arquitetura & Testes */}
        <View style={styles.archCard}>
          <View style={styles.archHeader}>
            <Text style={styles.archTitle}>Clean Architecture & TDD (Fase 1)</Text>
            <View style={styles.coverageBadge}>
              <Text style={styles.coverageText}>92.6% Cobertura</Text>
            </View>
          </View>
          <Text style={styles.archDesc}>
            11 Suítes de Testes (33/33 passando). Regras e entidades de domínio 100% puras sem dependência de SQLite ou Supabase.
          </Text>
          <View style={styles.archStats}>
            <Text style={styles.archStatItem}>
              <Text style={styles.boldText}>Rede:</Text> {isOnline ? 'Online (Wi-Fi)' : 'Offline (Subsolo G2)'}
            </Text>
            <Text style={styles.archStatItem}>
              <Text style={styles.boldText}>Vistoria:</Text> {vistoriaAtiva?.status || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Métricas Principais (Cards de KPI) */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{percentual}%</Text>
            <Text style={styles.kpiLabel}>Checklist Preenchido</Text>
            <Text style={styles.kpiSub}>Mínimo 80% p/ Concluir</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{ocorrencias.length}</Text>
            <Text style={styles.kpiLabel}>Ocorrências Vistoria</Text>
            <Text style={styles.kpiSub}>{ocorrenciasAltas} com Gravidade Alta</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, outboxPendentes.length > 0 ? styles.kpiAlert : {}]}>
              {outboxPendentes.length}
            </Text>
            <Text style={styles.kpiLabel}>Fila Outbox Local</Text>
            <Text style={styles.kpiSub}>Eventos p/ Sincronizar</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>33</Text>
            <Text style={styles.kpiLabel}>Testes Automatizados</Text>
            <Text style={styles.kpiSub}>100% Taxa de Sucesso</Text>
          </View>
        </View>

        {/* Subsistemas Prediais Reais */}
        <Text style={styles.sectionTitle}>Conformidade por Subsistema Predial</Text>
        {categorias.map((sub, idx) => (
          <View key={idx} style={styles.subCard}>
            <View style={styles.subHeader}>
              <Text style={styles.subNome}>{sub.nome}</Text>
              <Text
                style={[
                  styles.subStatus,
                  sub.status === 'CONFORME'
                    ? styles.statusOk
                    : sub.status === 'EM ANDAMENTO'
                    ? styles.statusWarn
                    : styles.statusPendente,
                ]}>
                {sub.status} ({sub.taxa}%)
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${sub.taxa}%` },
                  sub.status === 'CONFORME'
                    ? styles.barOk
                    : sub.status === 'EM ANDAMENTO'
                    ? styles.barWarn
                    : styles.barPendente,
                ]}
              />
            </View>
            <Text style={styles.subDetalhe}>{sub.detalhes}</Text>
          </View>
        ))}

        {/* Trilha de Auditoria em Tempo Real (Domain Audit Logs) */}
        <Text style={styles.sectionTitle}>Trilha de Auditoria em Tempo Real (Logs do Domínio)</Text>
        <View style={styles.auditContainer}>
          {auditLogs.length === 0 ? (
            <Text style={styles.auditVazio}>Nenhum log registrado ainda.</Text>
          ) : (
            auditLogs.slice(0, 8).map((log) => {
              const cor =
                log.tipo === 'SUCESSO'
                  ? '#3FB950'
                  : log.tipo === 'BLOQUEIO'
                  ? '#F85149'
                  : log.tipo === 'FALHA'
                  ? '#D29922'
                  : '#58A6FF';
              return (
                <View key={log.id} style={styles.logItem}>
                  <View style={styles.logItemHeader}>
                    <Text style={[styles.logTipo, { color: cor }]}>[{log.tipo}]</Text>
                    <Text style={styles.logHora}>{log.horario}</Text>
                  </View>
                  <Text style={styles.logMsg}>{log.mensagem}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Base Normativa */}
        <View style={styles.normaBox}>
          <Text style={styles.normaTitle}>Conformidade Normativa ABNT</Text>
          <Text style={styles.normaText}>
            • <Text style={styles.bold}>ABNT NBR 5674:</Text> Procedimentos de gestão de manutenção em edificações.{'\n'}
            • <Text style={styles.bold}>ABNT NBR 16747:</Text> Diretrizes, conceitos e fluxo da inspeção predial.{'\n'}
            • <Text style={styles.bold}>Regras de Domínio:</Text> Validação offline in-memory com garantias de idempotência e outbox pattern.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D1117' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F0F6FC' },
  subtitle: { fontSize: 12, color: '#8B949E', marginTop: 2 },
  btnReset: {
    backgroundColor: '#21262D',
    borderColor: '#30363D',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnResetText: { color: '#58A6FF', fontSize: 12, fontWeight: '600' },
  archCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#238636',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  archHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  archTitle: { color: '#3FB950', fontSize: 13, fontWeight: 'bold' },
  coverageBadge: {
    backgroundColor: 'rgba(63, 185, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverageText: { color: '#3FB950', fontSize: 11, fontWeight: 'bold' },
  archDesc: { color: '#8B949E', fontSize: 12, lineHeight: 16, marginBottom: 8 },
  archStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#21262D', paddingTop: 8 },
  archStatItem: { color: '#8B949E', fontSize: 11 },
  boldText: { color: '#F0F6FC', fontWeight: 'bold' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  kpiVal: { fontSize: 22, fontWeight: 'bold', color: '#58A6FF', marginBottom: 2 },
  kpiAlert: { color: '#E3B341' },
  kpiLabel: { fontSize: 12, color: '#F0F6FC', fontWeight: '600', textAlign: 'center' },
  kpiSub: { fontSize: 10, color: '#8B949E', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F0F6FC', marginBottom: 12, marginTop: 6 },
  subCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  subNome: { color: '#F0F6FC', fontSize: 13, fontWeight: '600', flex: 1 },
  subStatus: { fontSize: 11, fontWeight: 'bold' },
  statusOk: { color: '#3FB950' },
  statusWarn: { color: '#D29922' },
  statusPendente: { color: '#8B949E' },
  barBg: { height: 6, backgroundColor: '#21262D', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barOk: { backgroundColor: '#238636' },
  barWarn: { backgroundColor: '#D29922' },
  barPendente: { backgroundColor: '#30363D' },
  subDetalhe: { color: '#6E7681', fontSize: 10, marginTop: 4, textAlign: 'right' },
  auditContainer: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  auditVazio: { color: '#8B949E', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: 8 },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
    paddingVertical: 6,
  },
  logItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  logTipo: { fontSize: 11, fontWeight: 'bold' },
  logHora: { fontSize: 10, color: '#6E7681' },
  logMsg: { fontSize: 12, color: '#C9D1D9', lineHeight: 16 },
  normaBox: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    padding: 14,
    marginTop: 4,
  },
  normaTitle: { color: '#38BDF8', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  normaText: { color: '#8B949E', fontSize: 12, lineHeight: 18 },
  bold: { color: '#F0F6FC', fontWeight: 'bold' },
});

