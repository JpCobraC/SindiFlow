import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';
import { GeolocalizacaoInvalidaError } from '../../src/domain/errors/domain-errors';

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
  describe('lote 5: coordenadas não finitas', () => {
    it('deve rejeitar latitude NaN — toda comparação com NaN é false e a faixa passava', () => {
      expect(() =>
        Geolocalizacao.criar({ latitude: NaN, longitude: -46.633308 })
      ).toThrow(GeolocalizacaoInvalidaError);
    });

    it('deve rejeitar longitude NaN', () => {
      expect(() =>
        Geolocalizacao.criar({ latitude: -23.55052, longitude: NaN })
      ).toThrow(GeolocalizacaoInvalidaError);
    });

    it('deve rejeitar infinito', () => {
      expect(() =>
        Geolocalizacao.criar({ latitude: Infinity, longitude: -46.633308 })
      ).toThrow(GeolocalizacaoInvalidaError);
      expect(() =>
        Geolocalizacao.criar({ latitude: -23.55052, longitude: -Infinity })
      ).toThrow(GeolocalizacaoInvalidaError);
    });

    it('deve rejeitar coordenada ausente ou não numérica, que também compararia como válida', () => {
      expect(() =>
        // @ts-expect-error runtime com dado ausente
        Geolocalizacao.criar({ longitude: -46.633308 })
      ).toThrow(GeolocalizacaoInvalidaError);
      expect(() =>
        // @ts-expect-error runtime com dado ausente
        Geolocalizacao.criar({ latitude: -23.55052 })
      ).toThrow(GeolocalizacaoInvalidaError);
    });
  });

  describe('lote 5: precisão', () => {
    it('deve rejeitar precisão NaN, negativa ou infinita', () => {
      expect(() =>
        Geolocalizacao.criar({ latitude: 1, longitude: 1, precisao: NaN })
      ).toThrow(GeolocalizacaoInvalidaError);
      expect(() =>
        Geolocalizacao.criar({ latitude: 1, longitude: 1, precisao: -1 })
      ).toThrow(GeolocalizacaoInvalidaError);
      expect(() =>
        Geolocalizacao.criar({ latitude: 1, longitude: 1, precisao: Infinity })
      ).toThrow(GeolocalizacaoInvalidaError);
    });

    it('deve preservar a precisão válida', () => {
      const geo = Geolocalizacao.criar({ latitude: 1, longitude: 1, precisao: 4.5 });
      expect(geo.precisao).toBe(4.5);
    });

    it('deve marcar a fixação como insegura quando a precisão é pior que o limite', () => {
      // §3.4: GPS degrada em garagem. Não bloqueamos, mas o laudo precisa dizer
      // que aquela coordenada é de baixa confiança, e não fingir 4,5 m.
      const geo = Geolocalizacao.criar({
        latitude: 1,
        longitude: 1,
        precisao: 120,
        precisaoMaximaAceitavel: 50,
      });

      expect(geo.precisao).toBe(120);
      expect(geo.precisaoAceitavel).toBe(false);
    });

    it('deve considerar aceitável a precisão igual ao limite', () => {
      const geo = Geolocalizacao.criar({
        latitude: 1,
        longitude: 1,
        precisao: 50,
        precisaoMaximaAceitavel: 50,
      });
      expect(geo.precisaoAceitavel).toBe(true);
    });

    it('deve considerar aceitável quando não há limite configurado (padrão permissivo)', () => {
      const geo = Geolocalizacao.criar({ latitude: 1, longitude: 1, precisao: 5000 });
      expect(geo.precisaoAceitavel).toBe(true);
    });

    it('deve dizer "sem precisão" em vez de deixar o chamador inventar um valor', () => {
      const geo = Geolocalizacao.criar({ latitude: 1, longitude: 1 });
      expect(geo.precisao).toBeUndefined();
      expect(geo.temPrecisao).toBe(false);
    });
  });

  describe('lote 6: Date não é mais vazado', () => {
    it('deve clonar o timestamp recebido', () => {
      const externo = new Date('2026-10-13T12:00:00.000Z');
      const geo = Geolocalizacao.criar({ latitude: 1, longitude: 1, timestamp: externo });

      externo.setFullYear(1999);

      expect(geo.timestamp.getUTCFullYear()).toBe(2026);
    });
  });
});
