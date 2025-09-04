import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Column, Task } from '../../types';
import { supabase } from '../../../lib/supabase';
import {
  getBoardById,
  getColumnsByBoardId,
  getTasksByBoardId,
  createColumn,
  deleteColumn,
  renameColumn,
  createTask,
  moveTask,
  toggleTaskCompleted,
  updateBoardTitle,
  deleteTask,
  deleteBoard,
  updateTask,
  resetColumnTasks,
} from '../../utils/storage';

type BoardRouteProp = RouteProp<{ Board: { boardId: string } }, 'Board'>;

export default function BoardScreen() {
  const route = useRoute<BoardRouteProp>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const boardId = route.params.boardId;

  const [boardTitle, setBoardTitle] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newTaskTitleByColumn, setNewTaskTitleByColumn] = useState<Record<string, string>>({});
  const [taskModalColumnId, setTaskModalColumnId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; email: string; avatar_url?: string }>>({});

  // Helpers for date parsing/formatting
  const parseDateInputToISO = (input: string): string | undefined => {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    // Accept DD-MM-YYYY or YYYY-MM-DD
    const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
    const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (ddmmyyyy.test(trimmed)) {
      const [, dd, mm, yyyy] = trimmed.match(ddmmyyyy) as RegExpMatchArray;
      return `${yyyy}-${mm}-${dd}`; // ISO
    }
    if (yyyymmdd.test(trimmed)) {
      return trimmed; // already ISO
    }
    return undefined; // unrecognized
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

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    const board = await getBoardById(boardId);
    setBoardTitle(board?.title ?? '');
    const cols = await getColumnsByBoardId(boardId);
    const tks = await getTasksByBoardId(boardId);
    setColumns(cols);
    setTasks(tks);
  };

  useEffect(() => {
    load();
  }, [boardId]);

  // Load profiles for users who completed tasks so we can show avatar/name
  useEffect(() => {
    const loadProfiles = async () => {
      const ids = Array.from(new Set((tasks || []).map(t => t.completedBy).filter(Boolean) as string[]));
      if (ids.length === 0) {
        setUserProfiles({});
        return;
      }
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

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of columns) map[c.id] = [];
    for (const task of tasks) {
      (map[task.columnId] = map[task.columnId] || []).push(task);
    }
    for (const c of columns) map[c.id]?.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [columns, tasks]);

  const handleAddColumn = async () => {
    if (!isAdmin) return;
    if (!newColumnTitle.trim()) return;
    await createColumn(boardId, newColumnTitle.trim());
    setNewColumnTitle('');
    await load();
  };

  const handleRenameColumn = async (columnId: string) => {
    if (!isAdmin) return;
    Alert.prompt(
      'Rename Column',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text) => {
            if (text?.trim()) {
              await renameColumn(columnId, text.trim());
              await load();
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!isAdmin) return;
    Alert.alert('Delete Column', 'This will remove the column and its tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteColumn(columnId);
          await load();
        },
      },
    ]);
  };

  const openEditColumn = (columnId: string) => {
    if (!isAdmin) return;
    Alert.alert(
      'Edit Column',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => handleRenameColumn(columnId) },
        { text: 'Reset tasks to not done', onPress: async () => {
            try {
              await resetColumnTasks(columnId);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Unable to reset tasks');
            }
          }
        },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteColumn(columnId) },
      ]
    );
  };

  const handleAddTask = async (columnId: string) => {
    const title = newTaskTitleByColumn[columnId]?.trim();
    if (!title || !user) return;
    try {
      await createTask({ boardId, columnId, title, createdBy: user.id });
      setNewTaskTitleByColumn(prev => ({ ...prev, [columnId]: '' }));
      await load();
    } catch (e: any) {
      console.error('Create task error:', e);
      Alert.alert('Error', e?.message || 'Unable to create task');
    }
  };

  const openTaskModal = (columnId: string) => {
    setTaskModalColumnId(columnId);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setTaskDueTime('');
  };

  const closeTaskModal = () => setTaskModalColumnId(null);

  const handleCreateTaskAdvanced = async () => {
    if (!user || !taskModalColumnId) return;
    const title = taskTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Please enter a task title');
      return;
    }
    try {
      await createTask({
        boardId,
        columnId: taskModalColumnId,
        title,
        description: taskDescription.trim() || undefined,
        dueDate: parseDateInputToISO(taskDueDate) || undefined,
        dueTime: taskDueTime || undefined,
        createdBy: user.id,
      });
      closeTaskModal();
      await load();
    } catch (e: any) {
      console.error('Create task (advanced) error:', e);
      Alert.alert('Error', e?.message || 'Unable to create task');
    }
  };

  const handleToggleDone = async (taskId: string, done: boolean) => {
    try {
      await toggleTaskCompleted(taskId, done);
      // Record who completed it
      if (done && user) {
        await updateTask(taskId, { completedBy: user.id });
      } else {
        await updateTask(taskId, { completedBy: undefined });
      }
      await load();
    } catch (e) {
      console.error('Toggle done error:', e);
    }
  };

  const handleMoveTask = async (taskId: string, toColumnId: string) => {
    if (!isAdmin) return;
    await moveTask(taskId, toColumnId);
    await load();
  };

  const handleRenameBoard = async () => {
    if (!isAdmin) return;
    Alert.prompt(
      'Rename Board',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text) => {
            if (text?.trim()) {
              try {
                await updateBoardTitle(boardId, text.trim());
                setBoardTitle(text.trim());
                await load();
              } catch (e: any) {
                console.error('Rename board error:', e);
                Alert.alert('Error', e?.message || 'Unable to rename board');
              }
            }
          },
        },
      ],
      'plain-text',
      boardTitle
    );
  };

  const handleDeleteBoard = async () => {
    if (!isAdmin) return;
    Alert.alert('Delete Board', 'This will remove the board and all its columns and tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBoard(boardId);
            navigation.goBack();
          } catch (e: any) {
            console.error('Delete board error:', e);
            Alert.alert('Error', e?.message || 'Unable to delete board');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{boardTitle}</Text>
        {isAdmin && (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={handleRenameBoard}>
              <Text style={styles.headerAction}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteBoard}>
              <Text style={styles.headerActionDanger}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView horizontal contentContainerStyle={styles.columnsContainer}>
        {columns.map(col => (
              <ScrollView 
              key={col.id} 
              contentContainerStyle={{ paddingBottom: 20 }} 
            >
          <View key={col.id} style={styles.column}>
            <View style={styles.columnHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.columnTitle}>{col.title}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>
                    {(tasksByColumn[col.id] || []).filter(t => t.completed).length}
                    /
                    {(tasksByColumn[col.id] || []).length}
                  </Text>
                </View>
              </View>
              {isAdmin && (
                <TouchableOpacity onPress={() => openEditColumn(col.id)}>
                  <Text style={styles.columnAction}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {(tasksByColumn[col.id] || []).length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardTitle}>No tasks</Text>
                {isAdmin ? (
                  <Text style={styles.emptyCardSub}>Add a task to get started</Text>
                ) : (
                  <Text style={styles.emptyCardSub}>Waiting for your admin to add tasks</Text>
                )}
              </View>
            )}

            {(tasksByColumn[col.id] || []).map(task => (
              <View key={task.id} style={[styles.taskCard, task.completed && styles.taskCardDone]}>
                <View style={styles.taskContentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]} numberOfLines={2}>
                      {task.title}
                    </Text>
                    {task.description ? (
                      <Text style={styles.taskDesc}>{task.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.taskMeta}>
                    {(task.dueDate || task.dueTime) ? (
                      <Text style={styles.dueDateText}>
                        {[
                          task.dueDate ? formatISOForDisplayNO(task.dueDate) : undefined,
                          task.dueTime
                        ].filter(Boolean).join(' ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.taskActionsRow}>
                  <TouchableOpacity onPress={() => handleToggleDone(task.id, !task.completed)} style={[styles.actionBtn, task.completed ? styles.actionDone : styles.actionPrimary]}>
                    <Text style={[styles.actionBtnText, task.completed ? styles.actionDoneText : undefined]}>
                      {task.completed ? 'Done' : 'Mark done'}
                    </Text>
                  </TouchableOpacity>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => Alert.alert('Delete Task', 'Remove this task?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(task.id); await load(); } }
                    ])} style={[styles.actionBtn, styles.actionDanger]}>
                      <Text style={[styles.actionBtnText, styles.actionDangerText]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {task.completed && task.completedBy ? (
                  <View style={styles.completedInfoRow}>
                    {userProfiles[task.completedBy]?.avatar_url ? (
                      <Image source={{ uri: userProfiles[task.completedBy]?.avatar_url }} style={styles.completedAvatar} />
                    ) : null}
                    <Text style={styles.completedInfoText}>
                      Done by {userProfiles[task.completedBy]?.name || 'Someone'}
                    </Text>
                  </View>
                ) : null}
                {isAdmin && (
                  <View style={styles.moveRow}>
                    {columns
                      .filter(c => c.id !== col.id)
                      .map(c => (
                        <TouchableOpacity key={c.id} onPress={() => handleMoveTask(task.id, c.id)}>
                          <Text style={styles.moveChip}>→ {c.title}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
            ))}

            {isAdmin && (
              <View>
                <TouchableOpacity style={styles.addTaskButton} onPress={() => openTaskModal(col.id)}>
                  <Text style={styles.addTaskButtonText}>+ Add Task</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          </ScrollView>
        ))}

        {isAdmin && (
          <View style={[styles.column, styles.addColumn]}>
            <Text style={styles.columnTitle}>New Column</Text>
            <View style={styles.addColumnRow}>
              <TextInput
                placeholder="Column name"
                value={newColumnTitle}
                onChangeText={setNewColumnTitle}
                style={styles.smallInput}
                maxLength={28}
              />
              <TouchableOpacity style={styles.smallAddButton} onPress={handleAddColumn}>
                <Text style={styles.smallAddButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      <Modal visible={!!taskModalColumnId} transparent animationType="fade" onRequestClose={closeTaskModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Task</Text>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.modalLabel}>Title</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Task title"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                />
              </View>
              <View>
                <Text style={styles.modalLabel}>Description (optional)</Text>
                <TextInput
                  style={styles.modalTextArea}
                  placeholder="Write a short description"
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Date (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="DD-MM-YYYY"
                    value={taskDueDate}
                    onChangeText={setTaskDueDate}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
                <View style={{ width: 120 }}>
                  <Text style={styles.modalLabel}>Time (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="HH:MM"
                    value={taskDueTime}
                    onChangeText={setTaskDueTime}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeTaskModal} style={styles.modalCancel}>
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateTaskAdvanced} style={styles.modalSave}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBack: { marginRight: 8 },
  headerBackIcon: { fontSize: 18, color: '#4f46e5' },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerAction: {
    color: '#6366f1',
    fontWeight: '600',
  },
  headerActionDanger: {
    color: '#ef4444',
    fontWeight: '600',
  },
  viewOnlyBanner: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewOnlyText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  columnsContainer: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    width: 280,
    marginRight: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addColumn: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  countPill: {
    marginLeft: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
  },
  columnAction: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  taskCardDone: {
    backgroundColor: '#ecfdf5',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#065f46',
  },
  taskDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  taskContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskMeta: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  dueDateText: {
    fontSize: 12,
    color: '#4b5563',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  badgeTodo: {
    backgroundColor: '#6366f1',
  },
  badgeDone: {
    backgroundColor: '#10b981',
  },
  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontWeight: '500',
    fontSize: 12,
  },
  actionPrimary: {
    backgroundColor: '#6366f1',
  },
  actionDone: {
    backgroundColor: '#ecfdf5',
  },
  actionDoneText: {
    color: '#065f46',
  },
  actionDanger: {
    backgroundColor: '#fee2e2',
  },
  actionDangerText: {
    color: '#b91c1c',
  },
  completedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  completedAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e5e7eb',
  },
  completedInfoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  moveChip: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#374151',
  },
  moveRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  moveChipDanger: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  emptyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  addTaskRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  addButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    padding: 15,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  addTaskButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addTaskButtonText: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  addColumnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'white',
    fontSize: 14,
  },
  smallAddButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAddButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalSave: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
});


