import { CameraGatewayFake } from '../../src/adapters/gateways/camera.gateway.fake';
import { OcorrenciaRepositoryInMemory } from '../../src/adapters/repositories/ocorrencia.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { AnexarFotoUseCase } from '../../src/application/use-cases/anexar-foto.usecase';
import { GravidadeOcorrencia, Ocorrencia } from '../../src/domain/entities/ocorrencia.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import {
  ItemChecklistNaoEncontradoError,
  OcorrenciaNaoEncontradaError,
  PermissaoNegadaError,
} from '../../src/domain/errors/domain-errors';
import { Evidencia } from '../../src/domain/value-objects/evidencia.vo';

describe('AnexarFotoUseCase (UC05)', () => {
  let cameraGateway: CameraGatewayFake;
  let vistoriaRepo: VistoriaRepositoryInMemory;
  let ocorrenciaRepo: OcorrenciaRepositoryInMemory;
  let useCase: AnexarFotoUseCase;

  beforeEach(() => {
    cameraGateway = new CameraGatewayFake();
    vistoriaRepo = new VistoriaRepositoryInMemory();
    ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    useCase = new AnexarFotoUseCase(cameraGateway, vistoriaRepo, ocorrenciaRepo);
  });

  it('deve capturar e retornar Evidencia com caminho local e hash (RF-EVI-001, RF07)', async () => {
    const evidencia = await useCase.executar({});

    expect(evidencia).toBeInstanceOf(Evidencia);
    expect(evidencia.id).toBeDefined();
    expect(evidencia.caminhoArquivoLocal).toContain('file:///');
    expect(evidencia.hash).toBeDefined();
  });

  it('deve solicitar permissão e prosseguir se concedida (RNF02)', async () => {
    cameraGateway.setPermissao(false);

    jest.spyOn(cameraGateway, 'solicitarPermissao').mockImplementation(async () => {
      cameraGateway.setPermissao(true);
      return true;
    });

    const evidencia = await useCase.executar({});
    expect(evidencia).toBeDefined();
    expect(cameraGateway.solicitarPermissao).toHaveBeenCalledTimes(1);
  });

  it('deve lançar PermissaoNegadaError sem crash se permissão for negada (RNF02)', async () => {
    cameraGateway.setPermissao(false);

    await expect(useCase.executar({})).rejects.toThrow(PermissaoNegadaError);
  });

  it('deve anexar a foto capturada ao item de checklist da vistoria', async () => {
    const item = ItemChecklist.criar({
      id: 'item-10',
      vistoriaId: 'vist-foto-01',
      titulo: 'Bomba d água',
      categoria: 'Hidráulica',
    });

    const vistoria = Vistoria.criar({
      id: 'vist-foto-01',
      condominioId: 'cond-01',
      inspetorId: 'user-01',
      itens: [item],
    });
    await vistoriaRepo.salvar(vistoria);

    const evidencia = await useCase.executar({
      vistoriaId: 'vist-foto-01',
      itemId: 'item-10',
    });

    const vistoriaSalva = await vistoriaRepo.buscarPorId('vist-foto-01');
    const itemAtualizado = vistoriaSalva?.itens.find((i) => i.id === 'item-10');
    expect(itemAtualizado?.evidencias).toHaveLength(1);
    expect(itemAtualizado?.evidencias[0].caminhoArquivoLocal).toBe(evidencia.caminhoArquivoLocal);
  });

  it('deve lançar erro se itemId informado não existir na vistoria', async () => {
    const vistoria = Vistoria.criar({
      id: 'vist-foto-02',
      condominioId: 'cond-01',
      inspetorId: 'user-01',
      itens: [],
    });
    await vistoriaRepo.salvar(vistoria);

    await expect(
      useCase.executar({
        vistoriaId: 'vist-foto-02',
        itemId: 'item-inexistente',
      })
    ).rejects.toThrow(ItemChecklistNaoEncontradoError);
  });

  it('deve anexar a foto à ocorrência existente', async () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-foto-01',
      vistoriaId: 'vist-01',
      titulo: 'Rachadura leve',
      gravidade: GravidadeOcorrencia.BAIXA,
    });
    await ocorrenciaRepo.salvar(ocorrencia);

    const evidencia = await useCase.executar({
      ocorrenciaId: 'oc-foto-01',
    });

    const ocorrenciaSalva = await ocorrenciaRepo.buscarPorId('oc-foto-01');
    expect(ocorrenciaSalva?.fotos).toContain(evidencia.caminhoArquivoLocal);
  });
});
