import {
  Task,
  CreateTaskInput,
  TaskStatus,
  Priority,
  Blocker,
  StorageAdapter,
  ListOptions,
  SplitTaskOptions,
} from '../types';
import { generateId, getPriorityOrder, isSimilar, addDays } from '../utils';
import { Validator } from '../validation';

class TaskManager {
  private storage?: StorageAdapter;
  private validator: Validator;

  constructor(storage?: StorageAdapter, validator?: Validator) {
    this.storage = storage;
    this.validator = validator || new Validator();
  }

  createTask(input: CreateTaskInput): Task {
    const validation = this.validator.validateCreateTaskInput(input);
    if (!validation.success) {
      throw new Error(validation.error?.message || '创建任务失败');
    }

    const normalizedInput = validation.data!;
    const now = new Date();

    const task: Task = {
      id: generateId(),
      title: normalizedInput.title,
      description: normalizedInput.description,
      goalId: normalizedInput.goalId,
      priority: normalizedInput.priority || 'medium',
      status: 'todo',
      progress: 0,
      estimatedMinutes: normalizedInput.estimatedMinutes,
      dueDate: normalizedInput.dueDate,
      startDate: normalizedInput.startDate,
      parentTaskId: normalizedInput.parentTaskId,
      subtaskIds: [],
      blockers: [],
      evidences: [],
      tags: normalizedInput.tags || [],
      reminderIds: [],
      order: 0,
      recurrenceRule: normalizedInput.recurrenceRule,
      metadata: normalizedInput.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    if (this.storage) {
      this.storage.saveTask(task);
    }

    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    if (this.storage) {
      return this.storage.getTask(id);
    }
    return null;
  }

  async listTasks(options?: ListOptions<Task>): Promise<Task[]> {
    if (this.storage) {
      return this.storage.listTasks(options);
    }
    return [];
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = await this.getTask(id);
    if (!task) return null;

    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: new Date(),
    };

    if (this.storage) {
      await this.storage.saveTask(updatedTask);
    }

    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    if (this.storage) {
      return this.storage.deleteTask(id);
    }
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const updates: Partial<Task> = { status };
    if (status === 'completed') {
      updates.completedAt = new Date();
      updates.progress = 100;
    }
    return this.updateTask(id, updates);
  }

  async updateTaskProgress(id: string, progress: number): Promise<Task | null> {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    return this.updateTask(id, { progress: clampedProgress });
  }

  async updateTaskPriority(id: string, priority: Priority): Promise<Task | null> {
    return this.updateTask(id, { priority });
  }

  sortTasks(tasks: Task[], sortBy: 'priority' | 'dueDate' | 'createdAt' | 'order' = 'priority'): Task[] {
    return [...tasks].sort((a, b) => {
      if (sortBy === 'priority') {
        return getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
      }
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      if (sortBy === 'createdAt') {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      if (sortBy === 'order') {
        return a.order - b.order;
      }
      return 0;
    });
  }

  async splitTask(
    parentTaskId: string,
    options: SplitTaskOptions = {}
  ): Promise<Task[] | null> {
    const validation = this.validator.validateSplitTaskOptions(options);
    if (!validation.success) {
      throw new Error(validation.error?.message || '拆分任务失败');
    }

    const parentTask = await this.getTask(parentTaskId);
    if (!parentTask) return null;

    const validatedOptions = validation.data!;
    const { parts = 3, subtaskTitles, autoEstimate = true } = validatedOptions;
    const subtasks: Task[] = [];
    const now = new Date();

    const titles = subtaskTitles || this.generateSubtaskTitles(parentTask.title, parts);
    const estimatedMinutesPerSubtask = autoEstimate && parentTask.estimatedMinutes
      ? Math.ceil(parentTask.estimatedMinutes / parts)
      : undefined;

    for (let i = 0; i < Math.min(parts, titles.length); i++) {
      const subtask: Task = {
        id: generateId(),
        title: titles[i],
        description: parentTask.description,
        goalId: parentTask.goalId,
        priority: parentTask.priority,
        status: 'todo',
        progress: 0,
        estimatedMinutes: estimatedMinutesPerSubtask,
        dueDate: parentTask.dueDate ? addDays(parentTask.dueDate, -Math.ceil((parts - i - 1) * 0.5)) : undefined,
        startDate: parentTask.startDate,
        parentTaskId,
        subtaskIds: [],
        blockers: [],
        evidences: [],
        tags: [...parentTask.tags],
        reminderIds: [],
        order: i,
        metadata: { ...parentTask.metadata, isSubtask: true },
        createdAt: now,
        updatedAt: now,
      };

      if (this.storage) {
        await this.storage.saveTask(subtask);
      }

      subtasks.push(subtask);
    }

    const subtaskIds = subtasks.map(s => s.id);
    await this.updateTask(parentTaskId, { subtaskIds });

    return subtasks;
  }

  private generateSubtaskTitles(parentTitle: string, parts: number): string[] {
    const titles: string[] = [];
    const actions = ['准备', '执行', '完成', '检查', '优化', '交付'];

    for (let i = 0; i < parts; i++) {
      const action = actions[i % actions.length];
      titles.push(`${action} - ${parentTitle} (${i + 1}/${parts})`);
    }

    return titles;
  }

  async addBlocker(taskId: string, description: string): Promise<Blocker | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const blocker: Blocker = {
      id: generateId(),
      description,
      createdAt: new Date(),
    };

    task.blockers.push(blocker);
    await this.updateTask(taskId, {
      blockers: task.blockers,
      status: task.status === 'todo' ? 'blocked' : task.status,
    });

    return blocker;
  }

