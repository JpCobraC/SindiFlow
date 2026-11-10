import { Usuario } from '../../src/domain/entities/usuario.entity';

describe('Usuario Entity', () => {
  it('deve instanciar um usuário válido com role SINDICO', () => {
    const usuario = new Usuario({
      id: 'usr-sindico-1',
      nome: 'Carlos Alberto',
      email: 'sindico@solar.com',
      role: 'SINDICO',
      condominioId: 'cond-solar',
    });

    expect(usuario.id).toBe('usr-sindico-1');
    expect(usuario.isSindico()).toBe(true);
    expect(usuario.podeAprovarVistoria()).toBe(true);
    expect(usuario.isInspetor()).toBe(false);
    expect(usuario.isCondomino()).toBe(false);
  });

  it('deve instanciar um usuário válido com role CONDOMINO com unidade', () => {
    const condomino = new Usuario({
      id: 'usr-condomino-1',
      nome: 'Mariana Souza',
      email: 'mariana@solar.com',
      role: 'CONDOMINO',
      condominioId: 'cond-solar',
      unidade: 'Apto 402 Bloco B',
    });

    expect(condomino.isCondomino()).toBe(true);
    expect(condomino.podeAprovarVistoria()).toBe(false);
    expect(condomino.podePreencherChecklist()).toBe(false);
    expect(condomino.podeVisualizarLaudo('RASCUNHO')).toBe(false);
    expect(condomino.podeVisualizarLaudo('APROVADA')).toBe(true);
    expect(condomino.unidade).toBe('Apto 402 Bloco B');
  });

  it('deve instanciar um usuário válido com role INSPETOR com CREA', () => {
    const inspetor = new Usuario({
      id: 'usr-insp-1',
      nome: 'Eng. Carlos Eduardo',
      email: 'inspetor@solar.com',
      role: 'INSPETOR',
      condominioId: 'cond-solar',
      registroProfissional: 'CREA 50692-SP',
    });

    expect(inspetor.isInspetor()).toBe(true);
    expect(inspetor.podePreencherChecklist()).toBe(true);
    expect(inspetor.registroProfissional).toBe('CREA 50692-SP');
  });

  it('deve lançar erro se email for inválido ou campos obrigatórios faltarem', () => {
    expect(() => {
      new Usuario({
        id: '',
        nome: 'Teste',
        email: 'invalido',
        role: 'SINDICO',
        condominioId: 'cond-1',
      });
    }).toThrow('ID do usuário é obrigatório.');

    expect(() => {
      new Usuario({
        id: '1',
        nome: '',
        email: 'teste@email.com',
        role: 'SINDICO',
        condominioId: 'cond-1',
      });
    }).toThrow('Nome do usuário é obrigatório.');

    expect(() => {
      new Usuario({
        id: '1',
        nome: 'Teste',
        email: 'emailsemarroba.com',
        role: 'SINDICO',
        condominioId: 'cond-1',
      });
    }).toThrow('Email inválido.');
  });
});

