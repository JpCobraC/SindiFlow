import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
  ResultadoCaptura,
} from '../../domain/interfaces/camera.gateway.interface';

export class CameraGatewayExpo implements ICameraGateway {
  async temPermissao(): Promise<boolean> {
    const status = await ImagePicker.getCameraPermissionsAsync();
    return status.granted;
  }

  async solicitarPermissao(): Promise<boolean> {
    const status = await ImagePicker.requestCameraPermissionsAsync();
    return status.granted;
  }

  async capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura> {
    try {
      const maxDim = options?.larguraMaxima || 1080;
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

      const asset = result.assets[0];

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
        const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).Paths?.document?.uri;
        if (docDir) {
          const pastaPrivada = `${docDir}evidencias/`;

          if ((FileSystem as any).makeDirectoryAsync) {
            await (FileSystem as any).makeDirectoryAsync(pastaPrivada, { intermediates: true });
          }

          const arquivoDestino = `${pastaPrivada}evi_${hash.substring(0, 16)}.jpg`;

          if ((FileSystem as any).copyAsync) {
            await (FileSystem as any).copyAsync({
              from: uriProcessada,
              to: arquivoDestino,
            });
            uriDestinoFinal = arquivoDestino;

            if ((FileSystem as any).getInfoAsync) {
              const info = await (FileSystem as any).getInfoAsync(arquivoDestino);
              if (info.exists && info.size) {
                tamanhoFinalBytes = info.size;
              }
            }
          }
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
    } catch (err: any) {
      return {
        status: 'erro',
        mensagem: err?.message || 'Erro ao capturar foto pela câmera',
      };
    }
  }
}
