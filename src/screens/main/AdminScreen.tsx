import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ScrollView } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { Board, BoardSnapshot } from '../../types';
import { getBoardsByOrganizationId, listSnapshotsByOrganization, snapshotBoardAndReset, deleteSnapshot, getOrganizationSettings } from '../../utils/storage';
import AnimatedTitle from '../../../components/AnimatedTitle';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import Card from '../../components/ui/Card';

export default function AdminScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [activeBoards, setActiveBoards] = useState<Board[]>([]);
  const [snapshots, setSnapshots] = useState<BoardSnapshot[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [isBoardsOpen, setIsBoardsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openDateFolders, setOpenDateFolders] = useState<Set<string>>(new Set());
  const { theme } = useTheme();
  const [resetOnSubmit, setResetOnSubmit] = useState(true);

  const isAdmin = user?.role === 'admin';

  const load = async (activeRef?: { current: boolean }) => {
    if (!user?.organizationId) return;
    const all = await getBoardsByOrganizationId(user.organizationId);
    if (activeRef && activeRef.current === false) return; 
    setActiveBoards(all);
     const snaps = await listSnapshotsByOrganization(user.organizationId);
     if (activeRef && activeRef.current === false) return; 
     setSnapshots(snaps);
    try {
      const settings = await getOrganizationSettings(user.organizationId);
      if (activeRef && activeRef.current === false) return;
      setResetOnSubmit(!!settings.resetOnSubmit);
    } catch {}
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
      if (activeRef && activeRef.current === false) return; setProfileNames(map);
    } else {
        if (activeRef && activeRef.current === false) return; setProfileNames({});
    }
  };

  useFocusEffect(
       useCallback(() => {
         const active = { current: true };
         (async () => {
           if (!user?.organizationId) return;
           await load(active);
         })();
         return () => { active.current = false; };
       }, [user?.organizationId])
     ); 

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      return `${date}`;
    } catch { return iso || ''; }
  };

  const formatEUDate = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      // Format: dd/mm/yyyy
      return d.toLocaleDateString('en-GB'); 
    } catch {
      return iso || '';
    }
  };

  // Group snapshots by date
  const snapshotsByDate = useMemo(() => {
    const grouped: { [date: string]: BoardSnapshot[] } = {};
    
    snapshots.forEach(snapshot => {
      const dateKey = formatEUDate(snapshot.finishedOn);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(snapshot);
    });
    
    // Sort dates in descending order (most recent first)
    return Object.entries(grouped).sort((a, b) => {
      const dateA = new Date(a[1][0].finishedOn || '');
      const dateB = new Date(b[1][0].finishedOn || '');
      return dateB.getTime() - dateA.getTime();
    });
  }, [snapshots]);

  const toggleDateFolder = (date: string) => {
    setOpenDateFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const confirmFinishBoard = (board: Board) => {
    if (!isAdmin) return;
    Alert.alert(t.admin.confirmFinishTitle, `${t.admin.confirmFinishMessage} "${board.title}".`, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.admin.finish, style: 'destructive', onPress: async () => { await snapshotBoardAndReset(board.id, undefined, false, { submittedBy: user?.id, submissionType: 'admin_finish' }, resetOnSubmit); await load(); } }
    ]);
  };

  const renderSectionHeader = (title: string, count: number, onPress?: () => void, open?: boolean) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.chevron, { color: theme.colors.secondaryText }]}>{open ? '▾' : '▸'}</Text>
      </View>
      <View style={[styles.countPill, { backgroundColor: theme.colors.border }]}><Text style={[styles.countPillText, { color: theme.colors.text }]}>{count}</Text></View>
    </TouchableOpacity>
  );

  const renderBoardItem = (board: Board) => (
    <Card style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{board.title}</Text>
        <Text style={[styles.cardSubtitle, { color: theme.colors.secondaryText }]}>{t.admin.created}: {formatEUDate(board.createdAt)}</Text>
      </View>
      {isAdmin && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => confirmFinishBoard(board)}>
          <Text style={[styles.primaryBtnText]}>{t.admin.finish}</Text>
        </TouchableOpacity>
      )}
    </Card>
  );

  const renderSnapshotItem = (item: BoardSnapshot) => (
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
      <Card style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.cardSubtitle, { color: theme.colors.secondaryText }]}>{t.admin.finishedOn}: {formatDateTime(item.finishedOn)}</Text>
          <Text style={[styles.cardSubtitle, { marginTop: 2, color: theme.colors.secondaryText }]}>{t.admin.by}: {item.submittedBy ? (profileNames[item.submittedBy] || item.submittedBy) : t.common.unknown}</Text>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('Snapshot', { snapshotId: item.id })}>
          <Text style={styles.primaryBtnText}>{t.common.open}</Text>
        </TouchableOpacity>
      </Card>
    </Swipeable>
  );

  const renderDateFolder = (date: string, dateSnapshots: BoardSnapshot[]) => {
    const isOpen = openDateFolders.has(date);
    
    return (
      <View key={date} style={styles.dateFolderContainer}>
        <TouchableOpacity 
          onPress={() => toggleDateFolder(date)} 
          activeOpacity={0.7} 
          style={[styles.dateFolderHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[styles.chevron, { color: theme.colors.primary, fontSize: 16 }]}>{isOpen ? '▾' : '▸'}</Text>
            <Text style={[styles.dateFolderTitle, { color: theme.colors.text }]}>{date}</Text>
          </View>
          <View style={[styles.countPill, { backgroundColor: theme.colors.border }]}>
            <Text style={[styles.countPillText, { color: theme.colors.text }]}>{dateSnapshots.length}</Text>
          </View>
        </TouchableOpacity>
        
        {isOpen && (
          <View style={styles.dateFolderContent}>
            {dateSnapshots.map(snapshot => (
              <View key={snapshot.id}>
                {renderSnapshotItem(snapshot)}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={[theme.colors.primary, theme.colors.primaryAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <AnimatedTitle text={t.admin.title} style={[styles.headerTitle, { color: 'white' }]} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      >
        {/* Organization settings moved to Profile screen */}
        {renderSectionHeader(t.admin.boards, activeBoards.length, () => setIsBoardsOpen(prev => !prev), isBoardsOpen)}
        {isBoardsOpen && (activeBoards.length === 0 ? (
          <View style={styles.emptyState}><Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>{t.admin.noBoards}</Text></View>
        ) : (
          <FlatList
            data={activeBoards}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => renderBoardItem(item)}
            contentContainerStyle={{ paddingBottom: 12 }}
            scrollEnabled={false} // Disable FlatList's internal scroll to allow parent ScrollView to handle it
          />
        ))}

        {renderSectionHeader(t.admin.history, snapshots.length, () => setIsHistoryOpen(prev => !prev), isHistoryOpen)}
        {isHistoryOpen && (snapshots.length === 0 ? (
          <View style={styles.emptyState}><Text style={[styles.emptyText, { color: theme.colors.secondaryText }]}>{t.admin.noSnapshots}</Text></View>
        ) : (
          <View style={styles.historyContainer}>
            {snapshotsByDate.map(([date, dateSnapshots]) => renderDateFolder(date, dateSnapshots))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 20, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  chevron: { fontSize: 18 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  content: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 50, gap: 10 },
  settingsCard: { borderRadius: 16, padding: 12, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, marginTop: 4 },
  emptyState: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  emptyText: { fontSize: 14 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  dangerBtn: { backgroundColor: '#fee2e2' },
  dangerBtnText: { color: '#b91c1c', fontWeight: '700' },
  historyContainer: { gap: 12, marginBottom: 10 },
  dateFolderContainer: { marginBottom: 8 },
  dateFolderHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1,
    marginBottom: 8,
  },
  dateFolderTitle: { fontSize: 15, fontWeight: '600' },
  dateFolderContent: { paddingLeft: 12, gap: 4 },
});