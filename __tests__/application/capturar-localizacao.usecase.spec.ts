import { LocationGatewayFake } from '../../src/adapters/gateways/location.gateway.fake';
import { VistoriaRepositoryInMemory } from '../../src/adapters/repositories/vistoria.repository.inmemory';
import { CapturarLocalizacaoUseCase } from '../../src/application/use-cases/capturar-localizacao.usecase';
import { Vistoria } from '../../src/domain/entities/vistoria.entity';
import { PermissaoNegadaError } from '../../src/domain/errors/domain-errors';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('CapturarLocalizacaoUseCase (UC04)', () => {
  let locationGateway: LocationGatewayFake;
  let vistoriaRepo: VistoriaRepositoryInMemory;
  let useCase: CapturarLocalizacaoUseCase;

  beforeEach(() => {
    locationGateway = new LocationGatewayFake();
    vistoriaRepo = new VistoriaRepositoryInMemory();
    useCase = new CapturarLocalizacaoUseCase(locationGateway, vistoriaRepo);
  });

  it('deve capturar geolocalizacao válida com sucesso (RF-VIST-004)', async () => {
    locationGateway.setPosicao({
      latitude: -23.55052,
      longitude: -46.633308,
      precisao: 4.2,
    });

    const geo = await useCase.executar();

    expect(geo).toBeInstanceOf(Geolocalizacao);
    expect(geo.latitude).toBe(-23.55052);
    expect(geo.longitude).toBe(-46.633308);
    expect(geo.precisao).toBe(4.2);
    expect(geo.timestamp).toBeInstanceOf(Date);
  });

  it('deve solicitar permissão quando ainda não concedida e prosseguir se aceita (RNF02)', async () => {
    locationGateway.setPermissao(false);

    // Simula que após solicitarPermissao(), o usuário aceita
    jest.spyOn(locationGateway, 'solicitarPermissao').mockImplementation(async () => {
      locationGateway.setPermissao(true);
      return true;
    });

    const geo = await useCase.executar();

    expect(geo).toBeDefined();
    expect(locationGateway.solicitarPermissao).toHaveBeenCalledTimes(1);
  });

  it('deve lançar PermissaoNegadaError sem crash se a permissão for recusada (RNF02)', async () => {
    locationGateway.setPermissao(false);

    await expect(useCase.executar()).rejects.toThrow(PermissaoNegadaError);
  });

  it('deve vincular geolocalização à sessão de vistoria existente (RNF03)', async () => {
    const vistoria = Vistoria.criar({
      id: 'vist-gps-01',
      condominioId: 'cond-01',
      inspetorId: 'user-01',
    });
    await vistoriaRepo.salvar(vistoria);

    const geo = await useCase.executar({ vistoriaId: 'vist-gps-01' });

    expect(geo).toBeInstanceOf(Geolocalizacao);
    expect(geo.latitude).toBeDefined();
    expect(geo.longitude).toBeDefined();
  });

  it('deve lançar erro se vistoriaId fornecido não for encontrado', async () => {
    await expect(useCase.executar({ vistoriaId: 'inexistente' })).rejects.toThrow(
      'Vistoria com ID inexistente não encontrada'
    );
  });
});
