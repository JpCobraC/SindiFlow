import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { SincronizarOutboxUseCase } from '../../src/application/use-cases/sincronizar-outbox.usecase';
import { StatusOutbox } from '../../src/domain/entities/outbox-event.entity';
import {
  ConexaoIndisponivelError,
  ErroSincronizacao,
  OutboxNaoProcessavelError,
} from '../../src/domain/errors/domain-errors';
import { IRemoteSyncGateway } from '../../src/domain/interfaces/remote-sync.gateway.interface';
import {
  EstadoRede,
  INetworkService,
} from '../../src/domain/interfaces/network.service.interface';

const T0 = new Date('2026-10-13T12:00:00.000Z');

class RedeFake implements INetworkService {
  constructor(private conectado: boolean) {}
  async estadoConexao(): Promise<EstadoRede> {
    return this.conectado ? EstadoRede.ONLINE : EstadoRede.OFFLINE;
  }
  async estaConectado(): Promise<boolean> {
    return this.conectado;
  }
}

/**
 * O gateway fake anterior devolvia `true` ou lançava exceção. Nunca devolvia
 * `false` — e o use case **descartava** o retorno de qualquer jeito. Por isso
 * uma falha "não-exceptional" era impossível de detectar nos testes, e um adapter
 * real devolvendo `false` marcava o item como sincronizado, perdendo o dado.
 */
class SyncFake implements IRemoteSyncGateway {
  public chamadas: string[] = [];

  constructor(
    private readonly comportamento: (id: string) => void | Promise<void> = () => {}
  ) {}

  async sincronizarItem(evento: { id: string }): Promise<void> {
    this.chamadas.push(evento.id);
    await this.comportamento(evento.id);
  }
}

