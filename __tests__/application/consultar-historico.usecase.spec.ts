import { ConsultarHistoricoUseCase } from '../../src/application/use-cases/consultar-historico.usecase';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { OcorrenciaRepositoryInMemory } from '../../src/adapters/repositories/ocorrencia.repository.inmemory';
import { Vistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Ocorrencia, GravidadeOcorrencia } from '../../src/domain/entities/ocorrencia.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('ConsultarHistoricoUseCase', () => {
  it('deve retornar métricas vazias quando não há vistorias', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    const useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);

    const resultado = await useCase.executar('cond-1');

    expect(resultado.totalVistorias).toBe(0);
    expect(resultado.vistoriasFinalizadas).toBe(0);
    expect(resultado.vistoriasEmAndamento).toBe(0);
    expect(resultado.totalOcorrencias).toBe(0);
    expect(resultado.ocorrenciasCriticas).toBe(0);
    expect(resultado.taxaConformidade).toBe(100);
    expect(resultado.vistorias).toEqual([]);
  });

  it('deve agregar vistorias por status e itens avaliados', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    const useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);

    const itemOk = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    itemOk.marcarStatus(StatusItemChecklist.OK);
    const itemCritico = ItemChecklist.criar({ id: 'i-2', vistoriaId: 'v-1', titulo: 'QGBT', categoria: 'Elétrica' });
    itemCritico.marcarStatus(StatusItemChecklist.CRITICO, 'Lacre violado');

    const vistoriaFinalizada = Vistoria.criar({ id: 'v-1', condominioId: 'cond-1', inspetorId: 'user-1', itens: [itemOk, itemCritico] });
    vistoriaFinalizada.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    await vistoriaRepo.salvar(vistoriaFinalizada);

    const itemPendente = ItemChecklist.criar({ id: 'i-3', vistoriaId: 'v-2', titulo: 'Bomba', categoria: 'Hidráulica' });
    const vistoriaRascunho = Vistoria.criar({ id: 'v-2', condominioId: 'cond-1', inspetorId: 'user-1', itens: [itemPendente] });
    await vistoriaRepo.salvar(vistoriaRascunho);

    const resultado = await useCase.executar('cond-1');

    expect(resultado.totalVistorias).toBe(2);
    expect(resultado.vistoriasFinalizadas).toBe(1);
    expect(resultado.vistoriasEmAndamento).toBe(1);
    expect(resultado.taxaConformidade).toBe(50); // 1 OK de 2 avaliados
  });

  it('deve contar ocorrências críticas', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    const useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);

    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    const vistoria = Vistoria.criar({ id: 'v-1', condominioId: 'cond-1', inspetorId: 'user-1', itens: [item] });
    await vistoriaRepo.salvar(vistoria);

    await ocorrenciaRepo.salvar(Ocorrencia.criar({ id: 'oc-1', vistoriaId: 'v-1', titulo: 'Fissura', gravidade: GravidadeOcorrencia.ALTA, fotos: ['file:///foto.jpg'] }));
    await ocorrenciaRepo.salvar(Ocorrencia.criar({ id: 'oc-2', vistoriaId: 'v-1', titulo: 'Pintura', gravidade: GravidadeOcorrencia.BAIXA }));

    const resultado = await useCase.executar('cond-1');

    expect(resultado.totalOcorrencias).toBe(2);
    expect(resultado.ocorrenciasCriticas).toBe(1);
  });

  it('deve ignorar vistorias de outro condomínio', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    const useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);

    const item = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    const vistoria = Vistoria.criar({ id: 'v-1', condominioId: 'cond-2', inspetorId: 'user-1', itens: [item] });
    await vistoriaRepo.salvar(vistoria);

    const resultado = await useCase.executar('cond-1');

    expect(resultado.totalVistorias).toBe(0);
  });

  it('deve ignorar ocorrências de vistorias de outro condomínio', async () => {
    const vistoriaRepo = new VistoriaRepositoryInMemory();
    const ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    const useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);

    const item1 = ItemChecklist.criar({ id: 'i-1', vistoriaId: 'v-1', titulo: 'Extintor', categoria: 'Incêndio' });
    const vistoria1 = Vistoria.criar({ id: 'v-1', condominioId: 'cond-1', inspetorId: 'user-1', itens: [item1] });
    await vistoriaRepo.salvar(vistoria1);

    const item2 = ItemChecklist.criar({ id: 'i-2', vistoriaId: 'v-2', titulo: 'Bomba', categoria: 'Hidráulica' });
    const vistoria2 = Vistoria.criar({ id: 'v-2', condominioId: 'cond-2', inspetorId: 'user-1', itens: [item2] });
    await vistoriaRepo.salvar(vistoria2);

    await ocorrenciaRepo.salvar(Ocorrencia.criar({ id: 'oc-1', vistoriaId: 'v-1', titulo: 'Ocorrência cond-1', gravidade: GravidadeOcorrencia.BAIXA }));
    await ocorrenciaRepo.salvar(Ocorrencia.criar({ id: 'oc-2', vistoriaId: 'v-2', titulo: 'Ocorrência cond-2', gravidade: GravidadeOcorrencia.ALTA, fotos: ['file:///f.jpg'] }));

    const resultado = await useCase.executar('cond-1');

    expect(resultado.totalOcorrencias).toBe(1);
    expect(resultado.ocorrenciasCriticas).toBe(0);
  });
});
