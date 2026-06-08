import { Goal, Task, Milestone, RiskAssessment, RiskLevel } from '../types';
import { getDaysBetween, calculateExpectedProgress, clamp } from '../utils';
import { I18n } from '../i18n';

class ProgressCalculator {
  private i18n: I18n;

  constructor(i18n: I18n) {
    this.i18n = i18n;
  }

  calculateGoalProgress(
    goal: Goal,
    tasks: Task[] = [],
    useMilestones: boolean = true
  ): number {
    if (goal.status === 'completed') {
      return 100;
    }

    if (tasks.length > 0) {
      const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
      return Math.round(totalProgress / tasks.length);
    }

    if (useMilestones && goal.milestones.length > 0) {
      const totalProgress = goal.milestones.reduce((sum, m) => sum + m.progress, 0);
      return Math.round(totalProgress / goal.milestones.length);
    }

    return goal.progress;
  }

  calculateOverallProgress(goals: Goal[], tasks: Task[]): number {
    const items = [
      ...goals.map(g => ({ progress: g.progress, weight: 3 })),
      ...tasks.map(t => ({ progress: t.progress, weight: 1 })),
    ];

    if (items.length === 0) return 0;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const weightedProgress = items.reduce(
      (sum, item) => sum + item.progress * item.weight,
      0
    );

    return Math.round(weightedProgress / totalWeight);
  }

  assessGoalRisk(goal: Goal, tasks: Task[] = [], now: Date = new Date()): RiskAssessment {
    const factors: string[] = [];
    const suggestions: string[] = [];
    let riskScore = 0;

    if (goal.status === 'completed' || goal.status === 'cancelled') {
      return {
        level: 'none',
        score: 0,
        factors: ['目标已完成或已取消'],
        suggestions: [],
      };
    }

    const actualProgress = this.calculateGoalProgress(goal, tasks);
    const expectedProgress = calculateExpectedProgress(goal.startDate, goal.targetDate, now);
    const progressGap = expectedProgress - actualProgress;

    if (progressGap > 0) {
      if (progressGap >= 50) {
        riskScore += 40;
        factors.push(`进度严重落后，预期 ${expectedProgress}%，实际 ${actualProgress}%`);
        suggestions.push(this.i18n.t('suggestions.resolveBlocker'));
      } else if (progressGap >= 30) {
        riskScore += 25;
        factors.push(`进度落后，预期 ${expectedProgress}%，实际 ${actualProgress}%`);
        suggestions.push(this.i18n.t('suggestions.splitLargeTask'));
      } else if (progressGap >= 10) {
        riskScore += 10;
        factors.push(`进度略落后，预期 ${expectedProgress}%，实际 ${actualProgress}%`);
        suggestions.push(this.i18n.t('suggestions.reviewProgress'));
      }
    }

    const daysRemaining = getDaysBetween(now, goal.targetDate);

    if (daysRemaining < 0) {
      riskScore += 50;
      factors.push(`已延期 ${Math.abs(daysRemaining)} 天`);
      suggestions.push('重新评估目标可行性，考虑延期或缩减范围');
    } else if (daysRemaining <= 3 && actualProgress < 80) {
      riskScore += 30;
      factors.push(`剩余 ${daysRemaining} 天，但仅完成 ${actualProgress}%`);
      suggestions.push('优先处理核心任务，必要时寻求帮助');
    } else if (daysRemaining <= 7 && actualProgress < 50) {
      riskScore += 20;
      factors.push(`剩余 ${daysRemaining} 天，完成度不足一半`);
      suggestions.push('加快进度，考虑增加投入时间');
    }

    const unresolvedBlockers = goal.blockers.filter(b => !b.resolvedAt).length;
    if (unresolvedBlockers > 0) {
      riskScore += unresolvedBlockers * 15;
      factors.push(`存在 ${unresolvedBlockers} 个未解决的阻塞问题`);
      suggestions.push(this.i18n.t('suggestions.resolveBlocker'));
    }

    const incompleteMilestones = goal.milestones.filter(
      m => m.status !== 'completed' && m.targetDate < now
    ).length;
    if (incompleteMilestones > 0) {
      riskScore += incompleteMilestones * 10;
      factors.push(`${incompleteMilestones} 个里程碑已逾期`);
      suggestions.push(this.i18n.t('suggestions.setMilestone'));
    }

    if (tasks.length > 0) {
      const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
      if (blockedTasks > 0) {
        riskScore += blockedTasks * 10;
        factors.push(`${blockedTasks} 个关联任务处于阻塞状态`);
      }

      const pendingTasks = tasks.filter(t => t.status === 'todo').length;
      if (pendingTasks > tasks.length * 0.7 && daysRemaining < 14) {
        riskScore += 15;
        factors.push('大部分任务尚未开始，但时间紧迫');
      }
    }

    if (goal.reviews.length === 0 && getDaysBetween(goal.startDate, now) > 7) {
      riskScore += 10;
      factors.push('目标启动超过一周但未进行复盘');
      suggestions.push(this.i18n.t('suggestions.reviewProgress'));
    }

    if (goal.evidences.length === 0 && actualProgress > 0) {
      riskScore += 5;
      factors.push('已有进度但未记录完成证据');
      suggestions.push(this.i18n.t('suggestions.addEvidence'));
    }

    const level: RiskLevel = this.getRiskLevel(riskScore);

    return {
      level,
      score: clamp(riskScore, 0, 100),
      factors,
      suggestions,
    };
  }

