import { StatusOutbox } from '../../domain/entities/outbox-event.entity';
import {
  ConexaoIndisponivelError,
  ErroSincronizacao,
  OutboxNaoProcessavelError,
} from '../../domain/errors/domain-errors';
import { INetworkService } from '../../domain/interfaces/network.service.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export interface DetalheSincronizacao {
  id: string;
  sucesso: boolean;
  erro?: string;
  transitorio?: boolean;
  statusFinal?: StatusOutbox;
}

export interface SincronizacaoResultado {
  total: number;
  sincronizados: number;
  falhas: number;
  /** Falhas que não adelham com retry e foram para dead-letter. */
  permanentes: number;
  /** Eventos que não puderam ser despachados (já em curso, já resolvidos). */
  ignorados: number;
  detalhes: DetalheSincronizacao[];
}

/**
 * Drena a fila de outbox — `sindiflow-obrigacoes.md` §1.3.
 *
 * O instante de referência é parâmetro, não `new Date()` interno: prazo de retry e
 * limite de SLA precisam ser verificáveis por teste.
 */
export class SincronizarOutboxUseCase {
  constructor(
    private readonly networkService: INetworkService,
    private readonly outboxRepo: IOutboxRepository,
    private readonly syncGateway: IRemoteSyncGateway
  ) {}

  async executar(agora: Date = new Date()): Promise<SincronizacaoResultado> {
    // 1. §1.3: detecção de rede obrigatória antes de toda tentativa de sync.
    const online = await this.networkService.estaConectado();
    if (!online) {
      throw new ConexaoIndisponivelError();
    }

    // 2. Só entram na fila os eventos PENDENTE cujo prazo de retry já venceu.
    //    Filtrar por status e prazo é o que impede retentativa imediata e inanição
    //    de head-of-line — o `slice(0, limite)` anterior ignorava ambos.
    const pendentes = await this.outboxRepo.obterPendentes(agora);

    const detalhes: DetalheSincronizacao[] = [];
    let sincronizados = 0;
    let falhas = 0;
    let permanentes = 0;
    let ignorados = 0;

    for (const candidato of pendentes) {
      // 3. A reserva do despacho acontece FORA do try de sincronização. Se ela
      //    lançar — outro toque no botão disparou a mesma fila em paralelo — o
      //    evento não saiu, e tratá-lo como falha de sync queimaria uma tentativa
      //    e reabriria um despacho que já está em curso.
      let evento;
      try {
        evento = await this.outboxRepo.iniciarProcessamento(candidato.id);
      } catch (erro) {
        ignorados++;
        detalhes.push({
          id: candidato.id,
          sucesso: false,
          erro:
            erro instanceof OutboxNaoProcessavelError
              ? erro.message
              : 'Falha ao reservar o evento para despacho.',
          statusFinal: candidato.status,
        });
        continue;
      }

      try {
        await this.syncGateway.sincronizarItem(evento);
        await this.outboxRepo.marcarSincronizado(evento.id, agora);
        sincronizados++;
        detalhes.push({ id: evento.id, sucesso: true, statusFinal: evento.status });
      } catch (erro) {
        falhas++;

        // Erro não tipado é tratado como transitório: a falha de rede não vem
        // rotulada, e tratar tudo como permanente jogaria a fila no dead-letter.
        const transitorio = !(erro instanceof ErroSincronizacao) || erro.transitorio;
        if (!transitorio) permanentes++;

        const mensagem =
          erro instanceof Error ? erro.message : 'Erro desconhecido na sincronização remota';

        // 4. Registrar a falha tem o próprio try. Um throw aqui — evento já
        //    sincronizado por um despacho concorrente, disco cheio — não pode
        //    abortar o lote: os eventos restantes ainda precisam ser tentados.
        try {
          if (transitorio) {
            await this.outboxRepo.registrarFalha(evento.id, mensagem, agora);
          } else {
            await this.outboxRepo.registrarFalhaPermanente(evento.id, mensagem, agora);
          }
        } catch (falhaAoRegistrar) {
          detalhes.push({
            id: evento.id,
            sucesso: false,
            erro: `${mensagem} (falha ao registrar: ${
              falhaAoRegistrar instanceof Error ? falhaAoRegistrar.message : 'desconhecida'
            })`,
            transitorio,
            statusFinal: evento.status,
          });
          continue;
        }

        detalhes.push({
          id: evento.id,
          sucesso: false,
          erro: mensagem,
          transitorio,
          statusFinal: evento.status,
        });
      }
    }

    return {
      total: pendentes.length,
      sincronizados,
      falhas,
      permanentes,
      ignorados,
      detalhes,
    };
  }
}
