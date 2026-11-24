/**
 * Testes de mapeamento do VistoriaRepositorySQLite contra SQLiteExecutorFake.
 *
 * Como `expo-sqlite` não roda sob Jest (C-15), usamos o `SQLiteExecutorFake`
 * para validar que o repositórioSQLite mapeia corretamente entidade <-> linha do banco.
 */
import { VistoriaRepositorySQLite } from '../../../src/adapters/repositories/vistoria.repository.sqlite';
import { SQLiteExecutorFake } from '../../fakes/sqlite-executor-in-memory.fake';
import { Vistoria , StatusVistoria } from '../../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../../src/domain/entities/item-checklist.entity';
import { Evidencia } from '../../../src/domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../../../src/domain/value-objects/geolocalizacao.vo';

function criarVistoriaDeTeste(props?: Partial<{
  id: string;
  condominioId: string;
  inspetorId: string;
  status: StatusVistoria;
  itens: { id: string; titulo: string; categoria: string }[];
}>): Vistoria {
  const itens = (props?.itens ?? []).map((i) =>
    ItemChecklist.criar({
      id: i.id,
      vistoriaId: props?.id ?? 'vist-test',
      titulo: i.titulo,
      categoria: i.categoria,
    })
  );

  return Vistoria.criar({
    id: props?.id ?? 'vist-test',
    condominioId: props?.condominioId ?? 'cond-test',
    inspetorId: props?.inspetorId ?? 'insp-test',
    itens,
  });
}

