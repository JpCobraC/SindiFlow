import { GeolocalizacaoInvalidaError } from '../errors/domain-errors';

export interface GeolocalizacaoProps {
  latitude: number;
  longitude: number;
  /**
   * Precisão em metros reportada pelo dispositivo.
   *
   * Ausente significa "o dispositivo não soube medir" — e o valor **precisa
   * continuar ausente**. `VistoriaContext` usava `precisao || 4.5`, o que fabricava
   * uma medição de 4,5 m num laudo pericial sem nenhuma medição por trás.
   */
  precisao?: number;
  /**
   * Limite acima do qual a fixação é considerada de baixa confiança. **Não bloqueia**:
   * §3.4 prevê inspeção em garagem e casa de máquina, onde o GPS degrada. Só marca
   * a coordenada como suspeita para que o laudo não finja confiança que não tem.
   *
   * Padrão: permissivo (sem limite).
   */
  precisaoMaximaAceitavel?: number;
  timestamp?: Date;
}

export class Geolocalizacao {
  readonly latitude: number;
  readonly longitude: number;
  readonly precisao?: number;
  readonly precisaoMaximaAceitavel?: number;
  readonly timestamp: Date;

  private constructor(props: GeolocalizacaoProps) {
    // `Number.isFinite`, e não comparação de faixa: `NaN < -90` e `NaN > 90` são
    // ambos `false`, de modo que a checagem de faixa **aprovava** `NaN` — e uma
    // geolocalização inválida satisfazia RF-VIST-004.
    if (!Number.isFinite(props.latitude) || props.latitude < -90 || props.latitude > 90) {
      throw new GeolocalizacaoInvalidaError('Latitude inválida');
    }
    if (!Number.isFinite(props.longitude) || props.longitude < -180 || props.longitude > 180) {
      throw new GeolocalizacaoInvalidaError('Longitude inválida');
    }
    if (props.precisao !== undefined) {
      if (!Number.isFinite(props.precisao) || props.precisao < 0) {
        throw new GeolocalizacaoInvalidaError('Precisão inválida');
      }
    }
    if (
      props.precisaoMaximaAceitavel !== undefined &&
      (!Number.isFinite(props.precisaoMaximaAceitavel) || props.precisaoMaximaAceitavel <= 0)
    ) {
      throw new GeolocalizacaoInvalidaError('Limite de precisão inválido');
    }

    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.precisao = props.precisao;
    this.precisaoMaximaAceitavel = props.precisaoMaximaAceitavel;
    // Cópia defensiva: `readonly` num `Date` não protege nada, e
    // `timestamp.setFullYear(1999)` reescreveria a data do laudo.
    this.timestamp = new Date((props.timestamp ?? new Date()).getTime());
  }

  /** Houve alguma medição de precisão? */
  public get temPrecisao(): boolean {
    return this.precisao !== undefined;
  }

  /**
   * A fixação é confiável o bastante? Sem limite configurado, sempre sim — o
   * padrão é permissivo para não travar a inspeção em subsolo.
   */
  public get precisaoAceitavel(): boolean {
    if (this.precisaoMaximaAceitavel === undefined) return true;
    if (this.precisao === undefined) return false;
    return this.precisao <= this.precisaoMaximaAceitavel;
  }

  public static criar(props: GeolocalizacaoProps): Geolocalizacao {
    return new Geolocalizacao(props);
  }
}
