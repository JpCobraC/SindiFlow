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

  it('deve tratar role ADMIN como síndico e inspetor simultaneamente', () => {
    const admin = new Usuario({
      id: 'usr-admin-1',
      nome: 'Admin',
      email: 'admin@solar.com',
      role: 'ADMIN',
      condominioId: 'cond-solar',
    });

    expect(admin.isSindico()).toBe(true);
    expect(admin.isInspetor()).toBe(true);
    expect(admin.podeAprovarVistoria()).toBe(true);
    expect(admin.podePreencherChecklist()).toBe(true);
    expect(admin.podeVisualizarLaudo('RASCUNHO')).toBe(true);
  });

  it('deve gerenciar ativo/desativar/ativar', () => {
    const usuario = new Usuario({
      id: 'usr-1',
      nome: 'Teste',
      email: 'teste@solar.com',
      role: 'SINDICO',
      condominioId: 'cond-solar',
    });

    expect(usuario.ativo).toBe(true);
    usuario.desativar();
    expect(usuario.ativo).toBe(false);
    usuario.ativar();
    expect(usuario.ativo).toBe(true);
  });

  it('deve validar campos obrigatórios restantes', () => {
    expect(() => {
      new Usuario({
        id: '1',
        nome: 'Teste',
        email: 'teste@email.com',
        role: 'SINDICO',
        condominioId: '',
      });
    }).toThrow('Condomínio ID é obrigatório.');

    expect(() => {
      new Usuario({
        id: '1',
        nome: 'Teste',
        email: 'teste@email.com',
        role: undefined as any,
        condominioId: 'cond-1',
      });
    }).toThrow('Papel (Role) do usuário é obrigatório.');
  });

  it('deve permitir condômino visualizar laudo finalizado', () => {
    const condomino = new Usuario({
      id: 'usr-condomino-1',
      nome: 'Mariana',
      email: 'mariana@solar.com',
      role: 'CONDOMINO',
      condominioId: 'cond-solar',
    });

    expect(condomino.podeVisualizarLaudo('FINALIZADA')).toBe(true);
    expect(condomino.podeVisualizarLaudo('APROVADA')).toBe(true);
    expect(condomino.podeVisualizarLaudo('RASCUNHO')).toBe(false);
  });
});


