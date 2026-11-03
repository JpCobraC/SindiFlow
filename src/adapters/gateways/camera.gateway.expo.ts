import * as ImagePicker from 'expo-image-picker';
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
      const qualidade = options?.qualidade ?? 0.8;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: Math.min(Math.max(qualidade, 0.1), 1.0),
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { status: 'cancelado' };
      }

      const asset = result.assets[0];
      const timestamp = new Date();
      const hash = `sha256_${timestamp.getTime()}_${asset.fileName || 'foto.jpg'}`;

      const foto: FotoCapturada = {
        uri: asset.uri,
        largura: asset.width ?? (options?.larguraMaxima || 1080),
        altura: asset.height ?? (options?.alturaMaxima || 1080),
        tamanhoBytes: asset.fileSize ?? 350000,
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
