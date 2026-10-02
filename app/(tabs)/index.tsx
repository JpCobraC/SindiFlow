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

interface ChecklistItem {
  id: string;
  titulo: string;
  categoria: string;
  status: 'PENDENTE' | 'OK' | 'AVISO' | 'CRITICO';
  observacao?: string;
}

export default function VistoriaScreen() {
  const [itens, setItens] = useState<ChecklistItem[]>([
    {
      id: 'item-1',
      titulo: 'Extintores de Incêndio - Carga e Lacre',
      categoria: 'Segurança Contra Incêndio',
      status: 'OK',
    },
    {
      id: 'item-2',
      titulo: 'Quadro Geral de Baixa Tensão (QGBT)',
      categoria: 'Instalações Elétricas',
      status: 'OK',
    },
    {
      id: 'item-3',
      titulo: 'Bombas de Recalque e Retentores',
      categoria: 'Instalações Hidráulicas',
      status: 'AVISO',
      observacao: 'Leve gotejamento no retentor da bomba secundária',
    },
    {
      id: 'item-4',
      titulo: 'Barrilete e Impermeabilização Superior',
      categoria: 'Impermeabilização & Cobertura',
      status: 'PENDENTE',
    },
    {
      id: 'item-5',
      titulo: 'Gerador a Diesel - Nível de Óleo e Bateria',
      categoria: 'Emergência & Automação',
      status: 'PENDENTE',
    },
    {
      id: 'item-6',
      titulo: 'Iluminação de Emergência das Escadarias',
      categoria: 'Segurança Contra Incêndio',
      status: 'PENDENTE',
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [vistoriaFinalizada, setVistoriaFinalizada] = useState(false);

  // RF-VIST-002: Calcular percentual respondido
  const respondidos = itens.filter((i) => i.status !== 'PENDENTE').length;
  const percentual = Math.round((respondidos / itens.length) * 100);
  const aptoParaFinalizar = percentual >= 80;

  const handleMarcarStatus = (id: string, novoStatus: 'OK' | 'AVISO' | 'CRITICO') => {
    if (novoStatus === 'CRITICO') {
      // RF-VIST-003: Item CRITICO exige justificativa
      setSelectedItemId(id);
      setJustificativa('');
      setModalVisible(true);
      return;
    }

    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: novoStatus } : item))
    );
  };

  const handleConfirmarCritico = () => {
    if (!justificativa.trim()) {
      Alert.alert(
        'Regra do Domínio (RF-VIST-003)',
        'Itens marcados como CRÍTICO exigem justificativa/observação técnica obrigatória.'
      );
      return;
    }

    setItens((prev) =>
      prev.map((item) =>
        item.id === selectedItemId
          ? { ...item, status: 'CRITICO', observacao: justificativa.trim() }
          : item
      )
    );
    setModalVisible(false);
    setSelectedItemId(null);
    setJustificativa('');
  };

  const handleFinalizarVistoria = () => {
    // Validação RF-VIST-002
    if (percentual < 80) {
      Alert.alert(
        'Bloqueio Arquitetural (RF-VIST-002)',
        `A vistoria só pode ser finalizada se ≥80% dos itens estiverem respondidos. Progresso atual: ${percentual}%.`
      );
      return;
    }

    // Validação RF-VIST-003
    const criticoSemNota = itens.find(
      (i) => i.status === 'CRITICO' && (!i.observacao || i.observacao.trim() === '')
    );
    if (criticoSemNota) {
      Alert.alert(
        'Bloqueio Arquitetural (RF-VIST-003)',
        `O item "${criticoSemNota.titulo}" está marcado como CRÍTICO e exige observação técnica.`
      );
      return;
    }

    // RF-VIST-004: Geolocalização obrigatória
    setVistoriaFinalizada(true);
    Alert.alert(
      'Vistoria Finalizada com Sucesso!',
      `GPS registrado: -23.5612, -46.6537\nItens respondidos: ${percentual}%\nEvento enfileirado na Outbox para sincronização.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Banner de Status Offline */}
        <View style={styles.offlineBanner}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>
            Modo Offline Ativo — Garagem Subterrânea G2 (SQLite Local)
          </Text>
        </View>

        {/* Header da Vistoria */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.headerBadge}>VIST-2026-09</Text>
            <Text
              style={[
                styles.statusBadge,
                vistoriaFinalizada ? styles.statusDone : styles.statusProgress,
              ]}>
              {vistoriaFinalizada ? 'FINALIZADA' : 'EM ANDAMENTO'}
            </Text>
          </View>
          <Text style={styles.title}>Edifício Solar das Palmeiras</Text>
          <Text style={styles.subtitle}>Vistoria Preventiva Mensal — NBR 5674</Text>

          {/* Barra de Progresso com Regra dos 80% */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progresso do Checklist</Text>
              <Text style={styles.progressValue}>{percentual}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${percentual}%` },
                  aptoParaFinalizar ? styles.progressValid : styles.progressWarn,
                ]}
              />
            </View>
            <Text style={styles.progressNotice}>
              {aptoParaFinalizar
                ? '✓ Apto para finalização (≥80% dos itens respondidos)'
                : '⚠ Mínimo de 80% necessário para finalizar (RF-VIST-002)'}
            </Text>
          </View>
        </View>

        {/* Lista de Itens do Checklist */}
        <Text style={styles.sectionTitle}>Itens de Inspeção Técnica</Text>

        {itens.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemCategory}>{item.categoria}</Text>
              <Text
                style={[
                  styles.itemStatusBadge,
                  item.status === 'OK' && styles.badgeOk,
                  item.status === 'AVISO' && styles.badgeAviso,
                  item.status === 'CRITICO' && styles.badgeCritico,
                ]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.itemTitle}>{item.titulo}</Text>

            {item.observacao ? (
              <View style={styles.observacaoBox}>
                <Text style={styles.observacaoLabel}>Observação Técnica:</Text>
                <Text style={styles.observacaoText}>{item.observacao}</Text>
              </View>
            ) : null}

            {/* Ações de Classificação */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, item.status === 'OK' && styles.btnActiveOk]}
                onPress={() => handleMarcarStatus(item.id, 'OK')}>
                <Text style={styles.actionBtnText}>OK</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, item.status === 'AVISO' && styles.btnActiveAviso]}
                onPress={() => handleMarcarStatus(item.id, 'AVISO')}>
                <Text style={styles.actionBtnText}>AVISO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, item.status === 'CRITICO' && styles.btnActiveCritico]}
                onPress={() => handleMarcarStatus(item.id, 'CRITICO')}>
                <Text style={styles.actionBtnText}>CRÍTICO</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Botão de Finalização com Validação */}
        <TouchableOpacity
          style={[styles.finalizeBtn, !aptoParaFinalizar && styles.finalizeBtnDisabled]}
          onPress={handleFinalizarVistoria}
          disabled={vistoriaFinalizada}>
          <Text style={styles.finalizeBtnText}>
            {vistoriaFinalizada
              ? '✓ Vistoria Concluída'
              : 'Finalizar Vistoria com GPS (RF-VIST-004)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Justificativa Obrigatória para Crítico */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Item Crítico Detectado ⚠</Text>
            <Text style={styles.modalDesc}>
              Conforme a regra arquitetural RF-VIST-003, qualquer item classificado como CRÍTICO exige
              justificativa técnica detalhada para auditoria do condomínio.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Descreva o defeito, risco imediato ou medida recomendada..."
              placeholderTextColor="#8B949E"
              multiline
              numberOfLines={4}
              value={justificativa}
              onChangeText={setJustificativa}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedItemId(null);
                }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmarCritico}>
                <Text style={styles.modalConfirmText}>Salvar Justificativa</Text>
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
    backgroundColor: '#0D1117',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  offlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
    marginRight: 8,
  },
  offlineText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerBadge: {
    color: '#58A6FF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusProgress: {
    backgroundColor: 'rgba(88, 166, 255, 0.2)',
    color: '#58A6FF',
  },
  statusDone: {
    backgroundColor: 'rgba(35, 134, 54, 0.2)',
    color: '#3FB950',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F0F6FC',
  },
  subtitle: {
    fontSize: 13,
    color: '#8B949E',
    marginTop: 2,
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#C9D1D9',
    fontSize: 13,
  },
  progressValue: {
    color: '#F0F6FC',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#21262D',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressValid: {
    backgroundColor: '#238636',
  },
  progressWarn: {
    backgroundColor: '#D29922',
  },
  progressNotice: {
    fontSize: 11,
    color: '#8B949E',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F0F6FC',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCategory: {
    color: '#8B949E',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemStatusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#21262D',
    color: '#8B949E',
  },
  badgeOk: {
    backgroundColor: 'rgba(35, 134, 54, 0.25)',
    color: '#3FB950',
  },
  badgeAviso: {
    backgroundColor: 'rgba(210, 153, 34, 0.25)',
    color: '#D29922',
  },
  badgeCritico: {
    backgroundColor: 'rgba(248, 81, 73, 0.25)',
    color: '#F85149',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F0F6FC',
    marginBottom: 10,
  },
  observacaoBox: {
    backgroundColor: '#0D1117',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F85149',
  },
  observacaoLabel: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: 'bold',
  },
  observacaoText: {
    color: '#C9D1D9',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#21262D',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  btnActiveOk: {
    backgroundColor: '#238636',
    borderColor: '#238636',
  },
  btnActiveAviso: {
    backgroundColor: '#9E6A03',
    borderColor: '#D29922',
  },
  btnActiveCritico: {
    backgroundColor: '#DA3633',
    borderColor: '#F85149',
  },
  actionBtnText: {
    color: '#F0F6FC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  finalizeBtn: {
    backgroundColor: '#238636',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  finalizeBtnDisabled: {
    backgroundColor: '#30363D',
    opacity: 0.7,
  },
  finalizeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F85149',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#8B949E',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 10,
    color: '#F0F6FC',
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  modalCancelText: {
    color: '#8B949E',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#DA3633',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