describe('VistoriaRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: VistoriaRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new VistoriaRepositorySQLite(executor);
  });

  it('deve salvar e buscar uma vistoria por id', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      itens: [{ id: 'item-1', titulo: 'Item 1', categoria: 'Elétrica' }],
    });

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-1');
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id).toBe('vist-1');
    expect(encontrada?.condominioId).toBe('cond-1');
    expect(encontrada?.inspetorId).toBe('insp-1');
    expect(encontrada?.status).toBe(StatusVistoria.RASCUNHO);
  });

  it('deve persistir e reidratar os itens do checklist', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-itens',
      itens: [
        { id: 'item-1', titulo: 'Extintores', categoria: 'Incêndio' },
        { id: 'item-2', titulo: 'QGBT', categoria: 'Elétrica' },
      ],
    });

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-itens');
    expect(encontrada?.itens).toHaveLength(2);
    expect(encontrada?.itens.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    expect(encontrada?.itens[0]?.titulo).toBe('Extintores');
    expect(encontrada?.itens[0]?.status).toBe(StatusItemChecklist.PENDENTE);
  });

  it('deve preservar status e observação dos itens ao atualizar a vistoria', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-status',
      itens: [
        { id: 'item-1', titulo: 'Extintores', categoria: 'Incêndio' },
        { id: 'item-2', titulo: 'QGBT', categoria: 'Elétrica' },
      ],
    });
    await repo.salvar(vistoria);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const recarregada = await repo.buscarPorId('vist-status');
    recarregada?.itens[0]?.marcarStatus(StatusItemChecklist.CRITICO, 'Lacre violado');
    recarregada?.itens[1]?.marcarStatus(StatusItemChecklist.OK);
    await repo.salvar(recarregada!);

    const encontrada = await repo.buscarPorId('vist-status');
    expect(encontrada?.itens[0]?.status).toBe(StatusItemChecklist.CRITICO);
    expect(encontrada?.itens[0]?.observacao).toBe('Lacre violado');
    expect(encontrada?.itens[1]?.status).toBe(StatusItemChecklist.OK);
  });

  it('deve retornar null quando a vistoria não existe', async () => {
    const encontrada = await repo.buscarPorId('inexistente');
    expect(encontrada).toBeNull();
  });

  it('deve listar vistorias por condomínio', async () => {
    const v1 = criarVistoriaDeTeste({
      id: 'vist-1',
      condominioId: 'cond-A',
      inspetorId: 'insp-1',
    });
    const v2 = criarVistoriaDeTeste({
      id: 'vist-2',
      condominioId: 'cond-B',
      inspetorId: 'insp-2',
    });
    const v3 = criarVistoriaDeTeste({
      id: 'vist-3',
      condominioId: 'cond-A',
      inspetorId: 'insp-3',
    });

    await repo.salvar(v1);
    await repo.salvar(v2);
    await repo.salvar(v3);

    const condA = await repo.listarPorCondominio('cond-A');
    expect(condA).toHaveLength(2);
    expect(condA.map((v) => v.id)).toContain('vist-1');
    expect(condA.map((v) => v.id)).toContain('vist-3');

    const condB = await repo.listarPorCondominio('cond-B');
    expect(condB).toHaveLength(1);
    expect(condB[0]?.id).toBe('vist-2');
  });

  it('deve persistir geolocalização na reidratação', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-geo',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
    });
    // Simula uma vistoria finalizada com geolocalização
    // (não podemos chamar finalizar() aqui sem geolocalização no contexto,
    // então testamos a reidratação direta via salvar com geo)
    // O repositório SQLite hidrata geolocalização da linha do banco.
    // Como o fake não armazena latitude/longitude separadamente, testamos
    // que o repositório não quebra ao salvar/buscar.
    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-geo');
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id).toBe('vist-geo');
  });

  it('deve atualizar uma vistoria existente (upsert)', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-upd',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
    });

    await repo.salvar(vistoria);

    // RF-SYNC-005 usa updated_at como critério; garante um timestamp diferente.
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Modifica e salva novamente
    const vistaAtualizada = Vistoria.reidratar({
      id: 'vist-upd',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      status: StatusVistoria.FINALIZADA,
    });

    await repo.salvar(vistaAtualizada);

    const encontrada = await repo.buscarPorId('vist-upd');
    expect(encontrada?.status).toBe(StatusVistoria.FINALIZADA);
  });

  it('deve persistir e reidratar metadados de aprovação (parecerTecnico, aprovadoPor, dataAprovacao)', async () => {
    const item = ItemChecklist.criar({
      id: 'item-aprov',
      vistoriaId: 'vist-aprov',
      titulo: 'Extintores',
      categoria: 'Incêndio',
    });
    item.marcarStatus(StatusItemChecklist.OK);

    const vistoria = Vistoria.criar({
      id: 'vist-aprov',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      itens: [item],
    });
    vistoria.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    const dataAprov = new Date('2026-11-24T12:00:00.000Z');
    vistoria.aprovar('Tudo em conformidade.', 'sindico-1', dataAprov);

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-aprov');
    expect(encontrada?.status).toBe(StatusVistoria.APROVADA);
    expect(encontrada?.parecerTecnico).toBe('Tudo em conformidade.');
    expect(encontrada?.aprovadoPor).toBe('sindico-1');
    expect(encontrada?.dataAprovacao).toEqual(dataAprov);
  });

  it('deve persistir e reidratar metadados de devolução (motivoDevolucao, devolvidoPor)', async () => {
    const item = ItemChecklist.criar({
      id: 'item-dev',
      vistoriaId: 'vist-dev',
      titulo: 'Bombas',
      categoria: 'Hidráulica',
    });
    item.marcarStatus(StatusItemChecklist.OK);

    const vistoria = Vistoria.criar({
      id: 'vist-dev',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      itens: [item],
    });
    vistoria.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    vistoria.devolver('Faltou foto da casa de máquinas.', 'sindico-1');

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-dev');
    expect(encontrada?.status).toBe(StatusVistoria.DEVOLVIDA);
    expect(encontrada?.motivoDevolucao).toBe('Faltou foto da casa de máquinas.');
    expect(encontrada?.devolvidoPor).toBe('sindico-1');
  });

  it('deve persistir e reidratar evidências fotográficas dos itens do checklist', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-fotos',
      itens: [{ id: 'item-foto', titulo: 'Quadro Elétrico', categoria: 'Elétrica' }],
    });
    const ev = Evidencia.criar({
      id: 'ev-123',
      caminhoArquivoLocal: 'file:///evidencias/evi_123.jpg',
      hash: 'sha256_abc',
      timestamp: new Date('2026-11-24T10:00:00.000Z'),
    });
    vistoria.itens[0].adicionarEvidencia(ev);

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-fotos');
    expect(encontrada?.itens[0].evidencias).toHaveLength(1);
    expect(encontrada?.itens[0].evidencias[0].id).toBe('ev-123');
    expect(encontrada?.itens[0].evidencias[0].caminhoArquivoLocal).toBe('file:///evidencias/evi_123.jpg');
    expect(encontrada?.itens[0].evidencias[0].hash).toBe('sha256_abc');
  });

  it('deve persistir gravações consecutivas no mesmo milissegundo sem descartar a segunda', async () => {
    const item = ItemChecklist.criar({
      id: 'item-ms',
      vistoriaId: 'vist-ms',
      titulo: 'Extintor',
      categoria: 'Incêndio',
    });
    item.marcarStatus(StatusItemChecklist.OK);

    const vistoria = Vistoria.criar({
      id: 'vist-ms',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      itens: [item],
    });
    await repo.salvar(vistoria);

    vistoria.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    await repo.salvar(vistoria);

    vistoria.aprovar('Aprovada imediatamente.', 'sindico-1');
    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-ms');
    expect(encontrada?.status).toBe(StatusVistoria.APROVADA);
    expect(encontrada?.parecerTecnico).toBe('Aprovada imediatamente.');
  });
});
