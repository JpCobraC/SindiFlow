import { FinalizarVistoriaUseCase } from '../../src/application/use-cases/finalizar-vistoria.usecase';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { Vistoria, StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';

describe('FinalizarVistoriaUseCase', () => {
  it('deve finalizar vistoria válida e registrar evento no Outbox para sync', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new FinalizarVistoriaUseCase(vistoriaRepo, outboxRepo);

    const item1 = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    item1.marcarStatus(StatusItemChecklist.OK);

    const vistoria = Vistoria.criar({
      id: 'v-1',
      condominioId: 'cond-1',
      inspetorId: 'user-123',
      itens: [item1],
    });

    await vistoriaRepo.salvar(vistoria);

    const resultado = await useCase.executar({
      vistoriaId: 'v-1',
      latitude: -23.55052,
      longitude: -46.633308,
      deviceId: 'device-abc-123',
    });

    expect(resultado.status).toBe(StatusVistoria.FINALIZADA);
    expect(resultado.geolocalizacao).toBeDefined();

    const pendentes = await outboxRepo.obterPendentes();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tabela).toBe('vistorias');
    expect(pendentes[0].operacao).toBe('UPDATE');
    expect(pendentes[0].usuarioId).toBe('user-123');
    expect(pendentes[0].deviceId).toBe('device-abc-123');
  });
});
