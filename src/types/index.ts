export type Priority = 'urgent' | 'high' | 'medium' | 'low';

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'cancelled';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export type ReminderType = 'due_date' | 'start_date' | 'progress_check' | 'milestone' | 'custom';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type Language = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';

export type ErrorCode = 
  | 'EMPTY_TITLE'
  | 'INVALID_DATE'
  | 'INVALID_PARTS'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_SCORING_RULE'
  | 'DUPLICATE_ID'
  | 'NOT_FOUND'
  | 'VERSION_MISMATCH'
  | 'UNKNOWN_ERROR';

export interface SDKError {
  code: ErrorCode;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: SDKError;
}

export interface Blocker {
  id: string;
  description: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface CompletionEvidence {
  id: string;
  type: 'text' | 'image' | 'link' | 'file';
  content: string;
  description?: string;
  createdAt: Date;
}

export interface ReviewRecord {
  id: string;
  goalId: string;
  date: Date;
  summary: string;
  achievements: string[];
  challenges: string[];
  lessons: string[];
  nextActions: string[];
  rating: number;
  createdAt: Date;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  targetDate: Date;
  completedAt?: Date;
  status: GoalStatus;
  progress: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  targetId: string;
  targetType: 'goal' | 'task' | 'milestone';
  type: ReminderType;
  message: string;
  scheduledAt: Date;
  sentAt?: Date;
  isRead: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  priority: Priority;
  status: GoalStatus;
  progress: number;
  startDate: Date;
  targetDate: Date;
  completedAt?: Date;
  period?: GoalPeriod;
  parentGoalId?: string;
  milestones: Milestone[];
  taskIds: string[];
  blockers: Blocker[];
  reviews: ReviewRecord[];
  evidences: CompletionEvidence[];
  reminderIds: string[];
  score?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  goalId?: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  dueDate?: Date;
  startDate?: Date;
  completedAt?: Date;
  parentTaskId?: string;
  subtaskIds: string[];
  blockers: Blocker[];
  evidences: CompletionEvidence[];
  tags: string[];
  reminderIds: string[];
  score?: number;
  order: number;
  recurrenceRule?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyChecklist {
  date: Date;
  todayTasks: Task[];
  overdueTasks: Task[];
  upcomingTasks: Task[];
  goalsInProgress: Goal[];
  milestonesDue: Milestone[];
  unreadReminders: Reminder[];
  readReminders: Reminder[];
  suggestedActions: string[];
}

export interface WeeklyReport {
  startDate: Date;
  endDate: Date;
  completedGoals: Goal[];
  completedTasks: Task[];
  inProgressGoals: Goal[];
  totalTasksCompleted: number;
  totalGoalsCompleted: number;
  averageProgress: number;
  productivityScore: number;
  highlights: string[];
  challenges: string[];
  nextWeekPlan: string[];
  fullText: string;
}

export interface TrendData {
  date: Date;
  completedTasks: number;
  createdTasks: number;
  completedGoals: number;
  averageProgress: number;
  productivityScore: number;
}

export interface ScoringRule {
  id: string;
  name: string;
  description?: string;
  priorityWeights: Record<Priority, number>;
  onTimeBonus: number;
  earlyBonus: number;
  latePenalty: number;
  blockerPenalty: number;
  milestoneBonus: number;
  evidenceBonus: number;
  reviewBonus: number;
}

export interface SDKOptions {
  language?: Language;
  scoringRule?: Partial<ScoringRule>;
  storageAdapter?: StorageAdapter;
  timezone?: string;
  strictValidation?: boolean;
}

export interface StorageAdapter {
  saveGoal(goal: Goal): Promise<void>;
  getGoal(id: string): Promise<Goal | null>;
  listGoals(options?: ListOptions<Goal>): Promise<Goal[]>;
  deleteGoal(id: string): Promise<void>;
  saveTask(task: Task): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  listTasks(options?: ListOptions<Task>): Promise<Task[]>;
  deleteTask(id: string): Promise<void>;
  saveReminder(reminder: Reminder): Promise<void>;
  listReminders(options?: ListOptions<Reminder>): Promise<Reminder[]>;
  saveReview(review: ReviewRecord): Promise<void>;
  listReviews(goalId: string): Promise<ReviewRecord[]>;
}

export interface ListOptions<T> {
  filter?: Partial<T>;
  sortBy?: keyof T;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  priority?: Priority;
  startDate?: Date;
  targetDate: Date;
  period?: GoalPeriod;
  parentGoalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  goalId?: string;
  priority?: Priority;
  estimatedMinutes?: number;
  dueDate?: Date;
  startDate?: Date;
  parentTaskId?: string;
  tags?: string[];
  recurrenceRule?: string;
  metadata?: Record<string, unknown>;
}

export interface SplitTaskOptions {
  parts?: number;
  subtaskTitles?: string[];
  autoEstimate?: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: string[];
  suggestions: string[];
}

export interface NextAction {
  taskId?: string;
  goalId?: string;
  description: string;
  priority: Priority;
  reason: string;
  estimatedMinutes?: number;
}

export interface ExportData {
  version: string;
  exportedAt: Date;
  exportedBy?: string;
  goals: Goal[];
  tasks: Task[];
  reminders: Reminder[];
  reviews: ReviewRecord[];
}

export interface ImportOptions {
  duplicateStrategy: 'skip' | 'overwrite' | 'rename' | 'error';
  versionCheck: 'strict' | 'compatible' | 'ignore';
  onProgress?: (current: number, total: number) => void;
}

export interface ImportResult {
  success: boolean;
  imported: {
    goals: number;
    tasks: number;
    reminders: number;
    reviews: number;
  };
  skipped: {
    goals: number;
    tasks: number;
    reminders: number;
    reviews: number;
  };
  errors: SDKError[];
  warnings: string[];
}
