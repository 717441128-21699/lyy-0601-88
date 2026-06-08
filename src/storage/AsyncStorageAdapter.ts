import { StorageAdapter, Goal, Task, Reminder, ReviewRecord, ListOptions } from '../types';

interface AsyncStorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys?(): Promise<string[]>;
}

interface StorageData {
  version: string;
  goals: Record<string, Goal>;
  tasks: Record<string, Task>;
  reminders: Record<string, Reminder>;
  reviews: Record<string, ReviewRecord[]>;
}

class AsyncStorageAdapter implements StorageAdapter {
  private backend: AsyncStorageBackend;
  private namespace: string;
  private cache: StorageData;
  private cacheTimeout: number = 5000;
  private lastSync: number = 0;

  constructor(
    backend: AsyncStorageBackend,
    namespace: string = 'efficiency-goal-sdk'
  ) {
    this.backend = backend;
    this.namespace = namespace;
    this.cache = {
      version: '1.0.0',
      goals: {},
      tasks: {},
      reminders: {},
      reviews: {},
    };
  }

  private getKey(type: string): string {
    return `${this.namespace}:${type}`;
  }

  private async loadFromBackend(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.cacheTimeout) return;

    try {
      const [goalsData, tasksData, remindersData, reviewsData] = await Promise.all([
        this.backend.getItem(this.getKey('goals')),
        this.backend.getItem(this.getKey('tasks')),
        this.backend.getItem(this.getKey('reminders')),
        this.backend.getItem(this.getKey('reviews')),
      ]);

      this.cache.goals = goalsData ? JSON.parse(goalsData) : {};
      this.cache.tasks = tasksData ? JSON.parse(tasksData) : {};
      this.cache.reminders = remindersData ? JSON.parse(remindersData) : {};
      this.cache.reviews = reviewsData ? JSON.parse(reviewsData) : {};
      this.lastSync = now;

      this.parseDates();
    } catch (error) {
      console.warn('[AsyncStorage] Failed to load from backend:', error);
    }
  }

  private parseDates(): void {
    for (const id in this.cache.goals) {
      const goal = this.cache.goals[id];
      goal.startDate = new Date(goal.startDate);
      goal.targetDate = new Date(goal.targetDate);
      if (goal.completedAt) goal.completedAt = new Date(goal.completedAt);
      goal.createdAt = new Date(goal.createdAt);
      goal.updatedAt = new Date(goal.updatedAt);
    }
    for (const id in this.cache.tasks) {
      const task = this.cache.tasks[id];
      if (task.dueDate) task.dueDate = new Date(task.dueDate);
      if (task.startDate) task.startDate = new Date(task.startDate);
      if (task.completedAt) task.completedAt = new Date(task.completedAt);
      task.createdAt = new Date(task.createdAt);
      task.updatedAt = new Date(task.updatedAt);
    }
    for (const id in this.cache.reminders) {
      const reminder = this.cache.reminders[id];
      reminder.scheduledAt = new Date(reminder.scheduledAt);
      if (reminder.sentAt) reminder.sentAt = new Date(reminder.sentAt);
    }
    for (const goalId in this.cache.reviews) {
      this.cache.reviews[goalId] = this.cache.reviews[goalId].map(r => ({
        ...r,
        date: new Date(r.date),
        createdAt: new Date(r.createdAt),
      }));
    }
  }

  private async saveGoals(): Promise<void> {
    await this.backend.setItem(this.getKey('goals'), JSON.stringify(this.cache.goals));
  }

  private async saveTasks(): Promise<void> {
    await this.backend.setItem(this.getKey('tasks'), JSON.stringify(this.cache.tasks));
  }

  private async saveReminders(): Promise<void> {
    await this.backend.setItem(this.getKey('reminders'), JSON.stringify(this.cache.reminders));
  }

  private async saveReviews(): Promise<void> {
    await this.backend.setItem(this.getKey('reviews'), JSON.stringify(this.cache.reviews));
  }

  async saveGoal(goal: Goal): Promise<void> {
    await this.loadFromBackend();
    this.cache.goals[goal.id] = goal;
    await this.saveGoals();
  }

  async getGoal(id: string): Promise<Goal | null> {
    await this.loadFromBackend();
    return this.cache.goals[id] || null;
  }

  async listGoals(options?: ListOptions<Goal>): Promise<Goal[]> {
    await this.loadFromBackend();
    let result = Object.values(this.cache.goals);

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
    await this.loadFromBackend();
    delete this.cache.goals[id];
    delete this.cache.reviews[id];
    await Promise.all([this.saveGoals(), this.saveReviews()]);
  }

  async saveTask(task: Task): Promise<void> {
    await this.loadFromBackend();
    this.cache.tasks[task.id] = task;
    await this.saveTasks();
  }

  async getTask(id: string): Promise<Task | null> {
    await this.loadFromBackend();
    return this.cache.tasks[id] || null;
  }

  async listTasks(options?: ListOptions<Task>): Promise<Task[]> {
    await this.loadFromBackend();
    let result = Object.values(this.cache.tasks);

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
    await this.loadFromBackend();
    delete this.cache.tasks[id];
    await this.saveTasks();
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.loadFromBackend();
    this.cache.reminders[reminder.id] = reminder;
    await this.saveReminders();
  }

  async listReminders(options?: ListOptions<Reminder>): Promise<Reminder[]> {
    await this.loadFromBackend();
    let result = Object.values(this.cache.reminders);

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
    await this.loadFromBackend();
    if (!this.cache.reviews[review.goalId]) {
      this.cache.reviews[review.goalId] = [];
    }
    const existing = this.cache.reviews[review.goalId];
    const index = existing.findIndex(r => r.id === review.id);
    if (index >= 0) {
      existing[index] = review;
    } else {
      existing.push(review);
    }
    await this.saveReviews();
  }

  async listReviews(goalId: string): Promise<ReviewRecord[]> {
    await this.loadFromBackend();
    return this.cache.reviews[goalId] || [];
  }

  async clear(): Promise<void> {
    this.cache = {
      version: '1.0.0',
      goals: {},
      tasks: {},
      reminders: {},
      reviews: {},
    };
    await Promise.all([
      this.backend.removeItem(this.getKey('goals')),
      this.backend.removeItem(this.getKey('tasks')),
      this.backend.removeItem(this.getKey('reminders')),
      this.backend.removeItem(this.getKey('reviews')),
    ]);
  }

  async sync(): Promise<void> {
    this.lastSync = 0;
    await this.loadFromBackend();
  }
}

export { AsyncStorageAdapter };
export default AsyncStorageAdapter;
