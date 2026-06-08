import {
  Goal,
  Task,
  Milestone,
  Reminder,
  ReminderType,
  DailyChecklist,
  StorageAdapter,
  ListOptions,
} from '../types';
import { generateId, startOfDay, endOfDay, addDays, getDaysBetween } from '../utils';
import { I18n } from '../i18n';

class ReminderGenerator {
  private i18n: I18n;
  private storage?: StorageAdapter;

  constructor(i18n: I18n, storage?: StorageAdapter) {
    this.i18n = i18n;
    this.storage = storage;
  }

  generateReminder(
    targetId: string,
    targetType: 'goal' | 'task' | 'milestone',
    type: ReminderType,
    scheduledAt: Date,
    title: string
  ): Reminder {
    const reminder: Reminder = {
      id: generateId(),
      targetId,
      targetType,
      type,
      message: this.generateReminderMessage(type, title),
      scheduledAt,
      isRead: false,
    };

    if (this.storage) {
      this.storage.saveReminder(reminder);
    }

    return reminder;
  }

  private generateReminderMessage(type: ReminderType, title: string): string {
    const messageKeys: Record<ReminderType, string> = {
      due_date: 'reminder.dueDate',
      start_date: 'reminder.startDate',
      progress_check: 'reminder.progressCheck',
      milestone: 'reminder.milestone',
      custom: 'reminder.dueDate',
    };
    return this.i18n.t(messageKeys[type], { title });
  }

  generateGoalReminders(goal: Goal, daysBeforeDue: number = 3): Reminder[] {
    const reminders: Reminder[] = [];
    const now = new Date();

    const startReminderDate = new Date(goal.startDate);
    startReminderDate.setDate(startReminderDate.getDate() - 1);
    if (startReminderDate > now) {
      reminders.push(
        this.generateReminder(goal.id, 'goal', 'start_date', startReminderDate, goal.title)
      );
    }

    const dueReminderDate = new Date(goal.targetDate);
    dueReminderDate.setDate(dueReminderDate.getDate() - daysBeforeDue);
    if (dueReminderDate > now && goal.status !== 'completed') {
      reminders.push(
        this.generateReminder(goal.id, 'goal', 'due_date', dueReminderDate, goal.title)
      );
    }

    const totalDays = getDaysBetween(goal.startDate, goal.targetDate);
    if (totalDays > 7) {
      const checkInterval = Math.floor(totalDays / 4);
      for (let i = 1; i < 4; i++) {
        const checkDate = new Date(goal.startDate);
        checkDate.setDate(checkDate.getDate() + checkInterval * i);
        if (checkDate > now && checkDate < goal.targetDate && goal.status !== 'completed') {
          reminders.push(
            this.generateReminder(goal.id, 'goal', 'progress_check', checkDate, goal.title)
          );
        }
      }
    }

    return reminders;
  }

  generateTaskReminders(task: Task, daysBeforeDue: number = 1): Reminder[] {
    const reminders: Reminder[] = [];
    const now = new Date();

    if (task.dueDate && task.status !== 'completed' && task.status !== 'cancelled') {
      const dueReminderDate = new Date(task.dueDate);
      dueReminderDate.setDate(dueReminderDate.getDate() - daysBeforeDue);
      if (dueReminderDate > now) {
        reminders.push(
          this.generateReminder(task.id, 'task', 'due_date', dueReminderDate, task.title)
        );
      }

      if (task.dueDate < now) {
        reminders.push(
          this.generateReminder(task.id, 'task', 'due_date', now, task.title)
        );
      }
    }

    if (task.startDate && task.startDate > now && task.status === 'todo') {
      const startReminderDate = new Date(task.startDate);
      startReminderDate.setHours(9, 0, 0, 0);
      reminders.push(
        this.generateReminder(task.id, 'task', 'start_date', startReminderDate, task.title)
      );
    }

    return reminders;
  }

  generateMilestoneReminders(milestone: Milestone, daysBeforeDue: number = 1): Reminder[] {
    const reminders: Reminder[] = [];
    const now = new Date();

    if (milestone.status !== 'completed' && milestone.targetDate > now) {
      const dueReminderDate = new Date(milestone.targetDate);
      dueReminderDate.setDate(dueReminderDate.getDate() - daysBeforeDue);
      if (dueReminderDate > now) {
        reminders.push(
          this.generateReminder(
            milestone.id,
            'milestone',
            'milestone',
            dueReminderDate,
            milestone.title
          )
        );
      }
    }

    return reminders;
  }

