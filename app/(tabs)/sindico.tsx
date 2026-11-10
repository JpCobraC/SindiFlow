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

export default function SindicoScreen() {
  const {
    usuarioLogado,
    loginRapido,
    vistoriaAtiva,
    ocorrencias,
    comunicados,
    aprovarVistoria,
    devolverVistoria,
    criarComunicado,
    finalizarVistoria,
    marcarItem,
    itensChecklist,
  } = useVistoria();

  const [parecerTecnico, setParecerTecnico] = useState('');
  const [motivoDevolucao, setMotivoDevolucao] = useState('');
  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState('');
  const [novoAvisoConteudo, setNovoAvisoConteudo] = useState('');
  const [isProcessando, setIsProcessando] = useState(false);

  const isSindico = usuarioLogado?.isSindico() ?? false;

  const ocorrenciasCriticas = ocorrencias.filter(
    (o) => o.gravidade === GravidadeOcorrencia.ALTA
  );
  const ocorrenciasMedias = ocorrencias.filter(
    (o) => o.gravidade === GravidadeOcorrencia.MEDIA
  );

  const handleAprovar = async () => {
    try {
      setIsProcessando(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await aprovarVistoria(parecerTecnico.trim() || undefined);
      setParecerTecnico('');
      Alert.alert(
        'Laudo Aprovado!',
        'A vistoria pericial foi formalmente homologada e o laudo agora está público para todos os condôminos (RF15/RF16).'
      );
    } catch (e: any) {
      Alert.alert('Erro ao aprovar', e?.message || 'Falha na aprovação');
    } finally {
      setIsProcessando(false);
    }
  };

  const handleDevolver = async () => {
    if (!motivoDevolucao.trim()) {
      Alert.alert('Apontamento Obrigatório', 'Informe o motivo da devolução para o inspetor.');
      return;
    }
    try {
      setIsProcessando(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      await devolverVistoria(motivoDevolucao.trim());
      setMotivoDevolucao('');
      Alert.alert('Vistoria Devolvida', 'A vistoria foi devolvida para revisão técnica do perito.');
    } catch (e: any) {
      Alert.alert('Erro ao devolver', e?.message || 'Falha na devolução');
    } finally {
      setIsProcessando(false);
    }
  };

  const handlePublicarComunicado = async () => {
    if (!novoAvisoTitulo.trim() || !novoAvisoConteudo.trim()) {
      Alert.alert('Campos Obrigatórios', 'Preencha o título e o conteúdo do comunicado.');
      return;
    }
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await criarComunicado(novoAvisoTitulo.trim(), novoAvisoConteudo.trim());
      setNovoAvisoTitulo('');
      setNovoAvisoConteudo('');
      Alert.alert('Comunicado Emitido', 'O comunicado foi publicado no mural de todos os condôminos.');
    } catch (e: any) {
      Alert.alert('Erro ao publicar', e?.message || 'Falha na publicação');
    }
  };

  // Ajuda para demonstração rápida caso o vistoria esteja em rascunho
  const handleSimularFinalizacaoParaAprovar = async () => {
    try {
      setIsProcessando(true);
      for (const item of itensChecklist) {
        if (item.status === 'PENDENTE') {
          await marcarItem(item.id, 'OK' as any);
        }
      }
      await finalizarVistoria(-23.55052, -46.633308);
      Alert.alert('Vistoria Finalizada', 'Vistoria 100% preenchida com GPS pericial. Agora você pode homologá-la como Síndico!');
    } catch (e: any) {
      Alert.alert('Aviso', e?.message || 'Não foi possível finalizar automaticamente');
    } finally {
      setIsProcessando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Alerta de Perfil quando não for síndico */}
      {!isSindico && (
        <View style={styles.switchAlertCard}>
          <Text style={styles.switchAlertTitle}>Visualizando em modo de demonstração</Text>
          <Text style={styles.switchAlertText}>
            Você está conectado como {usuarioLogado?.nome} ({usuarioLogado?.role}). Para exercer as atribuições exclusivas do Síndico:
          </Text>
          <TouchableOpacity
            style={styles.switchAlertBtn}
            onPress={() => loginRapido('SINDICO')}>
            <Text style={styles.switchAlertBtnText}>Alternar para Dr. Carlos (Síndico) ➔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cabeçalho do Painel */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PAINEL DO SÍNDICO GERAL</Text>
        <Text style={styles.sectionSubtitle}>
          Governança Predial, Aprovação Técnica e Gestão de Riscos (NBR 5674)
        </Text>
      </View>

      {/* Métricas e KPIs Executivos */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderColor: '#E3B341' }]}>
          <Text style={styles.kpiValue}>
            {vistoriaAtiva?.status === StatusVistoria.APROVADA
              ? '100%'
              : vistoriaAtiva?.status === StatusVistoria.FINALIZADA
              ? 'Aguardando'
              : 'Em Andamento'}
          </Text>
          <Text style={styles.kpiLabel}>Laudo Pericial</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#F85149' }]}>
          <Text style={[styles.kpiValue, { color: '#F85149' }]}>
            {ocorrenciasCriticas.length}
          </Text>
          <Text style={styles.kpiLabel}>SLA Crítico (24h)</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#58A6FF' }]}>
          <Text style={styles.kpiValue}>{ocorrenciasMedias.length}</Text>
          <Text style={styles.kpiLabel}>SLA Médio (72h)</Text>
        </View>
      </View>

      {/* Fila de Aprovação de Laudos Técnicos (RF16) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>HOMOLOGAÇÃO DE LAUDO PERICIAL (RF16)</Text>
          <View
            style={[
              styles.statusBadge,
              vistoriaAtiva?.status === StatusVistoria.APROVADA
                ? styles.badgeAprovado
                : vistoriaAtiva?.status === StatusVistoria.FINALIZADA
                ? styles.badgeFinalizado
                : styles.badgePendente,
            ]}>
            <Text style={styles.statusBadgeText}>{vistoriaAtiva?.status}</Text>
          </View>
        </View>

        <Text style={styles.cardDesc}>
          Condomínio: Edifício Solar das Palmeiras • Inspetor Responsável: Eng. Carlos Eduardo (CREA 50692)
        </Text>

        {vistoriaAtiva?.geolocalizacao && (
          <View style={styles.geoBox}>
            <Text style={styles.geoText}>
              📍 Assinatura Pericial GPS: [
              {vistoriaAtiva.geolocalizacao.latitude.toFixed(6)},{' '}
              {vistoriaAtiva.geolocalizacao.longitude.toFixed(6)}] • Precisão:{' '}
              {vistoriaAtiva.geolocalizacao.precisao ?? '4.5'}m
            </Text>
          </View>
        )}

        {vistoriaAtiva?.status === StatusVistoria.APROVADA && (
          <View style={styles.aprovadoBox}>
            <Text style={styles.aprovadoBoxTitle}>✓ Laudo Técnico Homologado pelo Síndico</Text>
            <Text style={styles.aprovadoBoxText}>
              Parecer Técnico: {vistoriaAtiva.parecerTecnico || 'Em conformidade total com NBR 5674.'}
            </Text>
            <Text style={styles.aprovadoBoxDate}>
              Data da Aprovação: {vistoriaAtiva.dataAprovacao?.toLocaleString() || new Date().toLocaleString()}
            </Text>
          </View>
        )}

        {vistoriaAtiva?.status === StatusVistoria.DEVOLVIDA && (
          <View style={styles.devolvidoBox}>
            <Text style={styles.devolvidoBoxTitle}>⚠️ Laudo Devolvido para Revisão do Inspetor</Text>
            <Text style={styles.devolvidoBoxText}>Motivo: {vistoriaAtiva.motivoDevolucao}</Text>
          </View>
        )}

        {vistoriaAtiva?.status === StatusVistoria.FINALIZADA && (
          <View style={styles.actionForm}>
            <Text style={styles.inputLabel}>Parecer Técnico do Síndico (Opcional):</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Laudo analisado e aprovado. Providenciar ordens de serviço para itens de SLA 24h."
              placeholderTextColor="#8B949E"
              multiline
              value={parecerTecnico}
              onChangeText={setParecerTecnico}
            />

            <TouchableOpacity
              style={[styles.btnAprovar, isProcessando && { opacity: 0.6 }]}
              onPress={handleAprovar}
              disabled={isProcessando}>
              <Text style={styles.btnAprovarText}>✓ Aprovar Laudo e Liberar aos Moradores</Text>
            </TouchableOpacity>

            <View style={{ height: 16 }} />

            <Text style={styles.inputLabel}>Ou Devolver com Apontamento:</Text>
            <TextInput
              style={styles.input}
              placeholder="Informe o que precisa ser corrigido antes da homologação..."
              placeholderTextColor="#8B949E"
              value={motivoDevolucao}
              onChangeText={setMotivoDevolucao}
            />

            <TouchableOpacity
              style={[styles.btnDevolver, isProcessando && { opacity: 0.6 }]}
              onPress={handleDevolver}
              disabled={isProcessando}>
              <Text style={styles.btnDevolverText}>Devolver ao Inspetor para Correção</Text>
            </TouchableOpacity>
          </View>
        )}

        {vistoriaAtiva?.status === StatusVistoria.RASCUNHO && (
          <View style={styles.draftHelpBox}>
            <Text style={styles.draftHelpText}>
              A vistoria ainda está com o Inspetor em modo Rascunho ({Math.round(vistoriaAtiva.percentualRespondido())}% respondido).
            </Text>
            <TouchableOpacity
              style={styles.btnAutoFinalizar}
              onPress={handleSimularFinalizacaoParaAprovar}
              disabled={isProcessando}>
              <Text style={styles.btnAutoFinalizarText}>⚡ Concluir Vistoria com GPS para Testar Aprovação</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Monitor de SLAs Críticos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MONITOR DE MATRIZ DE SLA (§3.2)</Text>
        <Text style={styles.cardDesc}>
          Acompanhamento de apontamentos críticos com risco estrutural ou de segurança:
        </Text>

        {ocorrencias.map((oc) => {
          const isAlta = oc.gravidade === GravidadeOcorrencia.ALTA;
          return (
            <View
              key={oc.id}
              style={[
                styles.slaItem,
                { borderLeftColor: isAlta ? '#F85149' : '#E3B341', borderLeftWidth: 3 },
              ]}>
              <View style={styles.slaItemHeader}>
                <Text style={styles.slaItemTitle}>{oc.titulo}</Text>
                <View
                  style={[
                    styles.slaBadge,
                    { backgroundColor: isAlta ? 'rgba(248, 81, 73, 0.15)' : 'rgba(227, 179, 65, 0.15)' },
                  ]}>
                  <Text
                    style={[
                      styles.slaBadgeText,
                      { color: isAlta ? '#F85149' : '#E3B341' },
                    ]}>
                    SLA {oc.slaHoras}h
                  </Text>
                </View>
              </View>
              {oc.descricao && <Text style={styles.slaItemDesc}>{oc.descricao}</Text>}
              <Text style={styles.slaItemMeta}>
                Gravidade: {oc.gravidade} • ID: {oc.id} • Evidências: {oc.fotos.length} foto(s)
              </Text>
            </View>
          );
        })}
      </View>

      {/* Emissão de Comunicados Prediais */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>EMITIR COMUNICADO PREDIAL OFICIAL</Text>
        <Text style={styles.cardDesc}>
          Notificação direta no portal de todos os condôminos e moradores:
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Título do Comunicado (Ex: Manutenção Preventiva)"
          placeholderTextColor="#8B949E"
          value={novoAvisoTitulo}
          onChangeText={setNovoAvisoTitulo}
        />

        <TextInput
          style={[styles.input, { height: 75 }]}
          placeholder="Mensagem oficial aos moradores..."
          placeholderTextColor="#8B949E"
          multiline
          value={novoAvisoConteudo}
          onChangeText={setNovoAvisoConteudo}
        />

        <TouchableOpacity
          style={styles.btnPublicar}
          onPress={handlePublicarComunicado}>
          <Text style={styles.btnPublicarText}>Publicar no Mural dos Moradores</Text>
        </TouchableOpacity>
      </View>

      {/* Mural de Comunicados Atuais */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MURAL DE COMUNICADOS PUBLICADOS</Text>
        {comunicados.map((c) => (
          <View key={c.id} style={styles.comunicadoItem}>
            <View style={styles.comunicadoHeader}>
              <Text style={styles.comunicadoTitulo}>{c.titulo}</Text>
              {c.fixado && (
                <View style={styles.fixadoBadge}>
                  <Text style={styles.fixadoText}>FIXADO</Text>
                </View>
              )}
            </View>
            <Text style={styles.comunicadoConteudo}>{c.conteudo}</Text>
            <Text style={styles.comunicadoMeta}>
              Publicado por {c.autorNome} • {c.dataCriacao.toLocaleDateString()}
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
    backgroundColor: 'rgba(227, 179, 65, 0.12)',
    borderWidth: 1,
    borderColor: '#E3B341',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  switchAlertTitle: {
    color: '#E3B341',
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
    backgroundColor: '#E3B341',
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
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F0F6FC',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#8B949E',
    marginTop: 4,
    textAlign: 'center',
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
    marginBottom: 6,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeAprovado: {
    backgroundColor: 'rgba(63, 185, 80, 0.2)',
  },
  badgeFinalizado: {
    backgroundColor: 'rgba(88, 166, 255, 0.2)',
  },
  badgePendente: {
    backgroundColor: 'rgba(227, 179, 65, 0.2)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  geoBox: {
    backgroundColor: '#21262D',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  geoText: {
    fontSize: 11,
    color: '#58A6FF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  aprovadoBox: {
    backgroundColor: 'rgba(63, 185, 80, 0.12)',
    borderWidth: 1,
    borderColor: '#238636',
    borderRadius: 8,
    padding: 12,
  },
  aprovadoBoxTitle: {
    color: '#3FB950',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  aprovadoBoxText: {
    color: '#C9D1D9',
    fontSize: 12,
    marginBottom: 4,
  },
  aprovadoBoxDate: {
    color: '#8B949E',
    fontSize: 11,
  },
  devolvidoBox: {
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderWidth: 1,
    borderColor: '#DA3633',
    borderRadius: 8,
    padding: 12,
  },
  devolvidoBoxTitle: {
    color: '#F85149',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  devolvidoBoxText: {
    color: '#C9D1D9',
    fontSize: 12,
  },
  actionForm: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    color: '#C9D1D9',
    fontWeight: '600',
    marginBottom: 4,
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
  btnAprovar: {
    backgroundColor: '#238636',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAprovarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDevolver: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#F85149',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDevolverText: {
    color: '#F85149',
    fontWeight: '600',
    fontSize: 12,
  },
  draftHelpBox: {
    backgroundColor: '#21262D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftHelpText: {
    color: '#8B949E',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  btnAutoFinalizar: {
    backgroundColor: '#1F6FEB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnAutoFinalizarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  slaItem: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  slaItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  slaItemTitle: {
    color: '#F0F6FC',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  slaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  slaItemDesc: {
    color: '#8B949E',
    fontSize: 11,
    marginBottom: 4,
  },
  slaItemMeta: {
    color: '#6E7681',
    fontSize: 10,
  },
  btnPublicar: {
    backgroundColor: '#238636',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPublicarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  comunicadoItem: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  comunicadoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  comunicadoTitulo: {
    color: '#F0F6FC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  fixadoBadge: {
    backgroundColor: 'rgba(227, 179, 65, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixadoText: {
    color: '#E3B341',
    fontSize: 9,
    fontWeight: '700',
  },
  comunicadoConteudo: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  comunicadoMeta: {
    color: '#8B949E',
    fontSize: 10,
  },
});

