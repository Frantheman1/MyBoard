import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Board, Column, Task, Organization } from '../types';

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
    columnId: t.column_id,
    boardId: t.board_id,
    completed: !!t.completed,
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
    columnId: t.column_id,
    boardId: t.board_id,
    completed: !!t.completed,
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
  if (updates.columnId !== undefined) payload.column_id = updates.columnId;
  if (updates.boardId !== undefined) payload.board_id = updates.boardId;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.completedBy !== undefined) payload.completed_by = updates.completedBy || null;
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
  const { error } = await supabase
    .from('myboard_tasks')
    .update({ completed })
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
    .update({ completed: false, completed_by: null })
    .eq('column_id', columnId);
  if (error) throw error;
}


