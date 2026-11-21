/**
 * SindiFlow — Composition Root
 * Camada: Infra (Frameworks & Drivers)
 *
 * Monta os repositórios e casos de uso a partir de portas já instanciadas.
 *
 * Esta função é pura no sentido que importa para o boot: **não** abre SQLite,
 * não registra listeners e não semeia dados de demonstração. Quem faz o
 * trabalho nativo é `bootstrap.native.ts`; assim o grafo de dependências pode
 * ser testado sob Jest sem `expo-sqlite`.
 */

import { AnexarFotoUseCase } from '../application/use-cases/anexar-foto.usecase';
import { AprovarVistoriaUseCase } from '../application/use-cases/aprovar-vistoria.usecase';
import { AutenticarUsuarioUseCase } from '../application/use-cases/autenticar-usuario.usecase';
import { CapturarLocalizacaoUseCase } from '../application/use-cases/capturar-localizacao.usecase';
import { ClassificarItemChecklistUseCase } from '../application/use-cases/classificar-item.usecase';
import { CriarVistoriaUseCase } from '../application/use-cases/criar-vistoria.usecase';
import { DevolverVistoriaUseCase } from '../application/use-cases/devolver-vistoria.usecase';
import { FinalizarVistoriaUseCase } from '../application/use-cases/finalizar-vistoria.usecase';
import { RegistrarOcorrenciaUseCase } from '../application/use-cases/registrar-ocorrencia.usecase';
import { SincronizarOutboxUseCase } from '../application/use-cases/sincronizar-outbox.usecase';
import { OcorrenciaRepositorySQLite } from '../adapters/repositories/ocorrencia.repository.sqlite';
import { OutboxRepositorySQLite } from '../adapters/repositories/outbox.repository.sqlite';
import { UsuarioRepositorySQLite } from '../adapters/repositories/usuario.repository.sqlite';
import { VistoriaRepositorySQLite } from '../adapters/repositories/vistoria.repository.sqlite';
import type { ISQLiteExecutor } from '../adapters/repositories/sqlite-executor.interface';
import type { AuthGateway, GoogleSignInGateway } from '../domain/interfaces/auth.gateway.interface';
import type { ICameraGateway } from '../domain/interfaces/camera.gateway.interface';
import type { IFileSystemGateway } from '../domain/interfaces/file-system.gateway.interface';
import type { ILocationGateway } from '../domain/interfaces/location.gateway.interface';
import type { INetworkService } from '../domain/interfaces/network.service.interface';
import type { IRemoteSyncGateway } from '../domain/interfaces/remote-sync.gateway.interface';

export interface PortasAplicacao {
  executor: ISQLiteExecutor;
  authGateway: AuthGateway;
  googleSignInGateway: GoogleSignInGateway;
  networkService: INetworkService;
  syncGateway: IRemoteSyncGateway;
  fileSystemGateway: IFileSystemGateway;
  cameraGateway: ICameraGateway;
  locationGateway: ILocationGateway;
  deviceId: string;
}

export interface AplicacaoComposta {
  deviceId: string;
  repositorios: {
    vistoria: VistoriaRepositorySQLite;
    ocorrencia: OcorrenciaRepositorySQLite;
    outbox: OutboxRepositorySQLite;
    usuario: UsuarioRepositorySQLite;
  };
  casosDeUso: {
    autenticarUsuario: AutenticarUsuarioUseCase;
    criarVistoria: CriarVistoriaUseCase;
    classificarItem: ClassificarItemChecklistUseCase;
    finalizarVistoria: FinalizarVistoriaUseCase;
    registrarOcorrencia: RegistrarOcorrenciaUseCase;
    sincronizarOutbox: SincronizarOutboxUseCase;
    capturarLocalizacao: CapturarLocalizacaoUseCase;
    anexarFoto: AnexarFotoUseCase;
    aprovarVistoria: AprovarVistoriaUseCase;
    devolverVistoria: DevolverVistoriaUseCase;
  };
  gateways: {
    camera: ICameraGateway;
    location: ILocationGateway;
    fileSystem: IFileSystemGateway;
    network: INetworkService;
    sync: IRemoteSyncGateway;
  };
}

export function comporAplicacao(portas: PortasAplicacao): AplicacaoComposta {
  const vistoriaRepo = new VistoriaRepositorySQLite(portas.executor);
  const ocorrenciaRepo = new OcorrenciaRepositorySQLite(portas.executor);
  const outboxRepo = new OutboxRepositorySQLite(portas.executor);
  const usuarioRepo = new UsuarioRepositorySQLite(portas.executor);

  return {
    deviceId: portas.deviceId,
    repositorios: {
      vistoria: vistoriaRepo,
      ocorrencia: ocorrenciaRepo,
      outbox: outboxRepo,
      usuario: usuarioRepo,
    },
    casosDeUso: {
      autenticarUsuario: new AutenticarUsuarioUseCase(
        portas.authGateway,
        portas.googleSignInGateway,
        usuarioRepo,
        outboxRepo,
        portas.deviceId
      ),
      criarVistoria: new CriarVistoriaUseCase(vistoriaRepo, outboxRepo),
      classificarItem: new ClassificarItemChecklistUseCase(vistoriaRepo, outboxRepo),
      finalizarVistoria: new FinalizarVistoriaUseCase(vistoriaRepo, outboxRepo),
      registrarOcorrencia: new RegistrarOcorrenciaUseCase(ocorrenciaRepo, outboxRepo),
      sincronizarOutbox: new SincronizarOutboxUseCase(
        portas.networkService,
        outboxRepo,
        portas.syncGateway
      ),
      capturarLocalizacao: new CapturarLocalizacaoUseCase(
        portas.locationGateway,
        vistoriaRepo
      ),
      anexarFoto: new AnexarFotoUseCase(
        portas.cameraGateway,
        vistoriaRepo,
        ocorrenciaRepo,
        outboxRepo
      ),
      aprovarVistoria: new AprovarVistoriaUseCase(vistoriaRepo, outboxRepo),
      devolverVistoria: new DevolverVistoriaUseCase(vistoriaRepo, outboxRepo),
    },
    gateways: {
      camera: portas.cameraGateway,
      location: portas.locationGateway,
      fileSystem: portas.fileSystemGateway,
      network: portas.networkService,
      sync: portas.syncGateway,
    },
  };
}
