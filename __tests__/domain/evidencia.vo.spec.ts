import { Evidencia, EvidenciaProps } from '../../src/domain/value-objects/evidencia.vo';
import { EvidenciaSemHashError } from '../../src/domain/errors/domain-errors';

/**
 * RF-EVI-001 — "Evidência exige hash obrigatório".
 *
 * O hash já era obrigatório no contrato da câmera (`ICameraGateway`), mas o
 * value object mantinha `hash?: string` opcional enquanto o DDL declara
 * `hash TEXT NOT NULL`. Um adapter de reidratação (Fase 1) poderia construir uma
 * `Evidencia` sem hash, e o VO aceitaria em silêncio algo que o banco rejeitaria.
 *
 * Sobre o cast nos dois testes de ausência: com `hash` obrigatório em
 * `EvidenciaProps`, o TypeScript **rejeita em tempo de compilação** a chamada sem
 * hash. A guarda de runtime existe para o caminho que o compilador não vê — a
 * reidratação da Fase 1, onde `Evidencia` é montada a partir de uma linha do
 * banco (`row.hash` é `string | null`, não `string`), e para qualquer chamador em
 * JS puro. Estes testes simulam esse caminho, e é por isso que forçam o tipo.
 */
describe('Evidencia Value Object', () => {
  const propsValidas = {
    id: 'ev-1',
    caminhoArquivoLocal: 'file:///storage/emulated/0/foto1.jpg',
    hash: 'a3f5c9d2e1b40789',
  };

  /** Simula a linha do banco reidratada, que não é `EvidenciaProps` tipada. */
  function propsDeLinhaDoBanco(overrides: Record<string, unknown>): EvidenciaProps {
    return {
      id: 'ev-1',
      caminhoArquivoLocal: 'file:///foto.jpg',
      ...overrides,
    } as unknown as EvidenciaProps;
  }

  describe('criação', () => {
    it('deve criar a evidência com hash e caminho local', () => {
      const evidencia = Evidencia.criar(propsValidas);

      expect(evidencia.id).toBe('ev-1');
      expect(evidencia.hash).toBe('a3f5c9d2e1b40789');
      expect(evidencia.caminhoArquivoLocal).toBe('file:///storage/emulated/0/foto1.jpg');
    });

    it('deve recusar evidência sem hash (RF-EVI-001)', () => {
      expect(() => Evidencia.criar(propsDeLinhaDoBanco({ hash: undefined }))).toThrow(
        EvidenciaSemHashError
      );
    });

    it('deve recusar hash vazio', () => {
      expect(() => Evidencia.criar(propsDeLinhaDoBanco({ hash: '' }))).toThrow(
        EvidenciaSemHashError
      );
    });

    it('deve recusar hash com apenas espaços', () => {
      // Um hash "   " passaria por `if (!hash)` e chegaria ao banco como NOT NULL
      // válido — integridade aparente, conteúdo inútil.
      expect(() => Evidencia.criar(propsDeLinhaDoBanco({ hash: '   ' }))).toThrow(
        EvidenciaSemHashError
      );
    });

    it('deve recusar hash nulo vindo do banco', () => {
      // Coluna NOT NULL no SQLite nunca devolve `null`; mas uma coluna nullable
      // legada, ou um JOIN que não encontra a linha, devolve. A distinção entre
      // "ausente" e "vazio" é o que a validação precisa preservar.
      expect(() => Evidencia.criar(propsDeLinhaDoBanco({ hash: null }))).toThrow(
        EvidenciaSemHashError
      );
    });

    it('deve informar que o hash é a peça faltando', () => {
      expect(() => Evidencia.criar(propsDeLinhaDoBanco({ hash: undefined }))).toThrow(/hash/i);
    });
  });

  describe('defensividade', () => {
    it('deve clonar o timestamp recebido', () => {
      // `readonly timestamp: Date` não protege: `readonly` impede reatribuir a
      // referência, não `setFullYear`. Sem o clone, um chamador reescrevia a data
      // de captura de uma evidência já persistida — o mesmo motivo pelo qual o
      // Lote 6 clonou `dataCriacao` em Vistoria e Ocorrencia.
      const T0 = new Date('2026-10-16T10:00:00.000Z');
      const evidencia = Evidencia.criar({ ...propsValidas, timestamp: T0 });

      T0.setFullYear(1999);

      expect(evidencia.timestamp.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    });

    it('deve preservar o timestamp informado no instante da criação', () => {
      const T0 = new Date('2026-10-16T10:00:00.000Z');
      const evidencia = Evidencia.criar({ ...propsValidas, timestamp: T0 });

      expect(evidencia.timestamp.getTime()).toBe(T0.getTime());
    });

    it('deve assumir o instante atual quando nenhum timestamp for informado', () => {
      const antes = Date.now();
      const evidencia = Evidencia.criar(propsValidas);
      const depois = Date.now();

      expect(evidencia.timestamp.getTime()).toBeGreaterThanOrEqual(antes);
      expect(evidencia.timestamp.getTime()).toBeLessThanOrEqual(depois);
    });
  });
});