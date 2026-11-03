import * as Location from 'expo-location';
import {
  ILocationGateway,
  LocalizacaoDispositivo,
} from '../../domain/interfaces/location.gateway.interface';

export class LocationGatewayExpo implements ILocationGateway {
  async temPermissao(): Promise<boolean> {
    const { granted } = await Location.getForegroundPermissionsAsync();
    return granted;
  }

  async solicitarPermissao(): Promise<boolean> {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  }

  async obterPosicaoAtual(): Promise<LocalizacaoDispositivo> {
    const posicao = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: posicao.coords.latitude,
      longitude: posicao.coords.longitude,
      precisao: posicao.coords.accuracy ?? undefined,
      timestamp: new Date(posicao.timestamp),
    };
  }
}
