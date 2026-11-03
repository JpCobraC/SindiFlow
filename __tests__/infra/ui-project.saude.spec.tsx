import { Platform } from 'react-native';

/**
 * Saúde do project `ui`.
 *
 * Não verifica comportamento de negócio — verifica que o **project `ui`
 * consegue rodar um teste**. Ele estava declarado no `jest.config.js` desde
 * 13/10/2026 com 0 arquivos `.spec.tsx`, e por isso ninguém notou que estava
 * quebrado: faltava `babel.config.js`, o `babel-jest` não aplicava o preset de
 * Flow, e a suíte morria em `@react-native/jest-preset/jest/setup.js`
 * (`value(id: TimeoutID): void`) antes da primeira asserção.
 *
 * `Platform.OS === 'ios'` é a prova de que o preset `jest-expo/ios` foi aplicado
 * de fato — se o preset não pegasse, isto viraria `undefined`.
 *
 * Não usa `@testing-library/react-native`: o RNTL 14 pede `test-renderer@^1`, e
 * a árvore atual resolve `react-reconciler` pedindo `react@^19.3.0` contra o
 * `react@19.2.3` do projeto. Conflito de peer-dependência em aberto, registrado
 * em `docs/rastreabilidade.md`; não é escopo deste teste.
 */
describe('project ui — preset jest-expo ativo', () => {
  it('aplica o preset iOS', () => {
    expect(Platform.OS).toBe('ios');
  });

  it('carrega o módulo React Native do projeto', () => {
    expect(Platform.select({ ios: 'plataforma-ok', default: 'errado' })).toBe('plataforma-ok');
  });
});