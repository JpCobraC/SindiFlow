/**
 * Faker executável `ISQLiteExecutor` usando mapas em memória.
 *
 * Permite que `OutboxRepositorySQLite` e `VistoriaRepositorySQLite`
 * sejam instanciados e usados em ambiente de teste (Jest), onde o
 * `expo-sqlite` não está disponível (C-15).
 *
 * Na produção, substituir por `ExpoSQLiteExecutor` com banco real.
 */
import { ISQLiteExecutor, SqlParam, ResultadoExecucao } from './sqlite-executor.interface';

/**
 * Estado interno simulando tabelas do banco de dados.
 */
interface BancoDadosSimulado {
  vistorias: Map<string, LinhaVistoria>;
  itensChecklist: Map<string, LinhaItemChecklist>;
  fotosEvidencia: Map<string, LinhaFotoEvidencia>;
  outboxEvents: Map<string, LinhaOutbox>;
  users: Map<string, LinhaUser>;
}

interface LinhaVistoria {
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
}

interface LinhaItemChecklist {
  id: string;
  vistoria_id: string;
  titulo: string;
  categoria: string;
  status: string;
  observacao: string | null;
  vistoria_finalizada: boolean;
}

interface LinhaFotoEvidencia {
  id: string;
  vistoria_id: string;
  uri_local: string;
  hash: string;
  status_upload: string;
}

interface LinhaOutbox {
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
}

interface LinhaUser {
  id: string;
  email: string | null;
  condomnio_id: string | null;
  role: string | null;
  criado_em: string;
}

class SQLiteExecutorFake implements ISQLiteExecutor {
  private banco: BancoDadosSimulado = {
    vistorias: new Map(),
    itensChecklist: new Map(),
    fotosEvidencia: new Map(),
    outboxEvents: new Map(),
    users: new Map(),
  };

  async executar(sql: string, params?: SqlParam[]): Promise<ResultadoExecucao> {
    // Parse simples INSERT/UPDATE/DELETE para execução em memória
    const upper = sql.toUpperCase();

    if (upper.startsWith('INSERT INTO vistorias')) {
      // Extrair valores do INSERT (padrão simplificado)
      const match = sql.match(/VALUES\s*\((.*?)\)/s);
      if (match) {
        const valores = match[1].split(',').map(v => v.trim());
        const id = this.extrairValor(valores[0]);
        this.banco.vistorias.set(id, {
          id,
          condominio_id: this.extrairValor(valores[1]),
          inspetor_id: this.extrairValor(valores[2]),
          status: this.extrairValor(valores[3]),
          latitude: this.tipoNumero(this.extrairValor(valores[4])),
          longitude: this.tipoNumero(this.extrairValor(valores[5])),
          precisao: this.tipoNumero(this.extrairValor(valores[6])),
          data_criacao: this.extrairValor(valores[7]),
          data_finalizacao: this.extrairValor(valores[8]),
          updated_at: this.extrairValor(valores[9]),
        });
      }
      return { alteracoes: 1 };
    }

    if (upper.startsWith('INSERT INTO outbox_events')) {
      const match = sql.match(/VALUES\s*\((.*?)\)/s);
      if (match) {
        const valores = match[1].split(',').map(v => v.trim());
        const id = this.extrairValor(valores[0]);
        this.banco.outboxEvents.set(id, {
          id,
          tabela: this.extrairValor(valores[1]),
          operacao: this.extrairValor(valores[2]),
          id_registro: this.extrairValor(valores[3]),
          payload_json: this.extrairValor(valores[4]),
          usuario_id: this.extrairValor(valores[5]),
          device_id: this.extrairValor(valores[6]),
          status: this.extrairValor(valores[7]),
          tentativas: parseInt(this.extrairValor(valores[8]), 10) || 0,
          ultimo_erro: this.extrairValor(valores[9]) || null,
          proximo_retry_ms: parseInt(this.extrairValor(valores[10]), 10) || 1000,
          data_ultima_tentativa: this.extrairValor(valores[11]) || null,
          max_tentativas: parseInt(this.extrairValor(valores[12]), 10) || 5,
          data_criacao: this.extrairValor(valores[13]) || new Date().toISOString(),
          data_sincronizacao: this.extrairValor(valores[14]) || null,
          chave_dedup: this.extrairValor(valores[15]) || '',
        });
      }
      return { alteracoes: 1 };
    }

    if (upper.startsWith('UPDATE outbox_events')) {
      // Extrair id do WHERE
      const match = sql.match(/WHERE\s+id\s*=\s*['"]([^'"]+)['"]/i);
      if (match && match[1]) {
        const id = match[1];
        const evento = this.banco.outboxEvents.get(id);
        if (evento) {
          // Atualizar campos simples
          const fields = sql.toUpperCase().match(/SET\s+([^;]+)/i);
          if (fields) {
            // Apenas marcar como sincronizado como exemplo
            if (fields[0].toUpperCase().includes('SINCRONIZADO')) {
              evento.status = 'SINCRONIZADO';
              evento.data_sincronizacao = new Date().toISOString();
            }
          }
        }
      }
      return { alteracoes: 1 };
    }

    if (upper.startsWith('SELECT * FROM vistorias')) {
      const linhas = Array.from(this.banco.vistorias.values());
      return { alteracoes: linhas.length }; // usado como contador, mas consultar usa consultar
    }

    if (upper.startsWith('SELECT * FROM outbox_events')) {
      const linhas = Array.from(this.banco.outboxEvents.values());
      return { alteracoes: linhas.length };
    }

    // Default: não fazer nada
    return { alteracoes: 0 };
  }

  async consultar<T>(sql: string, params?: SqlParam[]): Promise<T[]> {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT * FROM vistorias')) {
      return Array.from(this.banco.vistorias.values()) as T[];
    }

    if (upper.startsWith('SELECT * FROM outbox_events')) {
      return Array.from(this.banco.outboxEvents.values()) as T[];
    }

    if (upper.startsWith('SELECT * FROM itens_checklist')) {
      return Array.from(this.banco.itensChecklist.values()) as T[];
    }

    if (upper.startsWith('SELECT * FROM fotos_evidencia')) {
      return Array.from(this.banco.fotosEvidencia.values()) as T[];
    }

    if (upper.startsWith('SELECT * FROM users')) {
      return Array.from(this.banco.users.values()) as T[];
    }

    return [] as T[];
  }

  async consultarUm<T>(sql: string, params?: SqlParam[]): Promise<T | null> {
    const upper = sql.toUpperCase();

    if (upper.includes('FROM vistorias WHERE id')) {
      const match = sql.match(/WHERE\s+id\s*=\s*['"]([^'"]+)['"]/i);
      const id = match ? match[1] : null;
      const linha = id ? this.banco.vistorias.get(id) : null;
      return linha as T | null;
    }

    if (upper.includes('FROM outbox_events WHERE id')) {
      const match = sql.match(/WHERE\s+id\s*=\s*['"]([^'"]+)['"]/i);
      const id = match ? match[1] : null;
      const linha = id ? this.banco.outboxEvents.get(id) : null;
      return linha as T | null;
    }

    return null as T | null;
  }

  async emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T> {
    return operacao(this);
  }

  private extrairValor(texto: string): string {
    const cleaned = texto.replace(/['"]/g, '').trim();
    return cleaned;
  }

  private tipoNumero(texto: string): number | null {
    const num = parseFloat(texto);
    return isNaN(num) ? null : num;
  }
}

export { SQLiteExecutorFake };