import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Board, Column, Task, Organization, BoardSnapshot, ColumnSnapshot, TaskSnapshot } from '../types';

const STORAGE_KEYS = {
  BOARDS: 'myboard_boards',
  COLUMNS: 'myboard_columns',
  TASKS: 'myboard_tasks',
  ORGS: 'myboard_organizations',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Organizations
export async function getOrganizationById(id: string): Promise<Organization | undefined> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    const mapped: Organization = {
      id: data.id,
      name: data.name,
      inviteCode: data.code,
      createdAt: data.created_at ?? new Date().toISOString(),
    };
    return mapped;
  } catch {
    return undefined;
  }
}

export async function getOrganizationByInviteCode(inviteCode: string): Promise<Organization | undefined> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('code', inviteCode)
      .single();
    if (error || !data) return undefined;
    const mapped: Organization = {
      id: data.id,
      name: data.name,
      inviteCode: data.code,
      createdAt: data.created_at ?? new Date().toISOString(),
    };
    return mapped;
  } catch {
    return undefined;
  }
}

// Boards
export async function getBoardsByOrganizationId(organizationId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from('myboard_boards')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((b: any) => ({
    id: b.id,
    title: b.title,
    organizationId: b.organization_id,
    finishedAt: b.finished_at || undefined,
    createdAt: b.created_at,
    createdBy: b.created_by,
  }));
}

export async function getBoardById(boardId: string): Promise<Board | undefined> {
  const { data, error } = await supabase
    .from('myboard_boards')
    .select('*')
    .eq('id', boardId)
    .single();
  if (error || !data) return undefined;
  return {
    id: data.id,
    title: data.title,
    organizationId: data.organization_id,
    finishedAt: data.finished_at || undefined,
    createdAt: data.created_at,
    createdBy: data.created_by,
  };
}

export async function createBoard(params: { title: string; organizationId: string; createdBy: string }): Promise<Board> {
  const { data, error } = await supabase
    .from('myboard_boards')
    .insert([
      {
        title: (params.title || 'Untitled Board').trim(),
        organization_id: params.organizationId,
        created_by: params.createdBy,
      }
    ])
    .select()
    .single();
  if (error || !data) throw error || new Error('Failed to create board');
  return {
    id: data.id,
    title: data.title,
    organizationId: data.organization_id,
    createdAt: data.created_at,
    createdBy: data.created_by,
  };
}

export async function updateBoardTitle(boardId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_boards')
    .update({ title: title.trim() })
    .eq('id', boardId);
  if (error) throw error;
}

export async function markBoardFinished(boardId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_boards')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', boardId);
  if (error) throw error;
}

export async function reopenBoard(boardId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_boards')
    .update({ finished_at: null })
    .eq('id', boardId);
  if (error) throw error;
}

export async function getFinishedBoardsByOrganizationId(organizationId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from('myboard_boards')
    .select('*')
    .eq('organization_id', organizationId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false });
  if (error || !data) return [];
  return data.map((b: any) => ({
    id: b.id,
    title: b.title,
    organizationId: b.organization_id,
    finishedAt: b.finished_at || undefined,
    createdAt: b.created_at,
    createdBy: b.created_by,
  }));
}

export async function deleteBoard(boardId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_boards')
    .delete()
    .eq('id', boardId);
  if (error) throw error;
}

// Columns
export async function getColumnsByBoardId(boardId: string): Promise<Column[]> {
  const { data, error } = await supabase
    .from('myboard_columns')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });
  if (error || !data) return [];
  return data.map((c: any) => ({
    id: c.id,
    title: c.title,
    boardId: c.board_id,
    order: c.position,
    color: c.color || undefined,
  }));
}

export async function createColumn(boardId: string, title: string): Promise<Column> {
  // Compute next position
  const { data: existing } = await supabase
    .from('myboard_columns')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1);
  const nextPosition = (existing && existing[0]?.position + 1) || 0;

  const { data, error } = await supabase
    .from('myboard_columns')
    .insert([
      {
        title: (title || 'Untitled').trim(),
        board_id: boardId,
        position: nextPosition,
      }
    ])
    .select()
    .single();
  if (error || !data) throw error || new Error('Failed to create column');
  return {
    id: data.id,
    title: data.title,
    boardId: data.board_id,
    order: data.position,
    color: data.color || undefined,
  };
}

