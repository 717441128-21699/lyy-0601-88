import {
  ExportData,
  ImportOptions,
  ImportResult,
  Goal,
  Task,
  Reminder,
  ReviewRecord,
  StorageAdapter,
  SDKError,
} from '../types';
import { generateId } from '../utils';

const CURRENT_VERSION = '1.0.0';

class ImportExportManager {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async exportData(options?: { pretty?: boolean; exportedBy?: string }): Promise<string> {
    const [goals, tasks, reminders, allReviews] = await Promise.all([
      this.storage.listGoals(),
      this.storage.listTasks(),
      this.storage.listReminders(),
      this.getAllReviews(),
    ]);

    const exportData: ExportData = {
      version: CURRENT_VERSION,
      exportedAt: new Date(),
      exportedBy: options?.exportedBy,
      goals,
      tasks,
      reminders,
      reviews: allReviews,
    };

    return JSON.stringify(exportData, null, options?.pretty ? 2 : 0);
  }

  private async getAllReviews(): Promise<ReviewRecord[]> {
    const goals = await this.storage.listGoals();
    const reviews: ReviewRecord[] = [];
    for (const goal of goals) {
      const goalReviews = await this.storage.listReviews(goal.id);
      reviews.push(...goalReviews);
    }
    return reviews;
  }

  private parseExportData(jsonString: string): ExportData {
    const parsed = JSON.parse(jsonString);

    const parseDate = (date: any): Date => (date ? new Date(date) : new Date());

    const parseGoal = (g: any): Goal => ({
      ...g,
      startDate: parseDate(g.startDate),
      targetDate: parseDate(g.targetDate),
      completedAt: g.completedAt ? parseDate(g.completedAt) : undefined,
      milestones: (g.milestones || []).map((m: any) => ({
        ...m,
        targetDate: parseDate(m.targetDate),
        completedAt: m.completedAt ? parseDate(m.completedAt) : undefined,
        createdAt: parseDate(m.createdAt),
        updatedAt: parseDate(m.updatedAt),
      })),
      blockers: (g.blockers || []).map((b: any) => ({
        ...b,
        createdAt: parseDate(b.createdAt),
        resolvedAt: b.resolvedAt ? parseDate(b.resolvedAt) : undefined,
      })),
      reviews: (g.reviews || []).map((r: any) => ({
        ...r,
        date: parseDate(r.date),
        createdAt: parseDate(r.createdAt),
      })),
      evidences: (g.evidences || []).map((e: any) => ({
        ...e,
        createdAt: parseDate(e.createdAt),
      })),
      createdAt: parseDate(g.createdAt),
      updatedAt: parseDate(g.updatedAt),
    });

    const parseTask = (t: any): Task => ({
      ...t,
      dueDate: t.dueDate ? parseDate(t.dueDate) : undefined,
      startDate: t.startDate ? parseDate(t.startDate) : undefined,
      completedAt: t.completedAt ? parseDate(t.completedAt) : undefined,
      blockers: (t.blockers || []).map((b: any) => ({
        ...b,
        createdAt: parseDate(b.createdAt),
        resolvedAt: b.resolvedAt ? parseDate(b.resolvedAt) : undefined,
      })),
      evidences: (t.evidences || []).map((e: any) => ({
        ...e,
        createdAt: parseDate(e.createdAt),
      })),
      createdAt: parseDate(t.createdAt),
      updatedAt: parseDate(t.updatedAt),
    });

    const parseReminder = (r: any): Reminder => ({
      ...r,
      scheduledAt: parseDate(r.scheduledAt),
      sentAt: r.sentAt ? parseDate(r.sentAt) : undefined,
    });

    const parseReview = (r: any): ReviewRecord => ({
      ...r,
      date: parseDate(r.date),
      createdAt: parseDate(r.createdAt),
    });

    return {
      version: parsed.version || '1.0.0',
      exportedAt: parseDate(parsed.exportedAt),
      exportedBy: parsed.exportedBy,
      goals: (parsed.goals || []).map(parseGoal),
      tasks: (parsed.tasks || []).map(parseTask),
      reminders: (parsed.reminders || []).map(parseReminder),
      reviews: (parsed.reviews || []).map(parseReview),
    };
  }

  private checkVersion(dataVersion: string, checkMode: 'strict' | 'compatible' | 'ignore'): SDKError | null {
    if (checkMode === 'ignore') return null;

    const [dataMajor, dataMinor] = dataVersion.split('.').map(Number);
    const [currMajor, currMinor] = CURRENT_VERSION.split('.').map(Number);

    if (checkMode === 'strict') {
      if (dataVersion !== CURRENT_VERSION) {
        return {
          code: 'VERSION_MISMATCH',
          message: `版本不匹配：数据版本 ${dataVersion}，当前版本 ${CURRENT_VERSION}`,
          details: { dataVersion, currentVersion: CURRENT_VERSION },
        };
      }
    } else if (checkMode === 'compatible') {
      if (dataMajor !== currMajor || dataMinor > currMinor) {
        return {
          code: 'VERSION_MISMATCH',
          message: `版本不兼容：数据版本 ${dataVersion}，当前版本 ${CURRENT_VERSION}`,
          details: { dataVersion, currentVersion: CURRENT_VERSION },
        };
      }
    }

    return null;
  }

