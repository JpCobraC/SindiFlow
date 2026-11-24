import { OutboxEvent } from '../entities/outbox-event.entity';

/**
 * Porta de sincronização remota — `sindiflow-obrigacoes.md` §1.3.
 *
 * Deliberadamente retorna `Promise<void>` e **não** `Promise<boolean>`. O contrato
 * anterior devolvia um booleano que o único chamador ignorava
 * (`sincronizar-outbox.usecase.ts`), de modo que um adapter real devolvendo
 * `false` — usuário revogado, payload rejeitado — marcava o evento como
 * sincronizado e o dado sumia sem erro. Agora a falha só pode ser sinalizada
 * lançando, e erro de verdade é `ErroSincronizacao`, com o sinalizador
 * `transitorio` que C-05 precisa.
 */
export interface VistoriaRemota {
  id: string;
  condominio_id: string;
  inspetor_id: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  precisao?: number | null;
  data_criacao: string;
  data_finalizacao?: string | null;
  parecer_tecnico?: string | null;
  motivo_devolucao?: string | null;
  devolvido_por?: string | null;
  aprovado_por?: string | null;
  data_aprovacao?: string | null;
}

export interface ItemChecklistRemoto {
  id: string;
  vistoria_id: string;
  titulo: string;
  categoria: string;
  status: string;
  observacao?: string | null;
}

export interface OcorrenciaRemota {
  id: string;
  vistoria_id: string;
  item_id?: string | null;
  titulo: string;
  descricao?: string | null;
  gravidade: string;
  status: string;
  data_criacao: string;
  data_resolucao?: string | null;
  data_cancelamento?: string | null;
  solucao?: string | null;
}

export interface FotoEvidenciaRemota {
  id: string;
  item_id?: string | null;
  ocorrencia_id?: string | null;
  caminho_arquivo: string;
  hash?: string | null;
  data_captura: string;
}

export interface ComunicadoRemoto {
  id: string;
  condominio_id: string;
  autor_id: string;
  autor_nome: string;
  titulo: string;
  conteudo: string;
  data_criacao: string;
  fixado?: boolean | null;
}

export interface SnapshotRemotoCondominio {
  vistorias: VistoriaRemota[];
  itensChecklist: ItemChecklistRemoto[];
  ocorrencias: OcorrenciaRemota[];
  fotosEvidencia: FotoEvidenciaRemota[];
  comunicados: ComunicadoRemoto[];
}

export interface IRemoteSyncGateway {
  sincronizarItem(evento: OutboxEvent): Promise<void>;
  buscarSnapshotCondominio?(condominioId: string): Promise<SnapshotRemotoCondominio>;
}
