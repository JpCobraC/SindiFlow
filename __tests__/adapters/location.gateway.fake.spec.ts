import { LocationGatewayFake } from '../../src/adapters/gateways/location.gateway.fake';

describe('LocationGatewayFake', () => {
  let locationGateway: LocationGatewayFake;

  beforeEach(() => {
    locationGateway = new LocationGatewayFake();
  });

  it('deve ter permissão concedida por padrão', async () => {
    const temPermissao = await locationGateway.temPermissao();
    expect(temPermissao).toBe(true);
  });

  it('deve permitir alterar permissão para negada', async () => {
    locationGateway.setPermissao(false);
    const temPermissao = await locationGateway.temPermissao();
    expect(temPermissao).toBe(false);
  });

  it('deve solicitar permissão e retornar o estado configurado', async () => {
    locationGateway.setPermissao(false);
    const solicitou = await locationGateway.solicitarPermissao();
    expect(solicitou).toBe(false);

    locationGateway.setPermissao(true);
    const solicitouNovamente = await locationGateway.solicitarPermissao();
    expect(solicitouNovamente).toBe(true);
  });

  it('deve retornar coordenadas padrão simuladas com precisão', async () => {
    const posicao = await locationGateway.obterPosicaoAtual();
    expect(posicao.latitude).toBeDefined();
    expect(posicao.longitude).toBeDefined();
    expect(posicao.precisao).toBeGreaterThan(0);
    expect(posicao.timestamp).toBeInstanceOf(Date);
  });

  it('deve permitir configurar coordenadas customizadas', async () => {
    locationGateway.setPosicao({
      latitude: -23.55052,
      longitude: -46.633308,
      precisao: 3.5,
    });

    const posicao = await locationGateway.obterPosicaoAtual();
    expect(posicao.latitude).toBe(-23.55052);
    expect(posicao.longitude).toBe(-46.633308);
    expect(posicao.precisao).toBe(3.5);
  });
});
