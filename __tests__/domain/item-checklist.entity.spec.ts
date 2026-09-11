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
});
