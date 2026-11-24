/**
 * Testes para SyncGatewaySupabase (FA 3.3)
 *
 * O gateway recebe o mesmo cliente Supabase autenticado usado pelo auth;
 * aqui ele é substituído por um duplo com `from().upsert()`.
 * C-05: 4xx permanente, 5xx transitório.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OutboxEvent,
  StatusOutbox,
  OperacaoOutbox,
} from '../../../src/domain/entities/outbox-event.entity';
import { ErroSincronizacao } from '../../../src/domain/errors/domain-errors';
import { SyncGatewaySupabase } from '../../../src/adapters/gateways/sync-gateway.supabase';

const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

const clienteFake = { from: mockFrom } as unknown as SupabaseClient;

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
    mockUpsert.mockResolvedValue({ data: null, error: null });
    gateway = new SyncGatewaySupabase(clienteFake);
  });

  it('envia evento para o Supabase via upsert', async () => {
    const evento = criarEventoDeTeste({
      tabela: 'vistorias',
      operacao: 'INSERT',
      idRegistro: 'vist-1',
    });

    await gateway.sincronizarItem(evento);

    expect(mockFrom).toHaveBeenCalledWith('vistorias');
    expect(mockUpsert).toHaveBeenCalledWith(evento.payload, {
      onConflict: 'id',
    });
  });

  it('lança ErroSincronizacao com transitorio=true em erro 5xx', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-5xx' });
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { code: '500', message: 'Internal Server Error', status: 500 },
    });

    const erro = await gateway.sincronizarItem(evento).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroSincronizacao);
    expect(erro.transitorio).toBe(true);
    expect(erro.statusCode).toBe(500);
  });

  it('lança ErroSincronizacao com transitorio=false em erro 4xx', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-4xx' });
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { code: '403', message: 'Forbidden', status: 403 },
    });

    const erro = await gateway.sincronizarItem(evento).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroSincronizacao);
    expect(erro.transitorio).toBe(false);
    expect(erro.statusCode).toBe(403);
  });

  it('lança ErroSincronizacao transitório quando o SDK rejeita sem status', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-rede' });
    mockUpsert.mockRejectedValueOnce(new Error('Network request failed'));

    const erro = await gateway.sincronizarItem(evento).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroSincronizacao);
    expect(erro.transitorio).toBe(true);
  });

  it('resolve com sucesso quando o Supabase retorna 200', async () => {
    const evento = criarEventoDeTeste({ idRegistro: 'vist-sucesso' });
    mockUpsert.mockResolvedValueOnce({
      data: { id: 'vist-sucesso' },
      error: null,
    });

    await expect(gateway.sincronizarItem(evento)).resolves.toBeUndefined();
  });

  it('normaliza tabela legada item_checklist e campos legados antes do upsert', async () => {
    const evento = criarEventoDeTeste({
      tabela: 'item_checklist',
      operacao: 'UPDATE',
      idRegistro: 'item-1',
      payload: {
        id: 'item-1',
        vistoria_id: 'vist-1',
        status: 'OK',
        percentual_vistoria: 50,
      },
    });

    await gateway.sincronizarItem(evento);

    expect(mockFrom).toHaveBeenCalledWith('itens_checklist');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'item-1',
        vistoria_id: 'vist-1',
        status: 'OK',
      },
      { onConflict: 'id' }
    );
  });

  it('normaliza payload legado de aprovação/devolução de vistoria', async () => {
    const evento = criarEventoDeTeste({
      tabela: 'vistorias',
      operacao: 'UPDATE',
      idRegistro: 'vist-legado',
      payload: {
        tipo: 'VISTORIA_APROVADA',
        vistoria_id: 'vist-legado',
        aprovador_id: 'sindico-1',
        parecer_tecnico: 'Ok',
      },
    });

    await gateway.sincronizarItem(evento);

    expect(mockFrom).toHaveBeenCalledWith('vistorias');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'vist-legado',
        status: 'APROVADA',
        aprovado_por: 'sindico-1',
        parecer_tecnico: 'Ok',
      },
      { onConflict: 'id' }
    );
  });
});
