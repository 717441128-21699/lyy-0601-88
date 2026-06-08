import { StorageAdapter, Goal, Task, Reminder, ReviewRecord, ListOptions } from '../types';

class MemoryStorage implements StorageAdapter {
  private goals: Map<string, Goal> = new Map();
  private tasks: Map<string, Task> = new Map();
  private reminders: Map<string, Reminder> = new Map();
  private reviews: Map<string, ReviewRecord[]> = new Map();

  async saveGoal(goal: Goal): Promise<void> {
    this.goals.set(goal.id, goal);
  }

  async getGoal(id: string): Promise<Goal | null> {
    return this.goals.get(id) || null;
  }

  async listGoals(options?: ListOptions<Goal>): Promise<Goal[]> {
    let result = Array.from(this.goals.values());

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
    this.goals.delete(id);
  }

  async saveTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listTasks(options?: ListOptions<Task>): Promise<Task[]> {
    let result = Array.from(this.tasks.values());

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
    this.tasks.delete(id);
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async listReminders(options?: ListOptions<Reminder>): Promise<Reminder[]> {
    let result = Array.from(this.reminders.values());

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
    const existing = this.reviews.get(review.goalId) || [];
    existing.push(review);
    this.reviews.set(review.goalId, existing);
  }

  async listReviews(goalId: string): Promise<ReviewRecord[]> {
    return this.reviews.get(goalId) || [];
  }

  clear(): void {
    this.goals.clear();
    this.tasks.clear();
    this.reminders.clear();
    this.reviews.clear();
  }

  size(): { goals: number; tasks: number; reminders: number } {
    return {
      goals: this.goals.size,
      tasks: this.tasks.size,
      reminders: this.reminders.size,
    };
  }
}

export { MemoryStorage };
export default MemoryStorage;
