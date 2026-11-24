import { Comunicado } from '../../domain/entities/comunicado.entity';
import {
  ItemChecklist,
  StatusItemChecklist,
} from '../../domain/entities/item-checklist.entity';
import {
  GravidadeOcorrencia,
  Ocorrencia,
  StatusOcorrencia,
} from '../../domain/entities/ocorrencia.entity';
import { StatusOutbox } from '../../domain/entities/outbox-event.entity';
import { StatusVistoria, Vistoria } from '../../domain/entities/vistoria.entity';
import { IComunicadoRepository } from '../../domain/interfaces/comunicado.repository.interface';
import { INetworkService } from '../../domain/interfaces/network.service.interface';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import {
  FotoEvidenciaRemota,
  IRemoteSyncGateway,
  ItemChecklistRemoto,
} from '../../domain/interfaces/remote-sync.gateway.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { Evidencia } from '../../domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../../domain/value-objects/geolocalizacao.vo';

export interface ResultadoPullRemoto {
  atualizado: boolean;
  vistorias: number;
  ocorrencias: number;
  comunicados: number;
}

const VAZIO: ResultadoPullRemoto = {
  atualizado: false,
  vistorias: 0,
  ocorrencias: 0,
  comunicados: 0,
};

/**
 * Baixa o snapshot atualizado do condomínio no Supabase e mescla no SQLite local,
 * preservando qualquer registro que ainda possua alterações locais não sincronizadas
 * na fila de outbox.
 */
export class SincronizarDadosRemotosUseCase {
  constructor(
    private readonly networkService: INetworkService,
    private readonly syncGateway: IRemoteSyncGateway,
    private readonly outboxRepo: IOutboxRepository,
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly ocorrenciaRepo: IOcorrenciaRepository,
    private readonly comunicadoRepo: IComunicadoRepository
  ) {}

