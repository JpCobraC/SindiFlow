import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { StatusItemChecklist } from '@/src/domain/entities/item-checklist.entity';
import { StatusVistoria } from '@/src/domain/entities/vistoria.entity';
import { humanizarErro } from '@/src/utils/error-messages';

export default function VistoriaScreen() {
  const {
    vistoriaAtiva,
    itensChecklist,
    marcarItem,
    finalizarVistoria,
    isOnline,
    outboxPendentes,
    isCarregando,
    iniciarVistoria,
    capturarLocalizacao,
    anexarFoto,
  } = useVistoria();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [sessionGps, setSessionGps] = useState<{
    latitude: number;
    longitude: number;
    precisao?: number;
  } | null>(null);
  const [capturandoGps, setCapturandoGps] = useState(false);
  const [anexandoFotoId, setAnexandoFotoId] = useState<string | null>(null);

  // Cálculo de progresso do agregado de domínio
  const percentual = vistoriaAtiva ? Math.round(vistoriaAtiva.percentualRespondido()) : 0;
  const aptoParaFinalizar = percentual >= 80;
  const isFinalizada =
    vistoriaAtiva?.status === StatusVistoria.FINALIZADA ||
    vistoriaAtiva?.status === StatusVistoria.APROVADA;

  const handleObterGPS = async () => {
    try {
      setCapturandoGps(true);
      const geo = await capturarLocalizacao();
      setSessionGps({
        latitude: geo.latitude,
        longitude: geo.longitude,
        precisao: geo.precisao,
      });
      Alert.alert(
        '✓ GPS Capturado com Sucesso',
        `📍 Coordenadas: [${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}]\n🎯 Precisão: ${geo.precisao ?? '4.5'} metros`
      );
    } catch (err: any) {
      Alert.alert('Falha na Localização', humanizarErro(err, 'Não foi possível capturar o GPS.'));
    } finally {
      setCapturandoGps(false);
    }
  };

  const handleAnexarFoto = async (
    itemId: string,
    origem: 'camera' | 'galeria' = 'camera'
  ) => {
    if (isFinalizada) {
      Alert.alert('Vistoria Concluída', 'Esta vistoria já foi finalizada e não aceita mais fotos.');
      return;
    }

    try {
      setAnexandoFotoId(itemId);
      const ev = await anexarFoto({ itemId, origem });
      if (ev) {
        Alert.alert('✓ Foto Anexada', 'A foto foi salva neste item da vistoria.');
      }
    } catch (err: any) {
      if (err?.message?.includes('cancelada')) return;
      const msg = humanizarErro(err, 'Não foi possível capturar a foto.');
      if (origem === 'camera') {
        Alert.alert('Não foi possível abrir a câmera', msg, [
          { text: 'Fechar', style: 'cancel' },
          {
            text: 'Escolher da Galeria',
            onPress: () => {
              void handleAnexarFoto(itemId, 'galeria');
            },
          },
        ]);
      } else {
        Alert.alert('Falha ao selecionar foto', msg);
      }
    } finally {
      setAnexandoFotoId(null);
    }
  };

  const handleMarcarStatus = async (id: string, novoStatus: StatusItemChecklist) => {
    if (isFinalizada) {
      Alert.alert('Vistoria Concluída', 'Esta vistoria já foi finalizada e não aceita mais edições.');
      return;
    }

    if (novoStatus === StatusItemChecklist.CRITICO) {
      setSelectedItemId(id);
      setJustificativa('');
      setModalVisible(true);
      return;
    }

    try {
      await marcarItem(id, novoStatus);
    } catch (err: any) {
      Alert.alert('Atenção', humanizarErro(err, 'Não foi possível atualizar o item.'));
    }
  };

  const handleConfirmarCritico = async () => {
    if (!selectedItemId) return;
    if (!justificativa.trim()) {
      Alert.alert(
        'Justificativa Obrigatória',
        'Itens classificados como CRÍTICO exigem descrição técnica detalhada da anomalia.'
      );
      return;
    }

    try {
      await marcarItem(selectedItemId, StatusItemChecklist.CRITICO, justificativa.trim());
      setModalVisible(false);
      setSelectedItemId(null);
      setJustificativa('');
    } catch (err: any) {
      Alert.alert('Atenção', humanizarErro(err, 'Não foi possível salvar a justificativa.'));
    }
  };

  const handleFinalizar = async () => {
    try {
      await finalizarVistoria(sessionGps?.latitude, sessionGps?.longitude);
      Alert.alert(
        '✓ Vistoria Finalizada com Sucesso!',
        `📍 Localização registrada com sucesso\n📊 Itens avaliados: ${percentual}%\n📄 Laudo técnico pronto para análise do síndico.`
      );
    } catch (err: any) {
      Alert.alert(
        'Não foi possível finalizar',
        humanizarErro(err, 'Responda pelo menos 80% dos itens antes de finalizar a vistoria.')
      );
    }
  };

  const handleIniciarVistoria = async () => {
    try {
      await iniciarVistoria();
    } catch (err: any) {
      Alert.alert(
        'Não foi possível iniciar',
        humanizarErro(err, 'Apenas inspetores podem iniciar uma vistoria.')
      );
    }
  };

  if (isCarregando) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={{ color: '#94A3B8', marginTop: 12 }}>Abrindo banco local...</Text>
      </SafeAreaView>
    );
  }

  if (!vistoriaAtiva) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center, { padding: 24 }]}>
        <Text style={{ color: '#F87171', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
          Nenhuma vistoria ativa
        </Text>
        <Text style={{ color: '#94A3B8', marginBottom: 20, textAlign: 'center' }}>
          Inicie uma nova vistoria. O checklist padrão fica salvo no aparelho e sincroniza quando houver conexão.
        </Text>
        <TouchableOpacity
          style={[styles.finalizeBtn, { paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }]}
          onPress={handleIniciarVistoria}>
          <Text style={styles.finalizeBtnText}>Iniciar Vistoria</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Banner de Status & Conectividade */}
        <View style={styles.mockBanner}>
          <View style={styles.mockBannerLeft}>
            <View style={[styles.networkDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.mockBannerText}>
              {isOnline ? 'Online — Sincronizado' : 'Modo Offline Ativo'}
            </Text>
          </View>
          <View style={styles.bannerActions}>
            <View style={styles.outboxPill}>
              <Text style={styles.outboxPillText}>{outboxPendentes.length} pendente(s)</Text>
            </View>
          </View>
        </View>

        {/* Header da Vistoria */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.headerBadge}>VIST-2026-09</Text>
            <View style={styles.headerRightActions}>
              <Text
                style={[
                  styles.statusBadge,
                  isFinalizada ? styles.statusDone : styles.statusProgress,
                ]}>
                {vistoriaAtiva.status}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Edifício Solar das Palmeiras</Text>
          <Text style={styles.subtitle}>
            Vistoria Preventiva Periódica • NBR 5674
          </Text>

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
                ? '✓ Cobertura mínima de 80% atingida — Pronto para finalizar'
                : '⚠ É obrigatório responder pelo menos 80% dos itens'}
            </Text>
          </View>
        </View>

        {/* Card de Geolocalização da Sessão */}
        <View style={styles.geoCard}>
          <View style={styles.geoCardHeader}>
            <Text style={styles.geoTitle}>📍 Localização GPS da Vistoria</Text>
            <TouchableOpacity
              style={styles.geoRefreshBtn}
              onPress={handleObterGPS}
              disabled={isFinalizada || capturandoGps}>
              <Text style={styles.geoRefreshText}>
                {capturandoGps ? 'Lendo GPS...' : 'Atualizar GPS'}
              </Text>
            </TouchableOpacity>
          </View>

          {vistoriaAtiva.geolocalizacao ? (
            <View style={styles.geoInfoBox}>
              <Text style={styles.geoCoords}>
                Lat: {vistoriaAtiva.geolocalizacao.latitude.toFixed(6)} | Long:{' '}
                {vistoriaAtiva.geolocalizacao.longitude.toFixed(6)}
              </Text>
              <Text style={styles.geoDetails}>
                ✓ Localização registrada • Precisão:{' '}
                {vistoriaAtiva.geolocalizacao.precisao ?? '4.5'}m
              </Text>
            </View>
          ) : sessionGps ? (
            <View style={styles.geoInfoBox}>
              <Text style={styles.geoCoords}>
                Lat: {sessionGps.latitude.toFixed(6)} | Long: {sessionGps.longitude.toFixed(6)}
              </Text>
              <Text style={styles.geoDetails}>
                Sessão em andamento • Precisão: {sessionGps.precisao ?? '4.5'}m
              </Text>
            </View>
          ) : (
            <Text style={styles.geoEmpty}>
              Nenhuma coordenada capturada ainda. O GPS será obtido automaticamente ao finalizar a
              inspeção, ou toque em Atualizar GPS.
            </Text>
          )}
        </View>

        {vistoriaAtiva.status === StatusVistoria.DEVOLVIDA && (
          <View style={styles.devolvidaBanner}>
            <Text style={styles.devolvidaBannerTitle}>
              ⚠️ Vistoria devolvida para revisão
            </Text>
            <Text style={styles.devolvidaBannerText}>
              Motivo informado pelo síndico:{' '}
              {vistoriaAtiva.motivoDevolucao || 'Revisar apontamentos antes de reenviar.'}
            </Text>
          </View>
        )}

        {/* Lista de Itens do Checklist */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Itens de Inspeção Técnica</Text>
          <Text style={styles.sectionCount}>
            {itensChecklist.filter((i) => i.status !== StatusItemChecklist.PENDENTE).length} de{' '}
            {itensChecklist.length} avaliados
          </Text>
        </View>

        {itensChecklist.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemCategory}>{item.categoria}</Text>
              <Text
                style={[
                  styles.itemStatusBadge,
                  item.status === StatusItemChecklist.OK && styles.badgeOk,
                  item.status === StatusItemChecklist.AVISO && styles.badgeAviso,
                  item.status === StatusItemChecklist.CRITICO && styles.badgeCritico,
                ]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.itemTitle}>{item.titulo}</Text>

            {item.observacao ? (
              <View style={styles.observacaoBox}>
                <Text style={styles.observacaoLabel}>Justificativa Técnica:</Text>
                <Text style={styles.observacaoText}>{item.observacao}</Text>
              </View>
            ) : null}

            {/* Ações de Classificação */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.status === StatusItemChecklist.OK && styles.btnActiveOk,
                ]}
                onPress={() => handleMarcarStatus(item.id, StatusItemChecklist.OK)}>
                <Text
                  style={[
                    styles.actionBtnText,
                    item.status === StatusItemChecklist.OK && styles.textActiveLight,
                  ]}>
                  OK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.status === StatusItemChecklist.AVISO && styles.btnActiveAviso,
                ]}
                onPress={() => handleMarcarStatus(item.id, StatusItemChecklist.AVISO)}>
                <Text
                  style={[
                    styles.actionBtnText,
                    item.status === StatusItemChecklist.AVISO && styles.textActiveLight,
                  ]}>
                  AVISO
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.status === StatusItemChecklist.CRITICO && styles.btnActiveCritico,
                ]}
                onPress={() => handleMarcarStatus(item.id, StatusItemChecklist.CRITICO)}>
                <Text
                  style={[
                    styles.actionBtnText,
                    item.status === StatusItemChecklist.CRITICO && styles.textActiveLight,
                  ]}>
                  CRÍTICO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ação de Evidência Fotográfica do Item */}
            <View style={styles.itemFooterRow}>
              <View style={styles.itemFotoActions}>
                <TouchableOpacity
                  style={styles.itemFotoBtn}
                  onPress={() => handleAnexarFoto(item.id, 'camera')}
                  disabled={isFinalizada || anexandoFotoId === item.id}>
                  <Text style={styles.itemFotoBtnText}>
                    {anexandoFotoId === item.id ? 'Abrindo...' : '📷 Tirar Foto'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.itemFotoBtn}
                  onPress={() => handleAnexarFoto(item.id, 'galeria')}
                  disabled={isFinalizada || anexandoFotoId === item.id}>
                  <Text style={styles.itemFotoBtnText}>🖼️ Galeria</Text>
                </TouchableOpacity>
              </View>
              {item.evidencias.length > 0 && (
                <Text style={styles.itemFotoCount}>
                  {item.evidencias.length} foto(s) anexada(s)
                </Text>
              )}
            </View>
            {item.evidencias.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbsRow}>
                {item.evidencias.map((ev) => (
                  <Image
                    key={ev.id}
                    source={{ uri: ev.caminhoArquivoLocal }}
                    style={styles.thumbImage}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ))}

        {/* Botão de Finalização com Validação */}
        <TouchableOpacity
          style={[styles.finalizeBtn, !aptoParaFinalizar && styles.finalizeBtnDisabled]}
          onPress={handleFinalizar}
          disabled={isFinalizada}>
          <Text style={styles.finalizeBtnText}>
            {isFinalizada
              ? '✓ Vistoria Concluída'
              : 'Finalizar Vistoria com GPS'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Justificativa Obrigatória para Crítico */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Justificativa Obrigatória</Text>
              <Text style={styles.modalSubtitle}>
                Qualquer item classificado como CRÍTICO exige justificativa técnica detalhando a anomalia.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Descreva o problema crítico, risco e necessidade de reparo..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={4}
                value={justificativa}
                onChangeText={setJustificativa}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedItemId(null);
                    setJustificativa('');
                  }}>
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleConfirmarCritico}>
                  <Text style={styles.modalBtnConfirmText}>Confirmar Crítico</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060911',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
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
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hwToggleBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  hwToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
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
  geoCard: {
    backgroundColor: '#0E1726',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginBottom: 20,
  },
  geoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  geoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  geoRefreshBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  geoRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  geoInfoBox: {
    backgroundColor: '#151D30',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  geoCoords: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  geoDetails: {
    fontSize: 11,
    color: '#94A3B8',
  },
  geoEmpty: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  itemFotoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemFotoBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B4B70',
  },
  itemFotoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  itemFotoCount: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  thumbsRow: {
    marginTop: 10,
  },
  thumbImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  devolvidaBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  devolvidaBannerTitle: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  devolvidaBannerText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
  },
  headerCard: {
    backgroundColor: '#151D30',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#232E48',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBadge: {
    backgroundColor: '#0E1322',
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#232E48',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusProgress: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38BDF8',
  },
  statusDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
  },
  resetBtn: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#3B4B70',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resetBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: '#0E1322',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232E48',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38BDF8',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#060911',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressValid: {
    backgroundColor: '#10B981',
  },
  progressWarn: {
    backgroundColor: '#F59E0B',
  },
  progressNotice: {
    fontSize: 11,
    color: '#94A3B8',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  sectionCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#151D30',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#232E48',
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCategory: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemStatusBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0E1322',
    color: '#64748B',
  },
  badgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
  },
  badgeAviso: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
  },
  badgeCritico: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  observacaoBox: {
    backgroundColor: '#0E1322',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  observacaoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 2,
  },
  observacaoText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  btnActiveOk: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  btnActiveAviso: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  btnActiveCritico: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  textActiveLight: {
    color: '#FFFFFF',
  },
  finalizeBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finalizeBtnDisabled: {
    backgroundColor: '#1E293B',
    shadowOpacity: 0,
  },
  finalizeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151D30',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#232E48',
    borderRadius: 8,
    padding: 10,
    color: '#F8FAFC',
    fontSize: 13,
    textAlignVertical: 'top',
    height: 90,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: '#3B4B70',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  modalBtnConfirm: {
    flex: 1.4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
