import {
  OutboxEvent,
  StatusOutbox,
  TETO_BACKOFF_MS,
} from '../../src/domain/entities/outbox-event.entity';
import { OutboxNaoProcessavelError } from '../../src/domain/errors/domain-errors';

/**
 * O `OutboxEvent` era código morto: 98 linhas com 90% de cobertura e nenhum
 * consumidor em produção. O caminho real de sync usava um DTO plano (`ItemOutbox`)
 * que não conseguia representar as colunas que o próprio DDL exigia
 * (`status`, `proximo_retry_ms`, `ultimo_erro`). Estes testes fixam o contrato
 * único que a Fase 1 vai implementar em SQLite.
 */
function novoEvento(overrides: Partial<Parameters<typeof OutboxEvent.criar>[0]> = {}): OutboxEvent {
  return OutboxEvent.criar({
    id: 'out-1',
    tabela: 'vistorias',
    operacao: 'UPDATE',
    // RF-SYNC-007: registro que a escrita afeta, distinto do id do evento.
    idRegistro: 'vist-1',
    payload: { id: 'vist-1', status: 'FINALIZADA' },
    usuarioId: 'user-1',
    deviceId: 'device-1',
    ...overrides,
  });
}

const T0 = new Date('2026-10-13T12:00:00.000Z');

