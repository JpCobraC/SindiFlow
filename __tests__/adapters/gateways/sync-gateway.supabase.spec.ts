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
const mockIn = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq, in: mockIn }));
const mockFrom = jest.fn(() => ({ upsert: mockUpsert, select: mockSelect }));

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

  it('usa onConflict email para sincronizar tabela users', async () => {
    const evento = criarEventoDeTeste({
      tabela: 'users',
      operacao: 'INSERT',
      idRegistro: 'uuid-user-1',
      payload: {
        id: 'uuid-user-1',
        nome: 'Dr. Carlos',
        email: 'sindico@solar.com',
        role: 'SINDICO',
        condominio_id: 'cond-solar-palmeiras',
      },
    });

    await gateway.sincronizarItem(evento);

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockUpsert).toHaveBeenCalledWith(evento.payload, { onConflict: 'email' });
  });

  describe('buscarSnapshotCondominio', () => {
    it('busca vistorias, comunicados, itens, ocorrências e fotos do condomínio', async () => {
      mockLimit
        .mockResolvedValueOnce({
          data: [{ id: 'vist-1', condominio_id: 'cond-1', inspetor_id: 'insp-1', status: 'FINALIZADA', data_criacao: '2026-11-24T10:00:00Z' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'com-1', condominio_id: 'cond-1', autor_id: 'sin-1', autor_nome: 'Síndico', titulo: 'Aviso', conteudo: 'Texto', data_criacao: '2026-11-24T10:00:00Z', fixado: false }],
          error: null,
        });

      mockIn
        .mockResolvedValueOnce({
          data: [{ id: 'item-1', vistoria_id: 'vist-1', titulo: 'Extintor', categoria: 'Segurança', status: 'OK' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'oc-1', vistoria_id: 'vist-1', titulo: 'Vazamento', gravidade: 'MEDIA', status: 'ABERTA', data_criacao: '2026-11-24T10:00:00Z' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'foto-1', item_id: 'item-1', caminho_arquivo: 'file:///foto1.jpg', hash: 'h1', data_captura: '2026-11-24T10:00:00Z' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'foto-2', ocorrencia_id: 'oc-1', caminho_arquivo: 'file:///foto2.jpg', hash: 'h2', data_captura: '2026-11-24T10:00:00Z' }],
          error: null,
        });

      const snapshot = await gateway.buscarSnapshotCondominio('cond-1');

      expect(snapshot.vistorias).toHaveLength(1);
      expect(snapshot.comunicados).toHaveLength(1);
      expect(snapshot.itensChecklist).toHaveLength(1);
      expect(snapshot.ocorrencias).toHaveLength(1);
      expect(snapshot.fotosEvidencia).toHaveLength(2);
    });

    it('não consulta tabelas filhas quando não há vistorias remotas', async () => {
      mockLimit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const snapshot = await gateway.buscarSnapshotCondominio('cond-vazio');

      expect(snapshot.vistorias).toEqual([]);
      expect(snapshot.itensChecklist).toEqual([]);
      expect(snapshot.ocorrencias).toEqual([]);
      expect(mockIn).not.toHaveBeenCalled();
    });

    it('traduz erro do Supabase ao consultar snapshot', async () => {
      mockLimit
        .mockResolvedValueOnce({
          data: null,
          error: { code: '503', message: 'Service Unavailable', status: 503 },
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const erro = await gateway.buscarSnapshotCondominio('cond-1').catch((e) => e);
      expect(erro).toBeInstanceOf(ErroSincronizacao);
      expect(erro.transitorio).toBe(true);
      expect(erro.statusCode).toBe(503);
    });
  });
});
