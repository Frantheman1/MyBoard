import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { Board, BoardSnapshot } from '../../types';
import { getBoardsByOrganizationId, listSnapshotsByOrganization, snapshotBoardAndReset, deleteSnapshot } from '../../utils/storage';
import AnimatedTitle from '../../../components/AnimatedTitle';
import { useFocusEffect } from '@react-navigation/native';

export default function AdminScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [activeBoards, setActiveBoards] = useState<Board[]>([]);
  const [snapshots, setSnapshots] = useState<BoardSnapshot[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [isBoardsOpen, setIsBoardsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    if (!user?.organizationId) return;
    const all = await getBoardsByOrganizationId(user.organizationId);
    setActiveBoards(all);
    const snaps = await listSnapshotsByOrganization(user.organizationId);
    setSnapshots(snaps);
    const submitterIds = Array.from(new Set((snaps || []).map(s => s.submittedBy).filter(Boolean) as string[]));
    if (submitterIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', submitterIds);
      const map: Record<string, string> = {};
      for (const p of (data || []) as any[]) {
        map[p.id] = p.name || p.email;
      }
      setProfileNames(map);
    } else {
      setProfileNames({});
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [user?.organizationId])
  );

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${date} ${time}`;
    } catch { return iso || ''; }
  };

  const confirmFinishBoard = (board: Board) => {
    if (!isAdmin) return;
    Alert.alert(t.admin.confirmFinishTitle, `${t.admin.confirmFinishMessage} "${board.title}".`, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.admin.finish, style: 'destructive', onPress: async () => { await snapshotBoardAndReset(board.id, undefined, false, { submittedBy: user?.id, submissionType: 'admin_finish' }); await load(); } }
    ]);
  };

  const renderSectionHeader = (title: string, count: number, onPress?: () => void, open?: boolean) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </View>
      <View style={styles.countPill}><Text style={styles.countPillText}>{count}</Text></View>
    </TouchableOpacity>
  );

  const renderBoardItem = (board: Board) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{board.title}</Text>
        <Text style={styles.cardSubtitle}>{t.admin.created}: {formatDateTime(board.createdAt)}</Text>
      </View>
      {isAdmin && (
        <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => confirmFinishBoard(board)}>
          <Text style={styles.primaryBtnText}>{t.admin.finish}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedTitle text={t.admin.title} style={styles.headerTitle} />
      </View>

      <View style={styles.content}>
        {renderSectionHeader(t.admin.boards, activeBoards.length, () => setIsBoardsOpen(prev => !prev), isBoardsOpen)}
        {isBoardsOpen && (activeBoards.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>{t.admin.noBoards}</Text></View>
        ) : (
          <FlatList
            data={activeBoards}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => renderBoardItem(item)}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        ))}

        {renderSectionHeader(t.admin.history, snapshots.length, () => setIsHistoryOpen(prev => !prev), isHistoryOpen)}
        {isHistoryOpen && (snapshots.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>{t.admin.noSnapshots}</Text></View>
        ) : (
          <FlatList
            data={snapshots}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <Swipeable
                renderRightActions={() => (
                  <TouchableOpacity
                    onPress={async () => {
                      Alert.alert(t.admin.deleteSnapshotTitle, `${item.title} (${item.finishedOn})`, [
                        { text: t.common.cancel, style: 'cancel' },
                        { text: t.common.delete, style: 'destructive', onPress: async () => { await deleteSnapshot(item.id); await load(); } }
                      ]);
                    }}
                    style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#fee2e2', borderRadius: 8, marginVertical: 6 }}
                  >
                    <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{t.common.delete}</Text>
                  </TouchableOpacity>
                )}
              >
                <View style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{t.admin.finishedOn}: {item.finishedOn}</Text>
                    <Text style={[styles.cardSubtitle, { marginTop: 2 }]}>{t.admin.by}: {item.submittedBy ? (profileNames[item.submittedBy] || item.submittedBy) : t.common.unknown}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => navigation.navigate('Snapshot', { snapshotId: item.id })}>
                    <Text style={styles.primaryBtnText}>{t.common.open}</Text>
                  </TouchableOpacity>
                </View>
              </Swipeable>
            )}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chevron: { fontSize: 18, color: '#6b7280' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  countPill: { backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  emptyState: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtn: { backgroundColor: '#6366f1' },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  dangerBtn: { backgroundColor: '#fee2e2' },
  dangerBtnText: { color: '#b91c1c', fontWeight: '700' },
});


