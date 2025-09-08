import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getOrganizationById } from '../../utils/storage';
import { supabase } from '../../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import AnimatedTitle from '../../../components/AnimatedTitle';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [inviteCode, setInviteCode] = useState<string>('');
  const [members, setMembers] = useState<Array<{ id: string; name: string; email: string; is_admin: boolean; avatar_url?: string }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const org = await getOrganizationById(user.organizationId);
      setInviteCode(org?.inviteCode || '');
      // Fetch current user's avatar
      try {
        const { data: me } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        if (me?.avatar_url) setAvatarUrl(me.avatar_url as string);
      } catch {}

      if (user.role === 'admin' && user.organizationId) {
        setMembersLoading(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email, is_admin, organization_id, avatar_url')
            .eq('organization_id', user.organizationId)
            .order('name', { ascending: true });
          if (!error && data) {
            const mapped = data.map((p: any) => ({
              id: p.id,
              name: p.name || p.email,
              email: p.email,
              is_admin: !!p.is_admin,
              avatar_url: p.avatar_url || undefined,
            }));
            setMembers(mapped);
          }
        } finally {
          setMembersLoading(false);
        }
      } else {
        setMembers([]);
      }
    };
    load();
  }, [user?.organizationId]);

  const handleChangeAvatar = async () => {
    if (!user) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.profile.permissionNeededTitle, t.profile.permissionNeededMessage);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      if (!fileData || fileData.byteLength === 0) {
        throw new Error(t.profile.selectedFileEmpty);
      }

      const nameExt = (asset as any).fileName?.split('.').pop()?.toLowerCase();
      const guessedExt = nameExt || ((asset as any).mimeType?.includes('png') ? 'png' : (asset as any).mimeType?.includes('webp') ? 'webp' : (asset as any).mimeType?.includes('heic') ? 'heic' : 'jpg');
      const contentType = (asset as any).mimeType || (guessedExt === 'png' ? 'image/png' : guessedExt === 'webp' ? 'image/webp' : guessedExt === 'heic' ? 'image/heic' : 'image/jpeg');
      const filePath = `${user.id}/${Date.now()}.${guessedExt}`;

      // Upload to storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileData, { upsert: true, contentType });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const urlBase = publicUrl?.publicUrl;
      const url = urlBase ? `${urlBase}?t=${Date.now()}` : undefined;
      if (!url) throw new Error('Failed to get public URL');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setAvatarUrl(url);
      // Also reflect in members list if present
      setMembers(prev => prev.map(m => (m.id === user.id ? { ...m, avatar_url: url } : m)));
    } catch (e: any) {
      console.error('Avatar update error:', e);
      Alert.alert(t.common.error, e?.message || t.profile.unableUpdateProfilePicture);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t.common.logout,
      t.profile.logoutConfirmMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.logout,
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'no' : 'en';
    setLanguage(newLanguage);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedTitle text={t.settings.title} style={styles.headerTitle} />
      </View>

      <View style={styles.content}>
        {/* User Profile */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              ) : (
                <Text style={styles.avatarText}>
                  {user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <Text style={styles.profileRole}>
              {user.role === 'admin' ? t.auth.admin : t.auth.employee}
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <TouchableOpacity style={styles.settingItem} onPress={toggleLanguage}>
            <Text style={styles.settingLabel}>{t.settings.language}</Text>
            <Text style={styles.settingValue}>
              {language === 'en' ? t.settings.english : t.settings.norwegian}
            </Text>
          </TouchableOpacity>

          {user.role === 'admin' && (
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t.profile.inviteCode}</Text>
              <TouchableOpacity onPress={() => { if (inviteCode) { Alert.alert(t.profile.inviteCode, inviteCode); } }}>
                <Text style={[styles.settingValue, { textDecorationLine: 'underline' }]}>{inviteCode || '-'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>{t.common.logout}</Text>
          </TouchableOpacity>
        </View>

        {/* Organization Members (Admins) */}
        {user.role === 'admin' && (
          <View style={styles.membersCard}>
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>{t.profile.organizationMembers}</Text>
              <Text style={styles.membersCount}>{members.length}</Text>
            </View>
            <ScrollView>
            {membersLoading ? (
              <Text style={styles.membersLoading}>{t.profile.loading}</Text>
            ) : members.length === 0 ? (
              <Text style={styles.membersEmpty}>{t.profile.noMembersYet}</Text>
            ) : (
              <View>
                {members.map(m => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      {m.avatar_url ? (
                        <Image source={{ uri: m.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <Text style={styles.memberAvatarText}>
                          {(m.name || m.email).split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>
                    <Text style={[styles.memberRole, m.is_admin && { color: '#4f46e5' }]}>{m.is_admin ? t.auth.admin : t.auth.employee}</Text>
                  </View>
                ))}
              </View>
            )}
            </ScrollView>
          </View>
        )}

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.dashboard.title}</Text>
          <Text style={styles.footerSubtext}>{t.profile.version} 1.0.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  settingsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: '#6366f1',
  },
  logoutButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  membersCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  membersCount: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  membersLoading: {
    color: '#6b7280',
  },
  membersEmpty: {
    color: '#6b7280',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#374151',
    fontWeight: '700',
  },
  memberName: {
    color: '#111827',
    fontWeight: '600',
  },
  memberEmail: {
    color: '#6b7280',
    fontSize: 12,
  },
  memberRole: {
    color: '#6b7280',
    fontWeight: '600',
  },
});
