import {
  Goal,
  CreateGoalInput,
  Milestone,
  GoalStatus,
  Priority,
  StorageAdapter,
  ListOptions,
} from '../types';
import { generateId, getDaysBetween, getPeriodDates, addDays } from '../utils';

class GoalManager {
  private storage?: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage;
  }

  createGoal(input: CreateGoalInput): Goal {
    const now = new Date();
    const startDate = input.startDate || now;

    const goal: Goal = {
      id: generateId(),
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags || [],
      priority: input.priority || 'medium',
      status: 'not_started',
      progress: 0,
      startDate,
      targetDate: input.targetDate,
      period: input.period,
      parentGoalId: input.parentGoalId,
      milestones: [],
      taskIds: [],
      blockers: [],
      reviews: [],
      evidences: [],
      reminderIds: [],
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    if (this.storage) {
      this.storage.saveGoal(goal);
    }

    return goal;
  }

  createPeriodicGoal(input: CreateGoalInput, generateCount: number = 1): Goal[] {
    if (!input.period || input.period === 'custom') {
      return [this.createGoal(input)];
    }

    const goals: Goal[] = [];
    let currentStart = input.startDate || new Date();

    for (let i = 0; i < generateCount; i++) {
      const periodDates = getPeriodDates(input.period, currentStart);
      const goal = this.createGoal({
        ...input,
        startDate: periodDates.start,
        targetDate: periodDates.end,
      });
      goals.push(goal);
      currentStart = addDays(periodDates.end, 1);
    }

    return goals;
  }

  async getGoal(id: string): Promise<Goal | null> {
    if (this.storage) {
      return this.storage.getGoal(id);
    }
    return null;
  }

  async listGoals(options?: ListOptions<Goal>): Promise<Goal[]> {
    if (this.storage) {
      return this.storage.listGoals(options);
    }
    return [];
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
    const goal = await this.getGoal(id);
    if (!goal) return null;

    const updatedGoal: Goal = {
      ...goal,
      ...updates,
      updatedAt: new Date(),
    };

    if (this.storage) {
      this.storage.saveGoal(updatedGoal);
    }

    return updatedGoal;
  }

  async deleteGoal(id: string): Promise<void> {
    if (this.storage) {
      return this.storage.deleteGoal(id);
    }
  }

  async updateGoalStatus(id: string, status: GoalStatus): Promise<Goal | null> {
    const updates: Partial<Goal> = { status };
    if (status === 'completed') {
      updates.completedAt = new Date();
      updates.progress = 100;
    }
    return this.updateGoal(id, updates);
  }

  async updateGoalProgress(id: string, progress: number): Promise<Goal | null> {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    return this.updateGoal(id, { progress: clampedProgress });
  }

  async addMilestone(
    goalId: string,
    title: string,
    targetDate: Date,
    description?: string
  ): Promise<Milestone | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;

    const now = new Date();
    const milestone: Milestone = {
      id: generateId(),
      goalId,
      title,
      description,
      targetDate,
      status: 'not_started',
      progress: 0,
      order: goal.milestones.length,
      createdAt: now,
      updatedAt: now,
    };

    goal.milestones.push(milestone);
    await this.updateGoal(goalId, { milestones: goal.milestones });

    return milestone;
  }

  async splitIntoMilestones(
    goalId: string,
    milestoneConfigs: Array<{ title: string; targetDate: Date; description?: string }>
  ): Promise<Milestone[] | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;

    const milestones: Milestone[] = [];
    const now = new Date();

    milestoneConfigs.forEach((config, index) => {
      const milestone: Milestone = {
        id: generateId(),
        goalId,
        title: config.title,
        description: config.description,
        targetDate: config.targetDate,
        status: 'not_started',
        progress: 0,
        order: index,
        createdAt: now,
        updatedAt: now,
      };
      milestones.push(milestone);
    });

    await this.updateGoal(goalId, { milestones: [...goal.milestones, ...milestones] });
    return milestones;
  }

  async autoSplitMilestones(
    goalId: string,
    parts: number = 4
  ): Promise<Milestone[] | null> {
    const goal = await this.getGoal(goalId);
    if (!goal || parts < 2) return null;

    const totalDays = getDaysBetween(goal.startDate, goal.targetDate);
    if (totalDays < parts) return null;

    const daysPerMilestone = Math.floor(totalDays / parts);
    const milestoneConfigs: Array<{ title: string; targetDate: Date; description?: string }> = [];

    for (let i = 0; i < parts; i++) {
      const progressPercent = Math.round(((i + 1) / parts) * 100);
      const daysOffset = daysPerMilestone * (i + 1);
      const targetDate = addDays(goal.startDate, daysOffset);

      milestoneConfigs.push({
        title: `阶段 ${i + 1} - 完成 ${progressPercent}%`,
        targetDate,
        description: `完成目标的 ${progressPercent}%`,
      });
    }

    return this.splitIntoMilestones(goalId, milestoneConfigs);
  }

  async updateMilestoneStatus(
    goalId: string,
    milestoneId: string,
    status: GoalStatus
  ): Promise<Milestone | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;

    const milestoneIndex = goal.milestones.findIndex(m => m.id === milestoneId);
    if (milestoneIndex === -1) return null;

    const milestone = goal.milestones[milestoneIndex];
    milestone.status = status;
    milestone.updatedAt = new Date();

    if (status === 'completed') {
      milestone.completedAt = new Date();
      milestone.progress = 100;
    }

    goal.milestones[milestoneIndex] = milestone;
    await this.updateGoal(goalId, { milestones: goal.milestones });

    return milestone;
  }

  async addTaskToGoal(goalId: string, taskId: string): Promise<Goal | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;

    if (!goal.taskIds.includes(taskId)) {
      goal.taskIds.push(taskId);
      return this.updateGoal(goalId, { taskIds: goal.taskIds });
    }

    return goal;
  }

  async getSubGoals(parentGoalId: string): Promise<Goal[]> {
    if (this.storage) {
      return this.storage.listGoals({
        filter: { parentGoalId } as Partial<Goal>,
      });
    }
    return [];
  }

  calculateGoalProgressFromTasks(goal: Goal, tasks: Array<{ progress: number }>): number {
    if (tasks.length === 0) return goal.progress;

    const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
    return Math.round(totalProgress / tasks.length);
  }

  calculateGoalProgressFromMilestones(goal: Goal): number {
    if (goal.milestones.length === 0) return goal.progress;

    const totalProgress = goal.milestones.reduce((sum, m) => sum + m.progress, 0);
    return Math.round(totalProgress / goal.milestones.length);
  }
}

export { GoalManager };
export default GoalManager;
