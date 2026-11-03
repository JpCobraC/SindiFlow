/**
 * Babel — configuração canônica do Expo SDK 57.
 *
 * Este arquivo faltava. O Metro resolve um default interno, então o app
 * emulsionava; o **Jest** não tem default: o `babel-jest` procurava uma config,
 * não achava, e aplicava o parser sem o preset de Flow. Resultado: qualquer
 * teste no project `ui` morria em `@react-native/jest-preset/jest/setup.js`
 * (`value(id: TimeoutID): void` — sintaxe Flow) antes de executar uma linha.
 *
 * O project `ui` foi declarado em 13/10/2026 com 0 testes, então a falha nunca
 * apareceu. Descoberto no spike de `expo-sqlite` em 16/10/2026.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};