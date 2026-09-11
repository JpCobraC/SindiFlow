import { CriarVistoriaUseCase } from '../../src/application/use-cases/criar-vistoria.usecase';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { StatusVistoria } from '../../src/domain/entities/vistoria.entity';

describe('CriarVistoriaUseCase', () => {
  it('deve criar uma nova vistoria em rascunho com os itens do checklist', async () => {
    const repo = new VistoriaRepositoryInMemory();
    const useCase = new CriarVistoriaUseCase(repo);

    const vistoria = async () =>
      useCase.executar({
        id: 'vist-100',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        itens: [
          { id: 'item-1', titulo: 'Extintor Portaria', categoria: 'Incêndio' },
          { id: 'item-2', titulo: 'Bomba Subsolo', categoria: 'Hidráulica' },
        ],
      });

    const resultado = await vistoria();

    expect(resultado.id).toBe('vist-100');
    expect(resultado.status).toBe(StatusVistoria.RASCUNHO);
    expect(resultado.itens).toHaveLength(2);

    const salva = await repo.buscarPorId('vist-100');
    expect(salva).not.toBeNull();
    expect(salva?.id).toBe('vist-100');
  });
});
