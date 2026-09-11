import { Vistoria, StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

describe('Vistoria Entity', () => {
  const criarItensMock = (quantidade: number): ItemChecklist[] => {
    const itens: ItemChecklist[] = [];
    for (let i = 1; i <= quantidade; i++) {
      itens.push(
        ItemChecklist.criar({
          id: `item-${i}`,
          vistoriaId: 'vist-1',
          titulo: `Item ${i}`,
          categoria: 'Geral',
        })
      );
    }
    return itens;
  };

  it('deve iniciar obrigatoriamente com status RASCUNHO (RF-VIST-001)', () => {
    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens: criarItensMock(5),
    });

    expect(vistoria.status).toBe(StatusVistoria.RASCUNHO);
    expect(vistoria.dataCriacao).toBeInstanceOf(Date);
  });

  it('deve impedir finalização se menos de 80% dos itens forem marcados (RF-VIST-002)', () => {
    const itens = criarItensMock(5); // 5 itens => 80% é 4 itens
    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens,
    });

    // Marca apenas 3 de 5 (60%)
    itens[0].marcarStatus(StatusItemChecklist.OK);
    itens[1].marcarStatus(StatusItemChecklist.OK);
    itens[2].marcarStatus(StatusItemChecklist.AVISO);

    const geo = Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 });

    expect(() => {
      vistoria.finalizar(geo);
    }).toThrow('Vistoria só pode ser finalizada se 80% ou mais dos itens estiverem respondidos (RF-VIST-002)');
  });

  it('deve permitir finalização quando ≥80% dos itens respondidos e com geolocalização (RF-VIST-002 & RF-VIST-004)', () => {
    const itens = criarItensMock(5);
    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens,
    });

    // Marca 4 de 5 (80%)
    itens[0].marcarStatus(StatusItemChecklist.OK);
    itens[1].marcarStatus(StatusItemChecklist.OK);
    itens[2].marcarStatus(StatusItemChecklist.OK);
    itens[3].marcarStatus(StatusItemChecklist.AVISO);

    const geo = Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63 });
    vistoria.finalizar(geo);

    expect(vistoria.status).toBe(StatusVistoria.FINALIZADA);
    expect(vistoria.dataFinalizacao).toBeInstanceOf(Date);
    expect(vistoria.geolocalizacao).toBe(geo);
  });

  it('deve exigir geolocalização para finalização (RF-VIST-004)', () => {
    const itens = criarItensMock(5);
    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens,
    });

    for (const item of itens) {
      item.marcarStatus(StatusItemChecklist.OK);
    }

    expect(() => {
      // @ts-expect-error teste com geo undefined
      vistoria.finalizar(null);
    }).toThrow('Geolocalização é obrigatória para finalizar a vistoria (RF-VIST-004)');
  });
});
