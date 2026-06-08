import { ScoringRule, Priority, Goal, Task, Blocker } from '../types';

const defaultScoringRule: ScoringRule = {
  id: 'default',
  name: 'Default Scoring',
  description: 'Default scoring rule for productivity',
  priorityWeights: {
    urgent: 40,
    high: 30,
    medium: 20,
    low: 10,
  },
  onTimeBonus: 10,
  earlyBonus: 15,
  latePenalty: -15,
  blockerPenalty: -10,
  milestoneBonus: 20,
  evidenceBonus: 5,
  reviewBonus: 10,
};

class ScoringEngine {
  private rule: ScoringRule;

  constructor(customRule?: Partial<ScoringRule>) {
    this.rule = { ...defaultScoringRule, ...customRule };
  }

  setRule(customRule: Partial<ScoringRule>): void {
    this.rule = { ...this.rule, ...customRule };
  }

  getRule(): ScoringRule {
    return { ...this.rule };
  }

  calculateGoalScore(goal: Goal): number {
    let score = 0;
    const now = new Date();

    score += this.rule.priorityWeights[goal.priority] * (goal.progress / 100);

    if (goal.completedAt) {
      const completedBeforeTarget = goal.completedAt <= goal.targetDate;
      const completedBeforeStart = goal.completedAt <= goal.startDate;

      if (completedBeforeStart) {
        score += this.rule.earlyBonus;
      } else if (completedBeforeTarget) {
        score += this.rule.onTimeBonus;
      } else {
        score += this.rule.latePenalty;
      }
    } else if (goal.targetDate < now && goal.status !== 'completed') {
      score += this.rule.latePenalty;
    }

    const unresolvedBlockers = goal.blockers.filter(b => !b.resolvedAt).length;
    score += unresolvedBlockers * this.rule.blockerPenalty;

    const completedMilestones = goal.milestones.filter(m => m.status === 'completed').length;
    score += completedMilestones * this.rule.milestoneBonus;

    score += goal.evidences.length * this.rule.evidenceBonus;
    score += goal.reviews.length * this.rule.reviewBonus;

    return Math.round(score);
  }

  calculateTaskScore(task: Task): number {
    let score = 0;
    const now = new Date();

    const progressMultiplier = task.status === 'completed' ? 1 : task.progress / 100;
    score += this.rule.priorityWeights[task.priority] * progressMultiplier;

    if (task.completedAt && task.dueDate) {
      const completedBeforeDue = task.completedAt <= task.dueDate;
      if (completedBeforeDue) {
        score += this.rule.onTimeBonus;
      } else {
        score += this.rule.latePenalty;
      }
    } else if (task.dueDate && task.dueDate < now && task.status !== 'completed') {
      score += this.rule.latePenalty;
    }

    const unresolvedBlockers = task.blockers.filter(b => !b.resolvedAt).length;
    score += unresolvedBlockers * this.rule.blockerPenalty;

    score += task.evidences.length * this.rule.evidenceBonus;

    return Math.round(score);
  }

  calculateProductivityScore(tasks: Task[], goals: Goal[], periodDays: number = 7): number {
    if (tasks.length === 0 && goals.length === 0) {
      return 0;
    }

    let totalScore = 0;
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const completedTasks = tasks.filter(t =>
      t.completedAt && t.completedAt >= periodStart
    );
    const completedGoals = goals.filter(g =>
      g.completedAt && g.completedAt >= periodStart
    );

    completedTasks.forEach(task => {
      totalScore += this.calculateTaskScore(task);
    });

    completedGoals.forEach(goal => {
      totalScore += this.calculateGoalScore(goal);
    });

    const maxPossibleScore = (tasks.length + goals.length) *
      (this.rule.priorityWeights.urgent + this.rule.onTimeBonus);

    if (maxPossibleScore === 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, Math.round((totalScore / maxPossibleScore) * 100)));
  }
}

export { ScoringEngine, defaultScoringRule };
export default ScoringEngine;
