import { ComunicadoRepositorySQLite } from '../../src/adapters/repositories/comunicado.repository.sqlite';
import { OcorrenciaRepositorySQLite } from '../../src/adapters/repositories/ocorrencia.repository.sqlite';
import { OutboxRepositorySQLite } from '../../src/adapters/repositories/outbox.repository.sqlite';
import { VistoriaRepositorySQLite } from '../../src/adapters/repositories/vistoria.repository.sqlite';
import { SincronizarDadosRemotosUseCase } from '../../src/application/use-cases/sincronizar-dados-remotos.usecase';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { EstadoRede, INetworkService } from '../../src/domain/interfaces/network.service.interface';
import {
  IRemoteSyncGateway,
  SnapshotRemotoCondominio,
} from '../../src/domain/interfaces/remote-sync.gateway.interface';
import { SQLiteExecutorFake } from '../fakes/sqlite-executor-in-memory.fake';

class RedeFake implements INetworkService {
  constructor(public conectado = true) {}
  async estadoConexao(): Promise<EstadoRede> {
    return this.conectado ? EstadoRede.ONLINE : EstadoRede.OFFLINE;
  }
  async estaConectado(): Promise<boolean> {
    return this.conectado;
  }
}

describe('SincronizarDadosRemotosUseCase', () => {
  let executor: SQLiteExecutorFake;
  let rede: RedeFake;
  let outboxRepo: OutboxRepositorySQLite;
  let vistoriaRepo: VistoriaRepositorySQLite;
  let ocorrenciaRepo: OcorrenciaRepositorySQLite;
  let comunicadoRepo: ComunicadoRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    rede = new RedeFake(true);
    outboxRepo = new OutboxRepositorySQLite(executor);
    vistoriaRepo = new VistoriaRepositorySQLite(executor);
    ocorrenciaRepo = new OcorrenciaRepositorySQLite(executor);
    comunicadoRepo = new ComunicadoRepositorySQLite(executor);
  });

  function criarGateway(snapshot: SnapshotRemotoCondominio): IRemoteSyncGateway {
    return {
      sincronizarItem: jest.fn(),
      buscarSnapshotCondominio: jest.fn(async () => snapshot),
    };
  }

  it('mescla vistorias, itens, ocorrências, fotos e comunicados remotos no SQLite local', async () => {
    const gateway = criarGateway({
      vistorias: [
        {
          id: 'vist-rem-1',
          condominio_id: 'cond-1',
          inspetor_id: 'insp-1',
          status: 'APROVADA',
          latitude: -23.5,
          longitude: -46.6,
          precisao: 5,
          data_criacao: '2026-11-24T10:00:00.000Z',
          data_finalizacao: '2026-11-24T11:00:00.000Z',
          parecer_tecnico: 'Laudo homologado',
          aprovado_por: 'sin-1',
          data_aprovacao: '2026-11-24T12:00:00.000Z',
        },
      ],
      itensChecklist: [
        {
          id: 'item-rem-1',
          vistoria_id: 'vist-rem-1',
          titulo: 'Extintor',
          categoria: 'Segurança',
          status: 'OK',
          observacao: null,
        },
      ],
      ocorrencias: [
        {
          id: 'oc-rem-1',
          vistoria_id: 'vist-rem-1',
          item_id: null,
          titulo: 'Infiltração',
          descricao: 'Parede hall',
          gravidade: 'MEDIA',
          status: 'ABERTA',
          data_criacao: '2026-11-24T10:30:00.000Z',
        },
      ],
      fotosEvidencia: [
        {
          id: 'foto-item-1',
          item_id: 'item-rem-1',
          ocorrencia_id: null,
          caminho_arquivo: 'file:///item.jpg',
          hash: 'hash-item',
          data_captura: '2026-11-24T10:10:00.000Z',
        },
        {
          id: 'foto-oc-1',
          item_id: null,
          ocorrencia_id: 'oc-rem-1',
          caminho_arquivo: 'file:///oc.jpg',
          hash: 'hash-oc',
          data_captura: '2026-11-24T10:31:00.000Z',
        },
      ],
      comunicados: [
        {
          id: 'com-rem-1',
          condominio_id: 'cond-1',
          autor_id: 'sin-1',
          autor_nome: 'Dr. Carlos',
          titulo: 'Manutenção',
          conteudo: 'Limpeza da caixa d’água amanhã.',
          data_criacao: '2026-11-24T09:00:00.000Z',
          fixado: true,
        },
      ],
    });

    const useCase = new SincronizarDadosRemotosUseCase(
      rede,
      gateway,
      outboxRepo,
      vistoriaRepo,
      ocorrenciaRepo,
      comunicadoRepo
    );

    const resultado = await useCase.executar('cond-1');

    expect(resultado).toEqual({
      atualizado: true,
      vistorias: 1,
      ocorrencias: 1,
      comunicados: 1,
    });

    const vistoriaLocal = await vistoriaRepo.buscarPorId('vist-rem-1');
    expect(vistoriaLocal?.status).toBe(StatusVistoria.APROVADA);
    expect(vistoriaLocal?.parecerTecnico).toBe('Laudo homologado');
    expect(vistoriaLocal?.itens[0].evidencias).toHaveLength(1);

    const ocorrenciaLocal = await ocorrenciaRepo.buscarPorId('oc-rem-1');
    expect(ocorrenciaLocal?.fotos).toEqual(['file:///oc.jpg']);

    const comunicados = await comunicadoRepo.listarPorCondominio('cond-1');
    expect(comunicados).toHaveLength(1);
    expect(comunicados[0].fixado).toBe(true);
  });

  it('não sobrescreve registros que possuem alterações pendentes na outbox local', async () => {
    const vistoriaLocal = Vistoria.reidratar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      status: StatusVistoria.EM_ANDAMENTO,
      itens: [
        ItemChecklist.criar({
          id: 'item-1',
          vistoriaId: 'vist-1',
          titulo: 'Extintor',
          categoria: 'Segurança',
          status: StatusItemChecklist.OK,
        }),
      ],
    });
    await vistoriaRepo.salvar(vistoriaLocal);

    await outboxRepo.enfileirar({
      tabela: 'itens_checklist',
      operacao: 'UPDATE',
      idRegistro: 'item-1',
      payload: { id: 'item-1', vistoria_id: 'vist-1', status: 'OK' },
      usuarioId: 'insp-1',
      deviceId: 'dev-1',
    });

    const gateway = criarGateway({
      vistorias: [
        {
          id: 'vist-1',
          condominio_id: 'cond-1',
          inspetor_id: 'insp-1',
          status: 'RASCUNHO',
          data_criacao: '2026-11-24T10:00:00.000Z',
        },
      ],
      itensChecklist: [
        {
          id: 'item-1',
          vistoria_id: 'vist-1',
          titulo: 'Extintor',
          categoria: 'Segurança',
          status: 'PENDENTE',
        },
      ],
      ocorrencias: [],
      fotosEvidencia: [],
      comunicados: [],
    });

    const useCase = new SincronizarDadosRemotosUseCase(
      rede,
      gateway,
      outboxRepo,
      vistoriaRepo,
      ocorrenciaRepo,
      comunicadoRepo
    );

    const resultado = await useCase.executar('cond-1');
    expect(resultado.vistorias).toBe(0);

    const preservada = await vistoriaRepo.buscarPorId('vist-1');
    expect(preservada?.status).toBe(StatusVistoria.EM_ANDAMENTO);
    expect(preservada?.itens[0].status).toBe(StatusItemChecklist.OK);
  });

  it('não consulta remoto quando offline ou quando gateway não suporta snapshot', async () => {
    rede.conectado = false;
    const gatewayOffline = criarGateway({
      vistorias: [],
      itensChecklist: [],
      ocorrencias: [],
      fotosEvidencia: [],
      comunicados: [],
    });

    const useCaseOffline = new SincronizarDadosRemotosUseCase(
      rede,
      gatewayOffline,
      outboxRepo,
      vistoriaRepo,
      ocorrenciaRepo,
      comunicadoRepo
    );

    const resOffline = await useCaseOffline.executar('cond-1');
    expect(resOffline.atualizado).toBe(false);
    expect(gatewayOffline.buscarSnapshotCondominio).not.toHaveBeenCalled();

    rede.conectado = true;
    const gatewaySemSnapshot: IRemoteSyncGateway = { sincronizarItem: jest.fn() };
    const useCaseSemSnapshot = new SincronizarDadosRemotosUseCase(
      rede,
      gatewaySemSnapshot,
      outboxRepo,
      vistoriaRepo,
      ocorrenciaRepo,
      comunicadoRepo
    );

    const resSemSnapshot = await useCaseSemSnapshot.executar('cond-1');
    expect(resSemSnapshot.atualizado).toBe(false);
  });
});
