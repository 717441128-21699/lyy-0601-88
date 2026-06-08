import { SDKOptions, StorageAdapter } from './types';
import { I18n } from './i18n';
import { ScoringEngine } from './scoring';
import { MemoryStorage } from './storage/MemoryStorage';
import { GoalManager } from './modules/GoalManager';
import { TaskManager } from './modules/TaskManager';
import { ProgressCalculator } from './modules/ProgressCalculator';
import { ReminderGenerator } from './modules/ReminderGenerator';
import { ReviewManager } from './modules/ReviewManager';
import { StatsReporter } from './modules/StatsReporter';
import { RecommendationEngine } from './modules/RecommendationEngine';

export * from './types';
export { I18n } from './i18n';
export { ScoringEngine, defaultScoringRule } from './scoring';
export { MemoryStorage } from './storage/MemoryStorage';
export { GoalManager } from './modules/GoalManager';
export { TaskManager } from './modules/TaskManager';
export { ProgressCalculator } from './modules/ProgressCalculator';
export { ReminderGenerator } from './modules/ReminderGenerator';
export { ReviewManager } from './modules/ReviewManager';
export { StatsReporter } from './modules/StatsReporter';
export { RecommendationEngine } from './modules/RecommendationEngine';

class EfficiencyGoalSDK {
  public readonly i18n: I18n;
  public readonly scoring: ScoringEngine;
  public readonly storage: StorageAdapter;

  public readonly goals: GoalManager;
  public readonly tasks: TaskManager;
  public readonly progress: ProgressCalculator;
  public readonly reminders: ReminderGenerator;
  public readonly reviews: ReviewManager;
  public readonly stats: StatsReporter;
  public readonly recommendations: RecommendationEngine;

  constructor(options: SDKOptions = {}) {
    this.i18n = new I18n(options.language || 'zh-CN');
    this.scoring = new ScoringEngine(options.scoringRule);
    this.storage = options.storageAdapter || new MemoryStorage();

    this.goals = new GoalManager(this.storage);
    this.tasks = new TaskManager(this.storage);
    this.progress = new ProgressCalculator(this.i18n);
    this.reminders = new ReminderGenerator(this.i18n, this.storage);
    this.reviews = new ReviewManager(this.storage);
    this.stats = new StatsReporter(this.i18n, this.scoring);
    this.recommendations = new RecommendationEngine(this.i18n, this.progress);
  }

  setLanguage(lang: Parameters<I18n['setLanguage']>[0]): void {
    this.i18n.setLanguage(lang);
  }

  setScoringRule(rule: Parameters<ScoringEngine['setRule']>[0]): void {
    this.scoring.setRule(rule);
  }

  async getAllGoals() {
    return this.goals.listGoals();
  }

  async getAllTasks() {
    return this.tasks.listTasks();
  }

  async getDailyChecklist() {
    const [goals, tasks, reminders] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
      this.reminders.getPendingReminders(),
    ]);
    return this.reminders.getDailyChecklist(goals, tasks, reminders);
  }

  async getWeeklyReport(weekOffset: number = 0) {
    const [goals, tasks] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
    ]);
    return this.stats.generateWeeklyReport(goals, tasks, weekOffset);
  }

  async getTrendData(days: number = 30) {
    const [goals, tasks] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
    ]);
    return this.stats.getTrendData(goals, tasks, days);
  }

  async getSummaryStats() {
    const [goals, tasks] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
    ]);
    return this.stats.getSummaryStats(goals, tasks);
  }

  async getNextActions(limit: number = 5) {
    const [goals, tasks] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
    ]);
    return this.recommendations.getNextActions(goals, tasks, limit);
  }

  async generateAllReminders() {
    const [goals, tasks] = await Promise.all([
      this.getAllGoals(),
      this.getAllTasks(),
    ]);
    return this.reminders.generateAllReminders(goals, tasks);
  }

  async mergeDuplicateTasks() {
    const tasks = await this.getAllTasks();
    return this.tasks.mergeDuplicateTasks(tasks);
  }

  async assessGoalRisk(goalId: string) {
    const goal = await this.goals.getGoal(goalId);
    if (!goal) return null;

    const tasks = await this.tasks.listTasks({
      filter: { goalId } as any,
    });

    return this.progress.assessGoalRisk(goal, tasks);
  }

  async calculateGoalScore(goalId: string) {
    const goal = await this.goals.getGoal(goalId);
    if (!goal) return null;

    return this.scoring.calculateGoalScore(goal);
  }

  async calculateTaskScore(taskId: string) {
    const task = await this.tasks.getTask(taskId);
    if (!task) return null;

    return this.scoring.calculateTaskScore(task);
  }

  async createQuickReview(goalId: string, rating: number, summary?: string) {
    const goal = await this.goals.getGoal(goalId);
    if (!goal) return null;

    const tasks = await this.tasks.listTasks({
      filter: { goalId } as any,
    });

    return this.reviews.createQuickReview(goal, tasks, rating, summary);
  }

  async autoSplitMilestones(goalId: string, parts: number = 4) {
    return this.goals.autoSplitMilestones(goalId, parts);
  }

  async splitTask(taskId: string, options?: any) {
    return this.tasks.splitTask(taskId, options);
  }

  async addBlockerToTask(taskId: string, description: string) {
    return this.tasks.addBlocker(taskId, description);
  }

  async resolveTaskBlocker(taskId: string, blockerId: string, resolution: string) {
    return this.tasks.resolveBlocker(taskId, blockerId, resolution);
  }

  async addEvidenceToGoal(goalId: string, type: any, content: string, description?: string) {
    const goal = await this.goals.getGoal(goalId);
    if (!goal) return null;

    const updatedGoal = this.reviews.addEvidenceToGoal(goal, type, content, description);
    await this.goals.updateGoal(goalId, { evidences: updatedGoal.evidences });
    return updatedGoal.evidences[updatedGoal.evidences.length - 1];
  }

  async addEvidenceToTask(taskId: string, type: any, content: string, description?: string) {
    const task = await this.tasks.getTask(taskId);
    if (!task) return null;

    const updatedTask = this.reviews.addEvidenceToTask(task, type, content, description);
    await this.tasks.updateTask(taskId, { evidences: updatedTask.evidences });
    return updatedTask.evidences[updatedTask.evidences.length - 1];
  }

  async sortTasks(sortBy: 'priority' | 'dueDate' | 'createdAt' | 'order' = 'priority') {
    const tasks = await this.getAllTasks();
    return this.tasks.sortTasks(tasks, sortBy);
  }

  async findDuplicateTasks(threshold: number = 0.7) {
    const tasks = await this.getAllTasks();
    return this.tasks.findDuplicateTasks(tasks, threshold);
  }

  async getMotivationalMessage() {
    const stats = await this.getSummaryStats();
    return this.recommendations.getMotivationalMessage(
      stats.tasks.completed,
      stats.tasks.total,
      stats.productivity.score
    );
  }

  async getWorkloadBalance(dailyCapacityHours: number = 8) {
    const tasks = await this.getAllTasks();
    return this.recommendations.getWorkloadBalanceSuggestions(tasks, dailyCapacityHours);
  }
}

export { EfficiencyGoalSDK };
export default EfficiencyGoalSDK;
