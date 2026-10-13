import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { CriarVistoriaUseCase } from '../../src/application/use-cases/criar-vistoria.usecase';
import { StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ChecklistVazioError } from '../../src/domain/errors/domain-errors';

describe('CriarVistoriaUseCase', () => {
  let repo: VistoriaRepositoryInMemory;
  let outbox: OutboxRepositoryInMemory;

  const entrada = {
    id: 'vist-100',
    condominioId: 'cond-1',
    inspetorId: 'user-1',
    itens: [
      { id: 'item-1', titulo: 'Extintor Portaria', categoria: 'Incêndio' },
      { id: 'item-2', titulo: 'Bomba Subsolo', categoria: 'Hidráulica' },
    ],
  };

  beforeEach(() => {
    repo = new VistoriaRepositoryInMemory();
    outbox = new OutboxRepositoryInMemory();
  });

  it('deve criar uma nova vistoria em rascunho com os itens do checklist', async () => {
    const useCase = new CriarVistoriaUseCase(repo);
    const resultado = await useCase.executar(entrada);

    expect(resultado.id).toBe('vist-100');
    expect(resultado.status).toBe(StatusVistoria.RASCUNHO);
    expect(resultado.itens).toHaveLength(2);

    const salva = await repo.buscarPorId('vist-100');
    expect(salva?.id).toBe('vist-100');
  });

  it('deve enfileirar na outbox — §1.3 exige que toda escrita passe pela fila', async () => {
    // Sem este enfileiramento a linha `vistorias` nunca chegava ao servidor, e a
    // tabela ficaria vazia lá enquanto os itens de checklist chegavam.
    const useCase = new CriarVistoriaUseCase(repo, outbox);
    await useCase.executar(entrada);

    const pendentes = await outbox.listarTodos();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tabela).toBe('vistorias');
    expect(pendentes[0].operacao).toBe('INSERT');
    expect(pendentes[0].usuarioId).toBe('user-1');
    expect(pendentes[0].payload.condominio_id).toBe('cond-1');
  });

  it('deve recusar checklist vazio em vez de criar vistoria inapta a finalizar', async () => {
    const useCase = new CriarVistoriaUseCase(repo, outbox);

    // Uma vistoria sem itens tem percentualRespondido() === 0 e ficaria
    // permanentemente inapta a finalizar, sem diagnóstico algum.
    await expect(useCase.executar({ ...entrada, itens: [] })).rejects.toThrow(ChecklistVazioError);
    expect(await repo.buscarPorId('vist-100')).toBeNull();
  });

  it('deve recusar itens com id duplicado', async () => {
    const useCase = new CriarVistoriaUseCase(repo, outbox);

    await expect(
      useCase.executar({
        ...entrada,
        itens: [
          { id: 'item-1', titulo: 'A', categoria: 'Geral' },
          { id: 'item-1', titulo: 'B', categoria: 'Geral' },
        ],
      })
    ).rejects.toThrow(ChecklistVazioError);
  });

  it('deve funcionar sem o repositório de outbox informado', async () => {
    const useCase = new CriarVistoriaUseCase(repo);
    await expect(useCase.executar(entrada)).resolves.toBeDefined();
  });
});
