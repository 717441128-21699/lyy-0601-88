import { Goal, Task, WeeklyReport, TrendData } from '../types';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  getDaysBetween,
  formatDate,
} from '../utils';
import { I18n } from '../i18n';
import { ScoringEngine } from '../scoring';

class StatsReporter {
  private i18n: I18n;
  private scoringEngine: ScoringEngine;

  constructor(i18n: I18n, scoringEngine: ScoringEngine) {
    this.i18n = i18n;
    this.scoringEngine = scoringEngine;
  }

  generateWeeklyReport(
    goals: Goal[],
    tasks: Task[],
    weekOffset: number = 0
  ): WeeklyReport {
    const now = new Date();
    const referenceDate = addDays(now, weekOffset * 7);
    const startDate = startOfWeek(referenceDate);
    const endDate = endOfWeek(referenceDate);

    const completedGoals = goals.filter(
      g => g.completedAt && g.completedAt >= startDate && g.completedAt <= endDate
    );

    const completedTasks = tasks.filter(
      t => t.completedAt && t.completedAt >= startDate && t.completedAt <= endDate
    );

    const inProgressGoals = goals.filter(
      g => g.status === 'in_progress' || (g.startDate <= endDate && g.targetDate >= startDate)
    );

    const totalTasksCompleted = completedTasks.length;
    const totalGoalsCompleted = completedGoals.length;

    const allProgressValues = [
      ...goals.map(g => g.progress),
      ...tasks.map(t => t.progress),
    ];
    const averageProgress = allProgressValues.length > 0
      ? Math.round(allProgressValues.reduce((a, b) => a + b, 0) / allProgressValues.length)
      : 0;

    const productivityScore = this.scoringEngine.calculateProductivityScore(tasks, goals, 7);

    const highlights = this.generateHighlights(completedGoals, completedTasks, inProgressGoals);
    const challenges = this.generateChallenges(goals, tasks);
    const nextWeekPlan = this.generateNextWeekPlan(goals, tasks, endDate);

    const fullText = this.generateWeeklyReportText(
      startDate,
      endDate,
      completedGoals,
      completedTasks,
      totalGoalsCompleted,
      totalTasksCompleted,
      averageProgress,
      productivityScore,
      highlights,
      challenges,
      nextWeekPlan
    );

    return {
      startDate,
      endDate,
      completedGoals,
      completedTasks,
      inProgressGoals,
      totalTasksCompleted,
      totalGoalsCompleted,
      averageProgress,
      productivityScore,
      highlights,
      challenges,
      nextWeekPlan,
      fullText,
    };
  }

  private generateHighlights(
    completedGoals: Goal[],
    completedTasks: Task[],
    inProgressGoals: Goal[]
  ): string[] {
    const highlights: string[] = [];

    if (completedGoals.length > 0) {
      highlights.push(`完成了 ${completedGoals.length} 个目标`);
      completedGoals.slice(0, 3).forEach(g => highlights.push(`- ${g.title}`));
    }

    if (completedTasks.length > 0) {
      highlights.push(`完成了 ${completedTasks.length} 个任务`);
      const topTasks = completedTasks
        .filter(t => t.priority === 'urgent' || t.priority === 'high')
        .slice(0, 3);
      topTasks.forEach(t => highlights.push(`- ${t.title}`));
    }

    const onTrackGoals = inProgressGoals.filter(g => g.progress >= 50);
    if (onTrackGoals.length > 0) {
      highlights.push(`${onTrackGoals.length} 个目标进展顺利`);
    }

    if (highlights.length === 0) {
      highlights.push('本周持续推进中');
    }

    return highlights;
  }

  private generateChallenges(goals: Goal[], tasks: Task[]): string[] {
    const challenges: string[] = [];

    const delayedGoals = goals.filter(g => {
      const now = new Date();
      return g.targetDate < now && g.status !== 'completed' && g.status !== 'cancelled';
    });

    if (delayedGoals.length > 0) {
      challenges.push(`${delayedGoals.length} 个目标已延期`);
    }

    const blockedTasks = tasks.filter(t => t.blockers.some(b => !b.resolvedAt));
    if (blockedTasks.length > 0) {
      challenges.push(`${blockedTasks.length} 个任务存在阻塞问题`);
    }

    const pendingTasks = tasks.filter(t => t.status === 'todo');
    if (pendingTasks.length > 10) {
      challenges.push(`待处理任务积压 ${pendingTasks.length} 个，需要减负`);
    }

    const noProgressGoals = goals.filter(g => g.progress === 0 && g.status !== 'not_started');
    if (noProgressGoals.length > 0) {
      challenges.push(`${noProgressGoals.length} 个目标尚未启动`);
    }

    return challenges;
  }

