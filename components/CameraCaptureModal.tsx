import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FotoInAppCapturada {
  uri: string;
  width?: number;
  height?: number;
}

interface CameraCaptureModalProps {
  visible: boolean;
  onCancel: () => void;
  onCapture: (foto: FotoInAppCapturada) => void;
}

const CameraCaptureContent: React.FC<Omit<CameraCaptureModalProps, 'visible'>> = ({
  onCancel,
  onCapture,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const handleTirarFoto = async () => {
    if (!cameraRef.current || !cameraReady || capturando) return;
    try {
      setCapturando(true);
      setErroCamera(null);
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.75,
      });
      if (foto?.uri) {
        onCapture({
          uri: foto.uri,
          width: foto.width,
          height: foto.height,
        });
      }
    } catch {
      setErroCamera('Não foi possível registrar a foto agora. Tente novamente.');
      setCapturando(false);
    }
  };

  return (
    <View style={styles.container}>
      {!permission?.granted ? (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Acesso à Câmera</Text>
          <Text style={styles.permissionText}>
            Precisamos da sua permissão para tirar fotos diretamente pelo aplicativo.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              void requestPermission();
            }}
          >
            <Text style={styles.primaryBtnText}>Permitir Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
            <Text style={styles.secondaryBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            onCameraReady={() => setCameraReady(true)}
            onMountError={() =>
              setErroCamera('Não foi possível iniciar a câmera neste aparelho.')
            }
          />

          <View
            style={[
              styles.topBar,
              { paddingTop: Math.max(insets.top + 8, 24) },
            ]}
          >
            <TouchableOpacity style={styles.controlPill} onPress={onCancel}>
              <Text style={styles.controlText}>✕ Cancelar</Text>
            </TouchableOpacity>

            <View style={styles.topRightControls}>
              <TouchableOpacity
                style={[
                  styles.controlPill,
                  flash === 'on' && styles.controlPillActive,
                ]}
                onPress={() =>
                  setFlash((atual) => (atual === 'off' ? 'on' : 'off'))
                }
              >
                <Text style={styles.controlText}>
                  ⚡ {flash === 'on' ? 'Ligado' : 'Desligado'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlPill}
                onPress={() =>
                  setFacing((atual) => (atual === 'back' ? 'front' : 'back'))
                }
              >
                <Text style={styles.controlText}>🔄 Virar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {erroCamera && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{erroCamera}</Text>
            </View>
          )}

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.shutterOuter,
                (!cameraReady || capturando) && styles.shutterDisabled,
              ]}
              onPress={() => {
                void handleTirarFoto();
              }}
              disabled={!cameraReady || capturando}
              activeOpacity={0.8}
            >
              {capturando ? (
                <ActivityIndicator size="small" color="#060911" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  visible,
  onCancel,
  onCapture,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {visible ? (
        <CameraCaptureContent onCancel={onCancel} onCapture={onCapture} />
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionBox: {
    flex: 1,
    backgroundColor: '#060911',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: '#151D30',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlPill: {
    backgroundColor: 'rgba(6, 9, 17, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  controlPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.85)',
    borderColor: '#F59E0B',
  },
  controlText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.45,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
});
