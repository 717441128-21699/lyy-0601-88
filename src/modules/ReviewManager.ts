import {
  Goal,
  Task,
  ReviewRecord,
  CompletionEvidence,
  StorageAdapter,
} from '../types';
import { generateId } from '../utils';
import { Validator } from '../validation';

class ReviewManager {
  private storage?: StorageAdapter;
  private validator: Validator;

  constructor(storage?: StorageAdapter, validator?: Validator) {
    this.storage = storage;
    this.validator = validator || new Validator();
  }

  createReview(
    goalId: string,
    data: Omit<ReviewRecord, 'id' | 'goalId' | 'createdAt'>
  ): ReviewRecord {
    const review: ReviewRecord = {
      id: generateId(),
      goalId,
      ...data,
      createdAt: new Date(),
    };

    if (this.storage) {
      this.storage.saveReview(review);
    }

    return review;
  }

  createQuickReview(
    goal: Goal,
    tasks: Task[],
    rating: number,
    summary?: string
  ): ReviewRecord {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');

    const achievements = completedTasks.length > 0
      ? completedTasks.map(t => `完成任务: ${t.title}`)
      : [];

    const challenges = blockedTasks.length > 0
      ? blockedTasks.map(t => `任务阻塞: ${t.title} - ${t.blockers.filter(b => !b.resolvedAt).map(b => b.description).join(', ')}`)
      : [];

    if (goal.progress >= 100) {
      achievements.push(`目标达成: ${goal.title}`);
    }

    const lessons: string[] = [];
    if (goal.progress < 50 && blockedTasks.length > 0) {
      lessons.push('需要更早地识别和解决阻塞问题');
    }
    if (tasks.length > 10) {
      lessons.push('任务数量过多，建议优先处理核心任务');
    }

    const nextActions = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .slice(0, 3)
      .map(t => `继续推进: ${t.title}`);

    return this.createReview(goal.id, {
      date: new Date(),
      summary: summary || `目标「${goal.title}」进度: ${goal.progress}%`,
      achievements,
      challenges,
      lessons,
      nextActions,
      rating: Math.max(1, Math.min(5, rating)),
    });
  }

  async getReviews(goalId: string): Promise<ReviewRecord[]> {
    if (this.storage) {
      return this.storage.listReviews(goalId);
    }
    return [];
  }

  addEvidence(
    targetId: string,
    targetType: 'goal' | 'task',
    type: CompletionEvidence['type'],
    content: string,
    description?: string
  ): CompletionEvidence {
    const evidence: CompletionEvidence = {
      id: generateId(),
      type,
      content,
      description,
      createdAt: new Date(),
    };

    return evidence;
  }

  addEvidenceToGoal(
    goal: Goal,
    type: CompletionEvidence['type'],
    content: string,
    description?: string
  ): Goal {
    const evidence = this.addEvidence(goal.id, 'goal', type, content, description);
    goal.evidences.push(evidence);
    return goal;
  }

  addEvidenceToTask(
    task: Task,
    type: CompletionEvidence['type'],
    content: string,
    description?: string
  ): Task {
    const evidence = this.addEvidence(task.id, 'task', type, content, description);
    task.evidences.push(evidence);
    return task;
  }

  getEvidences(
    goal: Goal,
    filterType?: CompletionEvidence['type']
  ): CompletionEvidence[] {
    if (filterType) {
      return goal.evidences.filter(e => e.type === filterType);
    }
    return goal.evidences;
  }

  calculateAverageRating(reviews: ReviewRecord[]): number {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }

  generateReviewPrompts(
    goal: Goal,
    tasks: Task[],
    progressBefore: number,
    progressAfter: number
  ): { questions: string[]; suggestions: string[] } {
    const questions: string[] = [];
    const suggestions: string[] = [];

    const progressChange = progressAfter - progressBefore;

    if (progressChange >= 20) {
      questions.push('本周取得了哪些关键进展？是什么推动了这些进展？');
      suggestions.push('记录成功经验，复制到其他目标中');
    } else if (progressChange <= 0) {
      questions.push('本周进度停滞的主要原因是什么？');
      questions.push('有哪些外部或内部因素影响了进度？');
      suggestions.push('分析阻塞原因，制定下周突破计划');
    }

    const blockedCount = tasks.filter(t => t.blockers.some(b => !b.resolvedAt)).length;
    if (blockedCount > 0) {
      questions.push('遇到了哪些阻塞问题？计划如何解决？');
      suggestions.push('建立阻塞问题升级机制');
    }

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    if (completedCount > 0) {
      questions.push('完成的任务中，哪些最有价值？为什么？');
      suggestions.push('总结高效完成任务的方法论');
    }

    const pendingCount = tasks.filter(t => t.status === 'todo').length;
    if (pendingCount > tasks.length * 0.5) {
      questions.push('为什么还有大量任务未开始？是规划问题还是执行问题？');
      suggestions.push('重新评估任务优先级，考虑延期或删除非核心任务');
    }

    questions.push('本周最大的收获/学习是什么？');
    questions.push('下周最重要的3件事是什么？');

    suggestions.push('保持定期复盘的习惯，建议每周至少一次');

    return { questions, suggestions };
  }

  getReviewTrend(reviews: ReviewRecord[], periodDays: number = 30): Array<{ date: Date; rating: number; progress: number }> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    return reviews
      .filter(r => r.date >= periodStart)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(r => ({
        date: r.date,
        rating: r.rating,
        progress: parseInt(r.summary.match(/进度: (\d+)%/)?.[1] || '0'),
      }));
  }

  exportReviewToMarkdown(review: ReviewRecord, goalTitle: string): string {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let md = `# ${goalTitle} - 复盘记录\n\n`;
    md += `**日期**: ${formatDate(review.date)}\n`;
    md += `**评分**: ${'⭐'.repeat(review.rating)} (${review.rating}/5)\n\n`;
    md += `## 摘要\n${review.summary}\n\n`;

    if (review.achievements.length > 0) {
      md += `## 成就\n${review.achievements.map(a => `- ${a}`).join('\n')}\n\n`;
    }

    if (review.challenges.length > 0) {
      md += `## 挑战\n${review.challenges.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    if (review.lessons.length > 0) {
      md += `## 经验教训\n${review.lessons.map(l => `- ${l}`).join('\n')}\n\n`;
    }

    if (review.nextActions.length > 0) {
      md += `## 下一步行动\n${review.nextActions.map(n => `- [ ] ${n}`).join('\n')}\n\n`;
    }

    md += `---\n*记录于 ${formatDate(review.createdAt)}*\n`;

    return md;
  }
}

export { ReviewManager };
export default ReviewManager;
