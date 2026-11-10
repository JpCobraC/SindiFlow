import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVistoria } from '@/src/context/VistoriaContext';
import { RoleUsuario } from '@/src/domain/entities/usuario.entity';
import { LoginModal } from './LoginModal';

export const UserHeaderBar: React.FC = () => {
  const { usuarioLogado, isOnline, toggleRede } = useVistoria();
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpenLogin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setModalVisible(true);
  };

  const handleToggleRede = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    toggleRede();
  };

  const roleStyles = getRoleTheme(usuarioLogado?.role);

  return (
    <>
      <View style={styles.container}>
        {/* Identificação do Usuário */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleOpenLogin}
          activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: roleStyles.color }]}>
            <Text style={styles.avatarText}>
              {usuarioLogado ? usuarioLogado.nome.slice(0, 2).toUpperCase() : '??'}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {usuarioLogado ? usuarioLogado.nome.split(' ')[0] : 'Entrar'}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: roleStyles.bg }]}>
                <Text style={[styles.roleText, { color: roleStyles.color }]}>
                  {roleStyles.label}
                </Text>
              </View>
            </View>
            <Text style={styles.condoSubtitle} numberOfLines={1}>
              {usuarioLogado?.unidade
                ? usuarioLogado.unidade
                : usuarioLogado?.registroProfissional
                ? usuarioLogado.registroProfissional
                : 'Edifício Solar das Palmeiras'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Indicadores de Conexão e Troca Rápida */}
        <View style={styles.actionsGroup}>
          <TouchableOpacity
            style={[
              styles.networkPill,
              isOnline ? styles.networkOnline : styles.networkOffline,
            ]}
            onPress={handleToggleRede}
            activeOpacity={0.8}>
            <View
              style={[
                styles.networkDot,
                { backgroundColor: isOnline ? '#3FB950' : '#F85149' },
              ]}
            />
            <Text style={styles.networkText}>{isOnline ? 'Online' : 'Subsolo G2'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={handleOpenLogin}
            activeOpacity={0.8}>
            <Text style={styles.switchButtonText}>Perfil ▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LoginModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

function getRoleTheme(role?: RoleUsuario) {
  switch (role) {
    case 'SINDICO':
      return {
        label: 'Síndico',
        color: '#E3B341',
        bg: 'rgba(227, 179, 65, 0.15)',
      };
    case 'INSPETOR':
      return {
        label: 'Inspetor',
        color: '#58A6FF',
        bg: 'rgba(88, 166, 255, 0.15)',
      };
    case 'CONDOMINO':
      return {
        label: 'Condômino',
        color: '#3FB950',
        bg: 'rgba(63, 185, 80, 0.15)',
      };
    default:
      return {
        label: 'Visitante',
        color: '#8B949E',
        bg: 'rgba(139, 148, 158, 0.15)',
      };
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 36,
    paddingBottom: 10,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#0D1117',
    fontWeight: 'bold',
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: '#F0F6FC',
    fontSize: 14,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  condoSubtitle: {
    color: '#8B949E',
    fontSize: 11,
    marginTop: 1,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  networkOnline: {
    backgroundColor: 'rgba(63, 185, 80, 0.12)',
    borderColor: '#238636',
  },
  networkOffline: {
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderColor: '#DA3633',
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkText: {
    fontSize: 10,
    color: '#F0F6FC',
    fontWeight: '600',
  },
  switchButton: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  switchButtonText: {
    color: '#C9D1D9',
    fontSize: 11,
    fontWeight: '600',
  },
});