export async function renameColumn(columnId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_columns')
    .update({ title: title.trim() })
    .eq('id', columnId);
  if (error) throw error;
}

export async function deleteColumn(columnId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_columns')
    .delete()
    .eq('id', columnId);
  if (error) throw error;
}

// Tasks
export async function getTasksByBoardId(boardId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('myboard_tasks')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    dueDate: t.due_date || undefined,
    dueTime: t.due_time || undefined,
    importanceColor: t.importance_color || undefined,
    columnId: t.column_id,
    boardId: t.board_id,
    completed: !!t.completed,
    completedAt: t.completed_at || undefined,
    completedBy: t.completed_by || undefined,
    createdAt: t.created_at,
    createdBy: t.created_by,
  }));
}

export async function getTasksByColumnId(columnId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('myboard_tasks')
    .select('*')
    .eq('column_id', columnId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    dueDate: t.due_date || undefined,
    dueTime: t.due_time || undefined,
    importanceColor: t.importance_color || undefined,
    columnId: t.column_id,
    boardId: t.board_id,
    completed: !!t.completed,
    completedAt: t.completed_at || undefined,
    completedBy: t.completed_by || undefined,
    createdAt: t.created_at,
    createdBy: t.created_by,
  }));
}

export async function createTask(params: {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  importanceColor?: string;
  createdBy: string;
}): Promise<Task> {
  const { data, error } = await supabase
    .from('myboard_tasks')
    .insert([
      {
        title: (params.title || 'Untitled Task').trim(),
        description: params.description,
        due_date: params.dueDate,
        due_time: params.dueTime,
        importance_color: (params as any).importanceColor || null,
        column_id: params.columnId,
        board_id: params.boardId,
        created_by: params.createdBy,
      }
    ])
    .select()
    .single();
  if (error || !data) throw error || new Error('Failed to create task');
  return {
    id: data.id,
    title: data.title,
    description: data.description || undefined,
    dueDate: data.due_date || undefined,
    dueTime: data.due_time || undefined,
    columnId: data.column_id,
    boardId: data.board_id,
    completed: !!data.completed,
    createdAt: data.created_at,
    createdBy: data.created_by,
  };
}

export async function updateTask(taskId: string, updates: Partial<Omit<Task, 'id'>>): Promise<void> {
  const payload: any = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.dueTime !== undefined) payload.due_time = updates.dueTime;
  if ((updates as any).importanceColor !== undefined) payload.importance_color = (updates as any).importanceColor;
  if (updates.columnId !== undefined) payload.column_id = updates.columnId;
  if (updates.boardId !== undefined) payload.board_id = updates.boardId;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.completedBy !== undefined) payload.completed_by = updates.completedBy || null;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt || null;
  if (updates.createdAt !== undefined) payload.created_at = updates.createdAt;
  if (updates.createdBy !== undefined) payload.created_by = updates.createdBy;
  const { error } = await supabase
    .from('myboard_tasks')
    .update(payload)
    .eq('id', taskId);
  if (error) throw error;
}

export async function moveTask(taskId: string, toColumnId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_tasks')
    .update({ column_id: toColumnId })
    .eq('id', taskId);
  if (error) throw error;
}

export async function toggleTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  const payload: any = { completed };
  if (completed) {
    payload.completed_at = new Date().toISOString();
  } else {
    payload.completed_at = null;
    payload.completed_by = null;
  }
  const { error } = await supabase
    .from('myboard_tasks')
    .update(payload)
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_tasks')
    .delete()
    .eq('id', taskId);
  if (error) throw error;
}

export async function resetColumnTasks(columnId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_tasks')
    .update({ completed: false, completed_by: null, completed_at: null })
    .eq('column_id', columnId);
  if (error) throw error;
}

