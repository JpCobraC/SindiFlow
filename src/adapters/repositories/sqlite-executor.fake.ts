/**
 * Faker executável `ISQLiteExecutor` usando mapas em memória.
 *
 * Permite que `OutboxRepositorySQLite`, `VistoriaRepositorySQLite` e
 * `OcorrenciaRepositorySQLite` sejam instanciados e usados em ambiente
 * de teste (Jest), onde o `expo-sqlite` não está disponível (C-15).
 *
 * Na produção, substituir por `ExpoSQLiteExecutor` com banco real.
 *
 * Este fake usa os `params` passados em cada chamada em vez de fazer
 * parse regex do SQL bruto, porque os repositórios SQLite usam
 * placeholders `?`, não strings embutidas na query.
 */
import { ISQLiteExecutor, SqlParam, ResultadoExecucao } from './sqlite-executor.interface';

type LinhaVistoria = {
  id: string;
  condominio_id: string;
  inspetor_id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  data_criacao: string;
  data_finalizacao: string | null;
  updated_at: string;
};

type LinhaOcorrencia = {
  id: string;
  vistoria_id: string;
  item_id: string | null;
  titulo: string;
  descricao: string | null;
  gravidade: string;
  status: string;
  sla_horas: number;
  data_limite_sla: string;
  data_criacao: string;
  data_resolucao: string | null;
  data_cancelamento: string | null;
  solucao: string | null;
  updated_at: string;
};

type LinhaFotoEvidencia = {
  id: string;
  ocorrencia_id: string;
  item_id: string | null;
  caminho_arquivo: string;
  hash: string;
  tamanho_bytes: number | null;
  data_captura: string;
  updated_at: string;
};

type LinhaOutbox = {
  id: string;
  tabela: string;
  operacao: string;
  id_registro: string;
  payload_json: string;
  usuario_id: string;
  device_id: string;
  status: string;
  tentativas: number;
  ultimo_erro: string | null;
  proximo_retry_ms: number;
  data_ultima_tentativa: string | null;
  max_tentativas: number;
  data_criacao: string;
  data_sincronizacao: string | null;
  chave_dedup: string;
};

