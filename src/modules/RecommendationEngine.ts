import { Goal, Task, NextAction, Priority, RiskAssessment } from '../types';
import { getPriorityOrder, getDaysBetween } from '../utils';
import { I18n } from '../i18n';
import { ProgressCalculator } from './ProgressCalculator';

class RecommendationEngine {
  private i18n: I18n;
  private progressCalculator: ProgressCalculator;

  constructor(i18n: I18n, progressCalculator: ProgressCalculator) {
    this.i18n = i18n;
    this.progressCalculator = progressCalculator;
  }

  getNextActions(
    goals: Goal[],
    tasks: Task[],
    limit: number = 5
  ): NextAction[] {
    const actions: NextAction[] = [];

    const blockedTasks = tasks.filter(t => t.blockers.some(b => !b.resolvedAt));
    blockedTasks.forEach(task => {
      const unresolvedBlockers = task.blockers.filter(b => !b.resolvedAt);
      unresolvedBlockers.forEach(blocker => {
        actions.push({
          taskId: task.id,
          description: `解决阻塞: ${blocker.description}`,
          priority: 'urgent',
          reason: `任务「${task.title}」被阻塞，影响进度`,
        });
      });
    });

    const highRiskGoals = goals
      .map(goal => ({
        goal,
        risk: this.progressCalculator.assessGoalRisk(
          goal,
          tasks.filter(t => t.goalId === goal.id)
        ),
      }))
      .filter(({ risk }) => risk.level === 'high' || risk.level === 'critical')
      .sort((a, b) => b.risk.score - a.risk.score);

    highRiskGoals.slice(0, 2).forEach(({ goal, risk }) => {
      actions.push({
        goalId: goal.id,
        description: `重点关注: ${goal.title}`,
        priority: 'urgent',
        reason: risk.factors[0] || '目标存在高延期风险',
        estimatedMinutes: 60,
      });
    });

    const urgentTasks = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .filter(t => t.priority === 'urgent' || t.priority === 'high')
      .filter(t => !t.blockers.some(b => !b.resolvedAt))
      .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority));

    urgentTasks.slice(0, 3).forEach(task => {
      const risk = this.progressCalculator.assessTaskRisk(task);
      actions.push({
        taskId: task.id,
        goalId: task.goalId,
        description: task.title,
        priority: task.priority,
        reason: risk.level !== 'none'
          ? this.i18n.riskLevel(risk.level)
          : `优先级: ${this.i18n.priority(task.priority)}`,
        estimatedMinutes: task.estimatedMinutes || 30,
      });
    });

    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    if (inProgressTasks.length > 0 && actions.length < limit) {
      inProgressTasks.slice(0, 2).forEach(task => {
        if (!actions.find(a => a.taskId === task.id)) {
          actions.push({
            taskId: task.id,
            goalId: task.goalId,
            description: `继续: ${task.title}`,
            priority: task.priority,
            reason: `已完成 ${task.progress}%，继续推进`,
            estimatedMinutes: task.estimatedMinutes
              ? Math.round(task.estimatedMinutes * (1 - task.progress / 100))
              : 30,
          });
        }
      });
    }

    const tasksDueSoon = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .filter(t => {
        if (!t.dueDate) return false;
        const daysRemaining = getDaysBetween(new Date(), t.dueDate);
        return daysRemaining >= 0 && daysRemaining <= 3;
      })
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));

    tasksDueSoon.slice(0, 2).forEach(task => {
      if (!actions.find(a => a.taskId === task.id)) {
        const daysRemaining = getDaysBetween(new Date(), task.dueDate!);
        actions.push({
          taskId: task.id,
          goalId: task.goalId,
          description: task.title,
          priority: daysRemaining <= 1 ? 'urgent' : 'high',
          reason: `还有 ${daysRemaining} 天到期`,
          estimatedMinutes: task.estimatedMinutes || 30,
        });
      }
    });

    const pendingGoals = goals.filter(
      g => g.status === 'not_started' && g.startDate <= new Date()
    );
    if (pendingGoals.length > 0 && actions.length < limit) {
      pendingGoals.slice(0, 1).forEach(goal => {
        actions.push({
          goalId: goal.id,
          description: `启动目标: ${goal.title}`,
          priority: goal.priority,
          reason: '目标已到开始日期但尚未启动',
          estimatedMinutes: 30,
        });
      });
    }

    if (actions.length === 0) {
      actions.push({
        description: '规划下一个目标或任务',
        priority: 'medium',
        reason: '当前没有紧急事项，可以开始新的规划',
        estimatedMinutes: 15,
      });
    }

    return actions
      .sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority))
      .slice(0, limit);
  }

  getTaskRecommendations(task: Task, allTasks: Task[]): {
    shouldSplit: boolean;
    shouldPrioritize: boolean;
    shouldAddEvidence: boolean;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    const shouldSplit =
      (task.estimatedMinutes || 0) > 120 &&
      task.subtaskIds.length === 0 &&
      task.status !== 'completed';

    if (shouldSplit) {
      suggestions.push(this.i18n.t('suggestions.splitLargeTask'));
    }

    const shouldPrioritize =
      task.dueDate !== undefined &&
      getDaysBetween(new Date(), task.dueDate) < 7 &&
      task.progress < 50 &&
      task.priority !== 'urgent' &&
      task.priority !== 'high';

    if (shouldPrioritize) {
      suggestions.push('建议提高此任务的优先级');
    }

    const shouldAddEvidence =
      task.progress > 0 &&
      task.evidences.length === 0 &&
      task.status === 'in_progress';

    if (shouldAddEvidence) {
      suggestions.push(this.i18n.t('suggestions.addEvidence'));
    }

    if (task.blockers.some(b => !b.resolvedAt)) {
      suggestions.push(this.i18n.t('suggestions.resolveBlocker'));
    }

    return {
      shouldSplit,
      shouldPrioritize,
      shouldAddEvidence,
      suggestions,
    };
  }

  getGoalRecommendations(goal: Goal, tasks: Task[]): {
    shouldAddMilestones: boolean;
    shouldReview: boolean;
    shouldAddTasks: boolean;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    const now = new Date();

    const shouldAddMilestones =
      goal.milestones.length === 0 &&
      getDaysBetween(goal.startDate, goal.targetDate) > 14 &&
      goal.status !== 'completed';

    if (shouldAddMilestones) {
      suggestions.push(this.i18n.t('suggestions.setMilestone'));
    }

    const daysSinceCreation = getDaysBetween(goal.createdAt, now);
    const hasRecentReview = goal.reviews.some(
      r => getDaysBetween(r.createdAt, now) <= 7
    );
    const shouldReview =
      daysSinceCreation > 7 &&
      !hasRecentReview &&
      goal.status !== 'completed';

    if (shouldReview) {
      suggestions.push(this.i18n.t('suggestions.reviewProgress'));
    }

    const goalTasks = tasks.filter(t => t.goalId === goal.id);
    const shouldAddTasks =
      goalTasks.length === 0 &&
      goal.progress < 100 &&
      goal.status === 'in_progress';

    if (shouldAddTasks) {
      suggestions.push('建议将目标拆分为具体的执行任务');
    }

    const risk = this.progressCalculator.assessGoalRisk(goal, goalTasks);
    if (risk.level !== 'none' && risk.level !== 'low') {
      suggestions.push(...risk.suggestions);
    }

    return {
      shouldAddMilestones,
      shouldReview,
      shouldAddTasks,
      suggestions,
    };
  }

  getPriorityAdjustmentSuggestion(
    task: Task,
    allTasks: Task[],
    risk: RiskAssessment
  ): Priority | null {
    if (risk.level === 'critical' || risk.level === 'high') {
      if (task.priority !== 'urgent') {
        return 'urgent';
      }
    }

    if (risk.level === 'medium') {
      if (task.priority === 'low' || task.priority === 'medium') {
        return 'high';
      }
    }

    if (task.dueDate) {
      const daysRemaining = getDaysBetween(new Date(), task.dueDate);
      if (daysRemaining <= 1 && task.progress < 80 && task.priority !== 'urgent') {
        return 'urgent';
      }
      if (daysRemaining <= 3 && task.progress < 50 && task.priority === 'low') {
        return 'medium';
      }
    }

    const highPriorityCount = allTasks.filter(
      t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed'
    ).length;

    if (highPriorityCount > 5 && task.priority === 'high' && risk.level === 'low') {
      return 'medium';
    }

    return null;
  }

  getWorkloadBalanceSuggestions(
    tasks: Task[],
    dailyCapacityHours: number = 8
  ): {
    overloaded: boolean;
    suggestions: string[];
    recommendedTaskIds: string[];
  } {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingTasks = tasks.filter(
      t =>
        t.status !== 'completed' &&
        t.status !== 'cancelled' &&
        (!t.dueDate || t.dueDate <= weekEnd)
    );

    const totalEstimatedHours = upcomingTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 30) / 60,
      0
    );

    const availableHours = dailyCapacityHours * 7;
    const overloaded = totalEstimatedHours > availableHours * 1.2;

    const suggestions: string[] = [];
    const recommendedTaskIds: string[] = [];

    if (overloaded) {
      suggestions.push(
        `本周预估工作量 ${Math.round(totalEstimatedHours)} 小时，超过可用时间 ${Math.round(availableHours)} 小时`
      );

      const lowPriorityTasks = upcomingTasks
        .filter(t => t.priority === 'low')
        .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));

      if (lowPriorityTasks.length > 0) {
        suggestions.push('建议延期或委托低优先级任务');
        recommendedTaskIds.push(...lowPriorityTasks.slice(0, 3).map(t => t.id));
      }

      const largeTasks = upcomingTasks.filter(t => (t.estimatedMinutes || 0) > 120);
      if (largeTasks.length > 0) {
        suggestions.push('建议将大任务拆分为更小的子任务');
      }
    } else if (totalEstimatedHours < availableHours * 0.5) {
      suggestions.push('本周工作量较轻，可以考虑承接更多任务');
    }

    return {
      overloaded,
      suggestions,
      recommendedTaskIds,
    };
  }

  getMotivationalMessage(
    completedTasks: number,
    totalTasks: number,
    productivityScore: number
  ): string {
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    if (productivityScore >= 90) {
      return '太棒了！你本周的表现非常出色，继续保持！🎉';
    }
    if (productivityScore >= 70) {
      return '做得很好！你的效率很高，再努力一点就能达到优秀！💪';
    }
    if (productivityScore >= 50) {
      return '进展不错！保持这个节奏，你正在向目标前进 👍';
    }
    if (completionRate >= 0.8) {
      return '完成率很高！即使分数不高，你也在持续取得进展 ✨';
    }
    if (completedTasks >= 5) {
      return '你已经完成了不少任务，每一步都在进步 📈';
    }
    return '新的一周，新的开始！从一个小任务开始吧 🌱';
  }
}

export { RecommendationEngine };
export default RecommendationEngine;