describe('SincronizarOutboxUseCase (Application)', () => {
  let repo: OutboxRepositoryInMemory;
  let sync: SyncFake;
  let rede: RedeFake;
  let useCase: SincronizarOutboxUseCase;

  async function enfileirar(id: string) {
    return repo.enfileirar({
      id,
      tabela: 'vistorias',
      operacao: 'UPDATE',
      idRegistro: 'vist-1',
      payload: { id: 'vist-1' },
      usuarioId: 'user-1',
      deviceId: 'device-1',
      dataCriacao: T0,
    });
  }

  beforeEach(() => {
    repo = new OutboxRepositoryInMemory();
    sync = new SyncFake();
    rede = new RedeFake(true);
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
  });

  it('deve bloquear toda sincronização quando não há conexão (§1.3)', async () => {
    rede = new RedeFake(false);
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
    await enfileirar('out-1');

    await expect(useCase.executar(T0)).rejects.toThrow(ConexaoIndisponivelError);
    expect(sync.chamadas).toHaveLength(0);
  });

  it('deve despachar o evento, marcar SINCRONIZADO e mantê-lo na fila', async () => {
    await enfileirar('out-1');

    const resultado = await useCase.executar(T0);

    expect(sync.chamadas).toEqual(['out-1']);
    expect(resultado.sincronizados).toBe(1);
    expect(resultado.falhas).toBe(0);

    // O evento permanece na fila: §3.3 exige trilha de auditoria.
    const todos = await repo.listarTodos();
    expect(todos).toHaveLength(1);
    expect(todos[0].status).toBe(StatusOutbox.SINCRONIZADO);
  });

  it('não deve despachar evento cujo prazo de retry ainda não venceu', async () => {
    const evento = await enfileirar('out-1');
    await repo.iniciarProcessamento(evento.id);
    evento.registrarFalha('timeout anterior', T0);

    const resultado = await useCase.executar(new Date(T0.getTime() + 500));

    expect(sync.chamadas).toHaveLength(0);
    expect(resultado.total).toBe(0);
  });

  it('deve tratar falha transitória com retry e backoff', async () => {
    sync = new SyncFake(() => {
      throw new ErroSincronizacao('HTTP 503 Service Unavailable', true, 503);
    });
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
    await enfileirar('out-1');

    const resultado = await useCase.executar(T0);

    expect(resultado.falhas).toBe(1);
    expect(resultado.sincronizados).toBe(0);
    expect(resultado.detalhes[0].transitorio).toBe(true);

    const [evento] = await repo.listarTodos();
    expect(evento.tentativas).toBe(1);
    expect(evento.proximoRetryMs).toBe(1000);
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    // Não deve ser redespachado antes do prazo.
    expect(sync.chamadas).toHaveLength(1);
  });

  it('deve tratar falha PERMANENTE como dead-letter imediato, sem consumir retries (C-05)', async () => {
    sync = new SyncFake(() => {
      throw new ErroSincronizacao('HTTP 403 usuário revogado', false, 403);
    });
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
    await enfileirar('out-1');

    const resultado = await useCase.executar(T0);

    expect(resultado.falhas).toBe(1);
    expect(resultado.detalhes[0].transitorio).toBe(false);

    const [evento] = await repo.listarTodos();
    expect(evento.tentativas).toBe(1);
    expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
    expect(evento.ultimoErro).toContain('403');
  });

  it('deve assumir falha transitória quando o adapter lança erro não tipado', async () => {
    sync = new SyncFake(() => {
      throw new Error('ECONNRESET');
    });
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
    await enfileirar('out-1');

    await useCase.executar(T0);

    const [evento] = await repo.listarTodos();
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    expect(evento.tentativas).toBe(1);
  });

  it('deve continuar processando os demais itens após um falhar', async () => {
    sync = new SyncFake((id) => {
      if (id === 'out-1') throw new ErroSincronizacao('503', true, 503);
    });
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);
    await enfileirar('out-1');
    await enfileirar('out-2');

    const resultado = await useCase.executar(T0);

    expect(resultado.total).toBe(2);
    expect(resultado.sincronizados).toBe(1);
    expect(resultado.falhas).toBe(1);
    expect(sync.chamadas).toEqual(['out-1', 'out-2']);
  });

  it('deve avançar para FALHA_MAXIMA após esgotar as tentativas transitórias', async () => {
    let tentativas = 0;
    sync = new SyncFake(() => {
      tentativas += 1;
      throw new ErroSincronizacao('503', true, 503);
    });
    useCase = new SincronizarOutboxUseCase(rede, repo, sync);

    const evento = await repo.enfileirar({
      id: 'out-1',
      tabela: 'vistorias',
      operacao: 'UPDATE',
      idRegistro: 'vist-1',
      payload: {},
      usuarioId: 'user-1',
      deviceId: 'device-1',
      maxTentativas: 3,
      dataCriacao: T0,
    });

    let agora = T0;
    for (let i = 0; i < 3; i++) {
      await useCase.executar(agora);
      agora = new Date(agora.getTime() + 60_000);
    }

    expect(tentativas).toBe(3);
    expect(evento.tentativas).toBe(3);
    expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
  });
  describe('despacho concorrente (duplo toque no botão)', () => {
    it('deve despachar o evento uma única vez, sem queimar tentativa', async () => {
      let liberar!: () => void;
      const gatewayEsperado = new Promise<void>((r) => {
        liberar = r;
      });
      sync = new SyncFake(async () => {
        await gatewayEsperado;
      });
      useCase = new SincronizarOutboxUseCase(rede, repo, sync);
      await enfileirar('out-1');

      const a = useCase.executar(T0);
      await Promise.resolve();
      const b = useCase.executar(T0);

      liberar();
      const [resA, resB] = await Promise.all([a, b]);
      const somar = (k: keyof typeof resA) => [resA, resB].reduce((n, r) => n + (r[k] as number), 0);

      expect(somar("sincronizados")).toBe(1);
      expect(somar('falhas')).toBe(0);
      expect(sync.chamadas).toEqual(['out-1']);

      const [evento] = await repo.listarTodos();
      expect(evento.status).toBe(StatusOutbox.SINCRONIZADO);
      // Nenhuma tentativa queimada: o despacho perdedor não pode virar retry.
      expect(evento.tentativas).toBe(0);
    });

    it('deve contar como IGNORADO — e não como falha — quando o repositório recusa o despacho', async () => {
      // É o que acontece quando outra execução já reservou o mesmo evento: houve
      // um envio a menos, não um erro de sincronização. Contar como falha queima
      // tentativa e reabre um despacho em curso.
      const eventoRecusado = await enfileirar('out-1');
      jest.spyOn(repo, 'iniciarProcessamento').mockRejectedValue(
        new OutboxNaoProcessavelError('evento já está em processamento.')
      );

      const resultado = await useCase.executar(T0);

      expect(resultado.ignorados).toBe(1);
      expect(resultado.falhas).toBe(0);
      expect(resultado.sincronizados).toBe(0);
      expect(resultado.detalhes[0].erro).toContain('já está em processamento');
      expect(sync.chamadas).toHaveLength(0);

      // Nenhuma tentativa consumida por um evento que nem chegou a sair.
      expect(eventoRecusado.tentativas).toBe(0);
    });
  });

  describe('falha ao registrar o resultado da sincronização', () => {
    it('NÃO deve abortar o lote quando o registro da falha também falha', async () => {
      sync = new SyncFake((id) => {
        if (id === 'out-1') throw new ErroSincronizacao('503', true, 503);
      });
      useCase = new SincronizarOutboxUseCase(rede, repo, sync);
      await enfileirar('out-1');
      await enfileirar('out-2');

      jest.spyOn(repo, 'registrarFalha').mockRejectedValue(new Error('disco cheio'));

      const resultado = await useCase.executar(T0);

      // Sem o try interno, o throw do registro de out-1 escaparia do catch e
      // abortaria o lote: out-2 jamais seria tentado.
      expect(sync.chamadas).toEqual(['out-1', 'out-2']);
      expect(resultado.falhas).toBe(1);
      expect(resultado.sincronizados).toBe(1);
      expect(resultado.detalhes[0].erro).toContain('disco cheio');
    });

    it('deve usar texto genérico quando o erro registrado não é Error', async () => {
      sync = new SyncFake(() => {
        throw new ErroSincronizacao('503', true, 503);
      });
      useCase = new SincronizarOutboxUseCase(rede, repo, sync);
      await enfileirar('out-1');

      jest.spyOn(repo, 'registrarFalha').mockRejectedValue('texto solto');

      const resultado = await useCase.executar(T0);
      expect(resultado.detalhes[0].erro).toContain('desconhecida');
    });
  });
});
