import { RegistrarOcorrenciaUseCase } from '../../src/application/use-cases/registrar-ocorrencia.usecase';
import { GravidadeOcorrencia } from '../../src/domain/entities/ocorrencia.entity';
import { OcorrenciaAltaSemFotoError } from '../../src/domain/errors/domain-errors';
import { IOcorrenciaRepository } from '../../src/domain/interfaces/ocorrencia.repository.interface';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';

class FakeOcorrenciaRepository implements IOcorrenciaRepository {
  private itens: any[] = [];

  async salvar(ocorrencia: any): Promise<void> {
    const index = this.itens.findIndex((o) => o.id === ocorrencia.id);
    if (index >= 0) {
      this.itens[index] = ocorrencia;
    } else {
      this.itens.push(ocorrencia);
    }
  }

  async buscarPorId(id: string): Promise<any | null> {
    return this.itens.find((o) => o.id === id) || null;
  }

  async listarPorVistoria(vistoriaId: string): Promise<any[]> {
    return this.itens.filter((o) => o.vistoriaId === vistoriaId);
  }

  async listarTodas(): Promise<any[]> {
    return [...this.itens];
  }
}

describe('RegistrarOcorrenciaUseCase (Application)', () => {
  let ocorrenciaRepo: FakeOcorrenciaRepository;
  let outboxRepo: OutboxRepositoryInMemory;
  let useCase: RegistrarOcorrenciaUseCase;

  beforeEach(() => {
    ocorrenciaRepo = new FakeOcorrenciaRepository();
    outboxRepo = new OutboxRepositoryInMemory();
    useCase = new RegistrarOcorrenciaUseCase(ocorrenciaRepo, outboxRepo);
  });

  it('deve registrar ocorrência de média gravidade e enfileirar na outbox', async () => {
    const output = await useCase.executar({
      id: 'oc-1',
      vistoriaId: 'vist-1',
      titulo: 'Portão da garagem desalinhado',
      gravidade: GravidadeOcorrencia.MEDIA,
      usuarioId: 'user-sindico-1',
      deviceId: 'dev-moto-g',
    });

    expect(output.id).toBe('oc-1');
    expect(output.gravidade).toBe(GravidadeOcorrencia.MEDIA);
    expect(output.slaHoras).toBe(72);

    const salva = await ocorrenciaRepo.buscarPorId('oc-1');
    expect(salva).not.toBeNull();

    // Obrigação §1.3: Toda operação passa por fila de outbox na SQLite
    expect((await outboxRepo.listarTodos()).length).toBe(1);
    expect((await outboxRepo.listarTodos())[0].tabela).toBe('ocorrencias');
    expect((await outboxRepo.listarTodos())[0].operacao).toBe('INSERT');
  });

  it('deve bloquear ocorrência ALTA sem fotos conforme regra de negócio §3.2', async () => {
    await expect(
      useCase.executar({
        id: 'oc-2',
        vistoriaId: 'vist-1',
        titulo: 'Vazamento grave de esgoto',
        gravidade: GravidadeOcorrencia.ALTA,
        usuarioId: 'user-sindico-1',
        deviceId: 'dev-moto-g',
        fotos: [],
      })
    ).rejects.toThrow(OcorrenciaAltaSemFotoError);

    expect((await outboxRepo.listarTodos()).length).toBe(0);
  });

  it('deve registrar ocorrência ALTA com fotos e SLA de 24 horas', async () => {
    const output = await useCase.executar({
      id: 'oc-3',
      vistoriaId: 'vist-1',
      titulo: 'Curto circuito no quadro elétrico',
      gravidade: GravidadeOcorrencia.ALTA,
      fotos: ['file:///photos/evidencia1.jpg'],
      usuarioId: 'user-sindico-1',
      deviceId: 'dev-moto-g',
    });

    expect(output.gravidade).toBe(GravidadeOcorrencia.ALTA);
    expect(output.slaHoras).toBe(24);
    expect(output.fotos.length).toBe(1);
    expect((await outboxRepo.listarTodos()).length).toBe(1);
  });
});
