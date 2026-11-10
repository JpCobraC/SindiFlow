import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVistoria } from '@/src/context/VistoriaContext';
import { RoleUsuario } from '@/src/domain/entities/usuario.entity';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose }) => {
  const { usuarioLogado, loginRapido, fazerLogin, fazerLogout, usuariosDisponiveis } =
    useVistoria();

  const [emailInput, setEmailInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [roleInput, setRoleInput] = useState<RoleUsuario>('SINDICO');
  const [erro, setErro] = useState<string | null>(null);

  const handleSelectRole = async (role: RoleUsuario) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await loginRapido(role);
      setErro(null);
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao alternar perfil');
    }
  };

  const handleCustomLogin = async () => {
    if (!emailInput.trim()) {
      setErro('Informe um email válido.');
      return;
    }
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await fazerLogin(emailInput, senhaInput);
      setErro(null);
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Erro na autenticação');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Autenticação & Perfis</Text>
              <Text style={styles.subtitle}>
                Controle de Acesso Baseado em Papéis (RBAC - RF01/RF19)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {erro && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{erro}</Text>
              </View>
            )}

            {/* Perfil Ativo Atual */}
            {usuarioLogado && (
              <View style={styles.currentProfileCard}>
                <View style={styles.currentProfileHeader}>
                  <Text style={styles.sectionLabel}>PERFIL CONECTADO ATUALMENTE</Text>
                  <TouchableOpacity onPress={fazerLogout} style={styles.logoutBtn}>
                    <Text style={styles.logoutBtnText}>Desconectar</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.profileRow}>
                  <View style={[styles.avatarBadge, getRoleStyle(usuarioLogado.role).badge]}>
                    <Text style={styles.avatarText}>
                      {usuarioLogado.nome.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileDetails}>
                    <Text style={styles.profileName}>{usuarioLogado.nome}</Text>
                    <Text style={styles.profileRole}>
                      {getRoleLabel(usuarioLogado.role)}{' '}
                      {usuarioLogado.unidade ? `• ${usuarioLogado.unidade}` : ''}
                      {usuarioLogado.registroProfissional
                        ? `• ${usuarioLogado.registroProfissional}`
                        : ''}
                    </Text>
                    <Text style={styles.profileEmail}>{usuarioLogado.email}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Seleção Rápida de Perfis em 1 Toque */}
            <Text style={styles.sectionLabel}>ACESSO RÁPIDO PARA AVALIAÇÃO (1 TOQUE)</Text>
            <Text style={styles.sectionHelp}>
              Alterne instantaneamente para testar a experiência de cada tipo de usuário:
            </Text>

            {usuariosDisponiveis.map((u) => {
              const isSelected = usuarioLogado?.role === u.role;
              const roleStyles = getRoleStyle(u.role);

              return (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.roleCard,
                    isSelected && styles.roleCardSelected,
                    { borderLeftColor: roleStyles.color, borderLeftWidth: 4 },
                  ]}
                  onPress={() => handleSelectRole(u.role)}
                  activeOpacity={0.7}>
                  <View style={styles.roleCardTop}>
                    <View style={styles.roleTitleGroup}>
                      <Text style={styles.roleCardName}>{u.nome}</Text>
                      <View style={[styles.roleTag, { backgroundColor: roleStyles.bg }]}>
                        <Text style={[styles.roleTagText, { color: roleStyles.color }]}>
                          {getRoleLabel(u.role)}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.activeCheck}>
                        <Text style={styles.activeCheckText}>ATIVO</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.roleDesc}>{getRoleDescription(u.role)}</Text>

                  <View style={styles.roleMeta}>
                    <Text style={styles.roleMetaText}>📧 {u.email}</Text>
                    {u.registroProfissional && (
                      <Text style={styles.roleMetaText}>📜 {u.registroProfissional}</Text>
                    )}
                    {u.unidade && <Text style={styles.roleMetaText}>🏢 {u.unidade}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Formulário Dinâmico de Login */}
            <View style={styles.formContainer}>
              <Text style={styles.sectionLabel}>OU ACESSE COM OUTRAS CREDENCIAIS</Text>

              <TextInput
                style={styles.input}
                placeholder="E-mail profissional ou do morador"
                placeholderTextColor="#8B949E"
                keyboardType="email-address"
                autoCapitalize="none"
                value={emailInput}
                onChangeText={setEmailInput}
              />

              <TextInput
                style={styles.input}
                placeholder="Senha de acesso"
                placeholderTextColor="#8B949E"
                secureTextEntry
                value={senhaInput}
                onChangeText={setSenhaInput}
              />

              <TouchableOpacity
                style={styles.loginActionBtn}
                onPress={handleCustomLogin}
                activeOpacity={0.8}>
                <Text style={styles.loginActionBtnText}>Entrar no SindiFlow</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

