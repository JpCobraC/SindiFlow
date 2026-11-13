/**
 * Testes para SyncGatewaySupabase (FA 3.3)
 *
 * Testa que o gateway envia eventos do outbox para o Supabase,
 * traduzindo erros HTTP para ErroSincronizacao com o sinalizador
 * transitorio correto (C-05: 4xx permanente, 5xx transitório).
 *
 * Mockamos @supabase/supabase-js pois não há ambiente de rede
 * nos testes Jest.
 */
jest.mock('@supabase/supabase-js', () => {
  const mockSingle = jest.fn(async () => ({
    data: null,
    error: null,
  }));
  const mockSelect = jest.fn(() => ({
    single: mockSingle,
  }));
  const mockUpsert = jest.fn(() => ({
    select: mockSelect,
  }));
  const mockFrom = jest.fn(() => ({
    upsert: mockUpsert,
  }));
  return {
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
    __mockSingle: mockSingle,
    __mockSelect: mockSelect,
    __mockUpsert: mockUpsert,
    __mockFrom: mockFrom,
  };
});

import { createClient } from '@supabase/supabase-js';
import { OutboxEvent, StatusOutbox, OperacaoOutbox } from '../../../src/domain/entities/outbox-event.entity';
import { ErroSincronizacao } from '../../../src/domain/errors/domain-errors';
import { SyncGatewaySupabase } from '../../../src/adapters/gateways/sync-gateway.supabase';

const mockCreateClient = createClient as jest.Mock;
const { __mockSingle, __mockUpsert } = require('@supabase/supabase-js');

function criarEventoDeTeste(props?: Partial<{
  id: string;
  tabela: string;
  operacao: OperacaoOutbox;
  idRegistro: string;
  payload: Record<string, unknown>;
  usuarioId: string;
  deviceId: string;
  status: StatusOutbox;
}>): OutboxEvent {
  return OutboxEvent.criar({
    id: props?.id ?? 'out-1',
    tabela: props?.tabela ?? 'vistorias',
    operacao: props?.operacao ?? 'INSERT',
    idRegistro: props?.idRegistro ?? 'vist-1',
    payload: props?.payload ?? { id: 'vist-1', status: 'RASCUNHO' },
    usuarioId: props?.usuarioId ?? 'usr-1',
    deviceId: props?.deviceId ?? 'dev-1',
    status: props?.status ?? StatusOutbox.PENDENTE,
  });
}

describe('SyncGatewaySupabase', () => {
  let gateway: SyncGatewaySupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new SyncGatewaySupabase(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('deve criar o cliente Supabase com URL e anon key', () => {
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('deve enviar evento para o Supabase via upsert', async () => {
    const evento = criarEventoDeTeste({
      tabela: 'vistorias',
      operacao: 'INSERT',
      idRegistro: 'vist-1',
    });

    await gateway.sincronizarItem(evento);

    const mockFrom = mockCreateClient().from;
    expect(mockFrom).toHaveBeenCalledWith('vistorias');
    expect(mockFrom().upsert).toHaveBeenCalled();
  });

  it('deve lançar ErroSincronizacao com transitorio=true em erro 5xx', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-5xx' });
    __mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '500', message: 'Internal Server Error', status: 500 },
    });

    const erro = await gateway.sincronizarItem(evento).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroSincronizacao);
    expect(erro.transitorio).toBe(true);
    expect(erro.statusCode).toBe(500);
  });

  it('deve lançar ErroSincronizacao com transitorio=false em erro 4xx', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-4xx' });
    __mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '403', message: 'Forbidden', status: 403 },
    });

    const erro = await gateway.sincronizarItem(evento).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroSincronizacao);
    expect(erro.transitorio).toBe(false);
    expect(erro.statusCode).toBe(403);
  });

  it('deve resolver com sucesso quando o Supabase retorna 200', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-sucesso' });
    __mockSingle.mockResolvedValueOnce({
      data: { id: 'vist-sucesso' },
      error: null,
    });

    await expect(gateway.sincronizarItem(evento)).resolves.toBeUndefined();
  });
});