  async executar(condominioId: string): Promise<ResultadoPullRemoto> {
    if (!condominioId || !this.syncGateway.buscarSnapshotCondominio) {
      return { ...VAZIO };
    }

    const conectado = await this.networkService.estaConectado();
    if (!conectado) {
      return { ...VAZIO };
    }

    const eventosOutbox = await this.outboxRepo.listarTodos();
    const pendentesLocais = eventosOutbox.filter(
      (e) => e.status !== StatusOutbox.SINCRONIZADO
    );

    const vistoriasProtegidas = new Set<string>();
    const itensProtegidos = new Set<string>();
    const ocorrenciasProtegidas = new Set<string>();
    const comunicadosProtegidos = new Set<string>();

    for (const evento of pendentesLocais) {
      const payload = evento.payload ?? {};
      if (evento.tabela === 'vistorias') {
        vistoriasProtegidas.add(evento.idRegistro);
      } else if (evento.tabela === 'itens_checklist' || evento.tabela === 'item_checklist') {
        itensProtegidos.add(evento.idRegistro);
        if (typeof payload.vistoria_id === 'string' && payload.vistoria_id) {
          vistoriasProtegidas.add(payload.vistoria_id);
        }
      } else if (evento.tabela === 'ocorrencias') {
        ocorrenciasProtegidas.add(evento.idRegistro);
      } else if (evento.tabela === 'fotos_evidencia') {
        if (typeof payload.item_id === 'string' && payload.item_id) {
          itensProtegidos.add(payload.item_id);
        }
        if (typeof payload.ocorrencia_id === 'string' && payload.ocorrencia_id) {
          ocorrenciasProtegidas.add(payload.ocorrencia_id);
        }
      } else if (evento.tabela === 'comunicados') {
        comunicadosProtegidos.add(evento.idRegistro);
      }
    }

    const snapshot = await this.syncGateway.buscarSnapshotCondominio(condominioId);

    const itensPorVistoria = new Map<string, ItemChecklistRemoto[]>();
    for (const item of snapshot.itensChecklist) {
      const lista = itensPorVistoria.get(item.vistoria_id) ?? [];
      lista.push(item);
      itensPorVistoria.set(item.vistoria_id, lista);
    }

    const fotosPorItem = new Map<string, FotoEvidenciaRemota[]>();
    const fotosPorOcorrencia = new Map<string, FotoEvidenciaRemota[]>();
    for (const foto of snapshot.fotosEvidencia) {
      if (foto.item_id) {
        const lista = fotosPorItem.get(foto.item_id) ?? [];
        lista.push(foto);
        fotosPorItem.set(foto.item_id, lista);
      }
      if (foto.ocorrencia_id) {
        const lista = fotosPorOcorrencia.get(foto.ocorrencia_id) ?? [];
        lista.push(foto);
        fotosPorOcorrencia.set(foto.ocorrencia_id, lista);
      }
    }

    let vistoriasAtualizadas = 0;
    for (const remota of snapshot.vistorias) {
      const itensRemotos = itensPorVistoria.get(remota.id) ?? [];
      const possuiItemProtegido = itensRemotos.some((i) => itensProtegidos.has(i.id));
      if (vistoriasProtegidas.has(remota.id) || possuiItemProtegido) {
        continue;
      }

      const itens = itensRemotos.map((itemRemoto) => {
        const evidencias = (fotosPorItem.get(itemRemoto.id) ?? [])
          .filter((f) => Boolean(f.caminho_arquivo))
          .map((f) =>
            Evidencia.criar({
              id: f.id,
              caminhoArquivoLocal: f.caminho_arquivo,
              hash: f.hash || f.caminho_arquivo,
              timestamp: f.data_captura ? new Date(f.data_captura) : new Date(),
            })
          );

        return ItemChecklist.criar({
          id: itemRemoto.id,
          vistoriaId: itemRemoto.vistoria_id,
          titulo: itemRemoto.titulo,
          categoria: itemRemoto.categoria,
          status: (itemRemoto.status as StatusItemChecklist) || StatusItemChecklist.PENDENTE,
          observacao: itemRemoto.observacao ?? undefined,
          evidencias,
        });
      });

      const geolocalizacao =
        remota.latitude !== null &&
        remota.latitude !== undefined &&
        remota.longitude !== null &&
        remota.longitude !== undefined
          ? Geolocalizacao.criar({
              latitude: remota.latitude,
              longitude: remota.longitude,
              precisao: remota.precisao ?? undefined,
            })
          : undefined;

      const vistoria = Vistoria.reidratar({
        id: remota.id,
        condominioId: remota.condominio_id,
        inspetorId: remota.inspetor_id,
        status: remota.status as StatusVistoria,
        dataCriacao: new Date(remota.data_criacao),
        dataFinalizacao: remota.data_finalizacao ? new Date(remota.data_finalizacao) : undefined,
        geolocalizacao,
        itens,
        parecerTecnico: remota.parecer_tecnico ?? undefined,
        motivoDevolucao: remota.motivo_devolucao ?? undefined,
        devolvidoPor: remota.devolvido_por ?? undefined,
        aprovadoPor: remota.aprovado_por ?? undefined,
        dataAprovacao: remota.data_aprovacao ? new Date(remota.data_aprovacao) : undefined,
      });

      await this.vistoriaRepo.salvar(vistoria);
      vistoriasAtualizadas++;
    }

    let ocorrenciasAtualizadas = 0;
    for (const ocRemota of snapshot.ocorrencias) {
      if (ocorrenciasProtegidas.has(ocRemota.id)) {
        continue;
      }

      const fotos = (fotosPorOcorrencia.get(ocRemota.id) ?? [])
        .map((f) => f.caminho_arquivo)
        .filter(Boolean);

      const ocorrencia = Ocorrencia.reidratar({
        id: ocRemota.id,
        vistoriaId: ocRemota.vistoria_id,
        itemId: ocRemota.item_id ?? undefined,
        titulo: ocRemota.titulo,
        descricao: ocRemota.descricao ?? undefined,
        gravidade: ocRemota.gravidade as GravidadeOcorrencia,
        status: ocRemota.status as StatusOcorrencia,
        fotos,
        dataCriacao: new Date(ocRemota.data_criacao),
        dataResolucao: ocRemota.data_resolucao ? new Date(ocRemota.data_resolucao) : undefined,
        dataCancelamento: ocRemota.data_cancelamento
          ? new Date(ocRemota.data_cancelamento)
          : undefined,
        solucao: ocRemota.solucao ?? undefined,
      });

      await this.ocorrenciaRepo.salvar(ocorrencia);
      ocorrenciasAtualizadas++;
    }

    let comunicadosAtualizados = 0;
    for (const comRemoto of snapshot.comunicados) {
      if (comunicadosProtegidos.has(comRemoto.id)) {
        continue;
      }
      if (!comRemoto.titulo?.trim() || !comRemoto.conteudo?.trim()) {
        continue;
      }

      const comunicado = new Comunicado({
        id: comRemoto.id,
        condominioId: comRemoto.condominio_id,
        autorId: comRemoto.autor_id,
        autorNome: comRemoto.autor_nome,
        titulo: comRemoto.titulo,
        conteudo: comRemoto.conteudo,
        dataCriacao: new Date(comRemoto.data_criacao),
        fixado: Boolean(comRemoto.fixado),
      });

      await this.comunicadoRepo.salvar(comunicado);
      comunicadosAtualizados++;
    }

    return {
      atualizado: true,
      vistorias: vistoriasAtualizadas,
      ocorrencias: ocorrenciasAtualizadas,
      comunicados: comunicadosAtualizados,
    };
  }
}