  generateAllReminders(goals: Goal[], tasks: Task[]): Reminder[] {
    const allReminders: Reminder[] = [];

    goals.forEach(goal => {
      allReminders.push(...this.generateGoalReminders(goal));
      goal.milestones.forEach(milestone => {
        allReminders.push(...this.generateMilestoneReminders(milestone));
      });
    });

    tasks.forEach(task => {
      allReminders.push(...this.generateTaskReminders(task));
    });

    return allReminders;
  }

  getDailyChecklist(
    goals: Goal[],
    tasks: Task[],
    reminders: Reminder[],
    date: Date = new Date()
  ): DailyChecklist {
    const todayStart = startOfDay(date);
    const todayEnd = endOfDay(date);

    const todaysTasks = tasks.filter(task => {
      if (task.status === 'completed' || task.status === 'cancelled') return false;

      if (task.dueDate && task.dueDate >= todayStart && task.dueDate <= todayEnd) {
        return true;
      }
      if (task.status === 'in_progress') return true;
      if (task.blockers.some(b => !b.resolvedAt)) return true;

      return false;
    });

    const goalsInProgress = goals.filter(
      g => g.status === 'in_progress' || g.status === 'not_started'
    );

    const milestonesDue = goals.flatMap(g =>
      g.milestones.filter(
        m =>
          m.status !== 'completed' &&
          m.targetDate >= todayStart &&
          m.targetDate <= addDays(todayEnd, 2)
      )
    );

    const todaysReminders = reminders.filter(
      r =>
        !r.isRead &&
        r.scheduledAt >= todayStart &&
        r.scheduledAt <= todayEnd
    );

    const suggestedActions = this.generateSuggestedActions(todaysTasks, goalsInProgress);

    todaysTasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return {
      date,
      tasks: todaysTasks,
      goalsInProgress,
      milestonesDue,
      reminders: todaysReminders,
      suggestedActions,
    };
  }

  private generateSuggestedActions(tasks: Task[], goals: Goal[]): string[] {
    const actions: string[] = [];

    const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
    if (urgentTasks.length > 0) {
      actions.push(`优先处理 ${urgentTasks.length} 个紧急任务`);
    }

    const blockedTasks = tasks.filter(t => t.blockers.some(b => !b.resolvedAt));
    if (blockedTasks.length > 0) {
      actions.push(`解决 ${blockedTasks.length} 个任务的阻塞问题`);
    }

    const inProgressGoals = goals.filter(g => g.status === 'in_progress');
    if (inProgressGoals.length > 0) {
      actions.push(`推进 ${inProgressGoals.length} 个进行中的目标`);
    }

    const tasksWithoutProgress = tasks.filter(t => t.progress === 0 && t.status !== 'completed');
    if (tasksWithoutProgress.length > 3) {
      actions.push('开始处理尚未启动的任务');
    }

    return actions;
  }

  async getPendingReminders(
    options?: ListOptions<Reminder>
  ): Promise<Reminder[]> {
    if (this.storage) {
      return this.storage.listReminders(options);
    }
    return [];
  }

  markReminderAsRead(reminderId: string, reminders: Reminder[]): Reminder[] {
    return reminders.map(r =>
      r.id === reminderId ? { ...r, isRead: true, sentAt: new Date() } : r
    );
  }

  getUpcomingReminders(reminders: Reminder[], hours: number = 24): Reminder[] {
    const now = new Date();
    const threshold = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return reminders
      .filter(r => !r.isRead && r.scheduledAt >= now && r.scheduledAt <= threshold)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  generateCustomReminder(
    targetId: string,
    targetType: 'goal' | 'task' | 'milestone',
    message: string,
    scheduledAt: Date
  ): Reminder {
    const reminder: Reminder = {
      id: generateId(),
      targetId,
      targetType,
      type: 'custom',
      message,
      scheduledAt,
      isRead: false,
    };

    if (this.storage) {
      this.storage.saveReminder(reminder);
    }

    return reminder;
  }
}

export { ReminderGenerator };
export default ReminderGenerator;