/** Substitui cada `?` no SQL pelo valor correspondente de `params`. */
function substituirParams(sql: string, params?: SqlParam[]): string {
  if (!params || params.length === 0) return sql;
  let indice = 0;
  return sql.replace(/\?/g, () => {
    const valor = params[indice];
    indice += 1;
    if (valor === null || valor === undefined) return 'NULL';
    if (typeof valor === 'boolean') return valor ? '1' : '0';
    if (typeof valor === 'number') return String(valor);
    const escapado = String(valor).replace(/'/g, "''");
    return `'${escapado}'`;
  });
}

function extrairTabelaInsert(sql: string): string | null {
  const match = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  return match ? match[1] : null;
}

function extrairTabelaUpdateDelete(sql: string): string | null {
  const m1 = sql.match(/UPDATE\s+(\w+)\s+SET/i);
  if (m1) return m1[1];
  const m2 = sql.match(/DELETE\s+FROM\s+(\w+)/i);
  return m2 ? m2[1] : null;
}

function extrairCondicaoWhere(sql: string, coluna: string): string | null {
  const match = sql.match(new RegExp(`WHERE\\s+${coluna}\\s*=\\s*(.+)`, 'i'));
  return match ? match[1].trim() : null;
}

function extrairValorAspas(condicao: string): string | null {
  const match = condicao.match(/^'(.*)'$/);
  return match ? match[1] : null;
}

class SQLiteExecutorFake implements ISQLiteExecutor {
  private banco = {
    vistorias: new Map<string, LinhaVistoria>(),
    ocorrencias: new Map<string, LinhaOcorrencia>(),
    fotosEvidencia: new Map<string, LinhaFotoEvidencia>(),
    outboxEvents: new Map<string, LinhaOutbox>(),
  };

  async executar(sql: string, params?: SqlParam[]): Promise<ResultadoExecucao> {
    const upper = sql.toUpperCase();

    // ---------- INSERT ----------
    if (upper.startsWith('INSERT INTO')) {
      const tabela = extrairTabelaInsert(sql);
      if (!tabela) return { alteracoes: 0 };

      const sqlComParams = substituirParams(sql, params);
      const valoresMatch = sqlComParams.match(/VALUES\s*\(([\s\S]*?)\)\s*(?:ON|$|;)/i);
      if (!valoresMatch) return { alteracoes: 0 };

      const valoresBrutos = valoresMatch[1]
        .split(',')
        .map((v) => v.trim());

      const id = extrairValorAspas(valoresBrutos[0]) ?? valoresBrutos[0];

      switch (tabela) {
        case 'vistorias': {
          const [, condominioId, inspetorId, status, latitude, longitude, precisao, dataCriacao, dataFinalizacao, updatedAt] = valoresBrutos;
          this.banco.vistorias.set(id, {
            id,
            condominio_id: extrairValorAspas(condominioId) ?? condominioId,
            inspetor_id: extrairValorAspas(inspetorId) ?? inspetorId,
            status: extrairValorAspas(status) ?? status,
            latitude: latitude === 'NULL' ? null : Number(latitude),
            longitude: longitude === 'NULL' ? null : Number(longitude),
            precisao: precisao === 'NULL' ? null : Number(precisao),
            data_criacao: extrairValorAspas(dataCriacao) ?? dataCriacao,
            data_finalizacao: dataFinalizacao === 'NULL' ? null : (extrairValorAspas(dataFinalizacao) ?? dataFinalizacao),
            updated_at: extrairValorAspas(updatedAt) ?? updatedAt,
          });
          break;
        }
        case 'ocorrencias': {
          const [, vistoriaId, itemId, titulo, descricao, gravidade, status, slaHoras, dataLimiteSla, dataCriacao, dataResolucao, dataCancelamento, solucao, updatedAt] = valoresBrutos;
          this.banco.ocorrencias.set(id, {
            id,
            vistoria_id: extrairValorAspas(vistoriaId) ?? vistoriaId,
            item_id: itemId === 'NULL' ? null : (extrairValorAspas(itemId) ?? itemId),
            titulo: extrairValorAspas(titulo) ?? titulo,
            descricao: descricao === 'NULL' ? null : (extrairValorAspas(descricao) ?? descricao),
            gravidade: extrairValorAspas(gravidade) ?? gravidade,
            status: extrairValorAspas(status) ?? status,
            sla_horas: Number(slaHoras),
            data_limite_sla: extrairValorAspas(dataLimiteSla) ?? dataLimiteSla,
            data_criacao: extrairValorAspas(dataCriacao) ?? dataCriacao,
            data_resolucao: dataResolucao === 'NULL' ? null : (extrairValorAspas(dataResolucao) ?? dataResolucao),
            data_cancelamento: dataCancelamento === 'NULL' ? null : (extrairValorAspas(dataCancelamento) ?? dataCancelamento),
            solucao: solucao === 'NULL' ? null : (extrairValorAspas(solucao) ?? solucao),
            updated_at: extrairValorAspas(updatedAt) ?? updatedAt,
          });
          break;
        }
        case 'outbox_events': {
          const [, tabelaCol, operacao, idRegistro, payloadJson, usuarioId, deviceId, statusCol, tentativas, ultimoErro, proximoRetryMs, dataUltimaTentativa, maxTentativas, dataCriacao, dataSincronizacao, chaveDedup] = valoresBrutos;
          this.banco.outboxEvents.set(id, {
            id,
            tabela: extrairValorAspas(tabelaCol) ?? tabelaCol,
            operacao: extrairValorAspas(operacao) ?? operacao,
            id_registro: extrairValorAspas(idRegistro) ?? idRegistro,
            payload_json: extrairValorAspas(payloadJson) ?? payloadJson,
            usuario_id: extrairValorAspas(usuarioId) ?? usuarioId,
            device_id: extrairValorAspas(deviceId) ?? deviceId,
            status: extrairValorAspas(statusCol) ?? statusCol,
            tentativas: Number(tentativas),
            ultimo_erro: ultimoErro === 'NULL' ? null : (extrairValorAspas(ultimoErro) ?? ultimoErro),
            proximo_retry_ms: Number(proximoRetryMs),
            data_ultima_tentativa: dataUltimaTentativa === 'NULL' ? null : (extrairValorAspas(dataUltimaTentativa) ?? dataUltimaTentativa),
            max_tentativas: Number(maxTentativas),
            data_criacao: extrairValorAspas(dataCriacao) ?? dataCriacao,
            data_sincronizacao: dataSincronizacao === 'NULL' ? null : (extrairValorAspas(dataSincronizacao) ?? dataSincronizacao),
            chave_dedup: extrairValorAspas(chaveDedup) ?? chaveDedup,
          });
          break;
        }
        case 'fotos_evidencia': {
          const [, ocorrenciaId, itemId, caminhoArquivo, hashCol, tamanhoBytes, dataCaptura, updatedAt] = valoresBrutos;
          this.banco.fotosEvidencia.set(id, {
            id,
            ocorrencia_id: extrairValorAspas(ocorrenciaId) ?? ocorrenciaId,
            item_id: itemId === 'NULL' ? null : (extrairValorAspas(itemId) ?? itemId),
            caminho_arquivo: extrairValorAspas(caminhoArquivo) ?? caminhoArquivo,
            hash: extrairValorAspas(hashCol) ?? hashCol,
            tamanho_bytes: tamanhoBytes === 'NULL' ? null : Number(tamanhoBytes),
            data_captura: extrairValorAspas(dataCaptura) ?? dataCaptura,
            updated_at: extrairValorAspas(updatedAt) ?? updatedAt,
          });
          break;
        }
        default:
          return { alteracoes: 0 };
      }
      return { alteracoes: 1 };
    }

    // ---------- UPDATE ----------
    if (upper.startsWith('UPDATE')) {
      const tabela = extrairTabelaUpdateDelete(sql);
      if (!tabela) return { alteracoes: 0 };

      const sqlComParams = substituirParams(sql, params);
      const whereId = extrairCondicaoWhere(sqlComParams, 'id');
      if (!whereId) return { alteracoes: 0 };
      const id = extrairValorAspas(whereId) ?? whereId;

      const setMatch = sqlComParams.match(/SET\s+([\s\S]*?)(?:WHERE|$)/i);
      if (!setMatch) return { alteracoes: 0 };

      const campos = setMatch[1].split(',').map((c) => c.trim());
      for (const campo of campos) {
        const partes = campo.split('=').map((c) => c.trim());
        if (partes.length < 2) continue;
        const [coluna, valorBruto] = partes;
        const valor = extrairValorAspas(valorBruto) ?? valorBruto;

        switch (tabela) {
          case 'outbox_events': {
            const evento = this.banco.outboxEvents.get(id);
            if (!evento) return { alteracoes: 0 };
            if (coluna === 'status') evento.status = valor;
            else if (coluna === 'tentativas') evento.tentativas = Number(valor);
            else if (coluna === 'ultimo_erro') evento.ultimo_erro = valor === 'NULL' ? null : valor;
            else if (coluna === 'proximo_retry_ms') evento.proximo_retry_ms = Number(valor);
            else if (coluna === 'data_ultima_tentativa') evento.data_ultima_tentativa = valor === 'NULL' ? null : valor;
            else if (coluna === 'data_sincronizacao') evento.data_sincronizacao = valor === 'NULL' ? null : valor;
            this.banco.outboxEvents.set(id, evento);
            break;
          }
        }
      }
      return { alteracoes: 1 };
    }

    // ---------- DELETE ----------
    if (upper.startsWith('DELETE FROM')) {
      const tabela = extrairTabelaUpdateDelete(sql);
      if (!tabela) return { alteracoes: 0 };
      const sqlComParams = substituirParams(sql, params);
      const whereId = extrairCondicaoWhere(sqlComParams, 'id');
      if (!whereId) return { alteracoes: 0 };
      const id = extrairValorAspas(whereId) ?? whereId;

      switch (tabela) {
        case 'outbox_events':
          this.banco.outboxEvents.delete(id);
          break;
        default:
          return { alteracoes: 0 };
      }
      return { alteracoes: 1 };
    }

    return { alteracoes: 0 };
  }

  async consultar<T>(sql: string, params?: SqlParam[]): Promise<T[]> {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT * FROM VISTORIAS')) {
      const sqlComParams = substituirParams(sql, params);
      const linhas = Array.from(this.banco.vistorias.values());
      if (sqlComParams.includes('WHERE')) {
        const whereCondominio = extrairCondicaoWhere(sqlComParams, 'condominio_id');
        if (whereCondominio) {
          const condominioId = extrairValorAspas(whereCondominio) ?? whereCondominio;
          return linhas.filter((l) => l.condominio_id === condominioId) as T[];
        }
      }
      return linhas as T[];
    }

    if (upper.startsWith('SELECT * FROM OCORRENCIAS')) {
      const sqlComParams = substituirParams(sql, params);
      const linhas = Array.from(this.banco.ocorrencias.values());
      if (sqlComParams.includes('WHERE')) {
        const whereVistoria = extrairCondicaoWhere(sqlComParams, 'vistoria_id');
        if (whereVistoria) {
          const vistoriaId = extrairValorAspas(whereVistoria) ?? whereVistoria;
          return linhas.filter((l) => l.vistoria_id === vistoriaId) as T[];
        }
      }
      return linhas as T[];
    }

    if (upper.startsWith('SELECT * FROM OUTBOX_EVENTS')) {
      return Array.from(this.banco.outboxEvents.values()) as T[];
    }

    if (upper.startsWith('SELECT * FROM FOTOS_EVIDENCIA')) {
      const sqlComParams = substituirParams(sql, params);
      const linhas = Array.from(this.banco.fotosEvidencia.values());
      if (sqlComParams.includes('WHERE')) {
        const whereOcorrencia = extrairCondicaoWhere(sqlComParams, 'ocorrencia_id');
        if (whereOcorrencia) {
          const ocorrenciaId = extrairValorAspas(whereOcorrencia) ?? whereOcorrencia;
          return linhas.filter((l) => l.ocorrencia_id === ocorrenciaId) as T[];
        }
      }
      return linhas as T[];
    }

    return [] as T[];
  }

  async consultarUm<T>(sql: string, params?: SqlParam[]): Promise<T | null> {
    const upper = sql.toUpperCase();

    if (upper.includes('FROM VISTORIAS WHERE ID')) {
      const sqlComParams = substituirParams(sql, params);
      const whereId = extrairCondicaoWhere(sqlComParams, 'id');
      if (!whereId) return null;
      const id = extrairValorAspas(whereId) ?? whereId;
      return (this.banco.vistorias.get(id) ?? null) as T | null;
    }

    if (upper.includes('FROM OCORRENCIAS WHERE ID')) {
      const sqlComParams = substituirParams(sql, params);
      const whereId = extrairCondicaoWhere(sqlComParams, 'id');
      if (!whereId) return null;
      const id = extrairValorAspas(whereId) ?? whereId;
      return (this.banco.ocorrencias.get(id) ?? null) as T | null;
    }

    if (upper.includes('FROM OUTBOX_EVENTS WHERE ID')) {
      const sqlComParams = substituirParams(sql, params);
      const whereId = extrairCondicaoWhere(sqlComParams, 'id');
      if (!whereId) return null;
      const id = extrairValorAspas(whereId) ?? whereId;
      return (this.banco.outboxEvents.get(id) ?? null) as T | null;
    }

    return null as T | null;
  }

  async emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T> {
    return operacao(this);
  }
}

export { SQLiteExecutorFake };
