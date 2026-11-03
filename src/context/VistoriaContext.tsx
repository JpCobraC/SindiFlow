import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CameraGatewayExpo } from '../adapters/gateways/camera.gateway.expo';
import { CameraGatewayFake } from '../adapters/gateways/camera.gateway.fake';
import { LocationGatewayExpo } from '../adapters/gateways/location.gateway.expo';
import { LocationGatewayFake } from '../adapters/gateways/location.gateway.fake';
import { NetworkServiceFake } from '../adapters/gateways/network.service.fake';
import { RemoteSyncGatewayFake } from '../adapters/gateways/remote-sync.gateway.fake';
import { OcorrenciaRepositoryInMemory } from '../adapters/repositories/ocorrencia.repository.inmemory';
import { OutboxRepositoryInMemory } from '../adapters/repositories/outbox.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../adapters/repositories/vistoria.repository.inmemory';
import { AnexarFotoUseCase } from '../application/use-cases/anexar-foto.usecase';
import { CapturarLocalizacaoUseCase } from '../application/use-cases/capturar-localizacao.usecase';
import {
  ClassificarItemChecklistUseCase,
} from '../application/use-cases/classificar-item.usecase';
import { CriarVistoriaUseCase } from '../application/use-cases/criar-vistoria.usecase';
import { FinalizarVistoriaUseCase } from '../application/use-cases/finalizar-vistoria.usecase';
import { RegistrarOcorrenciaUseCase } from '../application/use-cases/registrar-ocorrencia.usecase';
import {
  SincronizacaoResultado,
  SincronizarOutboxUseCase,
} from '../application/use-cases/sincronizar-outbox.usecase';
import { ItemChecklist, StatusItemChecklist } from '../domain/entities/item-checklist.entity';
import { GravidadeOcorrencia, Ocorrencia } from '../domain/entities/ocorrencia.entity';
import { StatusVistoria, Vistoria } from '../domain/entities/vistoria.entity';
import { OutboxEvent } from '../domain/entities/outbox-event.entity';
import {
  CapturaFotoOptions,
  ICameraGateway,
  ResultadoCaptura,
} from '../domain/interfaces/camera.gateway.interface';
import {
  ILocationGateway,
  LocalizacaoDispositivo,
} from '../domain/interfaces/location.gateway.interface';
import { Evidencia } from '../domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../domain/value-objects/geolocalizacao.vo';

export class ProxyCameraGateway implements ICameraGateway {
  constructor(
    public readonly fake: CameraGatewayFake,
    public readonly expo: CameraGatewayExpo
  ) {}

  public isNativo = true;

  async temPermissao(): Promise<boolean> {
    if (this.isNativo) {
      try {
        return await this.expo.temPermissao();
      } catch {
        return await this.fake.temPermissao();
      }
    }
    return this.fake.temPermissao();
  }

  async solicitarPermissao(): Promise<boolean> {
    if (this.isNativo) {
      try {
        return await this.expo.solicitarPermissao();
      } catch {
        return await this.fake.solicitarPermissao();
      }
    }
    return this.fake.solicitarPermissao();
  }

  async capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura> {
    if (this.isNativo) {
      try {
        return await this.expo.capturarFoto(options);
      } catch {
        return this.fake.capturarFoto(options);
      }
    }
    return this.fake.capturarFoto(options);
  }
}

export class ProxyLocationGateway implements ILocationGateway {
  constructor(
    public readonly fake: LocationGatewayFake,
    public readonly expo: LocationGatewayExpo
  ) {}

  public isNativo = true;

  async temPermissao(): Promise<boolean> {
    if (this.isNativo) {
      try {
        return await this.expo.temPermissao();
      } catch {
        return await this.fake.temPermissao();
      }
    }
    return this.fake.temPermissao();
  }

  async solicitarPermissao(): Promise<boolean> {
    if (this.isNativo) {
      try {
        return await this.expo.solicitarPermissao();
      } catch {
        return await this.fake.solicitarPermissao();
      }
    }
    return this.fake.solicitarPermissao();
  }

  async obterPosicaoAtual(): Promise<LocalizacaoDispositivo> {
    if (this.isNativo) {
      try {
        return await this.expo.obterPosicaoAtual();
      } catch {
        return this.fake.obterPosicaoAtual();
      }
    }
    return this.fake.obterPosicaoAtual();
  }
}

