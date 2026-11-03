import * as ImagePicker from 'expo-image-picker';
import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
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

  async capturarFoto(options?: CapturaFotoOptions): Promise<FotoCapturada> {
    const qualidade = options?.qualidade ?? 0.8;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: Math.min(Math.max(qualidade, 0.1), 1.0),
      allowsEditing: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw new Error('Captura de foto cancelada pelo usuário');
    }

    const asset = result.assets[0];
    const timestamp = Date.now();
    const hash = `sha256_${timestamp}_${asset.fileName || 'foto'}`;

    return {
      uri: asset.uri,
      largura: asset.width,
      altura: asset.height,
      tamanhoBytes: asset.fileSize,
      hash,
    };
  }
}
