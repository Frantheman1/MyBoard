export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  organizationId: string;
  createdAt: string;
  password?: string; // For authentication
}

export interface Organization {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface OrganizationSettings {
  organizationId: string;
  resetOnSubmit: boolean;
  autoSendEndOfDay: boolean;
}

export interface Board {
  id: string;
  title: string;
  organizationId: string;
  finishedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface Column {
  id: string;
  title: string;
  boardId: string;
  order: number;
  color?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  importanceColor?: string;
  columnId: string;
  boardId: string;
  position?: number;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
  completedBy?: string;
  allowed_weekdays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

// Snapshots
export interface BoardSnapshot {
  id: string;
  boardId: string;
  organizationId: string;
  title: string;
  finishedOn: string; // UTC date, YYYY-MM-DD
  createdAt: string;
  submittedBy?: string;
  submissionType?: 'user' | 'admin_finish';
}

export interface ColumnSnapshot {
  id: string;
  boardSnapshotId: string;
  title: string;
  position: number;
  originalColumnId: string;
}

export interface TaskSnapshot {
  id: string;
  boardSnapshotId: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
  completedAt?: string;
  completedBy?: string;
  importanceColor?: string;
  position?: number;
  originalColumnId: string;
  originalTaskId: string;
}

export interface Notification {
  id: string;
  type: 'task_assigned' | 'task_moved' | 'task_completed' | 'comment_added' | 'due_date_reminder' | 'board_shared';
  title: string;
  message: string;
  boardId?: string;
  boardName?: string;
  taskId?: string;
  taskName?: string;
  fromUser?: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export type Language = 'en' | 'no';

export interface RootStackParamList {
  Auth: undefined;
  Main: undefined;
  Board: { boardId: string };
  Settings: undefined;
  Snapshot: { snapshotId: string };
  UserHelp: undefined;
  AdminHelp: undefined;
  [key: string]: undefined | object;
}

export interface MainTabParamList {
  Dashboard: undefined;
  Admin: undefined;
  Profile: undefined;
}

export interface AuthStackParamList {
  Login: undefined;
  Register: undefined;
}
