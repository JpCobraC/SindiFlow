import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVistoria } from '@/src/context/VistoriaContext';
import { GravidadeOcorrencia } from '@/src/domain/entities/ocorrencia.entity';
import { StatusVistoria } from '@/src/domain/entities/vistoria.entity';

export default function CondominoScreen() {
  const {
    usuarioLogado,
    loginRapido,
    vistoriaAtiva,
    itensChecklist,
    comunicados,
    anexarFoto,
    registrarOcorrencia,
  } = useVistoria();

  const [novoChamadoTitulo, setNovoChamadoTitulo] = useState('');
  const [novoChamadoDesc, setNovoChamadoDesc] = useState('');
  const [fotoEvidencia, setFotoEvidencia] = useState<string | null>(null);
  const [isEnviando, setIsEnviando] = useState(false);

  const isCondomino = usuarioLogado?.isCondomino() ?? false;
  const laudoLiberado = vistoriaAtiva?.status === StatusVistoria.APROVADA;

  const handleTirarFoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const resultado = await anexarFoto({});
      if (resultado) {
        setFotoEvidencia(resultado.caminhoArquivoLocal);
        Alert.alert('Foto Anexada', 'Evidência fotográfica registrada e comprimida no armazenamento privado.');
      }
    } catch (e: any) {
      Alert.alert('Aviso de Câmera', e?.message || 'Não foi possível capturar foto');
    }
  };

  const handleEnviarChamado = async () => {
    if (!novoChamadoTitulo.trim()) {
      Alert.alert('Campo Obrigatório', 'Informe o título do problema detectado na área comum.');
      return;
    }

    try {
      setIsEnviando(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await registrarOcorrencia({
        titulo: `[${usuarioLogado?.unidade || 'Condômino'}] ${novoChamadoTitulo.trim()}`,
        descricao: novoChamadoDesc.trim() || undefined,
        gravidade: GravidadeOcorrencia.MEDIA,
        fotos: fotoEvidencia ? [fotoEvidencia] : undefined,
      });

      setNovoChamadoTitulo('');
      setNovoChamadoDesc('');
      setFotoEvidencia(null);
      Alert.alert(
        'Chamado Registrado!',
        'Sua solicitação de manutenção foi enviada ao síndico com SLA de atendimento e salva no banco de dados offline.'
      );
    } catch (e: any) {
      Alert.alert('Erro ao enviar', e?.message || 'Falha ao registrar chamado');
    } finally {
      setIsEnviando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Alerta de Perfil */}
      {!isCondomino && (
        <View style={styles.switchAlertCard}>
          <Text style={styles.switchAlertTitle}>Visualizando como morador/condômino</Text>
          <Text style={styles.switchAlertText}>
            Você está conectado como {usuarioLogado?.nome}. Deseja ver a tela com a moradora Mariana Souza (Apto 402)?
          </Text>
          <TouchableOpacity
            style={styles.switchAlertBtn}
            onPress={() => loginRapido('CONDOMINO')}>
            <Text style={styles.switchAlertBtnText}>Alternar para Mariana (Condômina) ➔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cabeçalho do Portal */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PORTAL DO CONDÔMINO</Text>
        <Text style={styles.sectionSubtitle}>
          Transparência da Manutenção Predial e Chamados de Áreas Comuns (NBR 5674)
        </Text>
      </View>

      {/* Cartão de Unidade e Status Predial */}
      <View style={styles.statusPredialCard}>
        <View style={styles.statusPredialHeader}>
          <View>
            <Text style={styles.unitText}>
              {usuarioLogado?.unidade || 'Apartamento 402 — Bloco B'}
            </Text>
            <Text style={styles.condoText}>Condomínio Edifício Solar das Palmeiras</Text>
          </View>
          <View style={styles.sealBadge}>
            <Text style={styles.sealText}>NBR 5674</Text>
          </View>
        </View>

        <View style={styles.statusIndicatorRow}>
          <View
            style={[
              styles.indicatorCircle,
              { backgroundColor: laudoLiberado ? '#3FB950' : '#E3B341' },
            ]}
          />
          <Text style={styles.indicatorText}>
            {laudoLiberado
              ? 'Laudo Semestral Homologado pelo Síndico'
              : 'Inspeção Predial Periódica em Andamento'}
          </Text>
        </View>
      </View>

      {/* Consulta de Laudo Técnico Homologado (RF15) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>LAUDO TÉCNICO DE SEGURANÇA PREDIAL (RF15)</Text>
          <View
            style={[
              styles.badge,
              laudoLiberado ? styles.badgeSuccess : styles.badgeWarning,
            ]}>
            <Text style={styles.badgeText}>
              {laudoLiberado ? 'DISPONÍVEL' : 'EM AUDITORIA'}
            </Text>
          </View>
        </View>

        {laudoLiberado ? (
          <View style={styles.laudoContent}>
            <View style={styles.laudoHeaderBox}>
              <Text style={styles.laudoTitle}>Laudo Pericial Nº 2026/01 - Aprovado</Text>
              <Text style={styles.laudoMeta}>
                Responsável Técnico: Eng. Carlos Eduardo Viana (CREA 50692-SP)
              </Text>
              <Text style={styles.laudoMeta}>
                Homologado por: Dr. Carlos Alberto (Síndico Geral)
              </Text>
              {vistoriaAtiva?.geolocalizacao && (
                <Text style={styles.laudoGeo}>
                  📍 Localização Pericial Auditada: [
                  {vistoriaAtiva.geolocalizacao.latitude.toFixed(6)},{' '}
                  {vistoriaAtiva.geolocalizacao.longitude.toFixed(6)}]
                </Text>
              )}
            </View>

            <View style={styles.parecerBox}>
              <Text style={styles.parecerLabel}>Parecer Técnico do Síndico:</Text>
              <Text style={styles.parecerText}>
                {vistoriaAtiva?.parecerTecnico ||
                  'Laudo analisado e chancelado. Todas as ordens de serviço preventivas foram emitidas para a conservação patrimonial.'}
              </Text>
            </View>

            <Text style={styles.subHeader}>Sistemas e Áreas Avaliadas:</Text>
            {itensChecklist.map((item) => (
              <View key={item.id} style={styles.laudoItemRow}>
                <View
                  style={[
                    styles.itemDot,
                    {
                      backgroundColor:
                        item.status === 'OK'
                          ? '#3FB950'
                          : item.status === 'AVISO'
                          ? '#E3B341'
                          : '#F85149',
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitulo}>{item.titulo}</Text>
                  <Text style={styles.itemCategoria}>
                    {item.categoria} • Status: {item.status}
                  </Text>
                  {item.observacao && (
                    <Text style={styles.itemObs}>Nota: {item.observacao}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockTitle}>Laudo em Elaboração / Auditoria</Text>
            <Text style={styles.lockDesc}>
              De acordo com a norma NBR 5674 e os requisitos de governança do SindiFlow (RF15),
              o laudo técnico pericial só é disponibilizado para visualização dos moradores após a
              finalização com GPS pelo perito e a formal aprovação técnica do Síndico.
            </Text>
          </View>
        )}
      </View>

      {/* Abertura de Ocorrência pelo Condômino */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>REPORTAR PROBLEMA EM ÁREA COMUM</Text>
        <Text style={styles.cardDesc}>
          Notifique a administração caso note vazamento, lâmpada queimada, ruído anormal ou defeito estrutural:
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: Lâmpada queimada no hall do 4º andar ou goteira no pilotis"
          placeholderTextColor="#8B949E"
          value={novoChamadoTitulo}
          onChangeText={setNovoChamadoTitulo}
        />

        <TextInput
          style={[styles.input, { height: 65 }]}
          placeholder="Descrição detalhada do local e do problema..."
          placeholderTextColor="#8B949E"
          multiline
          value={novoChamadoDesc}
          onChangeText={setNovoChamadoDesc}
        />

        <View style={styles.photoRow}>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handleTirarFoto}
            activeOpacity={0.8}>
            <Text style={styles.photoButtonText}>📷 Tirar Foto da Evidência</Text>
          </TouchableOpacity>
          {fotoEvidencia && (
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>✓ Foto Anexada</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btnEnviarChamado, isEnviando && { opacity: 0.6 }]}
          onPress={handleEnviarChamado}
          disabled={isEnviando}
          activeOpacity={0.8}>
          <Text style={styles.btnEnviarChamadoText}>
            {isEnviando ? 'Gravando no SQLite...' : 'Registrar Chamado para o Síndico'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mural de Comunicados do Síndico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MURAL DE AVISOS DO CONDOMÍNIO</Text>
        {comunicados.map((c) => (
          <View key={c.id} style={styles.comunicadoCard}>
            <View style={styles.comunicadoTop}>
              <Text style={styles.comunicadoTitle}>{c.titulo}</Text>
              {c.fixado && (
                <View style={styles.fixadoPill}>
                  <Text style={styles.fixadoPillText}>IMPORTANTE</Text>
                </View>
              )}
            </View>
            <Text style={styles.comunicadoBody}>{c.conteudo}</Text>
            <Text style={styles.comunicadoSign}>
              {c.autorNome} • {c.dataCriacao.toLocaleDateString()}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  content: {
    padding: 16,
  },
  switchAlertCard: {
    backgroundColor: 'rgba(63, 185, 80, 0.12)',
    borderWidth: 1,
    borderColor: '#3FB950',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  switchAlertTitle: {
    color: '#3FB950',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  switchAlertText: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  switchAlertBtn: {
    backgroundColor: '#3FB950',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  switchAlertBtnText: {
    color: '#0D1117',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0F6FC',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  statusPredialCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusPredialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unitText: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '700',
  },
  condoText: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 2,
  },
  sealBadge: {
    backgroundColor: 'rgba(88, 166, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#58A6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sealText: {
    color: '#58A6FF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D1117',
    padding: 10,
    borderRadius: 8,
  },
  indicatorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorText: {
    color: '#C9D1D9',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F0F6FC',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 12,
    color: '#8B949E',
    lineHeight: 16,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(63, 185, 80, 0.2)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(227, 179, 65, 0.2)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  laudoContent: {
    marginTop: 4,
  },
  laudoHeaderBox: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  laudoTitle: {
    color: '#3FB950',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  laudoMeta: {
    color: '#8B949E',
    fontSize: 11,
    marginBottom: 2,
  },
  laudoGeo: {
    color: '#58A6FF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  parecerBox: {
    backgroundColor: 'rgba(88, 166, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#58A6FF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  parecerLabel: {
    color: '#58A6FF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  parecerText: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 16,
  },
  subHeader: {
    color: '#F0F6FC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  laudoItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  itemTitulo: {
    color: '#F0F6FC',
    fontSize: 12,
    fontWeight: '600',
  },
  itemCategoria: {
    color: '#8B949E',
    fontSize: 10,
  },
  itemObs: {
    color: '#E3B341',
    fontSize: 11,
    marginTop: 2,
  },
  lockBox: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  lockTitle: {
    color: '#E3B341',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  lockDesc: {
    color: '#8B949E',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  input: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F0F6FC',
    fontSize: 12,
    marginBottom: 10,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  photoButton: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  photoButtonText: {
    color: '#C9D1D9',
    fontSize: 12,
    fontWeight: '600',
  },
  photoBadge: {
    backgroundColor: 'rgba(63, 185, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoBadgeText: {
    color: '#3FB950',
    fontSize: 11,
    fontWeight: '700',
  },
  btnEnviarChamado: {
    backgroundColor: '#238636',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnEnviarChamadoText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  comunicadoCard: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  comunicadoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  comunicadoTitle: {
    color: '#F0F6FC',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  fixadoPill: {
    backgroundColor: 'rgba(227, 179, 65, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixadoPillText: {
    color: '#E3B341',
    fontSize: 9,
    fontWeight: '700',
  },
  comunicadoBody: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  comunicadoSign: {
    color: '#8B949E',
    fontSize: 10,
  },
});

