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
import { CameraGatewayExpo } from '../adapters/gateways/camera.gateway.expo';
import { FileSystemGateway } from '../adapters/gateways/file-system.gateway.real';
import { LocationGatewayExpo } from '../adapters/gateways/location.gateway.expo';
import { CapturaFotoOptions, ICameraGateway, ResultadoCaptura } from '../domain/interfaces/camera.gateway.interface';
import { IFileSystemGateway } from '../domain/interfaces/file-system.gateway.interface';
import {
  ILocationGateway,
} from '../domain/interfaces/location.gateway.interface';
import { ItemChecklist, StatusItemChecklist } from '../domain/entities/item-checklist.entity';
import { GravidadeOcorrencia, Ocorrencia } from '../domain/entities/ocorrencia.entity';
import { Vistoria } from '../domain/entities/vistoria.entity';
import { OutboxEvent } from '../domain/entities/outbox-event.entity';
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
  anexarFoto: (params: {
    itemId?: string;
    ocorrenciaId?: string;
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
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isCarregando, setIsCarregando] = useState(true);
  const [erroBoot, setErroBoot] = useState<string | null>(null);

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
    const pendentes = await app.repositorios.outbox.obterPendentes();
    setOutboxPendentes([...pendentes]);
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
      await carregarDadosDoUsuario(app, usuario);
      addLog('SUCESSO', `Usuário "${usuario.nome}" autenticado [${usuario.role}].`);
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

  const anexarFoto = async (params: {
    itemId?: string;
    ocorrenciaId?: string;
  }): Promise<Evidencia | null> => {
    if (!vistoriaAtiva) throw new Error('Nenhuma vistoria ativa.');
    const app = exigirApp();

    try {
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

      addLog('SUCESSO', `Foto salva no SQLite + FileSystem: ${evidencia.caminhoArquivoLocal}`);
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
        auditLogs,
        comunicados,
        isOnline,
        isCarregando,
        erroBoot,
        locationGateway,
        cameraGateway,
        fileSystemGateway,
        capturarLocalizacao,
        anexarFoto,
        iniciarVistoria,
        marcarItem,
        finalizarVistoria,
        aprovarVistoria,
        devolverVistoria,
        registrarOcorrencia,
        criarComunicado,
        sincronizarOutbox,
      }}>
      {children}
    </VistoriaContext.Provider>
  );
};

export interface ProxyCameraGateway extends ICameraGateway {
  isNativo: boolean;
  capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura>;
}

export const useVistoria = () => useContext(VistoriaContext);
