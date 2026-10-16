import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Evidencia } from '../../src/domain/value-objects/evidencia.vo';

describe('ItemChecklist Entity', () => {
  it('deve criar um item de checklist com status PENDENTE por padrão', () => {
    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vistoria-1',
      titulo: 'Verificar extintor do 1º andar',
      categoria: 'Segurança',
    });

    expect(item.id).toBe('item-1');
    expect(item.status).toBe(StatusItemChecklist.PENDENTE);
    expect(item.evidencias).toHaveLength(0);
  });

  it('deve permitir alterar status para OK', () => {
    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vistoria-1',
      titulo: 'Verificar extintor',
      categoria: 'Segurança',
    });

    item.marcarStatus(StatusItemChecklist.OK);
    expect(item.status).toBe(StatusItemChecklist.OK);
  });

  it('deve exigir observação ao marcar status como CRITICO (RF-VIST-003)', () => {
    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vistoria-1',
      titulo: 'Bomba d água vazando',
      categoria: 'Hidráulica',
    });

    expect(() => {
      item.marcarStatus(StatusItemChecklist.CRITICO, '');
    }).toThrow('Item com status CRITICO exige justificativa/observação (RF-VIST-003)');

    item.marcarStatus(StatusItemChecklist.CRITICO, 'Vazamento grave detectado na conexão principal');
    expect(item.status).toBe(StatusItemChecklist.CRITICO);
    expect(item.observacao).toBe('Vazamento grave detectado na conexão principal');
  });

  it('deve permitir anexar evidencia fotográfica ao item', () => {
    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vistoria-1',
      titulo: 'Extintor vencido',
      categoria: 'Segurança',
    });

    const evidencia = Evidencia.criar({
      id: 'ev-1',
      caminhoArquivoLocal: 'file:///storage/emulated/0/foto1.jpg',
      hash: 'abc123hash',
    });

    item.adicionarEvidencia(evidencia);
    expect(item.evidencias).toHaveLength(1);
    expect(item.evidencias[0].id).toBe('ev-1');
  });

  it('deve expor se a vistoria dona já está finalizada', () => {
    const item = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vist-1',
      titulo: 'Extintor',
      categoria: 'Segurança',
    });
    expect(item.vistoriaFinalizada).toBe(false);

    item.bloquearEdicao();
    expect(item.vistoriaFinalizada).toBe(true);
  });

  /**
   * Cópia defensiva — mesma defesa já aplicada em `Vistoria.itens`
   * (`[...this._itens]`) e `Ocorrencia.fotos` (`[...this._fotos]`). Sem ela o
   * agregado é mutável por fora e o chamador do construtor acaba vendo o próprio
   * array crescer a cada `adicionarEvidencia`.
   */
  describe('cópia defensiva das evidências', () => {
    function novaEvidencia(id = 'ev-x'): Evidencia {
      return Evidencia.criar({ id, caminhoArquivoLocal: `file:///${id}.jpg`, hash: `hash-${id}` });
    }

    it('não deve expor o array interno na leitura', () => {
      const item = ItemChecklist.criar({
        id: 'item-1',
        vistoriaId: 'vist-1',
        titulo: 'Extintor',
        categoria: 'Segurança',
      });

      // O cast é proposital: `readonly Evidencia[]` impede `.push()` só no
      // TypeScript. Quem roda o app em JS, ou quem usa `as Evidencia[]`, escreve
      // direto no agregado. O cast é a demonstração desse caminho.
      const vazamento = item.evidencias as Evidencia[];
      vazamento.push(novaEvidencia());

      expect(item.evidencias).toHaveLength(0);
    });

    it('não deve guardar o array recebido no construtor', () => {
      const externo = [novaEvidencia('ev-1')];
      const item = ItemChecklist.criar({
        id: 'item-1',
        vistoriaId: 'vist-1',
        titulo: 'Extintor',
        categoria: 'Segurança',
        evidencias: externo,
      });

      externo.push(novaEvidencia('ev-2'));

      expect(item.evidencias).toHaveLength(1);
    });

    it('deve refletir evidências anexadas depois da construção', () => {
      const item = ItemChecklist.criar({
        id: 'item-1',
        vistoriaId: 'vist-1',
        titulo: 'Extintor',
        categoria: 'Segurança',
      });

      // Sanidade do trade-off: a cópia é na leitura, não um espelho congelado.
      // `adicionarEvidencia()` é a porta de entrada e precisa continuar valendo.
      item.adicionarEvidencia(novaEvidencia('ev-9'));

      expect(item.evidencias).toHaveLength(1);
      expect(item.evidencias[0].id).toBe('ev-9');
    });
  });
});