  async resolveBlocker(taskId: string, blockerId: string, resolution: string): Promise<Blocker | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const blockerIndex = task.blockers.findIndex(b => b.id === blockerId);
    if (blockerIndex === -1) return null;

    const blocker = task.blockers[blockerIndex];
    blocker.resolvedAt = new Date();
    blocker.resolution = resolution;

    task.blockers[blockerIndex] = blocker;

    const hasUnresolvedBlockers = task.blockers.some(b => !b.resolvedAt);
    const newStatus = !hasUnresolvedBlockers && task.status === 'blocked' ? 'todo' : task.status;

    await this.updateTask(taskId, { blockers: task.blockers, status: newStatus });

    return blocker;
  }

  async addSubtask(parentTaskId: string, subtaskInput: CreateTaskInput): Promise<Task | null> {
    const parentTask = await this.getTask(parentTaskId);
    if (!parentTask) return null;

    const subtask = this.createTask({
      ...subtaskInput,
      parentTaskId,
      goalId: parentTask.goalId,
      priority: subtaskInput.priority || parentTask.priority,
    });

    parentTask.subtaskIds.push(subtask.id);
    await this.updateTask(parentTaskId, { subtaskIds: parentTask.subtaskIds });

    return subtask;
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    if (this.storage) {
      return this.storage.listTasks({
        filter: { parentTaskId } as Partial<Task>,
      });
    }
    return [];
  }

  calculateTaskProgressFromSubtasks(task: Task, subtasks: Task[]): number {
    if (subtasks.length === 0) return task.progress;

    const totalProgress = subtasks.reduce((sum, s) => sum + s.progress, 0);
    return Math.round(totalProgress / subtasks.length);
  }

  findDuplicateTasks(tasks: Task[], threshold: number = 0.7): Task[][] {
    const duplicates: Task[][] = [];
    const visited = new Set<string>();

    for (let i = 0; i < tasks.length; i++) {
      if (visited.has(tasks[i].id)) continue;

      const group: Task[] = [tasks[i]];
      visited.add(tasks[i].id);

      for (let j = i + 1; j < tasks.length; j++) {
        if (visited.has(tasks[j].id)) continue;

        const isTitleSimilar = isSimilar(tasks[i].title, tasks[j].title, threshold);
        const isSameGoal = tasks[i].goalId === tasks[j].goalId;
        const dueDate1 = tasks[i].dueDate;
        const dueDate2 = tasks[j].dueDate;
        const isSameDueDate = dueDate1 && dueDate2
          ? Math.abs(dueDate1.getTime() - dueDate2.getTime()) < 86400000
          : !dueDate1 && !dueDate2;

        if (isTitleSimilar && isSameGoal && isSameDueDate) {
          group.push(tasks[j]);
          visited.add(tasks[j].id);
        }
      }

      if (group.length > 1) {
        duplicates.push(group);
      }
    }

    return duplicates;
  }

  mergeDuplicateTasks(
    tasks: Task[],
    strategy: 'keep-latest' | 'keep-oldest' | 'keep-most-progress' = 'keep-most-progress'
  ): Task[] {
    const duplicateGroups = this.findDuplicateTasks(tasks);
    const mergedTasks = [...tasks];

    for (const group of duplicateGroups) {
      let keepTask: Task;

      switch (strategy) {
        case 'keep-latest':
          keepTask = group.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
          break;
        case 'keep-oldest':
          keepTask = group.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
          break;
        case 'keep-most-progress':
        default:
          keepTask = group.reduce((a, b) => (a.progress > b.progress ? a : b));
          break;
      }

      const others = group.filter(t => t.id !== keepTask.id);

      keepTask.blockers = [...keepTask.blockers, ...others.flatMap(t => t.blockers)];
      keepTask.evidences = [...keepTask.evidences, ...others.flatMap(t => t.evidences)];
      keepTask.tags = [...new Set([...keepTask.tags, ...others.flatMap(t => t.tags)])];
      keepTask.subtaskIds = [...new Set([...keepTask.subtaskIds, ...others.flatMap(t => t.subtaskIds)])];
      keepTask.updatedAt = new Date();

      if (this.storage) {
        this.storage.saveTask(keepTask);
        others.forEach(t => this.storage!.deleteTask(t.id));
      }

      for (const other of others) {
        const idx = mergedTasks.findIndex(t => t.id === other.id);
        if (idx !== -1) mergedTasks.splice(idx, 1);
      }

      const keepIdx = mergedTasks.findIndex(t => t.id === keepTask.id);
      if (keepIdx !== -1) mergedTasks[keepIdx] = keepTask;
    }

    return mergedTasks;
  }

  updateTaskOrder(taskId: string, newOrder: number): Promise<Task | null> | Task | null {
    return this.updateTask(taskId, { order: newOrder });
  }
}

export { TaskManager };
export default TaskManager;
