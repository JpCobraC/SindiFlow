import {
  AutenticacaoCanceladaError,
  ConexaoIndisponivelError,
  ErroSincronizacao,
  GeolocalizacaoObrigatoriaError,
  ItemChecklistNaoEditavelError,
  ItemCriticoSemObservacaoError,
  OcorrenciaAltaSemFotoError,
  PermissaoNegadaError,
  SessaoInvalidaError,
  VistoriaJaFinalizadaError,
  VistoriaNaoFinalizavelError,
  VistoriaPercentualIncompletoError,
} from '../domain/errors/domain-errors';

/**
 * Traduz erros técnicos (domínio, SQLite, Supabase, câmera) para mensagens
 * claras e compreensíveis pelo usuário final.
 */
export function humanizarErro(
  erro: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.'
): string {
  if (!erro) return fallback;

  if (erro instanceof OcorrenciaAltaSemFotoError) {
    return 'Ocorrências de gravidade alta exigem pelo menos uma foto antes de salvar.';
  }
  if (erro instanceof VistoriaPercentualIncompletoError) {
    return 'Responda pelo menos 80% dos itens antes de finalizar a vistoria.';
  }
  if (erro instanceof ItemCriticoSemObservacaoError) {
    return 'Itens marcados como críticos exigem uma justificativa detalhada.';
  }
  if (erro instanceof GeolocalizacaoObrigatoriaError) {
    return 'A localização GPS é obrigatória para finalizar a vistoria.';
  }
  if (erro instanceof PermissaoNegadaError) {
    return 'Permissão necessária negada. Ative o acesso nas configurações do aparelho.';
  }
  if (erro instanceof ConexaoIndisponivelError) {
    return 'Sem conexão com a internet no momento. Seus dados continuam salvos no aparelho.';
  }
  if (erro instanceof VistoriaJaFinalizadaError) {
    return 'Esta vistoria já foi finalizada e não pode ser alterada.';
  }
  if (erro instanceof ItemChecklistNaoEditavelError) {
    return 'Esta vistoria já foi concluída e não permite mais alterações.';
  }
  if (erro instanceof VistoriaNaoFinalizavelError) {
    return 'Esta vistoria não está em andamento e não pode ser finalizada.';
  }
  if (erro instanceof AutenticacaoCanceladaError) {
    return 'Entrada cancelada.';
  }
  if (erro instanceof SessaoInvalidaError) {
    return 'Não foi possível validar sua conta. Entre novamente.';
  }
  if (erro instanceof ErroSincronizacao) {
    if (erro.statusCode === 401) {
      return 'Sua sessão expirou. Faça login novamente para enviar os dados.';
    }
    if (erro.statusCode && erro.statusCode >= 400 && erro.statusCode < 500) {
      return 'Não foi possível validar os dados enviados. Verifique seu acesso ou tente reenviar.';
    }
    return 'O servidor não respondeu agora. Tentaremos enviar novamente em instantes.';
  }

  const msg = erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : '';
  const limpa = msg.trim();
  if (!limpa) return fallback;

  const lower = limpa.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (lower.includes('network request failed') || lower.includes('fetch failed') || lower.includes('timeout')) {
    return 'Sem conexão com o servidor no momento. Verifique sua internet e tente novamente.';
  }
  if (
    lower.includes('camera') &&
    (lower.includes('not available') ||
      lower.includes('not detected') ||
      lower.includes('unavailable') ||
      lower.includes('indisponível') ||
      lower.includes('no camera'))
  ) {
    return 'Não foi possível abrir a câmera neste aparelho. Você pode escolher uma foto da galeria.';
  }

  if (
    lower.includes('sqlite') ||
    lower.includes('constraint') ||
    lower.includes('pgrst') ||
    lower.includes('[supabase') ||
    lower.includes('ddl') ||
    lower.includes('outbox') ||
    lower.includes('invariante') ||
    lower.includes('filesystem')
  ) {
    return fallback;
  }

  return limpa
    .replace(/\s*\((?:RF-[A-Z0-9-]+|RF\d+(?:\/RF\d+)?|RNF\d+|Seção\s*[\d.]+|§[\d.]+)\)/gi, '')
    .trim();
}
