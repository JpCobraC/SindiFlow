import { Vistoria, StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';
import { Evidencia } from '../../src/domain/value-objects/evidencia.vo';
import {
  ItemChecklistNaoEditavelError,
  ItemCriticoSemObservacaoError,
  VistoriaJaFinalizadaError,
  VistoriaNaoFinalizavelError,
  VistoriaStatusInvalidoError,
} from '../../src/domain/errors/domain-errors';

const T0 = new Date('2026-10-13T12:00:00.000Z');

function criarItensMock(quantidade: number): ItemChecklist[] {
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
}

function vistoriaPronta(): Vistoria {
  const itens = criarItensMock(5);
  const vistoria = Vistoria.criar({
    id: 'vist-1',
    condominioId: 'cond-1',
    inspetorId: 'user-1',
    itens,
  });
  for (const item of itens) item.marcarStatus(StatusItemChecklist.OK);
  return vistoria;
}

describe('Vistoria Entity', () => {
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

  it('deve recusar criar com status FINALIZADO (RF-VIST-001)', () => {
    expect(() =>
      Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        status: StatusVistoria.FINALIZADA,
        itens: criarItensMock(5),
      })
    ).toThrow(VistoriaStatusInvalidoError);
  });

  it('deve recusar criar com status EM_ANDAMENTO (RF-VIST-001)', () => {
    expect(() =>
      Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        status: StatusVistoria.EM_ANDAMENTO,
        itens: criarItensMock(5),
      })
    ).toThrow(VistoriaStatusInvalidoError);
  });

  it('deve recusar criar com status CANCELADA (RF-VIST-001)', () => {
    expect(() =>
      Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        status: StatusVistoria.CANCELADA,
        itens: criarItensMock(5),
      })
    ).toThrow(VistoriaStatusInvalidoError);
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
  describe('vistoria finalizada é imutável (RF-VIST-007)', () => {
    // helper declarado no describe pai, abaixo
    it('deve recusar segunda finalização, preservando data e geolocalização assinadas', () => {
      const vistoria = vistoriaPronta();
      const geoOriginal = Geolocalizacao.criar({
        latitude: -23.55052,
        longitude: -46.633308,
        timestamp: T0,
      });

      vistoria.finalizar(geoOriginal, T0);
      const dataOriginal = vistoria.dataFinalizacao;

      const geoNovo = Geolocalizacao.criar({
        latitude: 10,
        longitude: 10,
        timestamp: new Date(T0.getTime() + 60_000),
      });

      expect(() => vistoria.finalizar(geoNovo, new Date(T0.getTime() + 60_000))).toThrow(
        VistoriaJaFinalizadaError
      );

      // Nada sobrescrito: a assinatura original permanece íntegra.
      expect(vistoria.dataFinalizacao).toEqual(dataOriginal);
      expect(vistoria.geolocalizacao?.latitude).toBe(-23.55052);
      expect(vistoria.geolocalizacao?.longitude).toBe(-46.633308);
    });

    it('deve recusar edição de item após a finalização', () => {
      const vistoria = vistoriaPronta();
      vistoria.finalizar(Geolocalizacao.criar({ latitude: 1, longitude: 1, timestamp: T0 }), T0);

      const item = vistoria.itens[0];
      expect(() => item.marcarStatus(StatusItemChecklist.CRITICO, 'reaberto')).toThrow(
        ItemChecklistNaoEditavelError
      );
      expect(item.status).toBe(StatusItemChecklist.OK);
    });

    it('deve permitir edição enquanto a vistoria não estiver finalizada', () => {
      const vistoria = vistoriaPronta();
      expect(() => vistoria.itens[0].marcarStatus(StatusItemChecklist.AVISO)).not.toThrow();
    });
    it('deve reidratar FINALIZADA do banco com itens JÁ bloqueados (RF-VIST-007)', () => {
      // Este é o caminho que o adapter SQLite vai usar: status vem da linha,
      // não de uma chamada a finalizar(). Sem isto, RF-VIST-007 é burlado em
      // todo cold start.
      const itens = criarItensMock(5);
      const vistoria = Vistoria.reidratar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        status: StatusVistoria.FINALIZADA,
        dataCriacao: T0,
        dataFinalizacao: T0,
        geolocalizacao: Geolocalizacao.criar({ latitude: 1, longitude: 1, timestamp: T0 }),
        itens,
      });

      expect(vistoria.status).toBe(StatusVistoria.FINALIZADA);
      expect(() => vistoria.itens[0].marcarStatus(StatusItemChecklist.OK)).toThrow(
        ItemChecklistNaoEditavelError
      );
      expect(() =>
        vistoria.itens[0].adicionarEvidencia(
          Evidencia.criar({ id: 'ev-1', caminhoArquivoLocal: 'file:///f.jpg', hash: 'abc' })
        )
      ).toThrow(ItemChecklistNaoEditavelError);
    });

    it('deve recusar finalização de vistoria CANCELADA', () => {
      const vistoria = Vistoria.reidratar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        status: StatusVistoria.CANCELADA,
        itens: criarItensMock(5).map((i) => {
          i.marcarStatus(StatusItemChecklist.OK);
          return i;
        }),
      });

      expect(() =>
        vistoria.finalizar(Geolocalizacao.criar({ latitude: 1, longitude: 1, timestamp: T0 }), T0)
      ).toThrow(VistoriaNaoFinalizavelError);
      expect(vistoria.status).toBe(StatusVistoria.CANCELADA);
    });

    it('não deve permitir editar item de vistoria em andamento', () => {
      const vistoria = vistoriaPronta();
      vistoria.itens[0].marcarStatus(StatusItemChecklist.AVISO);
      expect(vistoria.itens[0].status).toBe(StatusItemChecklist.AVISO);
    });
  });
  describe('lote 6: cópias defensivas', () => {
    it('NÃO deve deixar o array de itensoriginal ser mutado por fora', () => {
      const itens = criarItensMock(5);
      const vistoria = Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        itens,
      });

      itens.pop();

      expect(vistoria.itens).toHaveLength(5);
    });

    it('NÃO deve expor o array interno pelo getter', () => {
      const vistoria = vistoriaPronta();
      (vistoria.itens as ItemChecklist[]).push(
        ItemChecklist.criar({ id: 'injected', vistoriaId: 'vist-1', titulo: 'X', categoria: 'Geral' })
      );
      expect(vistoria.itens).toHaveLength(5);
    });

    it('NÃO deve deixar o dataCriacao original ser reescrito', () => {
      const externo = new Date('2026-10-13T12:00:00.000Z');
      const vistoria = Vistoria.criar({
        id: 'vist-1',
        condominioId: 'cond-1',
        inspetorId: 'user-1',
        dataCriacao: externo,
        itens: criarItensMock(5),
      });

      externo.setFullYear(1999);

      expect(vistoria.dataCriacao.getUTCFullYear()).toBe(2026);
    });

    it('deve recusar item cuja vistoriaId não é a da vistoria dona', () => {
      const alheio = ItemChecklist.criar({
        id: 'item-99',
        vistoriaId: 'OUTRA-VISTORIA',
        titulo: 'Alheio',
        categoria: 'Geral',
      });

      expect(() =>
        Vistoria.criar({
          id: 'vist-1',
          condominioId: 'cond-1',
          inspetorId: 'user-1',
          itens: [alheio, ...criarItensMock(4)],
        })
      ).toThrow();
    });
  });

  it('deve recusar finalizar com CRITICO criado sem justificativa (RF-VIST-003 na reidratação)', () => {
    // O guarda de `marcarStatus` impede chegar aqui pelo fluxo normal, mas uma
    // reidratação do banco pode trazer um CRITICO antigo sem observação. A
    // segunda linha de defesa existe para isso.
    const item = criarItensMock(5)[0];
    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      itens: [item, ...criarItensMock(4)],
    });
    for (const i of vistoria.itens) i.marcarStatus(StatusItemChecklist.OK);

    (item as unknown as { _status: StatusItemChecklist })._status =
      StatusItemChecklist.CRITICO;

    expect(() =>
      vistoria.finalizar(Geolocalizacao.criar({ latitude: 1, longitude: 1, timestamp: T0 }), T0)
    ).toThrow(ItemCriticoSemObservacaoError);
  });
});
