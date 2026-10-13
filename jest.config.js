/**
 * Jest — SindiFlow
 *
 * Obrigação §4.1: TDD obrigatório com cobertura mínima mensurável.
 *   Domain     ≥ 90%
 *   Application ≥ 80%
 *
 * A configuração anterior era um preset `ts-jest` único com `testEnvironment: node`
 * e `testMatch` restrito a `.ts`. Sem `coverageThreshold` a exigência de §4.1 era
 * uma afirmação sem prova, e nenhuma tela podia ser testada (T-01 em
 * `docs/rastreabilidade.md` §7).
 *
 * Dois projects, porque `jest-expo` universal executa a suíte uma vez por
 * plataforma e web é PROIBIDO por §1.1:
 *   core → domínio e aplicação (TypeScript puro, sem React Native)
 *   ui   → telas e hooks (React Native, preset iOS)
 */
module.exports = {
  // `coverageThreshold` precisa ficar na RAIZ. Dentro de um entry de `projects`
  // o Jest 29 o ignora silenciosamente e a exigência de §4.1 deixa de ter efeito
  // — foi verificado empiricamente: com o threshold no projeto, um limite de 99%
  // ainda saía com exit 0.
  coverageThreshold: {
    './src/domain/': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/application/': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    // §4.1 exige "Adapters: cobertura de mapeamento". Até 13/10 os adapters
    // ficavam fora do `collectCoverageFrom`, então o número que eu havia
    // documentado não era reproduzível — network.service.fake e
    // remote-sync.gateway.fake estavam em 0% e ninguém via.
    './src/adapters/': {
      statements: 70,
      branches: 60,
      functions: 60,
      lines: 70,
    },
  },
  projects: [
    {
      displayName: 'core',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.spec.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      clearMocks: true,
      collectCoverageFrom: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/adapters/**/*.ts',
      ],
      coveragePathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo/ios',
      testMatch: ['**/__tests__/**/*.spec.tsx'],
      clearMocks: true,
    },
  ],
};