export interface AuditLogItem {
  id: string;
  horario: string;
  tipo: 'INFO' | 'SUCESSO' | 'FALHA' | 'BLOQUEIO';
  mensagem: string;
}

export interface VistoriaContextData {
  // Entidades e Estado In-Memory
  vistoriaAtiva: Vistoria | null;
  itensChecklist: ItemChecklist[];
  ocorrencias: Ocorrencia[];
  outboxPendentes: OutboxEvent[];
  auditLogs: AuditLogItem[];
  
  // Conectividade e Simulação
  isOnline: boolean;
  isSimulandoErro503: boolean;
  isCarregando: boolean;

  // Modo de Hardware
  isHardwareNativo: boolean;
  toggleHardwareNativo: () => void;

  // Gateways e Ações de Hardware
  locationGateway: ILocationGateway;
  cameraGateway: ICameraGateway;
  capturarLocalizacao: () => Promise<Geolocalizacao>;
  anexarFoto: (params: { itemId?: string; ocorrenciaId?: string }) => Promise<Evidencia | null>;

  // Casos de Uso & Ações
  marcarItem: (itemId: string, status: StatusItemChecklist, observacao?: string) => Promise<void>;
  finalizarVistoria: (latitude?: number, longitude?: number) => Promise<void>;
  registrarOcorrencia: (dados: {
    titulo: string;
    descricao?: string;
    gravidade: GravidadeOcorrencia;
    fotos?: string[];
    itemId?: string;
  }) => Promise<Ocorrencia>;
  toggleRede: () => void;
  toggleErro503: () => void;
  sincronizarOutbox: () => Promise<SincronizacaoResultado>;
  reiniciarMock: () => Promise<void>;
}

const VistoriaContext = createContext<VistoriaContextData>({} as VistoriaContextData);

// Instâncias dos repositórios
const vistoriaRepo = new VistoriaRepositoryInMemory();
const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
const outboxRepo = new OutboxRepositoryInMemory();
const networkService = new NetworkServiceFake(false); // Inicia OFFLINE (Subsolo G2)
const syncGateway = new RemoteSyncGatewayFake();

const cameraGatewayFake = new CameraGatewayFake();
const cameraGatewayExpo = new CameraGatewayExpo();
const cameraGateway = new ProxyCameraGateway(cameraGatewayFake, cameraGatewayExpo);

const locationGatewayFake = new LocationGatewayFake();
const locationGatewayExpo = new LocationGatewayExpo();
const locationGateway = new ProxyLocationGateway(locationGatewayFake, locationGatewayExpo);

// Instâncias dos Casos de Uso
const criarVistoriaUseCase = new CriarVistoriaUseCase(vistoriaRepo, outboxRepo);
const classificarItemUseCase = new ClassificarItemChecklistUseCase(vistoriaRepo, outboxRepo);
const finalizarVistoriaUseCase = new FinalizarVistoriaUseCase(vistoriaRepo, outboxRepo);
const registrarOcorrenciaUseCase = new RegistrarOcorrenciaUseCase(ocorrenciaRepo, outboxRepo);
const sincronizarOutboxUseCase = new SincronizarOutboxUseCase(networkService, outboxRepo, syncGateway);
const capturarLocalizacaoUseCase = new CapturarLocalizacaoUseCase(locationGateway, vistoriaRepo);
const anexarFotoUseCase = new AnexarFotoUseCase(cameraGateway, vistoriaRepo, ocorrenciaRepo, outboxRepo);

