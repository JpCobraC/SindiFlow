import { OutboxEvent, StatusOutbox } from '../../src/domain/entities/outbox-event.entity';

describe('OutboxEvent Entity (Domínio)', () => {
  const agora = new Date('2026-10-02T12:00:00.000Z');

  it('deve criar um evento de outbox com status inicial PENDENTE e tentativa 0', () => {
    const evento = OutboxEvent.criar({
      id: 'out-1',
      tipo: 'VISTORIA_CRIADA',
      payload: { vistoriaId: 'v-1', titulo: 'Vistoria Garagem' },
      dataCriacao: agora,
    });

    expect(evento.id).toBe('out-1');
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    expect(evento.tentativas).toBe(0);
    expect(evento.proximoRetryMs).toBe(1000); // 1s inicial
  });

  it('deve calcular backoff exponencial correto a cada falha de envio (1s, 2s, 4s, 8s...)', () => {
    const evento = OutboxEvent.criar({
      id: 'out-2',
      tipo: 'OCORRENCIA_REGISTRADA',
      payload: { ocorrenciaId: 'oc-1' },
      dataCriacao: agora,
    });

    // 1ª falha -> tentativas = 1, proximoRetry = 2s (2^1 * 1000)
    evento.registrarFalha('Sem conexão com Supabase');
    expect(evento.tentativas).toBe(1);
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    expect(evento.ultimoErro).toBe('Sem conexão com Supabase');
    expect(evento.proximoRetryMs).toBe(2000);

    // 2ª falha -> tentativas = 2, proximoRetry = 4s (2^2 * 1000)
    evento.registrarFalha('Timeout 504');
    expect(evento.tentativas).toBe(2);
    expect(evento.proximoRetryMs).toBe(4000);

    // 3ª falha -> tentativas = 3, proximoRetry = 8s (2^3 * 1000)
    evento.registrarFalha('Network unreachable');
    expect(evento.tentativas).toBe(3);
    expect(evento.proximoRetryMs).toBe(8000);
  });

  it('deve marcar status como FALHA_MAXIMA se atingir 5 tentativas', () => {
    const evento = OutboxEvent.criar({
      id: 'out-3',
      tipo: 'VISTORIA_FINALIZADA',
      payload: { vistoriaId: 'v-1' },
      dataCriacao: agora,
      maxTentativas: 5,
    });

    for (let i = 0; i < 4; i++) {
      evento.registrarFalha(`Falha ${i + 1}`);
      expect(evento.status).toBe(StatusOutbox.PENDENTE);
    }

    evento.registrarFalha('Falha 5');
    expect(evento.tentativas).toBe(5);
    expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
  });

  it('deve marcar como SINCRONIZADO ao registrar sucesso', () => {
    const evento = OutboxEvent.criar({
      id: 'out-4',
      tipo: 'VISTORIA_FINALIZADA',
      payload: { vistoriaId: 'v-1' },
      dataCriacao: agora,
    });

    const dataSync = new Date('2026-10-02T12:05:00.000Z');
    evento.marcarSincronizado(dataSync);

    expect(evento.status).toBe(StatusOutbox.SINCRONIZADO);
    expect(evento.dataSincronizacao).toEqual(dataSync);
    expect(evento.ultimoErro).toBeUndefined();
  });
});
