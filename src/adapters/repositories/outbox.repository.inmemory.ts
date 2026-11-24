import { OutboxEvent, StatusOutbox } from '../../domain/entities/outbox-event.entity';
import { OutboxNaoProcessavelError } from '../../domain/errors/domain-errors';
import { DadosOutbox, IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';

/**
 * Repositório de outbox em memória.
 *
 * Substitui o DTO plano `ItemOutbox`. A mudança que importa não é de forma, é de
 * comportamento: o modelo antigo não guardava `status`, `ultimoErro` nem prazo de
 * retry, então `marcarSincronizado` **apagava** a linha e o retry era um
 * `tentativas += 1` sem teto — sem dead-letter, sem backoff, sem auditoria.
 */
export class OutboxRepositoryInMemory implements IOutboxRepository {
  private eventos = new Map<string, OutboxEvent>();
  private sequencia = 0;
  private processandoDesde = new Map<string, Date>();

  /**
   * Ponto de extensão para os testes, que sobrescrevem via `jest.spyOn` para
   * obter ids previsíveis sem depender da ordem de execução.
   */
  public proximoId(): string {
    this.sequencia += 1;
    return `out-${this.sequencia}`;
  }

  async enfileirar(dados: DadosOutbox): Promise<OutboxEvent> {
    const evento = OutboxEvent.criar({
      ...dados,
      id: dados.id ?? this.proximoId(),
    });
    this.eventos.set(evento.id, evento);
    return evento;
  }

  async obterPendentes(agora: Date = new Date(), limite: number = 50): Promise<OutboxEvent[]> {
    const prontos: OutboxEvent[] = [];
    for (const evento of this.eventos.values()) {
      if (prontos.length >= limite) break;
      if (evento.estaProntoParaRetry(agora)) prontos.push(evento);
    }
    return prontos;
  }

  async iniciarProcessamento(id: string): Promise<OutboxEvent> {
    const evento = this.eventos.get(id);
    if (!evento) throw new OutboxNaoProcessavelError(`evento ${id} não existe na fila.`);
    evento.iniciarProcessamento();
    this.processandoDesde.set(id, new Date());
    return evento;
  }

  async listarTodos(): Promise<OutboxEvent[]> {
    return [...this.eventos.values()];
  }

  async marcarSincronizado(id: string, dataSync: Date = new Date()): Promise<void> {
    const evento = this.eventos.get(id);
    if (!evento) return;
    evento.marcarSincronizado(dataSync);
  }

  async registrarFalha(id: string, erro: string, agora: Date = new Date()): Promise<void> {
    const evento = this.eventos.get(id);
    if (!evento) return;
    evento.registrarFalha(erro, agora);
  }

  async registrarFalhaPermanente(id: string, erro: string, agora: Date = new Date()): Promise<void> {
    const evento = this.eventos.get(id);
    if (!evento) return;
    evento.registrarFalhaPermanente(erro, agora);
  }

  async resetar(id: string): Promise<void> {
    this.eventos.get(id)?.resetar();
    this.processandoDesde.delete(id);
  }

  async resetarProcessandoAntigos(agora: Date, timeoutMs: number): Promise<number> {
    let recuperados = 0;
    for (const [id, inicio] of [...this.processandoDesde.entries()]) {
      const evento = this.eventos.get(id);
      if (!evento || evento.status !== StatusOutbox.PROCESSANDO) {
        this.processandoDesde.delete(id);
        continue;
      }
      if (agora.getTime() - inicio.getTime() >= timeoutMs) {
        evento.liberarProcessamento();
        this.processandoDesde.delete(id);
        recuperados += 1;
      }
    }
    return recuperados;
  }

  async descartarSincronizados(anteriorA: Date): Promise<number> {
    let removidos = 0;
    for (const [id, evento] of [...this.eventos.entries()]) {
      const sincronizadoEm = evento.dataSincronizacao;
      if (sincronizadoEm && sincronizadoEm < anteriorA) {
        this.eventos.delete(id);
        removidos += 1;
      }
    }
    return removidos;
  }

  /** Limpeza total. Usado em testes para isolar cenários. */
  limpar(): void {
    this.eventos.clear();
    this.sequencia = 0;
  }
}
