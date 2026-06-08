import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter, Goal, Task, Reminder, ReviewRecord, ListOptions } from '../types';

interface FileStorageData {
  version: string;
  exportedAt: Date;
  goals: Goal[];
  tasks: Task[];
  reminders: Reminder[];
  reviews: Record<string, ReviewRecord[]>;
}

class FileStorage implements StorageAdapter {
  private filePath: string;
  private data: FileStorageData;
  private autoSave: boolean;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(filePath: string, autoSave: boolean = true) {
    this.filePath = path.resolve(filePath);
    this.autoSave = autoSave;
    this.data = {
      version: '1.0.0',
      exportedAt: new Date(),
      goals: [],
      tasks: [],
      reminders: [],
      reviews: {},
    };
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const rawData = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(rawData);
        this.data = this.parseData(parsed);
      }
    } catch (error) {
      console.warn(`[FileStorage] Failed to load data from ${this.filePath}:`, error);
    }
  }

  private parseData(data: any): FileStorageData {
    return {
      version: data.version || '1.0.0',
      exportedAt: new Date(data.exportedAt || new Date()),
      goals: (data.goals || []).map((g: any) => this.parseGoal(g)),
      tasks: (data.tasks || []).map((t: any) => this.parseTask(t)),
      reminders: (data.reminders || []).map((r: any) => this.parseReminder(r)),
      reviews: this.parseReviews(data.reviews || {}),
    };
  }

  private parseGoal(goal: any): Goal {
    return {
      ...goal,
      startDate: new Date(goal.startDate),
      targetDate: new Date(goal.targetDate),
      completedAt: goal.completedAt ? new Date(goal.completedAt) : undefined,
      milestones: (goal.milestones || []).map((m: any) => ({
        ...m,
        targetDate: new Date(m.targetDate),
        completedAt: m.completedAt ? new Date(m.completedAt) : undefined,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      })),
      blockers: (goal.blockers || []).map((b: any) => ({
        ...b,
        createdAt: new Date(b.createdAt),
        resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : undefined,
      })),
      reviews: (goal.reviews || []).map((r: any) => this.parseReview(r)),
      evidences: (goal.evidences || []).map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt),
      })),
      createdAt: new Date(goal.createdAt),
      updatedAt: new Date(goal.updatedAt),
    };
  }

  private parseTask(task: any): Task {
    return {
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      startDate: task.startDate ? new Date(task.startDate) : undefined,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      blockers: (task.blockers || []).map((b: any) => ({
        ...b,
        createdAt: new Date(b.createdAt),
        resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : undefined,
      })),
      evidences: (task.evidences || []).map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt),
      })),
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
    };
  }

  private parseReminder(reminder: any): Reminder {
    return {
      ...reminder,
      scheduledAt: new Date(reminder.scheduledAt),
      sentAt: reminder.sentAt ? new Date(reminder.sentAt) : undefined,
    };
  }

  private parseReview(review: any): ReviewRecord {
    return {
      ...review,
      date: new Date(review.date),
      createdAt: new Date(review.createdAt),
    };
  }

  private parseReviews(reviews: any): Record<string, ReviewRecord[]> {
    const result: Record<string, ReviewRecord[]> = {};
    for (const [goalId, reviewList] of Object.entries(reviews)) {
      result[goalId] = (reviewList as any[]).map(r => this.parseReview(r));
    }
    return result;
  }

  private scheduleSave(): void {
    if (!this.autoSave) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToFile();
    }, 100);
  }

  private saveToFile(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.data.exportedAt = new Date();
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`[FileStorage] Failed to save data to ${this.filePath}:`, error);
    }
  }

  async saveGoal(goal: Goal): Promise<void> {
    const index = this.data.goals.findIndex(g => g.id === goal.id);
    if (index >= 0) {
      this.data.goals[index] = goal;
    } else {
      this.data.goals.push(goal);
    }
    this.scheduleSave();
  }

  async getGoal(id: string): Promise<Goal | null> {
    return this.data.goals.find(g => g.id === id) || null;
  }

  async listGoals(options?: ListOptions<Goal>): Promise<Goal[]> {
    let result = [...this.data.goals];

    if (options?.filter) {
      result = result.filter(goal => {
        return Object.entries(options.filter!).every(([key, value]) => {
          return (goal as unknown as Record<string, unknown>)[key] === value;
        });
      });
    }

    if (options?.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortField];
        const bVal = (b as unknown as Record<string, unknown>)[sortField];
        if (aVal && bVal && aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal && bVal && aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (options?.offset) {
      result = result.slice(options.offset);
    }

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async deleteGoal(id: string): Promise<void> {
    this.data.goals = this.data.goals.filter(g => g.id !== id);
    delete this.data.reviews[id];
    this.scheduleSave();
  }

  async saveTask(task: Task): Promise<void> {
    const index = this.data.tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      this.data.tasks[index] = task;
    } else {
      this.data.tasks.push(task);
    }
    this.scheduleSave();
  }

  async getTask(id: string): Promise<Task | null> {
    return this.data.tasks.find(t => t.id === id) || null;
  }

  async listTasks(options?: ListOptions<Task>): Promise<Task[]> {
    let result = [...this.data.tasks];

    if (options?.filter) {
      result = result.filter(task => {
        return Object.entries(options.filter!).every(([key, value]) => {
          return (task as unknown as Record<string, unknown>)[key] === value;
        });
      });
    }

    if (options?.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortField];
        const bVal = (b as unknown as Record<string, unknown>)[sortField];
        if (aVal && bVal && aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal && bVal && aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (options?.offset) {
      result = result.slice(options.offset);
    }

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async deleteTask(id: string): Promise<void> {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.scheduleSave();
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    const index = this.data.reminders.findIndex(r => r.id === reminder.id);
    if (index >= 0) {
      this.data.reminders[index] = reminder;
    } else {
      this.data.reminders.push(reminder);
    }
    this.scheduleSave();
  }

  async listReminders(options?: ListOptions<Reminder>): Promise<Reminder[]> {
    let result = [...this.data.reminders];

    if (options?.filter) {
      result = result.filter(reminder => {
        return Object.entries(options.filter!).every(([key, value]) => {
          return (reminder as unknown as Record<string, unknown>)[key] === value;
        });
      });
    }

    if (options?.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortField];
        const bVal = (b as unknown as Record<string, unknown>)[sortField];
        if (aVal && bVal && aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal && bVal && aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }

  async saveReview(review: ReviewRecord): Promise<void> {
    if (!this.data.reviews[review.goalId]) {
      this.data.reviews[review.goalId] = [];
    }
    const existing = this.data.reviews[review.goalId];
    const index = existing.findIndex(r => r.id === review.id);
    if (index >= 0) {
      existing[index] = review;
    } else {
      existing.push(review);
    }
    this.scheduleSave();
  }

  async listReviews(goalId: string): Promise<ReviewRecord[]> {
    return this.data.reviews[goalId] || [];
  }

  async saveToFileSync(): Promise<void> {
    this.saveToFile();
  }

  async reload(): Promise<void> {
    this.loadFromFile();
  }

  async exportData(): Promise<FileStorageData> {
    return { ...this.data };
  }

  async importData(data: Partial<FileStorageData>): Promise<void> {
    this.data = this.parseData(data);
    this.scheduleSave();
  }
}

export { FileStorage };
export default FileStorage;
