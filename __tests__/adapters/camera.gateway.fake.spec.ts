import { CameraGatewayFake } from '../../src/adapters/gateways/camera.gateway.fake';

describe('CameraGatewayFake', () => {
  let cameraGateway: CameraGatewayFake;

  beforeEach(() => {
    cameraGateway = new CameraGatewayFake();
  });

  it('deve ter permissão concedida por padrão', async () => {
    const temPermissao = await cameraGateway.temPermissao();
    expect(temPermissao).toBe(true);
  });

  it('deve permitir alterar permissão para negada', async () => {
    cameraGateway.setPermissao(false);
    const temPermissao = await cameraGateway.temPermissao();
    expect(temPermissao).toBe(false);
  });

  it('deve solicitar permissão e retornar o estado configurado', async () => {
    cameraGateway.setPermissao(false);
    const concedida = await cameraGateway.solicitarPermissao();
    expect(concedida).toBe(false);

    cameraGateway.setPermissao(true);
    const concedidaNovamente = await cameraGateway.solicitarPermissao();
    expect(concedidaNovamente).toBe(true);
  });

  it('deve capturar foto simulada com URI e dimensões máximas 1080p (RNF08)', async () => {
    const resultado = await cameraGateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    expect(resultado.status).toBe('sucesso');
    if (resultado.status !== 'sucesso') throw new Error('esperava sucesso');
    const foto = resultado.foto;

    expect(foto.uri).toContain('file:///');
    expect(foto.largura).toBeLessThanOrEqual(1080);
    expect(foto.altura).toBeLessThanOrEqual(1080);
    expect(foto.hash).toBeDefined();
    expect(foto.tamanhoBytes).toBeGreaterThan(0);
  });

  it('deve permitir configurar retorno customizado de foto', async () => {
    cameraGateway.setFotoRetorno({
      uri: 'file:///cache/custom_evidencia.jpg',
      largura: 800,
      altura: 600,
      hash: 'sha256-mock-hash-123',
    });

    const resultado = await cameraGateway.capturarFoto();
    expect(resultado.status).toBe('sucesso');
    if (resultado.status !== 'sucesso') throw new Error('esperava sucesso');
    expect(resultado.foto.uri).toBe('file:///cache/custom_evidencia.jpg');
    expect(resultado.foto.hash).toBe('sha256-mock-hash-123');
  });

  it('deve distinguir cancelamento de erro, sem crash (RNF02)', async () => {
    // Cancelar é o caminho mais comum numa tela de câmera. Com
    // `Promise<FotoCapturada>` o adapter teria de fabricar uri ou lançar.
    cameraGateway.setCancelado(true);
    const cancelado = await cameraGateway.capturarFoto();
    expect(cancelado.status).toBe('cancelado');

    cameraGateway.setCancelado(false);
    cameraGateway.setErro('Câmera ocupada');
    const erro = await cameraGateway.capturarFoto();
    expect(erro.status).toBe('erro');
    if (erro.status !== 'erro') throw new Error('esperava erro');
    expect(erro.mensagem).toBe('Câmera ocupada');
  });

  it('sempre deve devolver hash: RF-EVI-001 exige verificação da evidência', async () => {
    const resultado = await cameraGateway.capturarFoto();
    if (resultado.status !== 'sucesso') throw new Error('esperava sucesso');
    expect(resultado.foto.hash).toBeTruthy();
    expect(resultado.foto.timestamp).toBeInstanceOf(Date);
  });
});
