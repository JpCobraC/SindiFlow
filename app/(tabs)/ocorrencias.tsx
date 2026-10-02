import React, { useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface OcorrenciaItem {
  id: string;
  titulo: string;
  local: string;
  gravidade: 'BAIXA' | 'MEDIA' | 'ALTA';
  slaHoras: number;
  dataCriacao: string;
  temFoto: boolean;
  status: 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA';
}

export default function OcorrenciasScreen() {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaItem[]>([
    {
      id: 'oc-1',
      titulo: 'Infiltração ativa no pilar central da Garagem G2',
      local: 'Garagem G2 - Vaga 45',
      gravidade: 'ALTA',
      slaHoras: 24,
      dataCriacao: 'Hoje, 09:30',
      temFoto: true,
      status: 'ABERTA',
    },
    {
      id: 'oc-2',
      titulo: 'Gotejamento na válvula de retenção da bomba 2',
      local: 'Casa de Bombas - Subsolo',
      gravidade: 'MEDIA',
      slaHoras: 72,
      dataCriacao: 'Ontem, 16:45',
      temFoto: true,
      status: 'EM_ANDAMENTO',
    },
    {
      id: 'oc-3',
      titulo: 'Pintura descascando no hall de entrada',
      local: 'Hall Social - Térreo',
      gravidade: 'BAIXA',
      slaHoras: 168,
      dataCriacao: '28/09/2026',
      temFoto: false,
      status: 'RESOLVIDA',
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [gravidade, setGravidade] = useState<'BAIXA' | 'MEDIA' | 'ALTA'>('MEDIA');
  const [fotoCapturada, setFotoCapturada] = useState(false);

  const handleCapturarFoto = () => {
    setFotoCapturada(true);
    Alert.alert('Câmera Nativa', 'Evidência fotográfica capturada e salva no armazenamento local!');
  };

  const handleSalvarOcorrencia = () => {
    if (!titulo.trim() || !local.trim()) {
      Alert.alert('Dados Incompletos', 'Informe o título e o local da ocorrência.');
      return;
    }

    // Regra §3.2 do Domínio: ALTA gravidade exige foto obrigatória
    if (gravidade === 'ALTA' && !fotoCapturada) {
      Alert.alert(
        'Regra de Domínio (§3.2)',
        'Ocorrências de gravidade ALTA exigem obrigatoriamente pelo menos uma foto de evidência antes do salvamento.'
      );
      return;
    }

    const sla = gravidade === 'ALTA' ? 24 : gravidade === 'MEDIA' ? 72 : 168;

    const nova: OcorrenciaItem = {
      id: `oc-${Date.now().toString().slice(-4)}`,
      titulo: titulo.trim(),
      local: local.trim(),
      gravidade,
      slaHoras: sla,
      dataCriacao: 'Agora',
      temFoto: fotoCapturada,
      status: 'ABERTA',
    };

    setOcorrencias([nova, ...ocorrencias]);
    setModalVisible(false);
    setTitulo('');
    setLocal('');
    setFotoCapturada(false);

    Alert.alert(
      'Ocorrência Registrada na SQLite',
      `Gravidade: ${gravidade} (SLA: ${sla}h)\nEvento inserido na Outbox para sincronização com Supabase.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ocorrências & Chamados</Text>
          <Text style={styles.subtitle}>Classificação por Gravidade e Controle de SLA</Text>
        </View>

        {/* Quadro Informativo de SLAs (§3.2) */}
        <View style={styles.slaGrid}>
          <View style={[styles.slaCard, styles.slaAlta]}>
            <Text style={styles.slaBadgeAlta}>ALTA</Text>
            <Text style={styles.slaTime}>24 horas</Text>
            <Text style={styles.slaRule}>Foto Obrigatória</Text>
          </View>
          <View style={[styles.slaCard, styles.slaMedia]}>
            <Text style={styles.slaBadgeMedia}>MÉDIA</Text>
            <Text style={styles.slaTime}>72 horas</Text>
            <Text style={styles.slaRule}>Foto Recomendada</Text>
          </View>
          <View style={[styles.slaCard, styles.slaBaixa]}>
            <Text style={styles.slaBadgeBaixa}>BAIXA</Text>
            <Text style={styles.slaTime}>7 dias</Text>
            <Text style={styles.slaRule}>Foto Opcional</Text>
          </View>
        </View>

        {/* Botão Nova Ocorrência */}
        <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.newBtnText}>+ Nova Ocorrência Técnica</Text>
        </TouchableOpacity>

        {/* Lista de Ocorrências */}
        <Text style={styles.sectionTitle}>Chamados Ativos ({ocorrencias.length})</Text>

        {ocorrencias.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.tagRow}>
                <Text
                  style={[
                    styles.gravidadeTag,
                    item.gravidade === 'ALTA' && styles.tagAlta,
                    item.gravidade === 'MEDIA' && styles.tagMedia,
                    item.gravidade === 'BAIXA' && styles.tagBaixa,
                  ]}>
                  GRAVIDADE {item.gravidade} (SLA {item.slaHoras}h)
                </Text>
                {item.temFoto ? <Text style={styles.photoTag}>📷 Com Foto</Text> : null}
              </View>
              <Text style={styles.statusTag}>{item.status}</Text>
            </View>

            <Text style={styles.cardTitle}>{item.titulo}</Text>
            <Text style={styles.cardLocal}>📍 {item.local}</Text>
            <Text style={styles.cardTime}>Registrado: {item.dataCriacao}</Text>

            {item.status !== 'RESOLVIDA' ? (
              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => {
                  setOcorrencias((prev) =>
                    prev.map((o) => (o.id === item.id ? { ...o, status: 'RESOLVIDA' } : o))
                  );
                }}>
                <Text style={styles.resolveBtnText}>Marcar como Resolvido</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Modal Nova Ocorrência */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registrar Ocorrência Técnica</Text>

            <Text style={styles.inputLabel}>Título do Defeito</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Trinca estrutural no pilar P12"
              placeholderTextColor="#8B949E"
              value={titulo}
              onChangeText={setTitulo}
            />

            <Text style={styles.inputLabel}>Local / Área Predial</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Subestação ou Garagem G1"
              placeholderTextColor="#8B949E"
              value={local}
              onChangeText={setLocal}
            />

            <Text style={styles.inputLabel}>Classificação de Gravidade</Text>
            <View style={styles.gravidadeSelector}>
              {(['BAIXA', 'MEDIA', 'ALTA'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.gravidadeBtn,
                    gravidade === g && styles.gravidadeBtnActive,
                    g === 'ALTA' && styles.btnBorderAlta,
                  ]}
                  onPress={() => setGravidade(g)}>
                  <Text
                    style={[
                      styles.gravidadeText,
                      gravidade === g && styles.gravidadeTextActive,
                    ]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Aviso sobre foto se for ALTA */}
            {gravidade === 'ALTA' ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  ⚠ ATENÇÃO: Gravidade ALTA exige foto obrigatória conforme a regra de domínio §3.2.
                </Text>
              </View>
            ) : null}

            {/* Botão de Captura de Foto */}
            <TouchableOpacity
              style={[styles.cameraBtn, fotoCapturada && styles.cameraBtnDone]}
              onPress={handleCapturarFoto}>
              <Text style={styles.cameraBtnText}>
                {fotoCapturada ? '✓ Foto de Evidência Anexada' : '📷 Capturar Foto de Evidência'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSalvarOcorrencia}>
                <Text style={styles.submitBtnText}>Salvar Chamado</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D1117' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#F0F6FC' },
  subtitle: { fontSize: 13, color: '#8B949E', marginTop: 2 },
  slaGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  slaCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  slaAlta: { borderTopWidth: 3, borderTopColor: '#F85149' },
  slaMedia: { borderTopWidth: 3, borderTopColor: '#D29922' },
  slaBaixa: { borderTopWidth: 3, borderTopColor: '#3FB950' },
  slaBadgeAlta: { color: '#F85149', fontWeight: 'bold', fontSize: 11 },
  slaBadgeMedia: { color: '#D29922', fontWeight: 'bold', fontSize: 11 },
  slaBadgeBaixa: { color: '#3FB950', fontWeight: 'bold', fontSize: 11 },
  slaTime: { color: '#F0F6FC', fontWeight: 'bold', fontSize: 14, marginVertical: 2 },
  slaRule: { color: '#8B949E', fontSize: 10 },
  newBtn: {
    backgroundColor: '#1F6FEB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  newBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F0F6FC', marginBottom: 12 },
  card: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  gravidadeTag: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagAlta: { backgroundColor: 'rgba(248, 81, 73, 0.2)', color: '#F85149' },
  tagMedia: { backgroundColor: 'rgba(210, 153, 34, 0.2)', color: '#D29922' },
  tagBaixa: { backgroundColor: 'rgba(63, 185, 80, 0.2)', color: '#3FB950' },
  photoTag: {
    backgroundColor: 'rgba(88, 166, 255, 0.2)',
    color: '#58A6FF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTag: { color: '#8B949E', fontSize: 10, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#F0F6FC', marginBottom: 4 },
  cardLocal: { color: '#8B949E', fontSize: 12, marginBottom: 2 },
  cardTime: { color: '#6E7681', fontSize: 11, marginBottom: 8 },
  resolveBtn: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  resolveBtnText: { color: '#3FB950', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F0F6FC', marginBottom: 14 },
  inputLabel: { color: '#8B949E', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 6,
    padding: 10,
    color: '#F0F6FC',
    marginBottom: 12,
  },
  gravidadeSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  gravidadeBtn: {
    flex: 1,
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  gravidadeBtnActive: { backgroundColor: '#1F6FEB', borderColor: '#58A6FF' },
  btnBorderAlta: { borderColor: '#F85149' },
  gravidadeText: { color: '#8B949E', fontWeight: 'bold', fontSize: 12 },
  gravidadeTextActive: { color: '#FFFFFF' },
  warnBox: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#F85149',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  warnText: { color: '#F85149', fontSize: 11, lineHeight: 15 },
  cameraBtn: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#58A6FF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraBtnDone: { backgroundColor: '#238636', borderColor: '#3FB950' },
  cameraBtnText: { color: '#F0F6FC', fontWeight: 'bold', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  cancelBtnText: { color: '#8B949E', fontWeight: 'bold' },
  submitBtn: {
    backgroundColor: '#238636',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
});