  assessTaskRisk(task: Task, now: Date = new Date()): RiskAssessment {
    const factors: string[] = [];
    const suggestions: string[] = [];
    let riskScore = 0;

    if (task.status === 'completed' || task.status === 'cancelled') {
      return {
        level: 'none',
        score: 0,
        factors: ['任务已完成或已取消'],
        suggestions: [],
      };
    }

    if (task.dueDate) {
      const daysRemaining = getDaysBetween(now, task.dueDate);

      if (daysRemaining < 0) {
        riskScore += 40;
        factors.push(`已延期 ${Math.abs(daysRemaining)} 天`);
        suggestions.push('尽快完成或重新设置截止日期');
      } else if (daysRemaining <= 1 && task.progress < 80) {
        riskScore += 30;
        factors.push(`明天到期，但仅完成 ${task.progress}%`);
        suggestions.push('优先处理此任务');
      } else if (daysRemaining <= 3 && task.progress < 50) {
        riskScore += 20;
        factors.push(`剩余 ${daysRemaining} 天，完成度不足一半`);
      }
    }

    const unresolvedBlockers = task.blockers.filter(b => !b.resolvedAt).length;
    if (unresolvedBlockers > 0) {
      riskScore += unresolvedBlockers * 15;
      factors.push(`存在 ${unresolvedBlockers} 个未解决的阻塞问题`);
      suggestions.push(this.i18n.t('suggestions.resolveBlocker'));
    }

    if (task.status === 'blocked') {
      riskScore += 20;
      factors.push('任务处于阻塞状态');
    }

    if (task.estimatedMinutes && task.progress < 100) {
      const elapsedMinutes = task.actualMinutes || 0;
      const expectedElapsed = (task.progress / 100) * task.estimatedMinutes;
      if (elapsedMinutes > expectedElapsed * 1.5) {
        riskScore += 15;
        factors.push('实际耗时远超预期');
        suggestions.push('重新评估任务复杂度');
      }
    }

    const level: RiskLevel = this.getRiskLevel(riskScore);

    return {
      level,
      score: clamp(riskScore, 0, 100),
      factors,
      suggestions,
    };
  }

  private getRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    if (score >= 10) return 'low';
    return 'none';
  }

  calculateBurnDown(
    tasks: Task[],
    startDate: Date,
    endDate: Date
  ): Array<{ date: Date; planned: number; actual: number }> {
    const totalDays = getDaysBetween(startDate, endDate);
    const totalTasks = tasks.length;
    if (totalTasks === 0 || totalDays <= 0) return [];

    const dataPoints: Array<{ date: Date; planned: number; actual: number }> = [];
    const tasksPerDay = totalTasks / totalDays;

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const planned = Math.max(0, totalTasks - tasksPerDay * i);
      const completedBeforeDate = tasks.filter(
        t => t.completedAt && t.completedAt <= date
      ).length;
      const actual = totalTasks - completedBeforeDate;

      dataPoints.push({ date, planned, actual });
    }

    return dataPoints;
  }

  calculateVelocity(tasks: Task[], periodDays: number = 7): number {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const completedTasks = tasks.filter(
      t => t.completedAt && t.completedAt >= periodStart && t.completedAt <= now
    );

    const totalEstimatedMinutes = completedTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 30),
      0
    );

    return Math.round(totalEstimatedMinutes / 60);
  }

  predictCompletionDate(goal: Goal, tasks: Task[], velocity: number): Date | null {
    const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const remainingMinutes = incompleteTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 30) * (1 - t.progress / 100),
      0
    );

    if (velocity <= 0 || remainingMinutes <= 0) {
      return goal.targetDate;
    }

    const daysNeeded = Math.ceil(remainingMinutes / 60 / velocity);
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysNeeded);

    return predictedDate;
  }
}

export { ProgressCalculator };
export default ProgressCalculator;
