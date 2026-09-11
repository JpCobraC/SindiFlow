import { GeolocalizacaoInvalidaError } from '../errors/domain-errors';

export interface GeolocalizacaoProps {
  latitude: number;
  longitude: number;
  precisao?: number;
  timestamp?: Date;
}

export class Geolocalizacao {
  readonly latitude: number;
  readonly longitude: number;
  readonly precisao?: number;
  readonly timestamp: Date;

  private constructor(props: GeolocalizacaoProps) {
    if (props.latitude < -90 || props.latitude > 90) {
      throw new GeolocalizacaoInvalidaError('Latitude inválida');
    }
    if (props.longitude < -180 || props.longitude > 180) {
      throw new GeolocalizacaoInvalidaError('Longitude inválida');
    }

    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.precisao = props.precisao;
    this.timestamp = props.timestamp || new Date();
  }

  public static criar(props: GeolocalizacaoProps): Geolocalizacao {
    return new Geolocalizacao(props);
  }
}