// Snapshot helpers
function getUtcDateString(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function listSnapshotsByBoard(boardId: string): Promise<BoardSnapshot[]> {
  const { data, error } = await supabase
    .from('myboard_board_snapshots')
    .select('*')
    .eq('board_id', boardId)
    .order('finished_on', { ascending: false });
  if (error || !data) return [];
  return data.map((s: any) => ({
    id: s.id,
    boardId: s.board_id,
    organizationId: s.organization_id,
    title: s.title,
    finishedOn: s.finished_on,
    createdAt: s.created_at,
  }));
}

export async function listSnapshotsByOrganization(organizationId: string): Promise<BoardSnapshot[]> {
  const { data, error } = await supabase
    .from('myboard_board_snapshots')
    .select('*')
    .eq('organization_id', organizationId)
    .order('finished_on', { ascending: false });
  if (error || !data) return [];
  return data.map((s: any) => ({
    id: s.id,
    boardId: s.board_id,
    organizationId: s.organization_id,
    title: s.title,
    finishedOn: s.finished_on,
    createdAt: s.created_at,
    submittedBy: s.submitted_by || undefined,
    submissionType: s.submission_type || undefined,
  }));
}

export async function getSnapshotById(snapshotId: string): Promise<BoardSnapshot | undefined> {
  const { data, error } = await supabase
    .from('myboard_board_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();
  if (error || !data) return undefined;
  return {
    id: data.id,
    boardId: data.board_id,
    organizationId: data.organization_id,
    title: data.title,
    finishedOn: data.finished_on,
    createdAt: data.created_at,
  };
}

export async function getSnapshotColumns(snapshotId: string): Promise<ColumnSnapshot[]> {
  const { data, error } = await supabase
    .from('myboard_column_snapshots')
    .select('*')
    .eq('board_snapshot_id', snapshotId)
    .order('position', { ascending: true });
  if (error || !data) return [];
  return data.map((c: any) => ({
    id: c.id,
    boardSnapshotId: c.board_snapshot_id,
    title: c.title,
    position: c.position,
    originalColumnId: c.original_column_id,
  }));
}

export async function getSnapshotTasks(snapshotId: string): Promise<TaskSnapshot[]> {
  const { data, error } = await supabase
    .from('myboard_task_snapshots')
    .select('*')
    .eq('board_snapshot_id', snapshotId)
    .order('id', { ascending: true });
  if (error || !data) return [];
  return data.map((t: any) => ({
    id: t.id,
    boardSnapshotId: t.board_snapshot_id,
    title: t.title,
    description: t.description || undefined,
    completed: !!t.completed,
    dueDate: t.due_date || undefined,
    dueTime: t.due_time || undefined,
    completedAt: t.completed_at || undefined,
    completedBy: t.completed_by || undefined,
    importanceColor: t.importance_color || undefined,
    originalColumnId: t.original_column_id,
    originalTaskId: t.original_task_id,
  }));
}

// Create snapshot for a board and reset its tasks
export async function snapshotBoardAndReset(boardId: string, finishedOn?: string, dedupe: boolean = false, opts?: { submittedBy?: string; submissionType?: 'user' | 'admin_finish' }): Promise<string | undefined> {
  // Load board, columns, tasks
  const board = await getBoardById(boardId);
  if (!board) return undefined;
  const [columns, tasks] = await Promise.all([
    getColumnsByBoardId(boardId),
    getTasksByBoardId(boardId),
  ]);
  const dateStr = finishedOn || getUtcDateString();

  // Prevent duplicates per day (only when dedupe = true)
  if (dedupe) {
    const { data: existing, error: existErr } = await supabase
      .from('myboard_board_snapshots')
      .select('id')
      .eq('board_id', boardId)
      .eq('finished_on', dateStr)
      .maybeSingle();
    if (!existErr && existing?.id) {
      return existing.id as string;
    }
  }

  // Create board snapshot
  const { data: snap, error: snapErr } = await supabase
    .from('myboard_board_snapshots')
    .insert([
      {
        board_id: board.id,
        organization_id: board.organizationId,
        title: board.title,
        finished_on: dateStr,
        submitted_by: opts?.submittedBy || null,
        submission_type: opts?.submissionType || null,
      }
    ])
    .select()
    .single();
  if (snapErr || !snap) throw snapErr || new Error('Failed to create board snapshot');
  const snapshotId = snap.id as string;

  // Insert column snapshots
  if (columns.length > 0) {
    const columnRows = columns.map(c => ({
      board_snapshot_id: snapshotId,
      title: c.title,
      position: c.order,
      original_column_id: c.id,
    }));
    const { error: colErr } = await supabase
      .from('myboard_column_snapshots')
      .insert(columnRows);
    if (colErr) throw colErr;
  }

  // Insert task snapshots
  if (tasks.length > 0) {
    const taskRows = tasks.map(t => ({
      board_snapshot_id: snapshotId,
      title: t.title,
      description: t.description || null,
      completed: !!t.completed,
      due_date: t.dueDate || null,
      due_time: t.dueTime || null,
      completed_at: t.completedAt || null,
      completed_by: t.completedBy || null,
      importance_color: t.importanceColor || null,
      original_column_id: t.columnId,
      original_task_id: t.id,
    }));
    const { error: taskErr } = await supabase
      .from('myboard_task_snapshots')
      .insert(taskRows);
    if (taskErr) throw taskErr;
  }

  // Reset tasks for next day
  const { error: resetErr } = await supabase
    .from('myboard_tasks')
    .update({ completed: false, completed_at: null, completed_by: null })
    .eq('board_id', boardId);
  if (resetErr) throw resetErr;

  // Mark board finished_at (archive list can rely on this or snapshots list)
  try {
    await markBoardFinished(boardId);
  } catch {}

  return snapshotId;
}

// Ensure a board has a snapshot for a given UTC day, otherwise create it
export async function ensureDailySnapshotForBoard(boardId: string, utcDate: string): Promise<void> {
  await snapshotBoardAndReset(boardId, utcDate);
}

// Ensure all active boards in an organization have a snapshot for a given UTC day
export async function ensureDailySnapshotsForOrganization(organizationId: string, utcDate: string): Promise<void> {
  const boards = await getBoardsByOrganizationId(organizationId);
  const active = boards.filter(b => !b.finishedAt);
  for (const b of active) {
    await ensureDailySnapshotForBoard(b.id, utcDate);
  }
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const { error } = await supabase
    .from('myboard_board_snapshots')
    .delete()
    .eq('id', snapshotId);
  if (error) throw error;
}

export async function snapshotColumnAndReset(boardId: string, columnId: string, opts?: { submittedBy?: string; submissionType?: 'user' | 'admin_finish' }): Promise<string | undefined> {
  const board = await getBoardById(boardId);
  if (!board) return undefined;
  const [columns, tasks] = await Promise.all([
    getColumnsByBoardId(boardId),
    getTasksByBoardId(boardId),
  ]);
  const dateStr = getUtcDateString();

  const { data: snap, error: snapErr } = await supabase
    .from('myboard_board_snapshots')
    .insert([
      {
        board_id: board.id,
        organization_id: board.organizationId,
        title: `${board.title} - ${columns.find(c => c.id === columnId)?.title}`,
        finished_on: dateStr,
        submitted_by: opts?.submittedBy || null,
        submission_type: opts?.submissionType || 'user',
      }
    ])
    .select()
    .single();
  if (snapErr || !snap) throw snapErr || new Error('Failed to create board snapshot');
  const snapshotId = snap.id as string;

  const targetColumn = columns.find(c => c.id === columnId);
  if (targetColumn) {
    const { error: colErr } = await supabase
      .from('myboard_column_snapshots')
      .insert([{
        board_snapshot_id: snapshotId,
        title: targetColumn.title,
        position: targetColumn.order,
        original_column_id: targetColumn.id,
      }]);
    if (colErr) throw colErr;
  }

  const columnTasks = tasks.filter(t => t.columnId === columnId);
  if (columnTasks.length > 0) {
    const taskRows = columnTasks.map(t => ({
      board_snapshot_id: snapshotId,
      title: t.title,
      description: t.description || null,
      completed: !!t.completed,
      due_date: t.dueDate || null,
      due_time: t.dueTime || null,
      completed_at: t.completedAt || null,
      completed_by: t.completedBy || null,
      importance_color: t.importanceColor || null,
      original_column_id: t.columnId,
      original_task_id: t.id,
    }));
    const { error: taskErr } = await supabase
      .from('myboard_task_snapshots')
      .insert(taskRows);
    if (taskErr) throw taskErr;
  }

  // Reset only tasks from this column
  const { error: resetErr } = await supabase
    .from('myboard_tasks')
    .update({ completed: false, completed_at: null, completed_by: null })
    .eq('board_id', boardId)
    .eq('column_id', columnId);
  if (resetErr) throw resetErr;

  return snapshotId;
}