  private generateNextWeekPlan(goals: Goal[], tasks: Task[], endDate: Date): string[] {
    const nextWeekStart = addDays(endDate, 1);
    const nextWeekEnd = addDays(endDate, 7);

    const plan: string[] = [];

    const upcomingGoals = goals
      .filter(g => g.status !== 'completed' && g.status !== 'cancelled')
      .filter(g => g.targetDate >= nextWeekStart && g.targetDate <= nextWeekEnd)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3);

    upcomingGoals.forEach(g => {
      plan.push(`重点推进: ${g.title} (当前 ${g.progress}%)`);
    });

    const urgentTasks = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .filter(t => t.priority === 'urgent')
      .slice(0, 3);

    urgentTasks.forEach(t => {
      plan.push(`紧急处理: ${t.title}`);
    });

    const highPriorityTasks = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .filter(t => t.priority === 'high')
      .slice(0, 2);

    if (highPriorityTasks.length > 0 && plan.length < 5) {
      plan.push(`完成 ${highPriorityTasks.length} 个高优先级任务`);
    }

    if (plan.length === 0) {
      plan.push('根据实际情况安排下周工作');
    }

    return plan;
  }

  private generateWeeklyReportText(
    startDate: Date,
    endDate: Date,
    completedGoals: Goal[],
    completedTasks: Task[],
    totalGoalsCompleted: number,
    totalTasksCompleted: number,
    averageProgress: number,
    productivityScore: number,
    highlights: string[],
    challenges: string[],
    nextWeekPlan: string[]
  ): string {
    const formatDateStr = (d: Date) => formatDate(d, 'YYYY-MM-DD');

    let report = '';
    report += `# ${this.i18n.t('report.weeklyTitle', {
      start: formatDateStr(startDate),
      end: formatDateStr(endDate),
    })}\n\n`;

    report += `## 📊 ${this.i18n.t('report.productivityScore')}: ${productivityScore}/100\n\n`;

    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| ${this.i18n.t('report.completedGoals')} | ${totalGoalsCompleted} |\n`;
    report += `| ${this.i18n.t('report.completedTasks')} | ${totalTasksCompleted} |\n`;
    report += `| 平均进度 | ${averageProgress}% |\n\n`;

    report += `## 🌟 ${this.i18n.t('report.highlights')}\n`;
    highlights.forEach(h => {
      report += `- ${h}\n`;
    });
    report += '\n';

    if (challenges.length > 0) {
      report += `## ⚠️ ${this.i18n.t('report.challenges')}\n`;
      challenges.forEach(c => {
        report += `- ${c}\n`;
      });
      report += '\n';
    }

    report += `## 📅 ${this.i18n.t('report.nextWeek')}\n`;
    nextWeekPlan.forEach(p => {
      report += `- ${p}\n`;
    });
    report += '\n';

    if (completedGoals.length > 0) {
      report += '### 完成的目标\n';
      completedGoals.forEach(g => {
        report += `- ✅ ${g.title}\n`;
      });
      report += '\n';
    }

    if (completedTasks.length > 0) {
      report += '### 完成的任务\n';
      completedTasks.slice(0, 10).forEach(t => {
        report += `- ✅ ${t.title}\n`;
      });
      if (completedTasks.length > 10) {
        report += `- ...还有 ${completedTasks.length - 10} 个任务\n`;
      }
    }

    return report;
  }

  getTrendData(
    goals: Goal[],
    tasks: Task[],
    days: number = 30
  ): TrendData[] {
    const now = new Date();
    const trendData: TrendData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(now, -i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const completedTasks = tasks.filter(
        t => t.completedAt && t.completedAt >= dayStart && t.completedAt <= dayEnd
      ).length;

      const createdTasks = tasks.filter(
        t => t.createdAt >= dayStart && t.createdAt <= dayEnd
      ).length;

      const completedGoals = goals.filter(
        g => g.completedAt && g.completedAt >= dayStart && g.completedAt <= dayEnd
      ).length;

      const dayProgressValues = [
        ...goals.filter(g => g.createdAt <= dayEnd).map(g => g.progress),
        ...tasks.filter(t => t.createdAt <= dayEnd).map(t => t.progress),
      ];
      const averageProgress = dayProgressValues.length > 0
        ? Math.round(dayProgressValues.reduce((a, b) => a + b, 0) / dayProgressValues.length)
        : 0;

      const score = this.scoringEngine.calculateProductivityScore(
        tasks.filter(t => t.createdAt <= dayEnd),
        goals.filter(g => g.createdAt <= dayEnd),
        1
      );

      trendData.push({
        date: dayStart,
        completedTasks,
        createdTasks,
        completedGoals,
        averageProgress,
        productivityScore: score,
      });
    }

    return trendData;
  }

  getSummaryStats(goals: Goal[], tasks: Task[]) {
    const now = new Date();

    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    const inProgressGoals = goals.filter(g => g.status === 'in_progress').length;
    const delayedGoals = goals.filter(
      g => g.targetDate < now && g.status !== 'completed' && g.status !== 'cancelled'
    ).length;
    const atRiskGoals = goals.filter(
      g => g.progress < 50 && getDaysBetween(now, g.targetDate) < 7 && g.status !== 'completed'
    ).length;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    const pendingTasks = tasks.filter(t => t.status === 'todo').length;
    const delayedTasks = tasks.filter(
      t => t.dueDate && t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled'
    ).length;

    const averageGoalProgress = totalGoals > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / totalGoals)
      : 0;

    const averageTaskProgress = totalTasks > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / totalTasks)
      : 0;

    const productivityScore = this.scoringEngine.calculateProductivityScore(tasks, goals);

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) / 60;
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / 60;

    return {
      goals: {
        total: totalGoals,
        completed: completedGoals,
        inProgress: inProgressGoals,
        delayed: delayedGoals,
        atRisk: atRiskGoals,
        averageProgress: averageGoalProgress,
        completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        blocked: blockedTasks,
        pending: pendingTasks,
        delayed: delayedTasks,
        averageProgress: averageTaskProgress,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      time: {
        estimatedHours: Math.round(totalEstimatedHours * 10) / 10,
        actualHours: Math.round(totalActualHours * 10) / 10,
      },
      productivity: {
        score: productivityScore,
      },
    };
  }

  getCategoryStats(goals: Goal[], tasks: Task[]) {
    const categoryStats: Record<string, {
      goals: number;
      completedGoals: number;
      tasks: number;
      completedTasks: number;
      averageProgress: number;
    }> = {};

    goals.forEach(goal => {
      const category = goal.category || '未分类';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          goals: 0,
          completedGoals: 0,
          tasks: 0,
          completedTasks: 0,
          averageProgress: 0,
        };
      }
      categoryStats[category].goals++;
      if (goal.status === 'completed') {
        categoryStats[category].completedGoals++;
      }
      categoryStats[category].averageProgress += goal.progress;
    });

    tasks.forEach(task => {
      const category = task.tags[0] || '未分类';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          goals: 0,
          completedGoals: 0,
          tasks: 0,
          completedTasks: 0,
          averageProgress: 0,
        };
      }
      categoryStats[category].tasks++;
      if (task.status === 'completed') {
        categoryStats[category].completedTasks++;
      }
    });

    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category];
      if (stats.goals > 0) {
        stats.averageProgress = Math.round(stats.averageProgress / stats.goals);
      }
    });

    return categoryStats;
  }

  exportReportToJSON(report: WeeklyReport): string {
    return JSON.stringify(
      {
        ...report,
        startDate: report.startDate.toISOString(),
        endDate: report.endDate.toISOString(),
        completedGoals: report.completedGoals.map(g => ({
          id: g.id,
          title: g.title,
          progress: g.progress,
        })),
        completedTasks: report.completedTasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
        })),
      },
      null,
      2
    );
  }
}

export { StatsReporter };
export default StatsReporter;
