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

import { useVistoria } from '@/src/context/VistoriaContext';
import { GravidadeOcorrencia } from '@/src/domain/entities/ocorrencia.entity';

export default function OcorrenciasScreen() {
  const { ocorrencias, registrarOcorrencia, isOnline, outboxPendentes } = useVistoria();

  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [gravidade, setGravidade] = useState<GravidadeOcorrencia>(GravidadeOcorrencia.ALTA);
  const [fotoCapturada, setFotoCapturada] = useState(false);

  const handleCapturarFoto = () => {
    setFotoCapturada(!fotoCapturada);
  };

  const handleSalvarOcorrencia = async () => {
    if (!titulo.trim()) {
      Alert.alert('Dados Incompletos', 'Informe o título ou resumo da ocorrência técnica.');
      return;
    }

    try {
      const fotos = fotoCapturada
        ? [`file:///cache/evidencia_${Date.now()}.jpg`]
        : [];

      const nova = await registrarOcorrencia({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        gravidade,
        fotos,
      });

      setModalVisible(false);
      setTitulo('');
      setDescricao('');
      setFotoCapturada(false);

      Alert.alert(
        '✓ Ocorrência Registrada com Sucesso!',
        `Severidade: ${nova.gravidade}\n⏱️ SLA Calculado: ${nova.slaHoras} horas\n⚡ Evento INSERT enfileirado na Outbox em memória!`
      );
    } catch (err: any) {
      Alert.alert(
        'Bloqueio de Domínio (§3.2)',
        err?.message || 'Falha na validação de invariantes da ocorrência.'
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

        {/* Header da Tela */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ocorrências & Anomalias</Text>
            <Text style={styles.subtitle}>
              Matriz de SLA (24h, 72h, 7d) e fotos salvas via FileSystem
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Nova</Text>
          </TouchableOpacity>
        </View>

        {/* Cards de Resumo SLA */}
        <View style={styles.slaSummaryRow}>
          <View style={[styles.slaCard, styles.slaAlta]}>
            <Text style={styles.slaCardVal}>24h</Text>
            <Text style={styles.slaCardLabel}>ALTA (Foto Obrigatória)</Text>
          </View>
          <View style={[styles.slaCard, styles.slaMedia]}>
            <Text style={styles.slaCardVal}>72h</Text>
            <Text style={styles.slaCardLabel}>MÉDIA (Recomendada)</Text>
          </View>
          <View style={[styles.slaCard, styles.slaBaixa]}>
            <Text style={styles.slaCardVal}>7 dias</Text>
            <Text style={styles.slaCardLabel}>BAIXA (Opcional)</Text>
          </View>
        </View>

        {/* Lista de Ocorrências Cadastradas */}
        <Text style={styles.sectionTitle}>
          Ocorrências no Repositório ({ocorrencias.length})
        </Text>

        {ocorrencias.map((oc) => {
          const isAlta = oc.gravidade === GravidadeOcorrencia.ALTA;
          const isMedia = oc.gravidade === GravidadeOcorrencia.MEDIA;

          return (
            <View
              key={oc.id}
              style={[
                styles.itemCard,
                isAlta && styles.cardBorderAlta,
                isMedia && styles.cardBorderMedia,
              ]}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.gravidadeBadge,
                      isAlta && styles.badgeAlta,
                      isMedia && styles.badgeMedia,
                    ]}>
                    GRAVIDADE {oc.gravidade}
                  </Text>
                  <Text style={styles.slaBadge}>SLA: {oc.slaHoras}h</Text>
                </View>
                <Text style={styles.statusBadge}>{oc.status}</Text>
              </View>

              <Text style={styles.itemTitle}>{oc.titulo}</Text>
              {oc.descricao ? (
                <Text style={styles.itemDesc}>{oc.descricao}</Text>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.photoIndicator}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoText}>
                    {oc.fotos.length > 0
                      ? `${oc.fotos.length} foto(s) no FileSystem`
                      : 'Sem foto anexada'}
                  </Text>
                </View>
                <Text style={styles.dateText}>
                  {oc.dataCriacao ? new Date(oc.dataCriacao).toLocaleTimeString() : 'Agora'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Modal de Nova Ocorrência */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar Ocorrência Técnica</Text>
            <Text style={styles.modalSubtitle}>
              Classifique a severidade e anexe evidências conforme a regra §3.2.
            </Text>

            <Text style={styles.inputLabel}>Título / Problema Identificado:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Fissura passante em viga mestra..."
              placeholderTextColor="#64748B"
              value={titulo}
              onChangeText={setTitulo}
            />

            <Text style={styles.inputLabel}>Detalhes Técnicos (Opcional):</Text>
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              placeholder="Observações complementares..."
              placeholderTextColor="#64748B"
              multiline
              value={descricao}
              onChangeText={setDescricao}
            />

            <Text style={styles.inputLabel}>Severidade da Anomalia:</Text>
            <View style={styles.gravidadeRow}>
              <TouchableOpacity
                style={[
                  styles.gravidadeBtn,
                  gravidade === GravidadeOcorrencia.ALTA && styles.btnAltaActive,
                ]}
                onPress={() => setGravidade(GravidadeOcorrencia.ALTA)}>
                <Text
                  style={[
                    styles.gravidadeBtnText,
                    gravidade === GravidadeOcorrencia.ALTA && styles.textWhite,
                  ]}>
                  ALTA (24h)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.gravidadeBtn,
                  gravidade === GravidadeOcorrencia.MEDIA && styles.btnMediaActive,
                ]}
                onPress={() => setGravidade(GravidadeOcorrencia.MEDIA)}>
                <Text
                  style={[
                    styles.gravidadeBtnText,
                    gravidade === GravidadeOcorrencia.MEDIA && styles.textWhite,
                  ]}>
                  MÉDIA (72h)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.gravidadeBtn,
                  gravidade === GravidadeOcorrencia.BAIXA && styles.btnBaixaActive,
                ]}
                onPress={() => setGravidade(GravidadeOcorrencia.BAIXA)}>
                <Text
                  style={[
                    styles.gravidadeBtnText,
                    gravidade === GravidadeOcorrencia.BAIXA && styles.textWhite,
                  ]}>
                  BAIXA (7d)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Simulação de Foto da Câmera */}
            <TouchableOpacity
              style={[
                styles.cameraBtn,
                fotoCapturada ? styles.cameraBtnOk : styles.cameraBtnPending,
              ]}
              onPress={handleCapturarFoto}>
              <Text style={styles.cameraBtnText}>
                {fotoCapturada
                  ? '✓ Foto Capturada via Mock FileSystem (Clique p/ remover)'
                  : '📷 Simular Captura de Foto (Obrigatória se ALTA)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={handleSalvarOcorrencia}>
                <Text style={styles.modalBtnSaveText}>Salvar Ocorrência</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  },
  addBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  slaSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  slaCard: {
    flex: 1,
    backgroundColor: '#151D30',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232E48',
    alignItems: 'center',
  },
  slaAlta: {
    borderTopWidth: 3,
    borderTopColor: '#EF4444',
  },
  slaMedia: {
    borderTopWidth: 3,
    borderTopColor: '#F59E0B',
  },
  slaBaixa: {
    borderTopWidth: 3,
    borderTopColor: '#10B981',
  },
  slaCardVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  slaCardLabel: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#151D30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#232E48',
    marginBottom: 10,
  },
  cardBorderAlta: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  cardBorderMedia: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  gravidadeBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0E1322',
    color: '#10B981',
  },
  badgeAlta: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
  },
  badgeMedia: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
  },
  slaBadge: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(35, 46, 72, 0.5)',
  },
  photoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoIcon: {
    fontSize: 12,
  },
  photoText: {
    fontSize: 11,
    color: '#38BDF8',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#151D30',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#232E48',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 8,
    padding: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 12,
  },
  gravidadeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  gravidadeBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 8,
    alignItems: 'center',
  },
  gravidadeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  btnAltaActive: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  btnMediaActive: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  btnBaixaActive: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  cameraBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 18,
  },
  cameraBtnPending: {
    backgroundColor: '#0E1322',
    borderColor: '#38BDF8',
  },
  cameraBtnOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  cameraBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#3B4B70',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  modalBtnSave: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
  },
  modalBtnSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
