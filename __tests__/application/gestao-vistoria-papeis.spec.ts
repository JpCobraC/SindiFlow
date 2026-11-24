import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { AprovarVistoriaUseCase } from '../../src/application/use-cases/aprovar-vistoria.usecase';
import { DevolverVistoriaUseCase } from '../../src/application/use-cases/devolver-vistoria.usecase';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('Gestão de Vistoria (Síndico / Condômino)', () => {
  it('deve aprovar vistoria finalizada e registrar evento outbox', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();

    const vistoria = Vistoria.reidratar({
      id: 'vist-001',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      status: StatusVistoria.FINALIZADA,
      geolocalizacao: Geolocalizacao.criar({ latitude: -23.5, longitude: -46.6 }),
      dataFinalizacao: new Date(),
    });
    await vistoriaRepo.salvar(vistoria);

    const aprovarUseCase = new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo);
    const resultado = await aprovarUseCase.executar({
      vistoriaId: 'vist-001',
      aprovadorId: 'sindico-carlos',
      parecerTecnico: 'Laudo pericial aprovado de acordo com a NBR 5674.',
      deviceId: 'dev-1',
    });

    expect(resultado.status).toBe(StatusVistoria.APROVADA);
    expect(resultado.parecerTecnico).toBe('Laudo pericial aprovado de acordo com a NBR 5674.');
    expect(resultado.aprovadoPor).toBe('sindico-carlos');

    const outbox = await outboxRepo.obterPendentes();
    expect(outbox.length).toBe(1);
    expect(outbox[0].payload.status).toBe(StatusVistoria.APROVADA);
    expect(outbox[0].payload.aprovado_por).toBe('sindico-carlos');
  });

  it('deve devolver vistoria para revisão com motivo obrigatório', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const outboxRepo = new OutboxRepositoryInMemory();

    const vistoria = Vistoria.reidratar({
      id: 'vist-002',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      status: StatusVistoria.FINALIZADA,
      geolocalizacao: Geolocalizacao.criar({ latitude: -23.5, longitude: -46.6 }),
      dataFinalizacao: new Date(),
    });
    await vistoriaRepo.salvar(vistoria);

    const devolverUseCase = new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo);
    const resultado = await devolverUseCase.executar({
      vistoriaId: 'vist-002',
      solicitanteId: 'sindico-carlos',
      motivo: 'Faltou foto detalhada do barrilete.',
      deviceId: 'dev-1',
    });

    expect(resultado.status).toBe(StatusVistoria.DEVOLVIDA);
    expect(resultado.motivoDevolucao).toBe('Faltou foto detalhada do barrilete.');

    const outbox = await outboxRepo.obterPendentes();
    expect(outbox.length).toBe(1);
    expect(outbox[0].payload.status).toBe(StatusVistoria.DEVOLVIDA);
    expect(outbox[0].payload.motivo_devolucao).toBe('Faltou foto detalhada do barrilete.');
  });
});