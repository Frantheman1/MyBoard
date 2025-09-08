import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { ColumnSnapshot, TaskSnapshot } from '../../types';
import { getSnapshotById, getSnapshotColumns, getSnapshotTasks } from '../../utils/storage';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

type SnapshotRouteProp = RouteProp<{ Snapshot: { snapshotId: string } }, 'Snapshot'>;

export default function SnapshotScreen() {
  const route = useRoute<SnapshotRouteProp>();
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const snapshotId = route.params.snapshotId;

  const [title, setTitle] = useState('');
  const [finishedOn, setFinishedOn] = useState('');
  const [columns, setColumns] = useState<ColumnSnapshot[]>([]);
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; email: string; avatar_url?: string }>>({});

  useEffect(() => {
    const load = async () => {
      const snap = await getSnapshotById(snapshotId);
      if (snap) {
        setTitle(snap.title);
        setFinishedOn(snap.finishedOn);
      }
      const [cols, tks] = await Promise.all([
        getSnapshotColumns(snapshotId),
        getSnapshotTasks(snapshotId),
      ]);
      setColumns(cols);
      setTasks(tks);
    };
    load();
  }, [snapshotId]);

  useEffect(() => {
    const loadProfiles = async () => {
      const ids = Array.from(new Set((tasks || []).map(t => t.completedBy).filter(Boolean) as string[]));
      if (ids.length === 0) { setUserProfiles({}); return; }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', ids);
      if (!error && data) {
        const map: Record<string, { name: string; email: string; avatar_url?: string }> = {};
        for (const p of data as any[]) {
          map[p.id] = { name: p.name || p.email, email: p.email, avatar_url: p.avatar_url || undefined };
        }
        setUserProfiles(map);
      }
    };
    loadProfiles();
  }, [tasks]);

  const formatDueTime = (time?: string): string => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const formatISOForDisplayNO = (iso: string): string => {
    try {
      // Expect YYYY-MM-DD; display DD.MM.YYYY
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const [, y, mo, d] = m;
        return `${d}.${mo}.${y}`;
      }
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString('nb-NO');
    } catch { return iso; }
  };

  const formatTimeFromISO = (iso?: string): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch { return ''; }
  };

  const tasksByColumn = useMemo(() => {
    const map: Record<string, TaskSnapshot[]> = {};
    for (const c of columns) map[c.originalColumnId] = [];
    for (const t of tasks) {
      (map[t.originalColumnId] = map[t.originalColumnId] || []).push(t);
    }
    return map;
  }, [columns, tasks]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerMeta}>{finishedOn}</Text>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.columnsContainer}>
        {columns.map(col => (
          <View key={col.id} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{col.title}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{(tasksByColumn[col.originalColumnId] || []).filter(t => t.completed).length}/{(tasksByColumn[col.originalColumnId] || []).length}</Text>
              </View>
            </View>
            <ScrollView
          nestedScrollEnabled
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
            {(tasksByColumn[col.originalColumnId] || []).length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyCardText}>{t.snapshot.noTasksInSnapshot}</Text></View>
            ) : (
              (tasksByColumn[col.originalColumnId] || []).map(task => (
                <View key={task.id} style={[styles.taskCard, task.completed && styles.taskCardDone]}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>{task.title}</Text>
                  {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  <View style={styles.taskMetaRow}>
                    {(task.dueDate || task.dueTime) ? (
                      <Text style={styles.dueDateText}>
                        {[
                          task.dueDate ? formatISOForDisplayNO(task.dueDate) : undefined,
                          task.dueTime ? formatDueTime(task.dueTime) : undefined,
                        ].filter(Boolean).join(' ')}
                      </Text>
                     ) : null}
                  </View>
                    <View style={styles.taskMetaRow}>
                    {task.completed ? (
                      <View style={styles.completedRow}>
                        {userProfiles[task.completedBy || '']?.avatar_url ? (
                          <Image source={{ uri: userProfiles[task.completedBy || '']?.avatar_url }} style={styles.completedAvatar} />
                        ) : null}
                        <Text style={[styles.badge, styles.badgeDone]}>
                          {t.snapshot.doneBy} {userProfiles[task.completedBy || '']?.name || t.common.someone} {t.snapshot.at} {formatTimeFromISO(task.completedAt)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.badge, styles.badgeTodo]}>{t.snapshot.todo}</Text>
                    )}
                    </View>
                </View>
              ))
            )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBack: { marginBottom: 6 },
  headerBackIcon: { fontSize: 18, color: '#4f46e5' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  headerMeta: { color: '#6b7280', marginTop: 4 },
  columnsContainer: { padding: 16, flexDirection: 'row', gap: 12 },
  column: { width: 280, backgroundColor: 'white', borderRadius: 12, padding: 12, elevation: 2 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  columnTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  countPill: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  taskCard: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8 },
  taskCardDone: { backgroundColor: '#ecfdf5' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#065f46' },
  taskDesc: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  taskMetaRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: { fontSize: 12, backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, color: '#374151' },
  badgeTodo: { backgroundColor: '#6366f1', color: 'white' },
  badgeDone: { backgroundColor: '#10b981', color: 'white' },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e5e7eb' },
  dueDateText: {
    fontSize: 12,
    color: '#4b5563',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
  },
  emptyCard: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 },
  emptyCardText: { color: '#6b7280' },
});


