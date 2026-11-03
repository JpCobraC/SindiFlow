import { CameraGatewayFake } from '../../src/adapters/gateways/camera.gateway.fake';
import { OcorrenciaRepositoryInMemory } from '../../src/adapters/repositories/ocorrencia.repository.inmemory';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import {
  AnexarFotoUseCase,
  FotoSemDestinoError,
  ResultadoAnexarFoto,
} from '../../src/application/use-cases/anexar-foto.usecase';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import {
  GravidadeOcorrencia,
  Ocorrencia,
} from '../../src/domain/entities/ocorrencia.entity';
import { Vistoria } from '../../src/domain/entities/vistoria.entity';
import {
  ItemChecklistNaoEncontradoError,
  OcorrenciaNaoEncontradaError,
  PermissaoNegadaError,
} from '../../src/domain/errors/domain-errors';
import { Evidencia } from '../../src/domain/value-objects/evidencia.vo';

/** Desembrulha o resultado discriminado; falha o teste se não houver evidência. */
function evidenciaDe(resultado: ResultadoAnexarFoto): Evidencia {
  if (resultado.status !== 'anexada') {
    throw new Error(`esperava 'anexada', recebeu '${resultado.status}'`);
  }
  return resultado.evidencia;
}

describe('AnexarFotoUseCase (UC05)', () => {
  let cameraGateway: CameraGatewayFake;
  let vistoriaRepo: VistoriaRepositoryInMemory;
  let ocorrenciaRepo: OcorrenciaRepositoryInMemory;
  let outboxRepo: OutboxRepositoryInMemory;
  let useCase: AnexarFotoUseCase;
  let vistoria: Vistoria;

  beforeEach(async () => {
    cameraGateway = new CameraGatewayFake();
    vistoriaRepo = new VistoriaRepositoryInMemory();
    ocorrenciaRepo = new OcorrenciaRepositoryInMemory();
    outboxRepo = new OutboxRepositoryInMemory();
    useCase = new AnexarFotoUseCase(cameraGateway, vistoriaRepo, ocorrenciaRepo, outboxRepo);

    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vist-1',
      titulo: 'Extintor',
      categoria: 'Incêndio',
    });
    item.marcarStatus(StatusItemChecklist.OK);

    vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens: [item],
    });
    await vistoriaRepo.salvar(vistoria);
  });

  describe('captura', () => {
    it('deve capturar e retornar Evidencia com caminho local e hash (RF-EVI-001, RF07)', async () => {
      const evidencia = evidenciaDe(await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' }));

      expect(evidencia).toBeInstanceOf(Evidencia);
      expect(evidencia.id).toBeDefined();
      expect(evidencia.caminhoArquivoLocal).toContain('file:///');
      expect(evidencia.hash).toBeTruthy();
    });

    it('deve solicitar permissão e prosseguir se concedida (RNF02)', async () => {
      cameraGateway.setPermissao(false);
      jest.spyOn(cameraGateway, 'solicitarPermissao').mockImplementation(async () => {
        cameraGateway.setPermissao(true);
        return true;
      });

      evidenciaDe(await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' }));
      expect(cameraGateway.solicitarPermissao).toHaveBeenCalledTimes(1);
    });

    it('deve lançar PermissaoNegadaError quando a permissão é negada', async () => {
      cameraGateway.setPermissao(false);
      jest.spyOn(cameraGateway, 'solicitarPermissao').mockResolvedValue(false);

      await expect(
        useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' })
      ).rejects.toThrow(PermissaoNegadaError);
    });

    it('deve reportar cancelamento sem lançar — cancelar não é erro (RNF02)', async () => {
      cameraGateway.setCancelado(true);

      const resultado = await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' });

      expect(resultado.status).toBe('cancelado');
      const pendentes = await outboxRepo.listarTodos();
      expect(pendentes).toHaveLength(0);
    });

    it('deve reportar erro de câmera sem lançar', async () => {
      cameraGateway.setErro('Câmera ocupada');

      const resultado = await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' });

      expect(resultado.status).toBe('erro_captura');
      if (resultado.status !== 'erro_captura') throw new Error('esperava erro');
      expect(resultado.mensagem).toBe('Câmera ocupada');
    });
  });

  describe('destino validado antes do obturador', () => {
    it('NÃO deve abrir a câmera quando a vistoria não existe', async () => {
      const spy = jest.spyOn(cameraGateway, 'capturarFoto');

      await expect(
        useCase.executar({ vistoriaId: 'vist-inexistente', itemId: 'item-1' })
      ).rejects.toThrow(OcorrenciaNaoEncontradaError);

      // O fluxo anterior disparava o obturador e só depois descobria o erro,
      // deixando o arquivo no cache sem caminho de limpeza (C-07).
      expect(spy).not.toHaveBeenCalled();
    });

    it('NÃO deve abrir a câmera quando o item não existe', async () => {
      const spy = jest.spyOn(cameraGateway, 'capturarFoto');

      await expect(
        useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-inexistente' })
      ).rejects.toThrow(ItemChecklistNaoEncontradoError);
      expect(spy).not.toHaveBeenCalled();
    });

    it('deve recusar foto sem destino em vez de produzir evidência órfã', async () => {
      // Antes, `executar({})` devolvia uma Evidencia válida que não era
      // gravada em lugar nenhum: a foto sumia sem erro e sem rastro.
      await expect(useCase.executar({})).rejects.toThrow(FotoSemDestinoError);
    });
  });

  describe('vínculo com a vistoria', () => {
    it('deve anexar a evidência ao item e persistir', async () => {
      evidenciaDe(await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' }));

      const salva = await vistoriaRepo.buscarPorId('vist-1');
      expect(salva?.itens[0].evidencias).toHaveLength(1);
    });

    it('deve enfileirar na outbox — §1.3 exige que toda escrita passe pela fila', async () => {
      // O fluxo anterior fazia 2 escritas e 0 enfileiramentos: toda foto
      // capturada em campo era perda permanente.
      evidenciaDe(await useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' }));

      const pendentes = await outboxRepo.listarTodos();
      expect(pendentes).toHaveLength(1);
      expect(pendentes[0].tabela).toBe('fotos_evidencia');
      expect(pendentes[0].operacao).toBe('INSERT');
      expect(pendentes[0].payload.item_id).toBe('item-1');
      expect(pendentes[0].payload.hash).toBeTruthy();
    });

    it('deve recusar foto em vistoria já finalizada (RF-VIST-007)', async () => {
      const item = vistoria.itens[0];
      for (const i of [item]) i.marcarStatus(StatusItemChecklist.OK);
      vistoria.finalizar(
        (
          await import('../../src/domain/value-objects/geolocalizacao.vo')
        ).Geolocalizacao.criar({ latitude: 1, longitude: 1 })
      );
      await vistoriaRepo.salvar(vistoria);

      await expect(
        useCase.executar({ vistoriaId: 'vist-1', itemId: 'item-1' })
      ).rejects.toThrow();
    });
  });

  describe('vínculo com a ocorrência', () => {
    beforeEach(async () => {
      await ocorrenciaRepo.salvar(
        Ocorrencia.criar({
          id: 'oc-1',
          vistoriaId: 'vist-1',
          titulo: 'Infiltração',
          gravidade: GravidadeOcorrencia.MEDIA,
          fotos: ['file:///anterior.jpg'],
        })
      );
    });

    it('deve anexar a foto à ocorrência e enfileirar', async () => {
      evidenciaDe(await useCase.executar({ ocorrenciaId: 'oc-1' }));

      const ocorrencia = await ocorrenciaRepo.buscarPorId('oc-1');
      expect(ocorrencia?.fotos).toHaveLength(2);

      const pendentes = await outboxRepo.listarTodos();
      expect(pendentes[0].payload.ocorrencia_id).toBe('oc-1');
    });

    it('deve recusar ocorrência inexistente', async () => {
      await expect(useCase.executar({ ocorrenciaId: 'oc-9' })).rejects.toThrow(
        OcorrenciaNaoEncontradaError
      );
    });
  });
});
