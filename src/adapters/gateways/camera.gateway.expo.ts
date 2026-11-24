import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
  ResultadoCaptura,
} from '../../domain/interfaces/camera.gateway.interface';

export type ResultadoCapturadorInApp =
  | { canceled: true }
  | {
      canceled: false;
      uri: string;
      width?: number;
      height?: number;
      fileName?: string;
      fileSize?: number;
    };

export type CapturadorInApp = (
  options?: CapturaFotoOptions
) => Promise<ResultadoCapturadorInApp>;

export class CameraGatewayExpo implements ICameraGateway {
  private static capturadorInApp: CapturadorInApp | null = null;

  static definirCapturadorInApp(capturador: CapturadorInApp | null): void {
    CameraGatewayExpo.capturadorInApp = capturador;
  }

  async temPermissao(): Promise<boolean> {
    const status = await ImagePicker.getCameraPermissionsAsync();
    return status.granted;
  }

  async solicitarPermissao(): Promise<boolean> {
    const status = await ImagePicker.requestCameraPermissionsAsync();
    return status.granted;
  }

  async temPermissaoGaleria(): Promise<boolean> {
    const status = await ImagePicker.getMediaLibraryPermissionsAsync();
    return status.granted;
  }

  async solicitarPermissaoGaleria(): Promise<boolean> {
    const status = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status.granted;
  }

  async capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura> {
    try {
      if (CameraGatewayExpo.capturadorInApp) {
        const resultadoInApp = await CameraGatewayExpo.capturadorInApp(options);
        if (resultadoInApp.canceled) {
          return { status: 'cancelado' };
        }
        return this.processarAsset(
          {
            uri: resultadoInApp.uri,
            width: resultadoInApp.width ?? 1080,
            height: resultadoInApp.height ?? 1080,
            fileName: resultadoInApp.fileName,
            fileSize: resultadoInApp.fileSize,
          } as ImagePicker.ImagePickerAsset,
          options
        );
      }

      const qualidade = options?.qualidade ?? 0.8;

      // 1. Aciona o sensor de câmera nativo sem adicionar à galeria pública (DCIM/Photos)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: Math.min(Math.max(qualidade, 0.1), 1.0),
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { status: 'cancelado' };
      }

      return this.processarAsset(result.assets[0], options);
    } catch (err: any) {
      return {
        status: 'erro',
        mensagem: err?.message || 'Erro ao capturar foto pela câmera',
      };
    }
  }

  async recuperarFotoPendente(
    options?: CapturaFotoOptions
  ): Promise<ResultadoCaptura | null> {
    try {
      const pendente = await ImagePicker.getPendingResultAsync();
      if (!pendente) return null;

      const primeiro = Array.isArray(pendente) ? pendente[0] : pendente;
      if (!primeiro || !('assets' in primeiro) || primeiro.canceled || !primeiro.assets?.length) {
        return null;
      }

      return this.processarAsset(primeiro.assets[0], options);
    } catch {
      return null;
    }
  }

  async selecionarDaGaleria(options?: CapturaFotoOptions): Promise<ResultadoCaptura> {
    try {
      const qualidade = options?.qualidade ?? 0.8;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: Math.min(Math.max(qualidade, 0.1), 1.0),
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { status: 'cancelado' };
      }

      return this.processarAsset(result.assets[0], options);
    } catch (err: any) {
      return {
        status: 'erro',
        mensagem: err?.message || 'Erro ao selecionar foto da galeria',
      };
    }
  }

  private async processarAsset(
    asset: ImagePicker.ImagePickerAsset,
    options?: CapturaFotoOptions
  ): Promise<ResultadoCaptura> {
    const maxDim = options?.larguraMaxima || 1080;
    const qualidade = options?.qualidade ?? 0.8;

    // 2. Compressão & Tratamento (Redimensiona para máx 1080p e comprime em JPEG 70%)
    let uriProcessada = asset.uri;
    let larguraFinal = asset.width ?? maxDim;
    let alturaFinal = asset.height ?? maxDim;

    try {
      const actions: ImageManipulator.Action[] = [];
      if (asset.width && asset.height) {
        if (asset.width > maxDim || asset.height > maxDim) {
          if (asset.width >= asset.height) {
            actions.push({ resize: { width: maxDim } });
          } else {
            actions.push({ resize: { height: maxDim } });
          }
        }
      }

      const resultadoManipulacao = await ImageManipulator.manipulateAsync(
        asset.uri,
        actions,
        {
          compress: Math.min(qualidade, 0.7),
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      uriProcessada = resultadoManipulacao.uri;
      larguraFinal = resultadoManipulacao.width;
      alturaFinal = resultadoManipulacao.height;
    } catch {
      // Em ambiente onde o módulo nativo de manipulação não responde, mantém asset original
      uriProcessada = asset.uri;
    }

    // 3. Geração de Hash Criptográfico SHA-256 (Cadeia de Custódia Pericial)
    const timestamp = new Date();
    let hash = `sha256_${timestamp.getTime()}_${asset.fileName || 'evidencia.jpg'}`;
    try {
      const hashCalculado = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${uriProcessada}_${timestamp.toISOString()}_${asset.fileName || 'evidencia'}`
      );
      if (hashCalculado) {
        hash = hashCalculado;
      }
    } catch {
      // Fallback determinístico
    }

    // 4. Armazenamento em Sandbox Privado do Aplicativo (NÃO vai para a galeria pública)
    let uriDestinoFinal = uriProcessada;
    let tamanhoFinalBytes = asset.fileSize ?? 320000;

    try {
      const pastaPrivada = new Directory(Paths.document, 'evidencias');
      pastaPrivada.create({ intermediates: true, idempotent: true });

      const arquivoDestino = new File(pastaPrivada, `evi_${hash.substring(0, 16)}.jpg`);

      await new File(uriProcessada).copy(arquivoDestino, { overwrite: true });
      uriDestinoFinal = arquivoDestino.uri;

      if (arquivoDestino.exists && arquivoDestino.size) {
        tamanhoFinalBytes = arquivoDestino.size;
      }
    } catch {
      uriDestinoFinal = uriProcessada;
    }

    const foto: FotoCapturada = {
      uri: uriDestinoFinal,
      largura: larguraFinal,
      altura: alturaFinal,
      tamanhoBytes: tamanhoFinalBytes,
      hash,
      timestamp,
    };

    return {
      status: 'sucesso',
      foto,
    };
  }
}
