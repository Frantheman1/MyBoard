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

export interface Board {
  id: string;
  title: string;
  organizationId: string;
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
  columnId: string;
  boardId: string;
  completed: boolean;
  createdAt: string;
  createdBy: string;
  completedBy?: string;
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
}

export interface MainTabParamList {
  Dashboard: undefined;
  Notifications: undefined;
  Profile: undefined;
}

export interface AuthStackParamList {
  Login: undefined;
  Register: undefined;
}