  async importData(
    jsonString: string,
    options: ImportOptions = {
      duplicateStrategy: 'skip',
      versionCheck: 'compatible',
    }
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: { goals: 0, tasks: 0, reminders: 0, reviews: 0 },
      skipped: { goals: 0, tasks: 0, reminders: 0, reviews: 0 },
      errors: [],
      warnings: [],
    };

    try {
      const data = this.parseExportData(jsonString);

      const versionError = this.checkVersion(data.version, options.versionCheck);
      if (versionError) {
        result.errors.push(versionError);
        if (options.versionCheck === 'strict') {
          result.success = false;
          return result;
        }
        result.warnings.push(`版本警告：${versionError.message}`);
      }

      const total = data.goals.length + data.tasks.length + data.reminders.length + data.reviews.length;
      let current = 0;

      const existingGoalIds = new Set((await this.storage.listGoals()).map(g => g.id));
      const existingTaskIds = new Set((await this.storage.listTasks()).map(t => t.id));
      const existingReminderIds = new Set((await this.storage.listReminders()).map(r => r.id));

      for (const goal of data.goals) {
        current++;
        options.onProgress?.(current, total);

        const processed = await this.processItem(
          goal,
          existingGoalIds,
          options.duplicateStrategy,
          'goal'
        );

        if (processed.error) {
          result.errors.push(processed.error);
          result.skipped.goals++;
        } else if (processed.skipped) {
          result.skipped.goals++;
        } else if (processed.item) {
          await this.storage.saveGoal(processed.item as Goal);
          result.imported.goals++;
        }
      }

      for (const task of data.tasks) {
        current++;
        options.onProgress?.(current, total);

        const processed = await this.processItem(
          task,
          existingTaskIds,
          options.duplicateStrategy,
          'task'
        );

        if (processed.error) {
          result.errors.push(processed.error);
          result.skipped.tasks++;
        } else if (processed.skipped) {
          result.skipped.tasks++;
        } else if (processed.item) {
          await this.storage.saveTask(processed.item as Task);
          result.imported.tasks++;
        }
      }

      for (const reminder of data.reminders) {
        current++;
        options.onProgress?.(current, total);

        const processed = await this.processItem(
          reminder,
          existingReminderIds,
          options.duplicateStrategy,
          'reminder'
        );

        if (processed.error) {
          result.errors.push(processed.error);
          result.skipped.reminders++;
        } else if (processed.skipped) {
          result.skipped.reminders++;
        } else if (processed.item) {
          await this.storage.saveReminder(processed.item as Reminder);
          result.imported.reminders++;
        }
      }

      for (const review of data.reviews) {
        current++;
        options.onProgress?.(current, total);

        const existingReviews = await this.storage.listReviews(review.goalId);
        const existingIds = new Set(existingReviews.map(r => r.id));

        if (existingIds.has(review.id)) {
          if (options.duplicateStrategy === 'skip') {
            result.skipped.reviews++;
            continue;
          } else if (options.duplicateStrategy === 'error') {
            result.errors.push({
              code: 'DUPLICATE_ID',
              message: `重复的复盘 ID：${review.id}`,
              field: 'id',
              details: { id: review.id },
            });
            result.skipped.reviews++;
            continue;
          } else if (options.duplicateStrategy === 'rename') {
            review.id = generateId();
          }
        }

        await this.storage.saveReview(review);
        result.imported.reviews++;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        details: { error },
      });
      return result;
    }
  }

  private async processItem<T extends { id: string }>(
    item: T,
    existingIds: Set<string>,
    strategy: 'skip' | 'overwrite' | 'rename' | 'error',
    type: string
  ): Promise<{ item?: T; skipped?: boolean; error?: SDKError }> {
    if (existingIds.has(item.id)) {
      switch (strategy) {
        case 'skip':
          return { skipped: true };
        case 'error':
          return {
            error: {
              code: 'DUPLICATE_ID',
              message: `重复的 ${type} ID：${item.id}`,
              field: 'id',
              details: { id: item.id, type },
            },
            skipped: true,
          };
        case 'rename':
          item = { ...item, id: generateId() };
          existingIds.add(item.id);
          break;
        case 'overwrite':
          existingIds.add(item.id);
          break;
      }
    } else {
      existingIds.add(item.id);
    }
    return { item };
  }
}

export { ImportExportManager };
export default ImportExportManager;
