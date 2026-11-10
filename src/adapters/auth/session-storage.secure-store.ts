/**
 * SindiFlow — SessionStorageSecureStore
 * Camada: Adapters (Auth)
 *
 * Wrapper sobre `expo-secure-store` para persistência segura de token de
 * sessão (Keychain no iOS / Keystore no Android).
 *
 * Conformidade com §1.2: token de sessão em `expo-secure-store`, nunca
 * `AsyncStorage`.
 * Conformidade com §1.1: 100% nativo, sem web.
 */

import * as SecureStore from 'expo-secure-store';
import { SessaoUsuario } from '../../domain/interfaces/auth.gateway.interface';

const CHAVE_SESSAO = 'sessao_usuario';
const CHAVE_EXPIRACAO = 'sessao_expira_em';

/**
 * Sessão de usuário armazenada de forma segura no dispositivo.
 */
export class SessionStorageSecureStore {
  /**
   * Salva a sessão no SecureStore.
   */
  async salvarSessao(sessao: SessaoUsuario): Promise<void> {
    const sessaoJson = JSON.stringify({
      id: sessao.id,
      nome: sessao.nome,
      email: sessao.email,
      role: sessao.role,
      condominioId: sessao.condominioId,
      unidade: sessao.unidade,
      registroProfissional: sessao.registroProfissional,
      accessToken: sessao.accessToken,
      refreshToken: sessao.refreshToken,
    });

    await SecureStore.setItemAsync(CHAVE_SESSAO, sessaoJson);
    await SecureStore.setItemAsync(CHAVE_EXPIRACAO, sessao.expiraEm.toISOString());
  }

  /**
   * Recupera a sessão salva, se existir.
   */
  async obterSessao(): Promise<SessaoUsuario | null> {
    const sessaoJson = await SecureStore.getItemAsync(CHAVE_SESSAO);
    const expiracaoStr = await SecureStore.getItemAsync(CHAVE_EXPIRACAO);

    if (!sessaoJson || !expiracaoStr) {
      return null;
    }

    try {
      const sessaoParse = JSON.parse(sessaoJson);
      return {
        id: sessaoParse.id,
        nome: sessaoParse.nome,
        email: sessaoParse.email,
        role: sessaoParse.role,
        condominioId: sessaoParse.condominioId,
        unidade: sessaoParse.unidade,
        registroProfissional: sessaoParse.registroProfissional,
        expiraEm: new Date(expiracaoStr),
        accessToken: sessaoParse.accessToken,
        refreshToken: sessaoParse.refreshToken,
      };
    } catch {
      return null;
    }
  }

  /**
   * Remove a sessão do SecureStore (logout).
   */
  async removerSessao(): Promise<void> {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
    await SecureStore.deleteItemAsync(CHAVE_EXPIRACAO);
  }

  /**
   * Verifica se a sessão salva está expirada.
   */
  async estaExpirada(): Promise<boolean> {
    const sessao = await this.obterSessao();
    if (!sessao) return true;

    return sessao.expiraEm.getTime() <= Date.now();
  }
}
