import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { OcorrenciaRepositoryInMemory } from '../../src/adapters/repositories/ocorrencia.repository.inmemory';
import {
  GravidadeOcorrencia,
  Ocorrencia,
} from '../../src/domain/entities/ocorrencia.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Vistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklistDeOutraVistoriaError } from '../../src/domain/errors/domain-errors';

const T0 = new Date('2026-10-13T12:00:00.000Z');

function vistoriaComItens(id: string, condominioId: string, inspetorId: string): Vistoria {
  const itens = [1, 2].map((n) =>
    ItemChecklist.criar({
      id: `${id}-item-${n}`,
      vistoriaId: id,
      titulo: `Item ${n}`,
      categoria: 'Geral',
    })
  );
  return Vistoria.criar({ id, condominioId, inspetorId, itens, dataCriacao: T0 });
}

/**
 * T-02: os repositórios in-memory estavam sem nenhum teste direto, contra
 * "Adapters: cobertura de mapeamento" de §4.1. O de outbox já tem spec próprio
 * (`outbox.repository.inmemory.spec.ts`); estes cobrem vistoria e ocorrência.
 */
describe('VistoriaRepositoryInMemory (Adapters)', () => {
  let repo: VistoriaRepositoryInMemory;

  beforeEach(() => {
    repo = new VistoriaRepositoryInMemory();
  });

  it('deve salvar e recuperar por id preservando o agregado', async () => {
    const vistoria = vistoriaComItens('vist-1', 'cond-1', 'user-1');
    await repo.salvar(vistoria);

    const salva = await repo.buscarPorId('vist-1');

    expect(salva).not.toBeNull();
    expect(salva?.id).toBe('vist-1');
    expect(salva?.condominioId).toBe('cond-1');
    expect(salva?.inspetorId).toBe('user-1');
    expect(salva?.itens).toHaveLength(2);
    expect(salva?.dataCriacao).toEqual(T0);
  });

  it('deve retornar null para id desconhecido, não lançar', async () => {
    expect(await repo.buscarPorId('nao-existe')).toBeNull();
  });

  it('deve sobrescrever pelo mesmo id, sem duplicar', async () => {
    await repo.salvar(vistoriaComItens('vist-1', 'cond-1', 'user-1'));
    await repo.salvar(vistoriaComItens('vist-1', 'cond-1', 'user-1'));

    expect(await repo.listarPorCondominio('cond-1')).toHaveLength(1);
  });

  it('deve filtrar por condomínio, sem vazar de outros', async () => {
    await repo.salvar(vistoriaComItens('vist-1', 'cond-1', 'user-1'));
    await repo.salvar(vistoriaComItens('vist-2', 'cond-2', 'user-2'));
    await repo.salvar(vistoriaComItens('vist-3', 'cond-1', 'user-1'));

    const doCond1 = await repo.listarPorCondominio('cond-1');

    expect(doCond1.map((v) => v.id).sort()).toEqual(['vist-1', 'vist-3']);
  });

  it('deve devolver lista vazia para condomínio sem vistorias', async () => {
    expect(await repo.listarPorCondominio('cond-inexistente')).toEqual([]);
  });

  it('limpar deve esvaziar o repositório', async () => {
    await repo.salvar(vistoriaComItens('vist-1', 'cond-1', 'user-1'));
    repo.limpar();

    expect(await repo.buscarPorId('vist-1')).toBeNull();
  });

  it('deve recusar vistoria com item de outra vistoria (§4 do agregação)', async () => {
    const alheio = ItemChecklist.criar({
      id: 'item-alheio',
      vistoriaId: 'OUTRA',
      titulo: 'Alheio',
      categoria: 'Geral',
    });

    expect(() =>
      Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        itens: [alheio],
      })
    ).toThrow(ItemChecklistDeOutraVistoriaError);
  });
});

describe('OcorrenciaRepositoryInMemory (Adapters)', () => {
  let repo: OcorrenciaRepositoryInMemory;

  function ocorrencia(id: string, vistoriaId: string): Ocorrencia {
    return Ocorrencia.criar({
      id,
      vistoriaId,
      titulo: `Ocorrência ${id}`,
      gravidade: GravidadeOcorrencia.MEDIA,
      dataCriacao: T0,
    });
  }

  beforeEach(() => {
    repo = new OcorrenciaRepositoryInMemory();
  });

  it('deve salvar e recuperar por id preservando os campos', async () => {
    await repo.salvar(ocorrencia('oc-1', 'vist-1'));

    const salva = await repo.buscarPorId('oc-1');

    expect(salva?.id).toBe('oc-1');
    expect(salva?.vistoriaId).toBe('vist-1');
    expect(salva?.gravidade).toBe(GravidadeOcorrencia.MEDIA);
    expect(salva?.slaHoras).toBe(72);
    expect(salva?.dataCriacao).toEqual(T0);
  });

  it('deve retornar null para id desconhecido', async () => {
    expect(await repo.buscarPorId('nao-existe')).toBeNull();
  });

  it('deve listar por vistoria, sem misturar', async () => {
    await repo.salvar(ocorrencia('oc-1', 'vist-1'));
    await repo.salvar(ocorrencia('oc-2', 'vist-1'));
    await repo.salvar(ocorrencia('oc-3', 'vist-2'));

    const daVistoria = await repo.listarPorVistoria('vist-1');

    expect(daVistoria.map((o) => o.id).sort()).toEqual(['oc-1', 'oc-2']);
  });

  it('listarTodas deve retornar tudo — e a UI sabe que isso vaza entre condomínios', async () => {
    await repo.salvar(ocorrencia('oc-1', 'vist-1'));
    await repo.salvar(ocorrencia('oc-2', 'vist-2'));

    expect(await repo.listarTodas()).toHaveLength(2);
  });

  it('limpar deve esvaziar o repositório', async () => {
    await repo.salvar(ocorrencia('oc-1', 'vist-1'));
    repo.limpar();

    expect(await repo.listarTodas()).toHaveLength(0);
  });

  it('deve preservar a lista de fotos ao salvar', async () => {
    const oc = ocorrencia('oc-1', 'vist-1');
    oc.adicionarFoto('file:///evidencia.jpg');
    await repo.salvar(oc);

    expect((await repo.buscarPorId('oc-1'))?.fotos).toEqual(['file:///evidencia.jpg']);
  });
});
