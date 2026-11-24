/**
 * SindiFlow — VistoriaContext
 * Camada: UI (App/Expo Router)
 *
 * O provider não toca SQLite, Supabase nem semeadura de demonstração no escopo
 * do módulo. Essas dependências são montadas em `bootstrap.native.ts` e
 * carregadas dentro de `useEffect`, depois da primeira renderização.
 *
 * Conformidade com §1.2: o estado exibido é uma projeção do SQLite; toda ação
 * de escrita chama um caso de uso que persiste antes de atualizar a tela.
 * Conformidade com §1.3: a sincronização usa a rede real e a outbox.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CameraGatewayExpo,
  ResultadoCapturadorInApp,
} from '../adapters/gateways/camera.gateway.expo';
import {
  CameraCaptureModal,
  FotoInAppCapturada,
} from '../../components/CameraCaptureModal';
import { FileSystemGateway } from '../adapters/gateways/file-system.gateway.real';
import { LocationGatewayExpo } from '../adapters/gateways/location.gateway.expo';
import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
  ResultadoCaptura,
} from '../domain/interfaces/camera.gateway.interface';
import { IFileSystemGateway } from '../domain/interfaces/file-system.gateway.interface';
import {
  ILocationGateway,
} from '../domain/interfaces/location.gateway.interface';
import { ItemChecklist, StatusItemChecklist } from '../domain/entities/item-checklist.entity';
import { GravidadeOcorrencia, Ocorrencia } from '../domain/entities/ocorrencia.entity';
import { Vistoria } from '../domain/entities/vistoria.entity';
import { OutboxEvent, StatusOutbox } from '../domain/entities/outbox-event.entity';
import {
  ItemChecklistNaoEncontradoError,
  OcorrenciaNaoEncontradaError,
  PermissaoNegadaError,
} from '../domain/errors/domain-errors';
import { Evidencia } from '../domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../domain/value-objects/geolocalizacao.vo';
import { Usuario } from '../domain/entities/usuario.entity';
import { Comunicado } from '../domain/entities/comunicado.entity';
import type { SincronizacaoResultado } from '../application/use-cases/sincronizar-outbox.usecase';
import type { AplicacaoComposta } from '../infra/composition-root';

export interface AuditLogItem {
  id: string;
  horario: string;
  tipo: 'INFO' | 'SUCESSO' | 'FALHA' | 'BLOQUEIO';
  mensagem: string;
}

export interface VistoriaContextData {
  // Autenticação
  usuarioLogado: Usuario | null;
  fazerLogin: (email: string, senha: string) => Promise<void>;
  fazerLoginGoogle: () => Promise<void>;
  fazerLogout: () => Promise<void>;

  // Estado persistido
  vistoriaAtiva: Vistoria | null;
  itensChecklist: ItemChecklist[];
  ocorrencias: Ocorrencia[];
  outboxPendentes: OutboxEvent[];
  outboxComFalha: OutboxEvent[];
  auditLogs: AuditLogItem[];
  comunicados: Comunicado[];

  // Conectividade e boot
  isOnline: boolean;
  isCarregando: boolean;
  erroBoot: string | null;

  // Gateways de hardware
  locationGateway: ILocationGateway;
  cameraGateway: ICameraGateway;
  fileSystemGateway: IFileSystemGateway;
  capturarLocalizacao: () => Promise<Geolocalizacao>;
  capturarFotoAvulsa: (origem?: 'camera' | 'galeria') => Promise<FotoCapturada | null>;
  anexarFoto: (params: {
    itemId?: string;
    ocorrenciaId?: string;
    origem?: 'camera' | 'galeria';
  }) => Promise<Evidencia | null>;

  // Casos de uso & ações
  iniciarVistoria: () => Promise<void>;
  marcarItem: (
    itemId: string,
    status: StatusItemChecklist,
    observacao?: string
  ) => Promise<void>;
  finalizarVistoria: (latitude?: number, longitude?: number) => Promise<void>;
  aprovarVistoria: (parecerTecnico?: string) => Promise<void>;
  devolverVistoria: (motivo: string) => Promise<void>;
  registrarOcorrencia: (dados: {
    titulo: string;
    descricao?: string;
    gravidade: GravidadeOcorrencia;
    fotos?: string[];
    itemId?: string;
  }) => Promise<Ocorrencia>;
  criarComunicado: (titulo: string, conteudo: string) => Promise<void>;
  sincronizarOutbox: () => Promise<SincronizacaoResultado>;
  reentarFalhasOutbox: () => Promise<SincronizacaoResultado>;
}

const VistoriaContext = createContext<VistoriaContextData>({} as VistoriaContextData);

// Gateways de hardware não guardam estado de banco nem sessão: podem ser
// instanciados no escopo do módulo sem repetir o incidente de boot.
const cameraGateway = new CameraGatewayExpo();
const locationGateway = new LocationGatewayExpo();
const fileSystemGateway = new FileSystemGateway();

const CHECKLIST_PADRAO = [
  { titulo: 'Extintores de Incêndio — Carga e Lacre', categoria: 'Segurança Contra Incêndio' },
  { titulo: 'Quadro Geral de Baixa Tensão (QGBT)', categoria: 'Instalações Elétricas' },
  { titulo: 'Bombas de Recalque e Retentores', categoria: 'Instalações Hidráulicas' },
  { titulo: 'Barrilete e Impermeabilização Superior', categoria: 'Impermeabilização & Cobertura' },
  { titulo: 'Gerador a Diesel — Nível de Óleo e Bateria', categoria: 'Emergência & Automação' },
  { titulo: 'Iluminação de Emergência das Escadarias', categoria: 'Segurança Contra Incêndio' },
] as const;

export const VistoriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appRef = useRef<AplicacaoComposta | null>(null);

  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(null);
  const [vistoriaAtiva, setVistoriaAtiva] = useState<Vistoria | null>(null);
  const [itensChecklist, setItensChecklist] = useState<ItemChecklist[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [outboxPendentes, setOutboxPendentes] = useState<OutboxEvent[]>([]);
  const [outboxComFalha, setOutboxComFalha] = useState<OutboxEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isCarregando, setIsCarregando] = useState(true);
  const [erroBoot, setErroBoot] = useState<string | null>(null);
  const [cameraModalAberto, setCameraModalAberto] = useState(false);
  const cameraResolverRef = useRef<((res: ResultadoCapturadorInApp) => void) | null>(null);

  useEffect(() => {
    CameraGatewayExpo.definirCapturadorInApp(
      () =>
        new Promise<ResultadoCapturadorInApp>((resolve) => {
          if (cameraResolverRef.current) {
            cameraResolverRef.current({ canceled: true });
          }
          cameraResolverRef.current = resolve;
          setCameraModalAberto(true);
        })
    );

    return () => {
      if (cameraResolverRef.current) {
        cameraResolverRef.current({ canceled: true });
        cameraResolverRef.current = null;
      }
      CameraGatewayExpo.definirCapturadorInApp(null);
    };
  }, []);

  const handleCameraInAppCancel = useCallback(() => {
    setCameraModalAberto(false);
    const resolver = cameraResolverRef.current;
    cameraResolverRef.current = null;
    resolver?.({ canceled: true });
  }, []);

  const handleCameraInAppCapture = useCallback((foto: FotoInAppCapturada) => {
    setCameraModalAberto(false);
    const resolver = cameraResolverRef.current;
    cameraResolverRef.current = null;
    resolver?.({
      canceled: false,
      uri: foto.uri,
      width: foto.width,
      height: foto.height,
    });
  }, []);

  const addLog = useCallback((tipo: AuditLogItem['tipo'], mensagem: string) => {
    const novo: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      horario: new Date().toLocaleTimeString(),
      tipo,
      mensagem,
    };
    setAuditLogs((prev) => [novo, ...prev]);
  }, []);

  const exigirApp = useCallback((): AplicacaoComposta => {
    const app = appRef.current;
    if (!app) {
      throw new Error('Aplicação ainda inicializando. Aguarde o carregamento do banco local.');
    }
    return app;
  }, []);

  const atualizarEstadoOutbox = useCallback(async (app: AplicacaoComposta) => {
    try {
      const todos = await app.repositorios.outbox.listarTodos();
      setOutboxPendentes(
        todos.filter(
          (e) =>
            e.status === StatusOutbox.PENDENTE || e.status === StatusOutbox.PROCESSANDO
        )
      );
      setOutboxComFalha(
        todos.filter((e) => e.status === StatusOutbox.FALHA_MAXIMA)
      );
    } catch {
      // Falha silenciosa ao atualizar badge da fila local
    }
  }, []);

  const atualizarEstadoOcorrencias = useCallback(
    async (app: AplicacaoComposta, vistoriaId: string) => {
      const lista = await app.repositorios.ocorrencia.listarPorVistoria(vistoriaId);
      setOcorrencias([...lista]);
    },
    []
  );

  const carregarDadosDoUsuario = useCallback(
    async (app: AplicacaoComposta, usuario: Usuario) => {
      const vistorias = await app.repositorios.vistoria.listarPorCondominio(
        usuario.condominioId
      );

      const ativa =
        vistorias
          .slice()
          .sort((a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime())[0] ??
        null;

      setVistoriaAtiva(ativa);
      setItensChecklist(ativa ? [...ativa.itens] : []);
      setOcorrencias([]);

      const comunicadosCarregados = await app.casosDeUso.listarComunicados.executar(
        usuario.condominioId
      );
      setComunicados([...comunicadosCarregados]);

      if (ativa) {
        await atualizarEstadoOcorrencias(app, ativa.id);
      }
      await atualizarEstadoOutbox(app);
    },
    [atualizarEstadoOcorrencias, atualizarEstadoOutbox]
  );

  const limparEstado = useCallback(() => {
    setVistoriaAtiva(null);
    setItensChecklist([]);
    setOcorrencias([]);
    setOutboxPendentes([]);
    setOutboxComFalha([]);
    setComunicados([]);
  }, []);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        // Import dinâmico: nenhum módulo nativo é avaliado antes do mount.
        const { criarAplicacaoNativa } = await import('../infra/bootstrap.native');
        const app = await criarAplicacaoNativa();
        if (!ativo) return;

        appRef.current = app;

        const usuario = await app.casosDeUso.autenticarUsuario.restaurarSessao();
        if (!ativo) return;

        if (usuario) {
          setUsuarioLogado(usuario);
          await carregarDadosDoUsuario(app, usuario);
          addLog('SUCESSO', `Sessão restaurada para "${usuario.nome}".`);
        }

        setIsOnline(await app.gateways.network.estaConectado());
        addLog('INFO', 'SQLite aberto e schema aplicado — fonte da verdade local.');
      } catch (erro: unknown) {
        const mensagem =
          erro instanceof Error ? erro.message : 'Falha desconhecida na inicialização.';
        if (ativo) {
          setErroBoot(mensagem);
          addLog('BLOQUEIO', `Falha na inicialização: ${mensagem}`);
        }
      } finally {
        if (ativo) setIsCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [addLog, carregarDadosDoUsuario]);

  // Indicador de conectividade real. Não há toggle de demonstração.
  useEffect(() => {
    const intervalo = setInterval(async () => {
      const app = appRef.current;
      if (!app) return;
      try {
        setIsOnline(await app.gateways.network.estaConectado());
      } catch {
        setIsOnline(false);
      }
    }, 15000);

    return () => clearInterval(intervalo);
  }, []);

  const fazerLogin = async (email: string, senha: string): Promise<void> => {
    const app = exigirApp();
    try {
      const usuario = await app.casosDeUso.autenticarUsuario.executar({
        metodo: 'email',
        email,
        senha,
      });
      setUsuarioLogado(usuario);
      try {
        await carregarDadosDoUsuario(app, usuario);
      } catch {
        // Não derruba o login caso o carregamento inicial do banco local falhe;
        // o usuário já está autenticado e os dados podem ser recarregados depois.
      }
      addLog('SUCESSO', `Usuário "${usuario.nome}" autenticado.`);
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha na autenticação: ${mensagem}`);
      throw err;
    }
  };

  const fazerLoginGoogle = async (): Promise<void> => {
    const app = exigirApp();
    try {
      const usuario = await app.casosDeUso.autenticarUsuario.executar({
        metodo: 'google',
      });
      setUsuarioLogado(usuario);
      await carregarDadosDoUsuario(app, usuario);
      addLog('SUCESSO', `Usuário "${usuario.nome}" autenticado com Google [${usuario.role}].`);
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha no login com Google: ${mensagem}`);
      throw err;
    }
  };

  const fazerLogout = async (): Promise<void> => {
    const app = appRef.current;
    if (app) {
      await app.casosDeUso.autenticarUsuario.encerrarSessao();
    }
    setUsuarioLogado(null);
    limparEstado();
    addLog('INFO', 'Usuário desconectado.');
  };

  const iniciarVistoria = async (): Promise<void> => {
    const app = exigirApp();
    const usuario = usuarioLogado;

    if (!usuario) {
      throw new Error('Autentique-se antes de iniciar uma vistoria.');
    }
    if (!usuario.podePreencherChecklist()) {
      throw new Error('Apenas inspetores podem iniciar uma vistoria.');
    }

    const vistoriaId = `vist-${Date.now()}`;
    const vistoria = await app.casosDeUso.criarVistoria.executar({
      id: vistoriaId,
      condominioId: usuario.condominioId,
      inspetorId: usuario.id,
      itens: CHECKLIST_PADRAO.map((item, indice) => ({
        id: `${vistoriaId}-item-${indice + 1}`,
        titulo: item.titulo,
        categoria: item.categoria,
      })),
      deviceId: app.deviceId,
    });

    setVistoriaAtiva(vistoria);
    setItensChecklist([...vistoria.itens]);
    setOcorrencias([]);
    await atualizarEstadoOutbox(app);
    addLog('SUCESSO', `Vistoria ${vistoria.id} iniciada no SQLite com checklist padrão.`);
  };

  const marcarItem = async (
    itemId: string,
    status: StatusItemChecklist,
    observacao?: string
  ): Promise<void> => {
    if (!vistoriaAtiva) return;
    const app = exigirApp();

    try {
      const vistoriaAtualizada = await app.casosDeUso.classificarItem.executar({
        vistoriaId: vistoriaAtiva.id,
        itemId,
        status,
        observacao,
        usuarioId: vistoriaAtiva.inspetorId,
        deviceId: app.deviceId,
      });

      setVistoriaAtiva(vistoriaAtualizada);
      setItensChecklist([...vistoriaAtualizada.itens]);
      await atualizarEstadoOutbox(app);
      addLog(
        'INFO',
        `Item ${itemId} marcado como ${status}. Progresso: ${Math.round(
          vistoriaAtualizada.percentualRespondido()
        )}%.`
      );
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha ao marcar item: ${mensagem}`);
      throw err;
    }
  };

  const capturarLocalizacao = async (): Promise<Geolocalizacao> => {
    const app = exigirApp();
    try {
      const geo = await app.casosDeUso.capturarLocalizacao.executar({
        vistoriaId: vistoriaAtiva?.id,
      });
      addLog(
        'INFO',
        `Geolocalização obtida: [${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}].`
      );
      return geo;
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha ao obter localização: ${mensagem}`);
      throw err;
    }
  };

  const finalizarVistoria = async (
    latitude?: number,
    longitude?: number
  ): Promise<void> => {
    if (!vistoriaAtiva) return;
    const app = exigirApp();

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

      const vistoriaFinalizada = await app.casosDeUso.finalizarVistoria.executar({
        vistoriaId: vistoriaAtiva.id,
        latitude: lat,
        longitude: lng,
        precisao,
        deviceId: app.deviceId,
      });

      setVistoriaAtiva(vistoriaFinalizada);
      setItensChecklist([...vistoriaFinalizada.itens]);
      await atualizarEstadoOutbox(app);
      addLog('SUCESSO', `Vistoria ${vistoriaFinalizada.id} finalizada com GPS.`);
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Bloqueio de domínio: ${mensagem}`);
      throw err;
    }
  };

  const capturarFotoAvulsa = async (
    origem: 'camera' | 'galeria' = 'camera'
  ): Promise<FotoCapturada | null> => {
    const opcoes: CapturaFotoOptions = {
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    };

    let resultado: ResultadoCaptura;
    if (origem === 'galeria') {
      let permissao = await cameraGateway.temPermissaoGaleria();
      if (!permissao) {
        permissao = await cameraGateway.solicitarPermissaoGaleria();
        if (!permissao) {
          throw new PermissaoNegadaError('Galeria');
        }
      }
      resultado = await cameraGateway.selecionarDaGaleria(opcoes);
    } else {
      let permissao = await cameraGateway.temPermissao();
      if (!permissao) {
        permissao = await cameraGateway.solicitarPermissao();
        if (!permissao) {
          throw new PermissaoNegadaError('Câmera');
        }
      }
      resultado = await cameraGateway.capturarFoto(opcoes);
    }

    if (resultado.status === 'cancelado') {
      return null;
    }
    if (resultado.status === 'erro') {
      throw new Error(resultado.mensagem);
    }
    return resultado.foto;
  };

  const anexarFoto = async (params: {
    itemId?: string;
    ocorrenciaId?: string;
    origem?: 'camera' | 'galeria';
  }): Promise<Evidencia | null> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria ativa.');
    const app = exigirApp();

    try {
      if (params.origem === 'galeria') {
        let vistoriaDestino: Vistoria | null = null;
        let ocorrenciaDestino: Ocorrencia | null = null;

        if (params.itemId) {
          vistoriaDestino = await app.repositorios.vistoria.buscarPorId(vistoriaAtiva.id);
          if (!vistoriaDestino) throw new Error('Nenhuma vistoria ativa.');
          const itemExiste = vistoriaDestino.itens.some((i) => i.id === params.itemId);
          if (!itemExiste) throw new ItemChecklistNaoEncontradoError(params.itemId);
        } else if (params.ocorrenciaId) {
          ocorrenciaDestino = await app.repositorios.ocorrencia.buscarPorId(
            params.ocorrenciaId
          );
          if (!ocorrenciaDestino) {
            throw new OcorrenciaNaoEncontradaError(params.ocorrenciaId);
          }
        } else {
          throw new Error('Selecione um item ou ocorrência para anexar a foto.');
        }

        const foto = await capturarFotoAvulsa('galeria');
        if (!foto) return null;

        const evidencia = Evidencia.criar({
          id: `ev-${foto.timestamp.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
          caminhoArquivoLocal: foto.uri,
          hash: foto.hash,
          timestamp: foto.timestamp,
        });

        if (params.itemId && vistoriaDestino) {
          const item = vistoriaDestino.itens.find((i) => i.id === params.itemId)!;
          item.adicionarEvidencia(evidencia);
          await app.repositorios.vistoria.salvar(vistoriaDestino);
          setVistoriaAtiva(vistoriaDestino);
          setItensChecklist([...vistoriaDestino.itens]);
        } else if (params.ocorrenciaId && ocorrenciaDestino) {
          ocorrenciaDestino.adicionarFoto(evidencia.caminhoArquivoLocal);
          await app.repositorios.ocorrencia.salvar(ocorrenciaDestino);
          await atualizarEstadoOcorrencias(app, vistoriaAtiva.id);
        }

        await app.repositorios.outbox.enfileirar({
          tabela: 'fotos_evidencia',
          operacao: 'INSERT',
          idRegistro: evidencia.id,
          payload: {
            id: evidencia.id,
            item_id: params.itemId ?? null,
            ocorrencia_id: params.ocorrenciaId ?? null,
            caminho_arquivo: evidencia.caminhoArquivoLocal,
            hash: evidencia.hash,
            data_captura: evidencia.timestamp.toISOString(),
          },
          usuarioId: usuarioLogado?.id ?? vistoriaAtiva.inspetorId,
          deviceId: app.deviceId,
        });

        await atualizarEstadoOutbox(app);
        addLog('SUCESSO', 'Foto da galeria anexada com sucesso.');
        return evidencia;
      }

      const resultado = await app.casosDeUso.anexarFoto.executar({
        vistoriaId: vistoriaAtiva.id,
        itemId: params.itemId,
        ocorrenciaId: params.ocorrenciaId,
        usuarioId: usuarioLogado?.id ?? vistoriaAtiva.inspetorId,
        deviceId: app.deviceId,
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
        const vistoriaAtualizada = await app.repositorios.vistoria.buscarPorId(
          vistoriaAtiva.id
        );
        if (vistoriaAtualizada) {
          setVistoriaAtiva(vistoriaAtualizada);
          setItensChecklist([...vistoriaAtualizada.itens]);
        }
      }

      if (params.ocorrenciaId) {
        await atualizarEstadoOcorrencias(app, vistoriaAtiva.id);
      }

      await atualizarEstadoOutbox(app);
      addLog('SUCESSO', 'Foto anexada com sucesso.');
      return evidencia;
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha ao anexar foto: ${mensagem}`);
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
    const app = exigirApp();

    try {
      const nova = await app.casosDeUso.registrarOcorrencia.executar({
        id: `oc-${Date.now()}`,
        vistoriaId: vistoriaAtiva.id,
        itemId: dados.itemId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        gravidade: dados.gravidade,
        fotos: dados.fotos,
        usuarioId: usuarioLogado?.id ?? vistoriaAtiva.inspetorId,
        deviceId: app.deviceId,
      });

      await atualizarEstadoOcorrencias(app, vistoriaAtiva.id);
      await atualizarEstadoOutbox(app);
      addLog(
        'SUCESSO',
        `Ocorrência "${nova.titulo}" gravada com SLA de ${nova.slaHoras}h.`
      );
      return nova;
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Bloqueio de ocorrência: ${mensagem}`);
      throw err;
    }
  };

  const aprovarVistoria = async (parecerTecnico?: string): Promise<void> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria para aprovar.');
    if (!usuarioLogado || !usuarioLogado.podeAprovarVistoria()) {
      throw new Error('Apenas o síndico ou administrador pode aprovar vistorias.');
    }
    const app = exigirApp();

    try {
      const aprovada = await app.casosDeUso.aprovarVistoria.executar({
        vistoriaId: vistoriaAtiva.id,
        aprovadorId: usuarioLogado.id,
        parecerTecnico:
          parecerTecnico ||
          'Laudo pericial aprovado e liberado para os condôminos.',
        deviceId: app.deviceId,
      });

      setVistoriaAtiva(aprovada);
      await atualizarEstadoOutbox(app);
      addLog('SUCESSO', `Vistoria ${aprovada.id} aprovada por "${usuarioLogado.nome}".`);
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha ao aprovar vistoria: ${mensagem}`);
      throw err;
    }
  };

  const devolverVistoria = async (motivo: string): Promise<void> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria ativa.');
    if (!usuarioLogado || !usuarioLogado.podeAprovarVistoria()) {
      throw new Error('Apenas o síndico pode devolver vistorias para revisão.');
    }
    const app = exigirApp();

    try {
      const devolvida = await app.casosDeUso.devolverVistoria.executar({
        vistoriaId: vistoriaAtiva.id,
        solicitanteId: usuarioLogado.id,
        motivo,
        deviceId: app.deviceId,
      });

      setVistoriaAtiva(devolvida);
      setItensChecklist([...devolvida.itens]);
      await atualizarEstadoOutbox(app);
      addLog('INFO', `Vistoria ${devolvida.id} devolvida ao inspetor.`);
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Falha ao devolver vistoria: ${mensagem}`);
      throw err;
    }
  };

  const criarComunicado = async (titulo: string, conteudo: string): Promise<void> => {
    if (!usuarioLogado || !usuarioLogado.isSindico()) {
      throw new Error('Apenas o síndico pode emitir comunicados prediais.');
    }

    const app = exigirApp();

    const novo = await app.casosDeUso.criarComunicado.executar({
      id: `com-${Date.now()}`,
      condominioId: usuarioLogado.condominioId,
      autorId: usuarioLogado.id,
      autorNome: usuarioLogado.nome,
      titulo,
      conteudo,
      fixado: false,
      deviceId: app.deviceId,
    });

    setComunicados((prev) => [novo, ...prev]);
    await atualizarEstadoOutbox(app);
    addLog('SUCESSO', `Comunicado emitido pelo síndico: "${titulo}".`);
  };

  const sincronizarOutbox = async (): Promise<SincronizacaoResultado> => {
    const app = exigirApp();

    try {
      addLog('INFO', 'Iniciando sincronização da outbox...');
      const resultado = await app.casosDeUso.sincronizarOutbox.executar();
      await atualizarEstadoOutbox(app);
      setIsOnline(await app.gateways.network.estaConectado());

      if (resultado.sincronizados > 0) {
        addLog('SUCESSO', `${resultado.sincronizados} evento(s) sincronizado(s).`);
      }
      if (resultado.falhas > 0) {
        addLog('FALHA', `${resultado.falhas} evento(s) falharam e seguem em backoff.`);
      }

      return resultado;
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : String(err);
      addLog('BLOQUEIO', `Sincronização abortada: ${mensagem}`);
      throw err;
    }
  };

  const reentarFalhasOutbox = async (): Promise<SincronizacaoResultado> => {
    const app = exigirApp();
    const todos = await app.repositorios.outbox.listarTodos();
    const falhas = todos.filter((e) => e.status === StatusOutbox.FALHA_MAXIMA);
    for (const item of falhas) {
      await app.repositorios.outbox.resetar(item.id);
    }
    await atualizarEstadoOutbox(app);
    return sincronizarOutbox();
  };

  return (
    <VistoriaContext.Provider
      value={{
        usuarioLogado,
        fazerLogin,
        fazerLoginGoogle,
        fazerLogout,
        vistoriaAtiva,
        itensChecklist,
        ocorrencias,
        outboxPendentes,
        outboxComFalha,
        auditLogs,
        comunicados,
        isOnline,
        isCarregando,
        erroBoot,
        locationGateway,
        cameraGateway,
        fileSystemGateway,
        capturarLocalizacao,
        capturarFotoAvulsa,
        anexarFoto,
        iniciarVistoria,
        marcarItem,
        finalizarVistoria,
        aprovarVistoria,
        devolverVistoria,
        registrarOcorrencia,
        criarComunicado,
        sincronizarOutbox,
        reentarFalhasOutbox,
      }}>
      {children}
      <CameraCaptureModal
        visible={cameraModalAberto}
        onCancel={handleCameraInAppCancel}
        onCapture={handleCameraInAppCapture}
      />
    </VistoriaContext.Provider>
  );
};

export interface ProxyCameraGateway extends ICameraGateway {
  isNativo: boolean;
  capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura>;
}

export const useVistoria = () => useContext(VistoriaContext);
