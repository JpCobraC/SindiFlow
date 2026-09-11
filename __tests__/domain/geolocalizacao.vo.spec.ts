import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('Geolocalizacao Value Object', () => {
  it('deve criar uma instância válida de geolocalizacao', () => {
    const geo = Geolocalizacao.criar({
      latitude: -23.55052,
      longitude: -46.633308,
      precisao: 5,
    });

    expect(geo.latitude).toBe(-23.55052);
    expect(geo.longitude).toBe(-46.633308);
    expect(geo.precisao).toBe(5);
    expect(geo.timestamp).toBeInstanceOf(Date);
  });

  it('deve lançar erro se a latitude for inválida', () => {
    expect(() => {
      Geolocalizacao.criar({
        latitude: -95,
        longitude: -46.633308,
      });
    }).toThrow('Latitude inválida');
  });

  it('deve lançar erro se a longitude for inválida', () => {
    expect(() => {
      Geolocalizacao.criar({
        latitude: -23.55052,
        longitude: 190,
      });
    }).toThrow('Longitude inválida');
  });
});
