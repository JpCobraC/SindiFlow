import {
  ConexaoIndisponivelError,
  ErroSincronizacao,
  GeolocalizacaoObrigatoriaError,
  ItemCriticoSemObservacaoError,
  OcorrenciaAltaSemFotoError,
  PermissaoNegadaError,
  VistoriaJaFinalizadaError,
  VistoriaPercentualIncompletoError,
} from '../../src/domain/errors/domain-errors';
import { humanizarErro } from '../../src/utils/error-messages';

describe('humanizarErro', () => {
  it('traduz erros de domínio sem expor siglas técnicas', () => {
    const erros = [
      new OcorrenciaAltaSemFotoError(),
      new VistoriaPercentualIncompletoError(),
      new ItemCriticoSemObservacaoError(),
      new GeolocalizacaoObrigatoriaError(),
      new PermissaoNegadaError('Câmera'),
      new ConexaoIndisponivelError(),
      new VistoriaJaFinalizadaError('vist-1'),
    ];

    for (const err of erros) {
      const msg = humanizarErro(err);
      expect(msg).not.toMatch(/RF-|RNF|§|Seção|SQLite|outbox/i);
      expect(msg.length).toBeGreaterThan(10);
    }
  });

  it('traduz ErroSincronizacao conforme status HTTP', () => {
    expect(humanizarErro(new ErroSincronizacao('401', true, 401))).toContain('sessão expirou');
    expect(humanizarErro(new ErroSincronizacao('403', false, 403))).toContain('validar os dados');
    expect(humanizarErro(new ErroSincronizacao('503', true, 503))).toContain('não respondeu');
  });

  it('oculta mensagens técnicas de banco/Supabase/rede e usa fallback amigável', () => {
    expect(
      humanizarErro(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: outbox_events.id'))
    ).toBe('Não foi possível concluir a operação. Tente novamente.');
    expect(humanizarErro(new Error('[Supabase PGRST204] Could not find column'))).toBe(
      'Não foi possível concluir a operação. Tente novamente.'
    );
    expect(humanizarErro(new Error('Invalid login credentials'))).toBe(
      'E-mail ou senha incorretos.'
    );
    expect(humanizarErro(new Error('Camera not available on simulator'))).toContain('galeria');
  });
});
