import { AprovarVistoriaUseCase } from '../../src/application/use-cases/aprovar-vistoria.usecase';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { Vistoria, StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('AprovarVistoriaUseCase', () => {
  function criarVistoriaFinalizada(id = 'v-1'): Vistoria {
    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: id, titulo: 'Extintor', categoria: 'Incêndio' });
    item.marcarStatus(StatusItemChecklist.OK);
    const vistoria = Vistoria.criar({ id, condominioId: 'cond-1', inspetorId: 'user-123', itens: [item] });
    vistoria.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    return vistoria;
  }

  it('deve aprovar vistoria finalizada e registrar evento no Outbox', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo);

    const vistoria = criarVistoriaFinalizada();
    await vistoriaRepo.salvar(vistoria);

    const resultado = await useCase.executar({
      vistoriaId: 'v-1',
      aprovadorId: 'sindico-1',
      parecerTecnico: 'Laudo aprovado',
      deviceId: 'device-abc-123',
    });

    expect(resultado.status).toBe(StatusVistoria.APROVADA);
    expect(resultado.aprovadoPor).toBe('sindico-1');
    expect(resultado.parecerTecnico).toBe('Laudo aprovado');
    expect(resultado.dataAprovacao).toBeDefined();

    const pendentes = await outboxRepo.obterPendentes();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tabela).toBe('vistorias');
    expect(pendentes[0].operacao).toBe('UPDATE');
    expect(pendentes[0].usuarioId).toBe('sindico-1');
    expect(pendentes[0].deviceId).toBe('device-abc-123');
    expect(pendentes[0].payload.tipo).toBe('VISTORIA_APROVADA');
    expect(pendentes[0].payload.aprovador_id).toBe('sindico-1');
    expect(pendentes[0].payload.parecer_tecnico).toBe('Laudo aprovado');
  });

  it('deve rejeitar quando a vistoria não existe', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo);

    await expect(
      useCase.executar({ vistoriaId: 'v-inexistente', aprovadorId: 'sindico-1', deviceId: 'device-abc-123' })
    ).rejects.toThrow('Vistoria v-inexistente não encontrada');

    expect(await outboxRepo.obterPendentes()).toHaveLength(0);
  });

  it('deve rejeitar vistoria não finalizada (RF16)', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo);

    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    const vistoria = Vistoria.criar({ id: 'v-1', condominioId: 'cond-1', inspetorId: 'user-123', itens: [item] });
    await vistoriaRepo.salvar(vistoria);

    await expect(
      useCase.executar({ vistoriaId: 'v-1', aprovadorId: 'sindico-1', deviceId: 'device-abc-123' })
    ).rejects.toThrow('Apenas vistorias finalizadas');

    expect(await outboxRepo.obterPendentes()).toHaveLength(0);
  });

  it('deve usar parecer padrão quando não informado', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo);

    await vistoriaRepo.salvar(criarVistoriaFinalizada());

    const resultado = await useCase.executar({
      vistoriaId: 'v-1',
      aprovadorId: 'sindico-1',
      deviceId: 'device-abc-123',
    });

    expect(resultado.status).toBe(StatusVistoria.APROVADA);
    const pendentes = await outboxRepo.obterPendentes();
    expect(pendentes[0].payload.parecerTecnico).toBeUndefined();
  });
});