describe('OutboxEvent (Domain)', () => {
  describe('criação', () => {
    it('deve nascer PENDENTE, com 0 tentativas e primeiro retry em 1s', () => {
      const evento = novoEvento({ dataCriacao: T0 });

      expect(evento.status).toBe(StatusOutbox.PENDENTE);
      expect(evento.tentativas).toBe(0);
      expect(evento.proximoRetryMs).toBe(1000);
      expect(evento.ultimoErro).toBeUndefined();
      expect(evento.dataSincronizacao).toBeUndefined();
    });

    it('deve carregar autor e dispositivo, exigidos pela auditoria de §1.3', () => {
      const evento = novoEvento();

      expect(evento.tabela).toBe('vistorias');
      expect(evento.operacao).toBe('UPDATE');
      expect(evento.usuarioId).toBe('user-1');
      expect(evento.deviceId).toBe('device-1');
    });

    it('deve rejeitar identificadores vazios — o registro ficaria órfão no banco', () => {
      expect(() => novoEvento({ id: '' })).toThrow(OutboxNaoProcessavelError);
      expect(() => novoEvento({ usuarioId: '' })).toThrow(OutboxNaoProcessavelError);
      expect(() => novoEvento({ deviceId: '' })).toThrow(OutboxNaoProcessavelError);
      expect(() => novoEvento({ tabela: '' })).toThrow(OutboxNaoProcessavelError);
    });

    it('deve rejeitar maxTentativas zero ou negativa em vez de silenciar para 5', () => {
      expect(() => novoEvento({ maxTentativas: 0 })).toThrow(OutboxNaoProcessavelError);
      expect(() => novoEvento({ maxTentativas: -3 })).toThrow(OutboxNaoProcessavelError);
    });
  });

  describe('backoff exponencial (§1.3: 1s, 2s, 4s, 8s...)', () => {
    it('deve seguir a escada 1s -> 2s -> 4s -> 8s -> 16s', () => {
      const evento = novoEvento({ maxTentativas: 10 });

      const esperados = [1000, 2000, 4000, 8000, 16000];
      const instante = T0.getTime();
      esperados.forEach((esperado, indice) => {
        // Ciclo real de despacho: só se registra falha sobre algo em curso.
        evento.iniciarProcessamento();
        evento.registrarFalha('timeout', new Date(instante + indice * 60_000));
        expect(evento.proximoRetryMs).toBe(esperado);
        expect(evento.tentativas).toBe(indice + 1);
      });
    });

    it('deve limitar o backoff no teto, para não grow sem fim', () => {
      const evento = novoEvento({ maxTentativas: 50 });

      for (let i = 0; i < 20; i++) {
        if (evento.status === StatusOutbox.FALHA_MAXIMA) evento.resetar();
        evento.iniciarProcessamento();
        evento.registrarFalha('timeout', T0);
        expect(evento.proximoRetryMs).toBeLessThanOrEqual(TETO_BACKOFF_MS);
      }
      expect(evento.proximoRetryMs).toBe(TETO_BACKOFF_MS);
    });

    it('deve estar pronto imediatamente, sem esperar backoff, se nunca falhou', () => {
      const evento = novoEvento({ dataCriacao: T0 });

      // O backoff é castigo por falha; aplicá-lo ao primeiro envio atrasaria a fila.
      expect(evento.estaProntoParaRetry(T0)).toBe(true);
      expect(evento.proximoRetryEm).toEqual(T0);
    });

    it('não deve ficar pronto para retry antes do prazo', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', T0);

      // Após 1 falha, o próximo retry só pode ocorrer 1s depois.
      expect(evento.estaProntoParaRetry(new Date(T0.getTime() + 999))).toBe(false);
      expect(evento.estaProntoParaRetry(new Date(T0.getTime() + 1000))).toBe(true);
    });

    it('deve empurrar cada prazo a partir da última tentativa, não da criação', () => {
      const evento = novoEvento({ dataCriacao: T0 });
      const t1 = new Date(T0.getTime() + 60_000);

      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', t1); // falha 1 -> espera 1s

      expect(evento.estaProntoParaRetry(new Date(t1.getTime() + 500))).toBe(false);
      expect(evento.estaProntoParaRetry(new Date(t1.getTime() + 1000))).toBe(true);
    });
  });

  describe('FALHA_MAXIMA é terminal', () => {
    it('deve entrar em FALHA_MAXIMA ao atingir maxTentativas', () => {
      const evento = novoEvento({ maxTentativas: 5 });

      for (let i = 0; i < 4; i++) {
        evento.iniciarProcessamento();
        evento.registrarFalha(`erro ${i}`, T0);
      }
      expect(evento.status).toBe(StatusOutbox.PENDENTE);

      evento.iniciarProcessamento();
      evento.registrarFalha('última', T0);
      expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
      expect(evento.tentativas).toBe(5);
    });

    it('não deve redispatchar um evento em FALHA_MAXIMA', () => {
      const evento = novoEvento({ maxTentativas: 1 });
      evento.iniciarProcessamento();
      evento.registrarFalha('dead-letter', T0);

      expect(() => evento.iniciarProcessamento()).toThrow(OutboxNaoProcessavelError);
    });

    it('deve ignorar novas falhas depois de FALHA_MAXIMA, sem inflar tentativas', () => {
      const evento = novoEvento({ maxTentativas: 2 });
      evento.iniciarProcessamento();
      evento.registrarFalha('a', T0);
      evento.iniciarProcessamento();
      evento.registrarFalha('b', T0);

      evento.registrarFalha('c', T0);
      evento.registrarFalhaPermanente('d', T0);

      expect(evento.tentativas).toBe(2);
      expect(evento.ultimoErro).toBe('d');
    });

    it('deve entrar em dead-letter imediato quando a falha é permanente (C-05)', () => {
      const evento = novoEvento({ maxTentativas: 5, dataCriacao: T0 });

      // 4xx: retentar 5x com backoff só atrasa o alerta do usuário revogado.
      evento.iniciarProcessamento();
      evento.registrarFalhaPermanente('HTTP 403 - usuário revogado', T0);

      expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
      expect(evento.tentativas).toBe(1);
      expect(evento.ultimoErro).toBe('HTTP 403 - usuário revogado');
      expect(evento.estaProntoParaRetry(T0)).toBe(false);
    });

    it('deve permitir recuperação via resetar, devolvendo o evento à fila', () => {
      const evento = novoEvento({ maxTentativas: 2, dataCriacao: T0 });
      const idOriginal = evento.id;
      const criacaoOriginal = evento.dataCriacao;

      evento.iniciarProcessamento();
      evento.registrarFalha('a', T0);
      evento.iniciarProcessamento();
      evento.registrarFalha('b', T0);
      expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);

      evento.resetar();

      expect(evento.status).toBe(StatusOutbox.PENDENTE);
      expect(evento.tentativas).toBe(0);
      expect(evento.ultimoErro).toBeUndefined();
      expect(evento.id).toBe(idOriginal);
      expect(evento.dataCriacao).toBe(criacaoOriginal);
      expect(evento.estaProntoParaRetry(T0)).toBe(true);
    });
  });

  describe('iniciarProcessamento', () => {
    it('deve transicionar PENDENTE -> PROCESSANDO', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      expect(evento.status).toBe(StatusOutbox.PROCESSANDO);
    });

    it('deve recusar reentrada em si mesmo', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      expect(() => evento.iniciarProcessamento()).toThrow(OutboxNaoProcessavelError);
    });

    it('deve recusar evento já sincronizado', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);
      expect(() => evento.iniciarProcessamento()).toThrow(OutboxNaoProcessavelError);
    });
  });

  describe('marcarSincronizado retém o registro (auditoria §3.3)', () => {
    it('deve marcar SINCRONIZADO sem apagar o evento da fila', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', T0);
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);

      expect(evento.status).toBe(StatusOutbox.SINCRONIZADO);
      expect(evento.dataSincronizacao).toEqual(T0);
      expect(evento.ultimoErro).toBeUndefined();
      // O evento continua existindo: é a evidência de auditoria de §3.3.
      expect(evento.id).toBe('out-1');
      expect(evento.payload).toEqual({ id: 'vist-1', status: 'FINALIZADA' });
    });

    it('não deve ser possível sincronizar duas vezes', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);
      expect(() => evento.marcarSincronizado(new Date(T0.getTime() + 999))).toThrow(
        OutboxNaoProcessavelError
      );
    });

    it('deve ser rejeitado se chamado fora de PROCESSANDO', () => {
      const evento = novoEvento();
      expect(() => evento.marcarSincronizado(T0)).toThrow(OutboxNaoProcessavelError);
    });
  });

  describe('invariantes de estado', () => {
    it('não deve registrar falha em evento já sincronizado', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);

      expect(() => evento.registrarFalha('tarde demais', T0)).toThrow(OutboxNaoProcessavelError);
      expect(() => evento.registrarFalhaPermanente('tarde demais', T0)).toThrow(
        OutboxNaoProcessavelError
      );
      expect(evento.status).toBe(StatusOutbox.SINCRONIZADO);
    });

    it('deve expor a última tentativa e o instante limite do próximo retry', () => {
      const evento = novoEvento({ dataCriacao: T0 });
      expect(evento.dataUltimaTentativa).toBeUndefined();
      expect(evento.proximoRetryEm).toEqual(T0);

      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', T0);

      expect(evento.dataUltimaTentativa).toEqual(T0);
      expect(evento.proximoRetryEm).toEqual(new Date(T0.getTime() + 1000));
    });

    it('deve usar o relógio atual quando o instante não for informado', () => {
      const antes = Date.now();
      const evento = novoEvento({ dataCriacao: T0 });

      expect(evento.estaProntoParaRetry()).toBe(true);

      evento.iniciarProcessamento();
      evento.registrarFalha('timeout');
      expect(evento.dataUltimaTentativa!.getTime()).toBeGreaterThanOrEqual(antes);
      expect(evento.proximoRetryMs).toBe(1000);
    });

    it('não deve permitir despachar evento cujo prazo ainda não venceu', () => {
      const evento = novoEvento({ dataCriacao: T0 });
      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', T0);

      expect(evento.estaProntoParaRetry(new Date(T0.getTime() + 500))).toBe(false);
    });
  });
  describe('resetar só vale em dead-letter (auditoria §3.3)', () => {
    it('NÃO deve apagar a assinatura de um evento já SINCRONIZADO', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);

      expect(() => evento.resetar()).toThrow(OutboxNaoProcessavelError);

      expect(evento.status).toBe(StatusOutbox.SINCRONIZADO);
      expect(evento.dataSincronizacao).toEqual(T0);
    });

    it('NÃO deve desfazer um despacho em PROCESSANDO', () => {
      const evento = novoEvento();
      evento.iniciarProcessamento();

      expect(() => evento.resetar()).toThrow(OutboxNaoProcessavelError);
      expect(evento.status).toBe(StatusOutbox.PROCESSANDO);
    });

    it('NÃO deve zerar tentativas de um evento PENDENTE saudável', () => {
      // Permitir isto tornaria o retry grátis e repetível, e não detectaria abuso.
      const evento = novoEvento();
      evento.iniciarProcessamento();
      evento.registrarFalha('timeout', T0);

      expect(() => evento.resetar()).toThrow(OutboxNaoProcessavelError);
      expect(evento.tentativas).toBe(1);
    });
  });

  describe('falha após dead-letter preserva o diagnóstico', () => {
    it('deve registrar a nova causa mesmo sem contar nova tentativa', () => {
      const evento = novoEvento({ maxTentativas: 1, dataCriacao: T0 });
      evento.iniciarProcessamento();
      evento.registrarFalha('timeout de rede', T0);
      expect(evento.ultimoErro).toBe('timeout de rede');

      // Um 403 posterior é a informação que o inspetor precisa; silenciá-la
      // manda quem depura a fila atrás da causa errada.
      evento.registrarFalhaPermanente('HTTP 403: usuário revogado', T0);

      expect(evento.ultimoErro).toBe('HTTP 403: usuário revogado');
      expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
      expect(evento.tentativas).toBe(1);
    });
  });

  describe('falha só pode ser registrada sobre um despacho em curso', () => {
    it('deve recusar registrarFalha em evento PENDENTE e nunca despachado', () => {
      const evento = novoEvento();
      expect(() => evento.registrarFalha('inventada', T0)).toThrow(OutboxNaoProcessavelError);
      expect(evento.tentativas).toBe(0);
    });

    it('deve recusar registrarFalhaPermanente em evento PENDENTE e nunca despachado', () => {
      const evento = novoEvento();
      expect(() => evento.registrarFalhaPermanente('inventada', T0)).toThrow(
        OutboxNaoProcessavelError
      );
      expect(evento.status).toBe(StatusOutbox.PENDENTE);
    });
  });
});
