import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function MetricasScreen() {
  const subsistemas = [
    { nome: 'Combate a Incêndio (AVCB)', taxa: 98, status: 'CONFORME' },
    { nome: 'Instalações Elétricas (QGBT / SPDA)', taxa: 92, status: 'CONFORME' },
    { nome: 'Instalações Hidráulicas & Bombas', taxa: 86, status: 'ATENÇÃO' },
    { nome: 'Impermeabilização & Coberturas', taxa: 94, status: 'CONFORME' },
    { nome: 'Transporte Vertical (Elevadores)', taxa: 100, status: 'CONFORME' },
  ];

  const historicoVistorias = [
    {
      id: 'VIST-2026-09',
      data: '02/10/2026',
      condominio: 'Ed. Solar das Palmeiras',
      responsavel: 'Carlos Lima (Eng. Civil)',
      itens: '18/18 itens',
      status: 'SINCRONIZADA',
    },
    {
      id: 'VIST-2026-08',
      data: '05/09/2026',
      condominio: 'Cond. Bosque Imperial',
      responsavel: 'Marcos Souza (Síndico)',
      itens: '24/24 itens',
      status: 'SINCRONIZADA',
    },
    {
      id: 'VIST-2026-07',
      data: '08/08/2026',
      condominio: 'Residencial Bela Vista',
      responsavel: 'Carlos Lima (Eng. Civil)',
      itens: '16/16 itens',
      status: 'SINCRONIZADA',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Conformidade & Métricas</Text>
          <Text style={styles.subtitle}>Gestão de Manutenção Predial — NBR 5674 / NBR 16747</Text>
        </View>

        {/* Métricas Principais (Cards de KPI) */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>94.2%</Text>
            <Text style={styles.kpiLabel}>Taxa Conformidade</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>12</Text>
            <Text style={styles.kpiLabel}>Vistorias Totais</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiVal, styles.kpiCrit]}>1</Text>
            <Text style={styles.kpiLabel}>Ocorrência Alta</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiVal}>18.4h</Text>
            <Text style={styles.kpiLabel}>SLA Médio</Text>
          </View>
        </View>

        {/* Subsistemas Prediais */}
        <Text style={styles.sectionTitle}>Conformidade por Subsistema Predial</Text>

        {subsistemas.map((sub, idx) => (
          <View key={idx} style={styles.subCard}>
            <View style={styles.subHeader}>
              <Text style={styles.subNome}>{sub.nome}</Text>
              <Text
                style={[
                  styles.subStatus,
                  sub.status === 'CONFORME' ? styles.statusOk : styles.statusWarn,
                ]}>
                {sub.status} ({sub.taxa}%)
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${sub.taxa}%` },
                  sub.status === 'CONFORME' ? styles.barOk : styles.barWarn,
                ]}
              />
            </View>
          </View>
        ))}

        {/* Histórico Recente */}
        <Text style={styles.sectionTitle}>Histórico de Vistorias Finalizadas</Text>

        {historicoVistorias.map((vist) => (
          <View key={vist.id} style={styles.histCard}>
            <View style={styles.histHeader}>
              <Text style={styles.histId}>{vist.id}</Text>
              <Text style={styles.histBadge}>{vist.status}</Text>
            </View>
            <Text style={styles.histCondo}>{vist.condominio}</Text>
            <Text style={styles.histResp}>Responsável: {vist.responsavel}</Text>
            <View style={styles.histFooter}>
              <Text style={styles.histDate}>Data: {vist.data}</Text>
              <Text style={styles.histItens}>{vist.itens}</Text>
            </View>
          </View>
        ))}

        {/* Base Normativa */}
        <View style={styles.normaBox}>
          <Text style={styles.normaTitle}>Conformidade Normativa ABNT</Text>
          <Text style={styles.normaText}>
            • <Text style={styles.bold}>ABNT NBR 5674:</Text> Procedimentos de gestão de manutenção em edificações.{'\n'}
            • <Text style={styles.bold}>ABNT NBR 16747:</Text> Diretrizes, conceitos e fluxo da inspeção predial.{'\n'}
            • <Text style={styles.bold}>Regras de Domínio:</Text> Validação offline local com SQLite e auditoria contínua.
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
  title: { fontSize: 22, fontWeight: 'bold', color: '#F0F6FC' },
  subtitle: { fontSize: 13, color: '#8B949E', marginTop: 2 },
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
  kpiCrit: { color: '#F85149' },
  kpiLabel: { fontSize: 11, color: '#8B949E' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F0F6FC', marginBottom: 12, marginTop: 6 },
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
  barBg: { height: 6, backgroundColor: '#21262D', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barOk: { backgroundColor: '#238636' },
  barWarn: { backgroundColor: '#D29922' },
  histCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  histId: { color: '#58A6FF', fontWeight: 'bold', fontSize: 12 },
  histBadge: { color: '#3FB950', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(63, 185, 80, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  histCondo: { color: '#F0F6FC', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  histResp: { color: '#8B949E', fontSize: 12, marginBottom: 6 },
  histFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#21262D', paddingTop: 6 },
  histDate: { color: '#6E7681', fontSize: 11 },
  histItens: { color: '#8B949E', fontSize: 11, fontWeight: '600' },
  normaBox: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
  },
  normaTitle: { color: '#38BDF8', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  normaText: { color: '#8B949E', fontSize: 12, lineHeight: 18 },
  bold: { color: '#F0F6FC', fontWeight: 'bold' },
});
