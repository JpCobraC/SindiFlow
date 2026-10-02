import { GravidadeOcorrencia, Ocorrencia, StatusOcorrencia } from '../../src/domain/entities/ocorrencia.entity';
import { OcorrenciaAltaSemFotoError } from '../../src/domain/errors/domain-errors';

describe('Ocorrencia Entity (Domínio)', () => {
  const agora = new Date('2026-10-02T10:00:00.000Z');

  it('deve criar uma ocorrência de gravidade BAIXA com SLA de 7 dias e sem foto obrigatória', () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-1',
      vistoriaId: 'vist-1',
      titulo: 'Lâmpada do hall queimada',
      descricao: 'Lâmpada LED piscou e apagou',
      gravidade: GravidadeOcorrencia.BAIXA,
      dataCriacao: agora,
    });

    expect(ocorrencia.gravidade).toBe(GravidadeOcorrencia.BAIXA);
    expect(ocorrencia.status).toBe(StatusOcorrencia.ABERTA);
    expect(ocorrencia.slaHoras).toBe(168); // 7 dias * 24h
    // Data limite deve ser agora + 7 dias
    const limiteEsperado = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(ocorrencia.dataLimiteSla.toISOString()).toBe(limiteEsperado.toISOString());
    expect(ocorrencia.fotos.length).toBe(0);
  });

  it('deve criar uma ocorrência de gravidade MEDIA com SLA de 72 horas', () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-2',
      vistoriaId: 'vist-1',
      titulo: 'Infiltração leve no teto da garagem',
      gravidade: GravidadeOcorrencia.MEDIA,
      dataCriacao: agora,
    });

    expect(ocorrencia.gravidade).toBe(GravidadeOcorrencia.MEDIA);
    expect(ocorrencia.slaHoras).toBe(72);
    const limiteEsperado = new Date(agora.getTime() + 72 * 60 * 60 * 1000);
    expect(ocorrencia.dataLimiteSla.toISOString()).toBe(limiteEsperado.toISOString());
  });

  it('deve lançar erro se ocorrência ALTA for criada sem foto obrigatória (Seção 3.2)', () => {
    expect(() => {
      Ocorrencia.criar({
        id: 'oc-3',
        vistoriaId: 'vist-1',
        titulo: 'Vazamento grave na prumada central',
        gravidade: GravidadeOcorrencia.ALTA,
        dataCriacao: agora,
        fotos: [],
      });
    }).toThrow(OcorrenciaAltaSemFotoError);
  });

  it('deve criar ocorrência ALTA com sucesso quando foto for fornecida e SLA for 24h', () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-4',
      vistoriaId: 'vist-1',
      titulo: 'Curto-circuito no quadro geral',
      gravidade: GravidadeOcorrencia.ALTA,
      fotos: ['file:///data/fotos/quadro_eletrico.jpg'],
      dataCriacao: agora,
    });

    expect(ocorrencia.gravidade).toBe(GravidadeOcorrencia.ALTA);
    expect(ocorrencia.slaHoras).toBe(24);
    const limiteEsperado = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    expect(ocorrencia.dataLimiteSla.toISOString()).toBe(limiteEsperado.toISOString());
    expect(ocorrencia.fotos.length).toBe(1);
  });

  it('deve permitir resolução da ocorrência alterando status e data de resolução', () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-5',
      vistoriaId: 'vist-1',
      titulo: 'Interfone sem sinal no bloco B',
      gravidade: GravidadeOcorrencia.MEDIA,
      dataCriacao: agora,
    });

    const dataResolucao = new Date('2026-10-03T14:00:00.000Z');
    ocorrencia.resolver(dataResolucao, 'Trocado fusível do painel');

    expect(ocorrencia.status).toBe(StatusOcorrencia.RESOLVIDA);
    expect(ocorrencia.dataResolucao).toEqual(dataResolucao);
    expect(ocorrencia.solucao).toBe('Trocado fusível do painel');
    expect(ocorrencia.estaAtrasada(dataResolucao)).toBe(false);
  });

  it('deve identificar se a ocorrência está atrasada em relação a uma data informada', () => {
    const ocorrencia = Ocorrencia.criar({
      id: 'oc-6',
      vistoriaId: 'vist-1',
      titulo: 'Vazamento grave',
      gravidade: GravidadeOcorrencia.ALTA,
      fotos: ['file:///data/fotos/vazamento.jpg'],
      dataCriacao: agora, // limite: agora + 24h = 03/10 10:00
    });

    const dataAposVencimento = new Date('2026-10-03T11:00:00.000Z');
    expect(ocorrencia.estaAtrasada(dataAposVencimento)).toBe(true);
  });
});
