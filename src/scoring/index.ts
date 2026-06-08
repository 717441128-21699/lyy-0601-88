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

function mergeScoringRule(base: ScoringRule, partial?: Partial<ScoringRule>): ScoringRule {
  if (!partial) return { ...base };

  const merged: ScoringRule = {
    ...base,
    ...partial,
    priorityWeights: {
      ...base.priorityWeights,
      ...(partial.priorityWeights || {}),
    },
  };

  const numericFields = [
    'onTimeBonus', 'earlyBonus', 'latePenalty', 'blockerPenalty',
    'milestoneBonus', 'evidenceBonus', 'reviewBonus'
  ] as const;

  for (const field of numericFields) {
    const val = merged[field];
    if (typeof val !== 'number' || isNaN(val)) {
      (merged as any)[field] = base[field] as number;
    }
  }

  const priorities: Priority[] = ['urgent', 'high', 'medium', 'low'];
  for (const p of priorities) {
    const val = merged.priorityWeights[p];
    if (typeof val !== 'number' || isNaN(val) || val < 0) {
      merged.priorityWeights[p] = base.priorityWeights[p];
    }
  }

  return merged;
}

function safeNumber(value: number | undefined | null, fallback: number = 0): number {
  if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
    return fallback;
  }
  return value;
}

class ScoringEngine {
  private rule: ScoringRule;

  constructor(customRule?: Partial<ScoringRule>) {
    this.rule = mergeScoringRule(defaultScoringRule, customRule);
  }

  setRule(customRule: Partial<ScoringRule>): void {
    this.rule = mergeScoringRule(this.rule, customRule);
  }

  getRule(): ScoringRule {
    return { ...this.rule };
  }

  calculateGoalScore(goal: Goal): number {
    let score = 0;
    const now = new Date();

    const priorityWeight = safeNumber(this.rule.priorityWeights[goal.priority], 0);
    const progress = safeNumber(goal.progress, 0);
    score += priorityWeight * (progress / 100);

    if (goal.completedAt) {
      const completedBeforeTarget = goal.completedAt <= goal.targetDate;
      const completedBeforeStart = goal.completedAt <= goal.startDate;

      if (completedBeforeStart) {
        score += safeNumber(this.rule.earlyBonus, 0);
      } else if (completedBeforeTarget) {
        score += safeNumber(this.rule.onTimeBonus, 0);
      } else {
        score += safeNumber(this.rule.latePenalty, 0);
      }
    } else if (goal.targetDate < now && goal.status !== 'completed') {
      score += safeNumber(this.rule.latePenalty, 0);
    }

    const unresolvedBlockers = goal.blockers.filter(b => !b.resolvedAt).length;
    score += unresolvedBlockers * safeNumber(this.rule.blockerPenalty, 0);

    const completedMilestones = goal.milestones.filter(m => m.status === 'completed').length;
    score += completedMilestones * safeNumber(this.rule.milestoneBonus, 0);

    score += goal.evidences.length * safeNumber(this.rule.evidenceBonus, 0);
    score += goal.reviews.length * safeNumber(this.rule.reviewBonus, 0);

    const result = Math.round(safeNumber(score, 0));
    return isNaN(result) ? 0 : result;
  }

  calculateTaskScore(task: Task): number {
    let score = 0;
    const now = new Date();

    const priorityWeight = safeNumber(this.rule.priorityWeights[task.priority], 0);
    const progressMultiplier = task.status === 'completed' ? 1 : safeNumber(task.progress, 0) / 100;
    score += priorityWeight * progressMultiplier;

    if (task.completedAt && task.dueDate) {
      const completedBeforeDue = task.completedAt <= task.dueDate;
      if (completedBeforeDue) {
        score += safeNumber(this.rule.onTimeBonus, 0);
      } else {
        score += safeNumber(this.rule.latePenalty, 0);
      }
    } else if (task.dueDate && task.dueDate < now && task.status !== 'completed') {
      score += safeNumber(this.rule.latePenalty, 0);
    }

    const unresolvedBlockers = task.blockers.filter(b => !b.resolvedAt).length;
    score += unresolvedBlockers * safeNumber(this.rule.blockerPenalty, 0);

    score += task.evidences.length * safeNumber(this.rule.evidenceBonus, 0);

    const result = Math.round(safeNumber(score, 0));
    return isNaN(result) ? 0 : result;
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
      totalScore += safeNumber(this.calculateTaskScore(task), 0);
    });

    completedGoals.forEach(goal => {
      totalScore += safeNumber(this.calculateGoalScore(goal), 0);
    });

    const maxPossibleScore = (tasks.length + goals.length) *
      (safeNumber(this.rule.priorityWeights.urgent, 0) + safeNumber(this.rule.onTimeBonus, 0));

    if (maxPossibleScore === 0 || isNaN(maxPossibleScore)) {
      return 0;
    }

    const result = Math.round((safeNumber(totalScore, 0) / maxPossibleScore) * 100);
    return Math.min(100, Math.max(0, isNaN(result) ? 0 : result));
  }
}

export { ScoringEngine, defaultScoringRule };
export default ScoringEngine;
