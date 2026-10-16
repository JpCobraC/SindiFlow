import {
  OutboxEvent,
  OutboxEventProps,
  StatusOutbox,
  TETO_BACKOFF_MS,
} from '../../src/domain/entities/outbox-event.entity';
import { OutboxNaoProcessavelError } from '../../src/domain/errors/domain-errors';

/**
 * RF-SYNC-007 — chave de deduplicação.
 *
 * O DDL exige `chave_dedup TEXT NOT NULL` com índice único, mas **nenhum código
 * produzia a coluna** (C-11). Um repositório SQLite que a ignora violaria o
 * NOT NULL na primeira inserção — o defeito apareceria em produção, não em teste.
 *
 * A chave é derivada de `tabela:operacao:idRegistro`, e `idRegistro` é campo
 * obrigatório de `DadosOutbox`. Não se deriva de `payload.id` porque `payload` é
 * `Record<string, unknown>` — ler `id` dali seria silenciosamente frágil.
 */
describe('OutboxEvent — chaveDedup (RF-SYNC-007)', () => {
  const T0 = new Date('2026-10-16T10:00:00.000Z');

  function propsBase(overrides: Record<string, unknown> = {}): OutboxEventProps {
    return {
      id: 'out-1',
      tabela: 'vistorias',
      operacao: 'INSERT',
      idRegistro: 'vist-1',
      payload: { id: 'vist-1' },
      usuarioId: 'user-1',
      deviceId: 'dev-1',
      dataCriacao: T0,
      ...overrides,
    };
  }

  function novoEvento(overrides: Record<string, unknown> = {}) {
    return OutboxEvent.criar(propsBase(overrides));
  }

  describe('derivação', () => {
    it('monta a chave como tabela:operacao:idRegistro', () => {
      const evento = novoEvento();

      expect(evento.chaveDedup).toBe('vistorias:INSERT:vist-1');
    });

    it('produz chaves diferentes para registros diferentes na mesma tabela', () => {
      const a = novoEvento({ id: 'out-1', idRegistro: 'vist-1' });
      const b = novoEvento({ id: 'out-2', idRegistro: 'vist-2' });

      expect(a.chaveDedup).not.toBe(b.chaveDedup);
    });

    it('produz chaves diferentes para operações diferentes no mesmo registro', () => {
      const insert = novoEvento({ operacao: 'INSERT' });
      const update = novoEvento({ operacao: 'UPDATE' });

      expect(insert.chaveDedup).not.toBe(update.chaveDedup);
    });

    it('produz chaves diferentes para tabelas diferentes', () => {
      const vistoria = novoEvento({ tabela: 'vistorias' });
      const ocorrencia = novoEvento({ tabela: 'ocorrencias' });

      expect(vistoria.chaveDedup).not.toBe(ocorrencia.chaveDedup);
    });

    it('produz a MESMA chave para o mesmo registro e operação — é isto que é dedup', () => {
      // Dois eventos distintos (ids diferentes) sobre a mesma escrita lógica
      // precisam colar na mesma chave: é o que faz o reenvio não duplicar
      // registro no servidor.
      const reenvio = novoEvento({ id: 'out-99' });

      expect(reenvio.chaveDedup).toBe(novoEvento().chaveDedup);
      expect(reenvio.id).not.toBe(novoEvento().id);
    });
  });

  describe('validação', () => {
    it('recusa idRegistro vazio', () => {
      expect(() => novoEvento({ idRegistro: '' })).toThrow(OutboxNaoProcessavelError);
    });

    it('recusa idRegistro só com espaços', () => {
      // Sem esta guarda a chave viraria "vistorias:INSERT:   " — uma chave
      // válida que colide com a de qualquer outro registro em branco.
      expect(() => novoEvento({ idRegistro: '   ' })).toThrow(OutboxNaoProcessavelError);
    });

    it('recusa idRegistro ausente', () => {
      const props = propsBase();
      delete (props as { idRegistro?: string }).idRegistro;

      expect(() => OutboxEvent.criar(props)).toThrow(OutboxNaoProcessavelError);
    });
  });

  it('participa da leitura normal do evento', () => {
    const evento = novoEvento();

    expect(evento.chaveDedup).toBe('vistorias:INSERT:vist-1');
    expect(evento.tabela).toBe('vistorias');
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    expect(evento.dataCriacao.getTime()).toBe(T0.getTime());
    expect(TETO_BACKOFF_MS).toBe(60_000);
  });
});