export const VistoriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vistoriaAtiva, setVistoriaAtiva] = useState<Vistoria | null>(null);
  const [itensChecklist, setItensChecklist] = useState<ItemChecklist[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [outboxPendentes, setOutboxPendentes] = useState<OutboxEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isSimulandoErro503, setIsSimulandoErro503] = useState<boolean>(false);
  const [isCarregando, setIsCarregando] = useState<boolean>(true);
  const [isHardwareNativo, setIsHardwareNativo] = useState<boolean>(true);

  const toggleHardwareNativo = () => {
    const novo = !isHardwareNativo;
    setIsHardwareNativo(novo);
    cameraGateway.isNativo = novo;
    locationGateway.isNativo = novo;
    addLog(
      'INFO',
      novo
        ? 'Câmera e Geolocalização alternadas para MÓDULOS NATIVOS EXPO (expo-image-picker / expo-location).'
        : 'Câmera e Geolocalização alternadas para MOCK DETERMINÍSTICO.'
    );
  };

  const addLog = useCallback((tipo: AuditLogItem['tipo'], mensagem: string) => {
    const novo: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      horario: new Date().toLocaleTimeString(),
      tipo,
      mensagem,
    };
    setAuditLogs((prev) => [novo, ...prev]);
  }, []);

  const atualizarEstadoOutbox = useCallback(async () => {
    const pendentes = await outboxRepo.obterPendentes();
    setOutboxPendentes([...pendentes]);
  }, []);

  const atualizarEstadoOcorrencias = useCallback(async (vistoriaId: string) => {
    const lista = await ocorrenciaRepo.listarPorVistoria(vistoriaId);
    setOcorrencias([...lista]);
  }, []);

  const popularMockInicial = useCallback(async () => {
    try {
      vistoriaRepo.limpar();
      ocorrenciaRepo.limpar();
      outboxRepo.limpar();

      const vistoria = await criarVistoriaUseCase.executar({
        id: 'vist-solar-01',
        condominioId: 'cond-solar-palmeiras',
        inspetorId: 'inspetor-carlos-crea123',
        itens: [
          {
            id: 'item-1',
            titulo: 'Extintores de Incêndio - Carga e Lacre',
            categoria: 'Segurança Contra Incêndio',
          },
          {
            id: 'item-2',
            titulo: 'Quadro Geral de Baixa Tensão (QGBT)',
            categoria: 'Instalações Elétricas',
          },
          {
            id: 'item-3',
            titulo: 'Bombas de Recalque e Retentores',
            categoria: 'Instalações Hidráulicas',
          },
          {
            id: 'item-4',
            titulo: 'Barrilete e Impermeabilização Superior',
            categoria: 'Impermeabilização & Cobertura',
          },
          {
            id: 'item-5',
            titulo: 'Gerador a Diesel - Nível de Óleo e Bateria',
            categoria: 'Emergência & Automação',
          },
          {
            id: 'item-6',
            titulo: 'Iluminação de Emergência das Escadarias',
            categoria: 'Segurança Contra Incêndio',
          },
        ],
      });

      await classificarItemUseCase.executar({
        vistoriaId: vistoria.id,
        itemId: 'item-1',
        status: StatusItemChecklist.OK,
        usuarioId: 'inspetor-carlos',
        deviceId: 'expo-device-01',
      });

      await classificarItemUseCase.executar({
        vistoriaId: vistoria.id,
        itemId: 'item-2',
        status: StatusItemChecklist.OK,
        usuarioId: 'inspetor-carlos',
        deviceId: 'expo-device-01',
      });

      await classificarItemUseCase.executar({
        vistoriaId: vistoria.id,
        itemId: 'item-3',
        status: StatusItemChecklist.AVISO,
        observacao: 'Leve gotejamento no retentor da bomba secundária',
        usuarioId: 'inspetor-carlos',
        deviceId: 'expo-device-01',
      });

      await registrarOcorrenciaUseCase.executar({
        id: 'oc-101',
        vistoriaId: vistoria.id,
        itemId: 'item-3',
        titulo: 'Infiltração ativa no pilar central da Garagem G2',
        descricao: 'Gotejamento contínuo com eflorescência e risco à armadura de aço.',
        gravidade: GravidadeOcorrencia.ALTA,
        fotos: ['file:///cache/infiltracao_g2_vaga45.jpg'],
        usuarioId: 'inspetor-carlos',
        deviceId: 'expo-device-01',
      });

      await registrarOcorrenciaUseCase.executar({
        id: 'oc-102',
        vistoriaId: vistoria.id,
        itemId: 'item-3',
        titulo: 'Gotejamento na válvula de retenção da bomba 2',
        descricao: 'Desgaste mecânico necessita reaperto de junta e troca de gaxeta.',
        gravidade: GravidadeOcorrencia.MEDIA,
        fotos: ['file:///cache/valvula_bomba_2.jpg'],
        usuarioId: 'inspetor-carlos',
        deviceId: 'expo-device-01',
      });

      const vistoriaAtualizada = await vistoriaRepo.buscarPorId(vistoria.id);
      if (vistoriaAtualizada) {
        setVistoriaAtiva(vistoriaAtualizada);
        setItensChecklist([...vistoriaAtualizada.itens]);
      }

      await atualizarEstadoOcorrencias(vistoria.id);
      await atualizarEstadoOutbox();

      networkService.setOnline(false);
      setIsOnline(false);
      syncGateway.setSimularErro503(false);
      setIsSimulandoErro503(false);

      addLog('INFO', 'SQLite Offline Inicializado — Fonte da verdade (§1.2).');
      addLog('INFO', 'Vistoria Edifício Solar carregada em RASCUNHO com 50% respondido.');
      addLog('INFO', 'Dispositivo em modo OFFLINE simulando garagem G2 sem sinal.');
    } catch (e: any) {
      addLog('BLOQUEIO', `Erro na inicialização: ${e?.message || e}`);
    } finally {
      setIsCarregando(false);
    }
  }, [addLog, atualizarEstadoOcorrencias, atualizarEstadoOutbox]);

  useEffect(() => {
    popularMockInicial();
  }, [popularMockInicial]);

  const marcarItem = async (
    itemId: string,
    status: StatusItemChecklist,
    observacao?: string
  ): Promise<void> => {
    if (!vistoriaAtiva) return;

    try {
      const vistoriaAtualizada = await classificarItemUseCase.executar({
        vistoriaId: vistoriaAtiva.id,
        itemId,
        status,
        observacao,
        usuarioId: vistoriaAtiva.inspetorId,
        deviceId: 'expo-device-01',
      });

      setVistoriaAtiva(vistoriaAtualizada);
      setItensChecklist([...vistoriaAtualizada.itens]);
      await atualizarEstadoOutbox();

      addLog(
        'INFO',
        `Item ${itemId} marcado como ${status} no SQLite. Progresso: ${Math.round(vistoriaAtualizada.percentualRespondido())}%.`
      );
    } catch (err: any) {
      addLog('BLOQUEIO', `Falha ao marcar item: ${err?.message || err}`);
      throw err;
    }
  };

  const capturarLocalizacao = async (): Promise<Geolocalizacao> => {
    try {
      const geo = await capturarLocalizacaoUseCase.executar({
        vistoriaId: vistoriaAtiva?.id,
      });
      addLog(
        'INFO',
        `Geolocalização obtida (${isHardwareNativo ? 'Expo Nativo' : 'Mock'}): [${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}] (Precisão: ${geo.precisao ?? '4.5'}m)`
      );
      return geo;
    } catch (err: any) {
      addLog('BLOQUEIO', `Falha ao obter localização (RNF02): ${err?.message || err}`);
      throw err;
    }
  };

  const finalizarVistoria = async (
    latitude?: number,
    longitude?: number
  ): Promise<void> => {
    if (!vistoriaAtiva) return;

    try {
      let lat = latitude;
      let lng = longitude;
      let precisao = 4.5;

      if (lat === undefined || lng === undefined) {
        const geo = await capturarLocalizacao();
        lat = geo.latitude;
        lng = geo.longitude;
        precisao = geo.precisao || 4.5;
      }

      const vistoriaFinalizada = await finalizarVistoriaUseCase.executar({
        vistoriaId: vistoriaAtiva.id,
        latitude: lat,
        longitude: lng,
        precisao,
        deviceId: 'expo-device-01',
      });

      setVistoriaAtiva(vistoriaFinalizada);
      setItensChecklist([...vistoriaFinalizada.itens]);
      await atualizarEstadoOutbox();

      addLog(
        'SUCESSO',
        `Vistoria ${vistoriaFinalizada.id} FINALIZADA com GPS [${lat}, ${lng}] salva no SQLite (RF-VIST-004)!`
      );
    } catch (err: any) {
      addLog('BLOQUEIO', `Bloqueio de Domínio: ${err?.message || err}`);
      throw err;
    }
  };

  const anexarFoto = async (params: { itemId?: string; ocorrenciaId?: string }): Promise<Evidencia | null> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria ativa.');

    try {
      const resultado = await anexarFotoUseCase.executar({
        vistoriaId: vistoriaAtiva.id,
        itemId: params.itemId,
        ocorrenciaId: params.ocorrenciaId,
      });

      if (resultado.status === 'cancelado') {
        return null;
      }

      if (resultado.status === 'erro_captura') {
        addLog('BLOQUEIO', `Falha ao anexar foto: ${resultado.mensagem}`);
        throw new Error(resultado.mensagem);
      }

      const evidencia = resultado.evidencia;

      if (params.itemId) {
        const vistoriaAtualizada = await vistoriaRepo.buscarPorId(vistoriaAtiva.id);
        if (vistoriaAtualizada) {
          setVistoriaAtiva(vistoriaAtualizada);
          setItensChecklist([...vistoriaAtualizada.itens]);
        }
      }

      if (params.ocorrenciaId) {
        await atualizarEstadoOcorrencias(vistoriaAtiva.id);
      }

      addLog('SUCESSO', `Foto salva no SQLite + FileSystem: ${evidencia.caminhoArquivoLocal}`);
      return evidencia;
    } catch (err: any) {
      addLog('BLOQUEIO', `Falha ao anexar foto (RNF02): ${err?.message || err}`);
      throw err;
    }
  };

  const registrarOcorrencia = async (dados: {
    titulo: string;
    descricao?: string;
    gravidade: GravidadeOcorrencia;
    fotos?: string[];
    itemId?: string;
  }): Promise<Ocorrencia> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria ativa.');

    try {
      const nova = await registrarOcorrenciaUseCase.executar({
        id: `oc-${Date.now().toString().slice(-4)}`,
        vistoriaId: vistoriaAtiva.id,
        itemId: dados.itemId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        gravidade: dados.gravidade,
        fotos: dados.fotos,
        usuarioId: vistoriaAtiva.inspetorId,
        deviceId: 'expo-device-01',
      });

      await atualizarEstadoOcorrencias(vistoriaAtiva.id);
      await atualizarEstadoOutbox();

      addLog(
        'SUCESSO',
        `Ocorrência "${nova.titulo}" gravada no SQLite com SLA de ${nova.slaHoras}h e na Outbox.`
      );
      return nova;
    } catch (err: any) {
      addLog('BLOQUEIO', `Bloqueio de Ocorrência (§3.2): ${err?.message || err}`);
      throw err;
    }
  };

  const toggleRede = () => {
    const novoStatus = !isOnline;
    networkService.setOnline(novoStatus);
    setIsOnline(novoStatus);
    addLog(
      novoStatus ? 'SUCESSO' : 'INFO',
      novoStatus
        ? 'expo-network: Conexão Wi-Fi detectada (Online).'
        : 'expo-network: Queda de sinal detectada. Dispositivo OFFLINE no subsolo.'
    );
  };

  const toggleErro503 = () => {
    const novoErro = !isSimulandoErro503;
    syncGateway.setSimularErro503(novoErro);
    setIsSimulandoErro503(novoErro);
    addLog(
      novoErro ? 'BLOQUEIO' : 'INFO',
      novoErro
        ? 'Simulação de Nuvem: Supabase retornará HTTP 503 Service Unavailable.'
        : 'Simulação de Nuvem: Supabase operando normalmente (HTTP 200 OK).'
    );
  };

  const sincronizarOutbox = async (): Promise<SincronizacaoResultado> => {
    try {
      addLog('INFO', 'Iniciando rotina SincronizarOutboxUseCase...');
      const resultado = await sincronizarOutboxUseCase.executar();
      await atualizarEstadoOutbox();

      if (resultado.sincronizados > 0) {
        addLog(
          'SUCESSO',
          `Sincronização concluída: ${resultado.sincronizados} itens enviados com 200 OK.`
        );
      }
      if (resultado.falhas > 0) {
        addLog(
          'FALHA',
          `Sincronização com ${resultado.falhas} falhas. Tentativas incrementadas para backoff exponencial.`
        );
      }

      return resultado;
    } catch (err: any) {
      addLog('BLOQUEIO', `Sincronização abortada: ${err?.message || err}`);
      throw err;
    }
  };

  return (
    <VistoriaContext.Provider
      value={{
        vistoriaAtiva,
        itensChecklist,
        ocorrencias,
        outboxPendentes,
        auditLogs,
        isOnline,
        isSimulandoErro503,
        isCarregando,
        isHardwareNativo,
        toggleHardwareNativo,
        locationGateway,
        cameraGateway,
        capturarLocalizacao,
        anexarFoto,
        marcarItem,
        finalizarVistoria,
        registrarOcorrencia,
        toggleRede,
        toggleErro503,
        sincronizarOutbox,
        reiniciarMock: popularMockInicial,
      }}>
      {children}
    </VistoriaContext.Provider>
  );
};

export const useVistoria = () => useContext(VistoriaContext);
