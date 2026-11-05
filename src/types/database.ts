// Типы схемы public. Соответствуют supabase/migrations; формат — как у `supabase gen types typescript`.
export type UserRole = 'manager' | 'executor';
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'rework';
export type TransitionActor = 'manager' | 'assignee';

type ProfileRow = { id: string; full_name: string; role: UserRole; created_at: string };
type SiteRow = { id: string; name: string; address: string; created_at: string };
type TaskRow = {
  id: string;
  site_id: string;
  title: string;
  description: string;
  assignee_id: string;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
};
type StatusTransitionRow = {
  from_status: TaskStatus;
  to_status: TaskStatus;
  actor: TransitionActor;
  comment_required: boolean;
};
type TaskStatusHistoryRow = {
  id: number;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  changed_by: string;
  changed_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: never; Update: never; Relationships: [] };
      sites: {
        Row: SiteRow;
        Insert: { id?: string; name: string; address: string };
        Update: { name?: string; address?: string };
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        // status, author_id и created_at выставляет база.
        Insert: { site_id: string; title: string; description?: string; assignee_id: string };
        Update: { site_id?: string; title?: string; description?: string; assignee_id?: string };
        Relationships: [
          {
            foreignKeyName: 'tasks_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      status_transitions: { Row: StatusTransitionRow; Insert: never; Update: never; Relationships: [] };
      task_status_history: {
        Row: TaskStatusHistoryRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'task_status_history_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      change_task_status: {
        Args: { p_task_id: string; p_to_status: TaskStatus; p_comment?: string | null };
        Returns: TaskRow;
      };
      is_manager: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: { user_role: UserRole; task_status: TaskStatus; transition_actor: TransitionActor };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = ProfileRow;
export type Site = SiteRow;
export type Task = TaskRow;
export type StatusTransition = StatusTransitionRow;
