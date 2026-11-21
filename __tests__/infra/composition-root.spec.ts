/**
 * Boot do grafo de dependências.
 *
 * O objetivo desta suíte é impedir a volta do incidente de boot: o provider
 * importava SQLite e semeava uma vistoria de demonstração no escopo do módulo.
 * Aqui o grafo é montado com um executor em memória e deve começar vazio.
 */
import { comporAplicacao } from '../../src/infra/composition-root';
import { SQLiteExecutorFake } from '../fakes/sqlite-executor-in-memory.fake';
import {
  AuthGatewayFake,
  GoogleSignInGatewayFake,
} from '../fakes/auth-gateway.fake';
import { CameraGatewayFake } from '../../src/adapters/gateways/camera.gateway.fake';
import { LocationGatewayFake } from '../../src/adapters/gateways/location.gateway.fake';
import { RemoteSyncGatewayFake } from '../../src/adapters/gateways/remote-sync.gateway.fake';
import { EstadoRede, INetworkService } from '../../src/domain/interfaces/network.service.interface';
import { IFileSystemGateway } from '../../src/domain/interfaces/file-system.gateway.interface';

class NetworkServiceFake implements INetworkService {
  async estadoConexao(): Promise<EstadoRede> {
    return EstadoRede.ONLINE;
  }

  async estaConectado(): Promise<boolean> {
    return true;
  }
}

class FileSystemGatewayFake implements IFileSystemGateway {
  async salvarArquivo(): Promise<void> {}
  async lerArquivo(): Promise<string> {
    return '';
  }
  async arquivoExiste(): Promise<boolean> {
    return false;
  }
  async removerArquivo(): Promise<void> {}
  async criarDiretorio(): Promise<void> {}
}

function compor() {
  const authGateway = new AuthGatewayFake();
  const googleGateway = new GoogleSignInGatewayFake();

  return {
    authGateway,
    googleGateway,
    app: comporAplicacao({
      executor: new SQLiteExecutorFake(),
      authGateway,
      googleSignInGateway: googleGateway,
      networkService: new NetworkServiceFake(),
      syncGateway: new RemoteSyncGatewayFake(),
      fileSystemGateway: new FileSystemGatewayFake(),
      cameraGateway: new CameraGatewayFake(),
      locationGateway: new LocationGatewayFake(),
      deviceId: 'device-teste',
    }),
  };
}

describe('comporAplicacao', () => {
  it('monta o grafo sem semear vistorias, ocorrências, outbox ou usuários', async () => {
    const { app } = compor();

    await expect(
      app.repositorios.vistoria.listarPorCondominio('cond-1')
    ).resolves.toEqual([]);
    await expect(app.repositorios.ocorrencia.listarTodas()).resolves.toEqual([]);
    await expect(app.repositorios.outbox.listarTodos()).resolves.toEqual([]);
    await expect(app.repositorios.usuario.buscarPorId('usr-1')).resolves.toBeNull();
  });

  it('injeta as portas de auth e Google no caso de uso de login', async () => {
    const { app, authGateway, googleGateway } = compor();

    const usuario = await app.casosDeUso.autenticarUsuario.executar({
      metodo: 'google',
    });

    expect(googleGateway.obterIdToken).toHaveBeenCalledTimes(1);
    expect(authGateway.loginComIdToken).toHaveBeenCalledWith('google-id-token');
    expect(usuario.id).toBe('usr-1');
    await expect(app.repositorios.usuario.buscarPorId('usr-1')).resolves.not.toBeNull();
  });

  it('expõe o deviceId recebido para as escritas da outbox', async () => {
    const { app } = compor();

    await app.casosDeUso.autenticarUsuario.executar({ metodo: 'google' });

    const [evento] = await app.repositorios.outbox.listarTodos();
    expect(evento.deviceId).toBe('device-teste');
  });
});
