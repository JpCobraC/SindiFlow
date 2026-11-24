import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { DevolverVistoriaUseCase } from '../../src/application/use-cases/devolver-vistoria.usecase';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('DevolverVistoriaUseCase', () => {
  function criarVistoriaFinalizada(id = 'v-1'): Vistoria {
    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: id, titulo: 'Extintor', categoria: 'Incêndio' });
    item.marcarStatus(StatusItemChecklist.OK);
    const vistoria = Vistoria.criar({ id, condominioId: 'cond-1', inspetorId: 'user-123', itens: [item] });
    vistoria.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    return vistoria;
  }

  it('deve devolver vistoria finalizada e registrar evento no Outbox', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo);

    await vistoriaRepo.salvar(criarVistoriaFinalizada());

    const resultado = await useCase.executar({
      vistoriaId: 'v-1',
      solicitanteId: 'sindico-1',
      motivo: 'Faltam fotos dos extintores',
      deviceId: 'device-abc-123',
    });

    expect(resultado.status).toBe(StatusVistoria.DEVOLVIDA);
    expect(resultado.motivoDevolucao).toBe('Faltam fotos dos extintores');

    const pendentes = await outboxRepo.obterPendentes();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tabela).toBe('vistorias');
    expect(pendentes[0].operacao).toBe('UPDATE');
    expect(pendentes[0].usuarioId).toBe('sindico-1');
    expect(pendentes[0].deviceId).toBe('device-abc-123');
    expect(pendentes[0].payload.id).toBe('v-1');
    expect(pendentes[0].payload.status).toBe('DEVOLVIDA');
    expect(pendentes[0].payload.devolvido_por).toBe('sindico-1');
    expect(pendentes[0].payload.motivo_devolucao).toBe('Faltam fotos dos extintores');
  });

  it('deve rejeitar quando a vistoria não existe', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo);

    await expect(
      useCase.executar({ vistoriaId: 'v-inexistente', solicitanteId: 'sindico-1', motivo: 'motivo', deviceId: 'device-abc-123' })
    ).rejects.toThrow('Vistoria v-inexistente não encontrada');

    expect(await outboxRepo.obterPendentes()).toHaveLength(0);
  });

  it('deve rejeitar vistoria não finalizada (RF16)', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo);

    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    const vistoria = Vistoria.criar({ id: 'v-1', condominioId: 'cond-1', inspetorId: 'user-123', itens: [item] });
    await vistoriaRepo.salvar(vistoria);

    await expect(
      useCase.executar({ vistoriaId: 'v-1', solicitanteId: 'sindico-1', motivo: 'motivo', deviceId: 'device-abc-123' })
    ).rejects.toThrow('Apenas vistorias finalizadas');

    expect(await outboxRepo.obterPendentes()).toHaveLength(0);
  });

  it('deve rejeitar motivo vazio', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();
    const useCase = new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo);

    await vistoriaRepo.salvar(criarVistoriaFinalizada());

    await expect(
      useCase.executar({ vistoriaId: 'v-1', solicitanteId: 'sindico-1', motivo: '   ', deviceId: 'device-abc-123' })
    ).rejects.toThrow('Motivo da devolução é obrigatório');

    expect(await outboxRepo.obterPendentes()).toHaveLength(0);
  });
});
