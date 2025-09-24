import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Column, Task } from '../../types';
import { supabase } from '../../../lib/supabase';
import AnimatedTitle from '../../../components/AnimatedTitle';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
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
  snapshotBoardAndReset,
  snapshotColumnAndReset,
} from '../../utils/storage';

type BoardRouteProp = RouteProp<{ Board: { boardId: string } }, 'Board'>;

export default function BoardScreen() {
  const route = useRoute<BoardRouteProp>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const boardId = route.params.boardId;

  const [boardTitle, setBoardTitle] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newTaskTitleByColumn, setNewTaskTitleByColumn] = useState<Record<string, string>>({});
  const [taskModalColumnId, setTaskModalColumnId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskImportanceColor, setTaskImportanceColor] = useState<string>('');
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

  const formatISOToInput = (iso?: string): string => {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return `${d}-${mo}-${y}`;
    }
    return '';
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

  const isAdmin = user?.role === 'admin';
  // Simple contrast helper to ensure readable text on colored backgrounds
  const getContrastingTextColor = (hex?: string): string => {
    if (!hex) return theme.colors.text;
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Perceived luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111827' : '#FFFFFF';
  };

  const load = async () => {
    const board = await getBoardById(boardId);
    setBoardTitle(board?.title ?? '');
    const cols = await getColumnsByBoardId(boardId);
    const tks = await getTasksByBoardId(boardId);
    setColumns(cols);
    setTasks(tks);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!boardId) return;
      await load();     // inside load(), before each setState: if (!active) return;
    })();
    return () => { active = false; };
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
      t.board.editColumnTitle,
      '',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.save,
          onPress: async (text?: string) => {
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
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
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
      t.board.editColumnTitle,
      undefined,
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.board.rename, onPress: () => handleRenameColumn(columnId) },
        { text: t.board.resetTasks, onPress: async () => {
            try {
              await resetColumnTasks(columnId);
              await load();
            } catch (e: any) {
              Alert.alert(t.common.error, e?.message || 'Unable to reset tasks');
            }
          }
        },
        { text: t.common.delete, style: 'destructive', onPress: () => handleDeleteColumn(columnId) },
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
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setTaskDueTime('');
    setTaskImportanceColor('');
  };

  const closeTaskModal = () => {
    setTaskModalColumnId(null);
    setEditingTaskId(null);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskModalColumnId(task.columnId); // reuse same modal visibility
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskDueDate(formatISOToInput(task.dueDate));
    setTaskDueTime(task.dueTime || '');
    setTaskImportanceColor(task.importanceColor || '');
  };

  const handleCreateTaskAdvanced = async () => {
    if (!user || !taskModalColumnId) return;
    const title = taskTitle.trim();
    if (!title) {
      Alert.alert(t.board.titleRequiredTitle, t.board.titleRequiredMessage);
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
        // allow empty string to mean "no color"
        importanceColor: typeof taskImportanceColor === 'string' ? taskImportanceColor : undefined,
        createdBy: user.id,
      });
      closeTaskModal();
      await load();
    } catch (e: any) {
      console.error('Create task (advanced) error:', e);
      Alert.alert(t.common.error, e?.message || 'Unable to create task');
    }
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTaskId) return;
    const title = taskTitle.trim();
    if (!title) {
      Alert.alert(t.board.titleRequiredTitle, t.board.titleRequiredMessage);
      return;
    }
    try {
      await updateTask(editingTaskId, {
        title,
        description: taskDescription.trim() || undefined,
        dueDate: parseDateInputToISO(taskDueDate) || undefined,
        dueTime: taskDueTime || undefined,
        // send empty string to clear color (storage maps '' -> null)
        importanceColor: taskImportanceColor,
      });
      setEditingTaskId(null);
      setTaskModalColumnId(null);
      await load();
    } catch (e: any) {
      console.error('Edit task error:', e);
      Alert.alert(t.common.error, e?.message || 'Unable to save task');
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
      t.board.renameBoardTitle,
      '',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.save,
          onPress: async (text?: string) => {
            if (text?.trim()) {
              try {
                await updateBoardTitle(boardId, text.trim());
                setBoardTitle(text.trim());
                await load();
              } catch (e: any) {
                console.error('Rename board error:', e);
                Alert.alert(t.common.error, e?.message || 'Unable to rename board');
              }
            }
          },
        },
      ],
      'plain-text',
      boardTitle
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={[theme.colors.primary, theme.colors.primaryAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={[styles.headerBackIcon, { color: 'white' }]}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isAdmin ? handleRenameBoard : undefined} // Only allow renaming if admin
          activeOpacity={isAdmin ? 0.7 : 1} // Visual feedback only for admins
        >
          <AnimatedTitle text={boardTitle} style={[styles.headerTitle, { color: 'white' }]} />
        </TouchableOpacity>
        {isAdmin && (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {/* The rename button is removed, clicking the title now handles it */}
            {/* The delete button is moved to DashboardScreen via swipeable action */}
          </View>
        )}
      </LinearGradient>

      <ScrollView horizontal contentContainerStyle={styles.columnsContainer}
        showsHorizontalScrollIndicator={false}
      >
        {columns.map(col => (
              <ScrollView 
              key={col.id} 
              contentContainerStyle={{ paddingBottom: 20 }} 
              showsVerticalScrollIndicator={false}
            >
          <View key={col.id} style={[styles.column, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.columnHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.columnTitle, { color: theme.colors.text }]}>{col.title}</Text>
                <View style={[styles.countPill, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }]}>
                  <Text style={[styles.countPillText, { color: theme.colors.secondaryText }]}>
                    {(tasksByColumn[col.id] || []).filter(t => t.completed).length}
                    /
                    {(tasksByColumn[col.id] || []).length}
                  </Text>
                </View>
              </View>
              {isAdmin && (
                <TouchableOpacity onPress={() => openEditColumn(col.id)}>
                  <Text style={[styles.columnAction, { color: theme.colors.primary }]}>{t.common.edit}</Text>
                </TouchableOpacity>
              )}
            </View>

            {(tasksByColumn[col.id] || []).length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: isDark ? '#0f172a' : '#f9fafb' }]}>
                <Text style={[styles.emptyCardTitle, { color: theme.colors.text }]}>{t.board.noTasks}</Text>
                {isAdmin ? (
                  <Text style={[styles.emptyCardSub, { color: theme.colors.secondaryText }]}>{t.board.emptyAdminHint}</Text>
                ) : (
                  <Text style={[styles.emptyCardSub, { color: theme.colors.secondaryText }]}>{t.board.emptyEmployeeHint}</Text>
                )}
              </View>
            )}

            {(tasksByColumn[col.id] || []).map(task => {
              const isColored = !!task.importanceColor && !task.completed;
              const cardBg = task.completed
                ? (isDark ? '#064e3b' : '#ecfdf5')
                : (task.importanceColor || (isDark ? '#111827' : '#f9fafb'));
              const textOnBg = isColored ? getContrastingTextColor(task.importanceColor || undefined) : theme.colors.text;
              const secondaryOnBg = isColored ? (textOnBg === '#FFFFFF' ? 'rgba(255,255,255,0.9)' : '#374151') : theme.colors.secondaryText;
              const chipBg = isColored ? (textOnBg === '#FFFFFF' ? 'rgba(255,255,255,0.25)' : 'rgba(17,24,39,0.08)') : (isDark ? '#1f2937' : '#f3f4f6');
              const chipText = isColored ? (textOnBg === '#FFFFFF' ? '#FFFFFF' : '#374151') : theme.colors.secondaryText;
              return (
              <TouchableOpacity key={task.id} activeOpacity={0.8} onPress={() => openEditTask(task)} style={[styles.taskCard, { backgroundColor: cardBg }]}>
                <View style={styles.taskContentRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {/* Hide dot when full card is colored */}
                      {!isColored && task.importanceColor ? (
                        <View style={[styles.importanceDot, { backgroundColor: task.importanceColor }]} />
                      ) : null}
                      <Text style={[styles.taskTitle, { color: task.completed ? '#065f46' : textOnBg }, task.completed && styles.taskTitleDone]} numberOfLines={2}>
                        {task.title}
                      </Text>
                    </View>
                    {task.description ? (
                      <Text style={[styles.taskDesc, { color: task.completed ? '#065f46' : secondaryOnBg }]}>{task.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.taskMeta}>
                    {(task.dueDate || task.dueTime) ? (
                      <Text style={[styles.dueDateText, { backgroundColor: chipBg, color: chipText }]}>
                        {[
                          task.dueDate ? formatISOForDisplayNO(task.dueDate) : undefined,
                          task.dueTime
                        ].filter(Boolean).join(' ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.taskActionsRow}>
                  <TouchableOpacity onPress={() => handleToggleDone(task.id, !task.completed)} style={[styles.actionBtn, task.completed ? styles.actionDone : styles.actionPrimary, task.completed ? { backgroundColor: isDark ? '#064e3b' : undefined } : { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.actionBtnText, { color: task.completed ? '#387053' : 'white' }]}>
                      {task.completed ? t.board.done : t.board.markDone}
                    </Text>
                  </TouchableOpacity>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => Alert.alert(t.board.deleteTaskTitle, t.board.deleteTaskMessage, [
                      { text: t.common.cancel, style: 'cancel' },
                      { text: t.common.delete, style: 'destructive', onPress: async () => { await deleteTask(task.id); await load(); } }
                    ])} style={[styles.actionBtn, styles.actionDanger]}>
                      <Text style={[styles.actionBtnText, styles.actionDangerText]}>{t.common.delete}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {task.completed && task.completedBy ? (
                  <View style={styles.completedInfoRow}>
                    {userProfiles[task.completedBy]?.avatar_url ? (
                      <Image source={{ uri: userProfiles[task.completedBy]?.avatar_url }} style={styles.completedAvatar} />
                    ) : null}
                    <Text style={[styles.completedInfoText, { color: theme.colors.secondaryText }]}>
                      {t.board.doneBy} {userProfiles[task.completedBy]?.name || t.common.someone} {t.board.at} {formatTimeFromISO(task.completedAt)}
                    </Text>
                  </View>
                ) : null}
                {isAdmin && (
                  <View style={styles.moveRow}>
                    {columns
                      .filter(c => c.id !== col.id)
                      .map(c => (
                        <TouchableOpacity key={c.id} onPress={() => handleMoveTask(task.id, c.id)}>
                          <Text style={[styles.moveChip, { backgroundColor: isDark ? '#1f2937' : '#e5e7eb', color: theme.colors.secondaryText }]}>→ {c.title}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </TouchableOpacity>
            );})}

            <View>
              {isAdmin && (
                <TouchableOpacity style={styles.addTaskButton} onPress={() => openTaskModal(col.id)}>
                  <Text style={[styles.addTaskButtonText, { color: theme.colors.primary }]}>+ {t.board.addTask}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.addTaskButton, { marginTop: 6 }]} onPress={async () => {
                try {
                  await snapshotColumnAndReset(boardId, col.id, { submittedBy: user?.id, submissionType: 'user' });
                  Alert.alert(t.common.sent, t.board.columnSent);
                  await load();
                } catch (e: any) {
                  Alert.alert(t.common.error, e?.message || t.board.unableSnapshotColumn);
                }
              }}>
                <Text style={[styles.addTaskButtonText, { color: theme.colors.primary }]}>{t.board.sendColumn}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        ))}

        {isAdmin && (
          <View style={[styles.column, styles.addColumn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.columnTitle, { color: theme.colors.text }]}>{t.board.newColumn}</Text>
            <View style={styles.addColumnRow}>
              <TextInput
                placeholder={t.board.columnNamePlaceholder}
                value={newColumnTitle}
                onChangeText={setNewColumnTitle}
                style={[styles.smallInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : 'white' }]}
                maxLength={28}
              />
              <TouchableOpacity style={styles.smallAddButton} onPress={handleAddColumn}>
                <Text style={styles.smallAddButtonText}>{t.common.create}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.addTaskButton, { marginTop: 8 }]} onPress={async () => {
              try {
                await snapshotBoardAndReset(boardId, undefined, false, { submittedBy: user?.id, submissionType: 'admin_finish' });
                Alert.alert(t.common.finished, t.board.boardFinished);
                await load();
              } catch (e: any) {
                Alert.alert(t.common.error, e?.message || t.board.unableFinishReset);
              }
            }}>
              <Text style={[styles.addTaskButtonText, { color: theme.colors.primary }]}>{t.board.finishAndReset}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isAdmin && (
          <View style={[styles.column, styles.addColumn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.columnTitle, { color: theme.colors.text }]}>{t.board.actions}</Text>
            <TouchableOpacity style={[styles.addTaskButton, { marginTop: 8 }]} onPress={async () => {
              try {
                await snapshotBoardAndReset(boardId, undefined, false, { submittedBy: user?.id, submissionType: 'user' });
                Alert.alert(t.common.sent, 'Board snapshot sent');
                await load();
              } catch (e: any) {
                Alert.alert(t.common.error, e?.message || t.board.unableSendBoard);
              }
            }}>
              <Text style={[styles.addTaskButtonText, { color: theme.colors.primary }]}>{t.board.sendBoard}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <Modal visible={!!taskModalColumnId || !!editingTaskId} transparent animationType="fade" onRequestClose={closeTaskModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{editingTaskId ? t.board.modalEditTask : t.board.modalNewTask}</Text>
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={[styles.modalLabel, { color: theme.colors.secondaryText }]}>{t.board.labelTitle}</Text>
                  <TextInput
                    style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : 'white' }]}
                    placeholder={t.board.titlePlaceholder}
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                  />
                </View>
                <View>
                  <Text style={[styles.modalLabel, { color: theme.colors.secondaryText }]}>{t.board.labelDescription}</Text>
                  <TextInput
                    style={[styles.modalTextArea, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : 'white' }]}
                    placeholder={t.board.descriptionPlaceholder}
                    value={taskDescription}
                    onChangeText={setTaskDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalLabel, { color: theme.colors.secondaryText }]}>{t.board.labelDate}</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : 'white' }]}
                      placeholder="DD-MM-YYYY"
                      value={taskDueDate}
                      onChangeText={setTaskDueDate}
                      autoCapitalize="none"
                      returnKeyType="done"
                      blurOnSubmit
                    />
                  </View>
                  <View style={{ width: 120 }}>
                    <Text style={[styles.modalLabel, { color: theme.colors.secondaryText }]}>{t.board.labelTime}</Text>
                    <TextInput
                      style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#0f172a' : 'white' }]}
                      placeholder="HH:MM"
                      value={taskDueTime}
                      onChangeText={setTaskDueTime}
                      autoCapitalize="none"
                      returnKeyType="done"
                      blurOnSubmit
                    />
                  </View>
                </View>
                {isAdmin ? (
                  <View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].map((c) => (
                        <TouchableOpacity
                          key={c || 'none'}
                          onPress={() => setTaskImportanceColor(c)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: c || 'transparent',
                            borderWidth: c ? 0 : 1,
                            borderColor: theme.colors.border,
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {taskImportanceColor === c ? (
                            <Text style={{ color: c ? 'white' : theme.colors.text, fontSize: 16 }}>•</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={closeTaskModal} style={styles.modalCancel}>
                  <Text style={{ color: theme.colors.secondaryText, fontWeight: '600' }}>{t.common.cancel}</Text>
                </TouchableOpacity>
                {editingTaskId ? (
                  <TouchableOpacity onPress={handleSaveTaskEdit} style={styles.modalSave}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>{t.common.save}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleCreateTaskAdvanced} style={styles.modalSave}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>{t.common.create}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerBack: { marginRight: 8 },
  headerBackIcon: { fontSize: 18 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerAction: { fontWeight: '600' },
  headerActionDanger: { fontWeight: '600' },
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
  column: { width: 280, marginRight: 12, borderRadius: 12, padding: 12 },
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
  columnTitle: { fontSize: 16, fontWeight: '700' },
  countPill: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { fontSize: 12, fontWeight: '600' },
  columnAction: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  taskCard: { borderRadius: 8, padding: 10, marginBottom: 8 },
  taskCardDone: {
    backgroundColor: '#ecfdf5',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#065f46',
  },
  taskDesc: {
    fontSize: 12,
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
  dueDateText: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  importanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  actionPrimary: { backgroundColor: '#6366f1' },
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
  completedInfoText: { fontSize: 12 },
  moveChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 12 },
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
  emptyCard: { borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 12,
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
  smallInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
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
  modalCard: { width: '100%', borderRadius: 12, padding: 16, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 12, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  modalTextArea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top' },
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
  keyboardAvoidingView: {
    flex: 1,
  },
});


