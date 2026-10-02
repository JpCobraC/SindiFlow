import { ConsultarHistoricoUseCase } from '../../src/application/use-cases/consultar-historico.usecase';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { GravidadeOcorrencia, Ocorrencia } from '../../src/domain/entities/ocorrencia.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { IOcorrenciaRepository } from '../../src/domain/interfaces/ocorrencia.repository.interface';
import { IVistoriaRepository } from '../../src/domain/interfaces/vistoria.repository.interface';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

class FakeVistoriaRepository implements IVistoriaRepository {
  public vistorias: Vistoria[] = [];

  async salvar(vistoria: Vistoria): Promise<void> {
    this.vistorias.push(vistoria);
  }
  async buscarPorId(id: string): Promise<Vistoria | null> {
    return this.vistorias.find((v) => v.id === id) || null;
  }
  async listarPorCondominio(condominioId: string): Promise<Vistoria[]> {
    return this.vistorias.filter((v) => v.condominioId === condominioId);
  }
}

class FakeOcorrenciaRepository implements IOcorrenciaRepository {
  public ocorrencias: Ocorrencia[] = [];

  async salvar(ocorrencia: Ocorrencia): Promise<void> {
    this.ocorrencias.push(ocorrencia);
  }
  async buscarPorId(id: string): Promise<Ocorrencia | null> {
    return this.ocorrencias.find((o) => o.id === id) || null;
  }
  async listarPorVistoria(vistoriaId: string): Promise<Ocorrencia[]> {
    return this.ocorrencias.filter((o) => o.vistoriaId === vistoriaId);
  }
  async listarTodas(): Promise<Ocorrencia[]> {
    return [...this.ocorrencias];
  }
}

describe('ConsultarHistoricoUseCase (Application)', () => {
  let vistoriaRepo: FakeVistoriaRepository;
  let ocorrenciaRepo: FakeOcorrenciaRepository;
  let useCase: ConsultarHistoricoUseCase;

  beforeEach(() => {
    vistoriaRepo = new FakeVistoriaRepository();
    ocorrenciaRepo = new FakeOcorrenciaRepository();
    useCase = new ConsultarHistoricoUseCase(vistoriaRepo, ocorrenciaRepo);
  });

  it('deve calcular métricas consolidadas de histórico e conformidade predial', async () => {
    const item1 = ItemChecklist.criar({ id: 'i1', vistoriaId: 'v1', titulo: 'Extintor', categoria: 'Incêndio', status: StatusItemChecklist.OK });
    const item2 = ItemChecklist.criar({ id: 'i2', vistoriaId: 'v1', titulo: 'Bomba', categoria: 'Hidráulica', status: StatusItemChecklist.OK });
    const item3 = ItemChecklist.criar({ id: 'i3', vistoriaId: 'v1', titulo: 'Painel', categoria: 'Elétrica', status: StatusItemChecklist.AVISO });
    const item4 = ItemChecklist.criar({ id: 'i4', vistoriaId: 'v1', titulo: 'Gerador', categoria: 'Elétrica', status: StatusItemChecklist.CRITICO, observacao: 'Nível de óleo baixo' });

    const vistoriaFinalizada = Vistoria.criar({
      id: 'v1',
      condominioId: 'cond-alpha',
      inspetorId: 'user-1',
      itens: [item1, item2, item3, item4],
    });
    vistoriaFinalizada.finalizar(Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 }));
    await vistoriaRepo.salvar(vistoriaFinalizada);

    const ocorrencia = Ocorrencia.criar({
      id: 'oc-1',
      vistoriaId: 'v1',
      titulo: 'Óleo baixo no gerador',
      gravidade: GravidadeOcorrencia.ALTA,
      fotos: ['file:///fotos/gerador.jpg'],
      dataCriacao: new Date(),
    });
    await ocorrenciaRepo.salvar(ocorrencia);

    const relatorio = await useCase.executar('cond-alpha');

    expect(relatorio.totalVistorias).toBe(1);
    expect(relatorio.vistoriasFinalizadas).toBe(1);
    expect(relatorio.totalOcorrencias).toBe(1);
    expect(relatorio.ocorrenciasCriticas).toBe(1);
    // 2 OKs em 4 itens respondidos = 50% de conformidade
    expect(relatorio.taxaConformidade).toBe(50);
  });
});
