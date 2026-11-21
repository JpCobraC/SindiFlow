/**
 * SindiFlow — Bootstrap nativo
 * Camada: Infra (Frameworks & Drivers)
 *
 * Ponto único que toca SDKs nativos: abre SQLite, roda migrations, cria o
 * cliente Supabase, resolve o device id e entrega tudo ao composition root.
 *
 * O provider importa este arquivo dinamicamente dentro de `useEffect`; nada
 * aqui roda no escopo do módulo. Era exatamente esse acoplamento que derrubava
 * o app antes da primeira renderização.
 */

import { CameraGatewayExpo } from '../adapters/gateways/camera.gateway.expo';
import { FileSystemGateway } from '../adapters/gateways/file-system.gateway.real';
import { LocationGatewayExpo } from '../adapters/gateways/location.gateway.expo';
import { NetworkServiceReal } from '../adapters/gateways/network.service.real';
import { AuthGatewaySupabase } from '../adapters/gateways/auth-gateway.supabase';
import { GoogleSignInGatewayNative } from '../adapters/gateways/google-signin.gateway.native';
import { SyncGatewaySupabase } from '../adapters/gateways/sync-gateway.supabase';
import { DeviceIdSecureStore } from '../adapters/auth/device-id.secure-store';
import { SupabaseAuthStorage } from '../adapters/auth/supabase-auth-storage.secure-store';
import { ExpoSQLiteExecutor } from './db/expo-sqlite.executor';
import { runMigrations } from './db/migrations';
import { openSindiFlowDatabase } from './db/sqlite-connection';
import { carregarConfiguracao } from './config/app-config';
import { criarClienteSupabase } from './supabase-client';
import { AplicacaoComposta, comporAplicacao } from './composition-root';

export async function criarAplicacaoNativa(): Promise<AplicacaoComposta> {
  const config = carregarConfiguracao();

  const db = openSindiFlowDatabase();
  runMigrations(db);
  const executor = new ExpoSQLiteExecutor(db);

  const storage = new SupabaseAuthStorage();
  const supabase = criarClienteSupabase(
    config.supabaseUrl,
    config.supabaseAnonKey,
    storage
  );

  const deviceId = await new DeviceIdSecureStore().obter();

  return comporAplicacao({
    executor,
    authGateway: new AuthGatewaySupabase(supabase),
    googleSignInGateway: new GoogleSignInGatewayNative(
      config.googleWebClientId,
      config.googleIosClientId
    ),
    networkService: new NetworkServiceReal(),
    syncGateway: new SyncGatewaySupabase(supabase),
    fileSystemGateway: new FileSystemGateway(),
    cameraGateway: new CameraGatewayExpo(),
    locationGateway: new LocationGatewayExpo(),
    deviceId,
  });
}