function getRoleLabel(role: RoleUsuario): string {
  switch (role) {
    case 'SINDICO':
      return 'Síndico Geral';
    case 'INSPETOR':
      return 'Inspetor Técnico (CREA)';
    case 'CONDOMINO':
      return 'Condômino / Morador';
    case 'ADMIN':
      return 'Administrador do Sistema';
  }
}

function getRoleDescription(role: RoleUsuario): string {
  switch (role) {
    case 'SINDICO':
      return 'Aprovação de laudos periciais NBR 5674, controle de SLAs críticos (24h/72h) e comunicados prediais oficiais.';
    case 'INSPETOR':
      return 'Execução de checklist técnico, registro de anomalias com evidência fotográfica privada e geolocalização mandante.';
    case 'CONDOMINO':
      return 'Consulta de laudos periciais homologados, abertura de ocorrências em áreas comuns e mural de avisos.';
    default:
      return 'Acesso integral à plataforma.';
  }
}

function getRoleStyle(role: RoleUsuario) {
  switch (role) {
    case 'SINDICO':
      return { color: '#E3B341', bg: 'rgba(227, 179, 65, 0.15)', badge: { backgroundColor: '#E3B341' } };
    case 'INSPETOR':
      return { color: '#58A6FF', bg: 'rgba(88, 166, 255, 0.15)', badge: { backgroundColor: '#58A6FF' } };
    case 'CONDOMINO':
      return { color: '#3FB950', bg: 'rgba(63, 185, 80, 0.15)', badge: { backgroundColor: '#3FB950' } };
    default:
      return { color: '#A371F7', bg: 'rgba(163, 113, 247, 0.15)', badge: { backgroundColor: '#A371F7' } };
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0D1117',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#30363D',
    maxHeight: '90%',
    paddingBottom: 20,
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#30363D',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  subtitle: {
    fontSize: 11,
    color: '#8B949E',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#C9D1D9',
    fontSize: 14,
    fontWeight: 'bold',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderColor: '#F85149',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#F85149',
    fontSize: 12,
  },
  currentProfileCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  currentProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#21262D',
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#F85149',
    fontSize: 11,
    fontWeight: '600',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#0D1117',
    fontWeight: 'bold',
    fontSize: 16,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    color: '#F0F6FC',
    fontSize: 15,
    fontWeight: '700',
  },
  profileRole: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 2,
  },
  profileEmail: {
    color: '#58A6FF',
    fontSize: 11,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B949E',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionHelp: {
    fontSize: 12,
    color: '#8B949E',
    marginBottom: 12,
  },
  roleCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  roleCardSelected: {
    borderColor: '#58A6FF',
    backgroundColor: '#1C2128',
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCardName: {
    color: '#F0F6FC',
    fontSize: 15,
    fontWeight: '700',
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  activeCheck: {
    backgroundColor: '#238636',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeCheckText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  roleDesc: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  roleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
    paddingTop: 8,
  },
  roleMetaText: {
    fontSize: 11,
    color: '#8B949E',
  },
  formContainer: {
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  input: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F0F6FC',
    fontSize: 13,
    marginBottom: 10,
  },
  loginActionBtn: {
    backgroundColor: '#238636',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  loginActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

