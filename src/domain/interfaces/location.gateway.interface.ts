export interface LocalizacaoDispositivo {
  latitude: number;
  longitude: number;
  /**
   * Precisão em metros. **Ausente** significa que o dispositivo não soube medir —
   * e assim deve chegar ao domínio. `expo-location` pode devolver
   * `coords.accuracy === null`, e o chamador que inventasse um valor affirmaria
   * uma medição que nunca existiu.
   */
  precisao?: number;
  timestamp: Date;
}

export interface ILocationGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  /**
   * §1.4: a geolocalização é capturada **por sessão de vistoria**, não por item.
   * Este método é o ponto único de leitura; o adapter deve rejeitar quando os
   * serviços de localização estiverem desligados, em vez de devolver lixo.
   */
  obterPosicaoAtual(): Promise<LocalizacaoDispositivo>;
}
