import { CriarComunicadoUseCase } from '../../src/application/use-cases/criar-comunicado.usecase';
import { ListarComunicadosUseCase } from '../../src/application/use-cases/listar-comunicados.usecase';
import { ComunicadoRepositoryInMemory } from '../../src/adapters/repositories/comunicado.repository.inmemory';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';

describe('CriarComunicadoUseCase', () => {
  it('deve criar e persistir o comunicado', async () => {
    const repo = new ComunicadoRepositoryInMemory();
    const outbox = new OutboxRepositoryInMemory();
    const useCase = new CriarComunicadoUseCase(repo, outbox);

    const resultado = await useCase.executar({
      id: 'com-1',
      condominioId: 'cond-1',
      autorId: 'sindico-1',
      autorNome: 'Dr. Carlos',
      titulo: 'Manutenção',
      conteudo: 'Aviso aos moradores',
      fixado: false,
      deviceId: 'device-abc-123',
    });

    expect(resultado.id).toBe('com-1');
    expect(resultado.titulo).toBe('Manutenção');
    expect(resultado.condominioId).toBe('cond-1');
    expect(resultado.fixado).toBe(false);

    const salvo = await repo.buscarPorId('com-1');
    expect(salvo?.id).toBe('com-1');
  });

  it('deve enfileirar na outbox — §1.3 exige que toda escrita passe pela fila', async () => {
    const repo = new ComunicadoRepositoryInMemory();
    const outbox = new OutboxRepositoryInMemory();
    const useCase = new CriarComunicadoUseCase(repo, outbox);

    await useCase.executar({
      id: 'com-1',
      condominioId: 'cond-1',
      autorId: 'sindico-1',
      autorNome: 'Dr. Carlos',
      titulo: 'Manutenção',
      conteudo: 'Aviso aos moradores',
      deviceId: 'device-abc-123',
    });

    const pendentes = await outbox.obterPendentes();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tabela).toBe('comunicados');
    expect(pendentes[0].operacao).toBe('INSERT');
    expect(pendentes[0].idRegistro).toBe('com-1');
    expect(pendentes[0].usuarioId).toBe('sindico-1');
    expect(pendentes[0].deviceId).toBe('device-abc-123');
  });

  it('deve funcionar sem o repositório de outbox informado', async () => {
    const repo = new ComunicadoRepositoryInMemory();
    const useCase = new CriarComunicadoUseCase(repo);

    await expect(
      useCase.executar({
        id: 'com-1',
        condominioId: 'cond-1',
        autorId: 'sindico-1',
        autorNome: 'Dr. Carlos',
        titulo: 'Manutenção',
        conteudo: 'Aviso',
        deviceId: 'device-abc-123',
      })
    ).resolves.toBeDefined();
  });
});

describe('ListarComunicadosUseCase', () => {
  it('deve listar comunicados do condomínio', async () => {
    const repo = new ComunicadoRepositoryInMemory();
    const criar = new CriarComunicadoUseCase(repo);
    await criar.executar({
      id: 'com-1',
      condominioId: 'cond-1',
      autorId: 'sindico-1',
      autorNome: 'Dr. Carlos',
      titulo: 'Aviso 1',
      conteudo: 'Conteúdo 1',
      deviceId: 'device-abc-123',
    });
    await criar.executar({
      id: 'com-2',
      condominioId: 'cond-2',
      autorId: 'sindico-2',
      autorNome: 'Síndico 2',
      titulo: 'Aviso 2',
      conteudo: 'Conteúdo 2',
      deviceId: 'device-abc-123',
    });

    const listar = new ListarComunicadosUseCase(repo);
    const resultado = await listar.executar('cond-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('com-1');
  });
});
