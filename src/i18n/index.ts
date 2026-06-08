import { Language, Priority, RiskLevel } from '../types';

interface I18nMessages {
  priority: Record<Priority, string>;
  riskLevel: Record<RiskLevel, string>;
  goal: {
    created: string;
    completed: string;
    delayed: string;
    atRisk: string;
  };
  task: {
    created: string;
    completed: string;
    blocked: string;
    dueSoon: string;
  };
  reminder: {
    dueDate: string;
    startDate: string;
    progressCheck: string;
    milestone: string;
  };
  suggestions: {
    splitLargeTask: string;
    resolveBlocker: string;
    reviewProgress: string;
    setMilestone: string;
    addEvidence: string;
  };
  report: {
    weeklyTitle: string;
    highlights: string;
    challenges: string;
    nextWeek: string;
    productivityScore: string;
    completedTasks: string;
    completedGoals: string;
  };
  common: {
    today: string;
    thisWeek: string;
    nextWeek: string;
    overdue: string;
    onTrack: string;
  };
}

const zhCN: I18nMessages = {
  priority: {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  },
  riskLevel: {
    none: '无风险',
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '严重风险',
  },
  goal: {
    created: '目标已创建',
    completed: '目标已完成',
    delayed: '目标已延期',
    atRisk: '目标存在延期风险',
  },
  task: {
    created: '任务已创建',
    completed: '任务已完成',
    blocked: '任务被阻塞',
    dueSoon: '任务即将到期',
  },
  reminder: {
    dueDate: '目标「{title}」即将到期',
    startDate: '目标「{title}」即将开始',
    progressCheck: '请检查「{title}」的进度',
    milestone: '里程碑「{title}」即将到达',
  },
  suggestions: {
    splitLargeTask: '建议将此任务拆分为更小的子任务',
    resolveBlocker: '请优先解决阻塞问题',
    reviewProgress: '建议定期复盘进度',
    setMilestone: '建议设置里程碑来追踪进度',
    addEvidence: '建议添加完成证据以便复盘',
  },
  report: {
    weeklyTitle: '{start} 至 {end} 周报',
    highlights: '本周亮点',
    challenges: '遇到的挑战',
    nextWeek: '下周计划',
    productivityScore: '生产力评分',
    completedTasks: '完成任务数',
    completedGoals: '完成目标数',
  },
  common: {
    today: '今天',
    thisWeek: '本周',
    nextWeek: '下周',
    overdue: '已逾期',
    onTrack: '正常进行',
  },
};

const enUS: I18nMessages = {
  priority: {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  },
  riskLevel: {
    none: 'No Risk',
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  },
  goal: {
    created: 'Goal created',
    completed: 'Goal completed',
    delayed: 'Goal delayed',
    atRisk: 'Goal at risk of delay',
  },
  task: {
    created: 'Task created',
    completed: 'Task completed',
    blocked: 'Task is blocked',
    dueSoon: 'Task due soon',
  },
  reminder: {
    dueDate: 'Goal "{title}" is due soon',
    startDate: 'Goal "{title}" is about to start',
    progressCheck: 'Please check progress of "{title}"',
    milestone: 'Milestone "{title}" is approaching',
  },
  suggestions: {
    splitLargeTask: 'Consider splitting this task into smaller subtasks',
    resolveBlocker: 'Please resolve the blocker first',
    reviewProgress: 'Consider regular progress reviews',
    setMilestone: 'Consider setting milestones to track progress',
    addEvidence: 'Consider adding completion evidence for review',
  },
  report: {
    weeklyTitle: 'Weekly Report: {start} to {end}',
    highlights: 'Highlights',
    challenges: 'Challenges',
    nextWeek: 'Next Week Plan',
    productivityScore: 'Productivity Score',
    completedTasks: 'Tasks Completed',
    completedGoals: 'Goals Completed',
  },
  common: {
    today: 'Today',
    thisWeek: 'This Week',
    nextWeek: 'Next Week',
    overdue: 'Overdue',
    onTrack: 'On Track',
  },
};

const jaJP: I18nMessages = {
  priority: {
    urgent: '緊急',
    high: '高',
    medium: '中',
    low: '低',
  },
  riskLevel: {
    none: 'リスクなし',
    low: '低リスク',
    medium: '中リスク',
    high: '高リスク',
    critical: '重大なリスク',
  },
  goal: {
    created: '目標が作成されました',
    completed: '目標が完了しました',
    delayed: '目標が遅延しています',
    atRisk: '目標に遅延リスクがあります',
  },
  task: {
    created: 'タスクが作成されました',
    completed: 'タスクが完了しました',
    blocked: 'タスクがブロックされています',
    dueSoon: 'タスクの期限が近づいています',
  },
  reminder: {
    dueDate: '目標「{title}」の期限が近づいています',
    startDate: '目標「{title}」がまもなく開始されます',
    progressCheck: '「{title}」の進捗を確認してください',
    milestone: 'マイルストーン「{title}」が近づいています',
  },
  suggestions: {
    splitLargeTask: 'このタスクを小さなサブタスクに分割することを検討してください',
    resolveBlocker: '最初にブロッカーを解決してください',
    reviewProgress: '定期的な進捗レビューを検討してください',
    setMilestone: '進捗を追跡するためにマイルストーンを設定することを検討してください',
    addEvidence: 'レビューのために完了証拠を追加することを検討してください',
  },
  report: {
    weeklyTitle: '週報: {start} 〜 {end}',
    highlights: '今週のハイライト',
    challenges: '課題',
    nextWeek: '来週の計画',
    productivityScore: '生産性スコア',
    completedTasks: '完了タスク数',
    completedGoals: '完了目標数',
  },
  common: {
    today: '今日',
    thisWeek: '今週',
    nextWeek: '来週',
    overdue: '期限超過',
    onTrack: '順調',
  },
};

const koKR: I18nMessages = {
  priority: {
    urgent: '긴급',
    high: '높음',
    medium: '중간',
    low: '낮음',
  },
  riskLevel: {
    none: '위험 없음',
    low: '낮은 위험',
    medium: '중간 위험',
    high: '높은 위험',
    critical: '심각한 위험',
  },
  goal: {
    created: '목표가 생성되었습니다',
    completed: '목표가 완료되었습니다',
    delayed: '목표가 지연되었습니다',
    atRisk: '목표에 지연 위험이 있습니다',
  },
  task: {
    created: '태스크가 생성되었습니다',
    completed: '태스크가 완료되었습니다',
    blocked: '태스크가 차단되었습니다',
    dueSoon: '태스크 마감일이 임박했습니다',
  },
  reminder: {
    dueDate: '목표 「{title}」 마감일이 임박했습니다',
    startDate: '목표 「{title}」가 곧 시작됩니다',
    progressCheck: '「{title}」의 진행 상황을 확인해 주세요',
    milestone: '마일스톤 「{title}」이(가) 다가오고 있습니다',
  },
  suggestions: {
    splitLargeTask: '이 태스크를 더 작은 하위 태스크로 나누는 것을 고려하세요',
    resolveBlocker: '먼저 차단 요인을 해결하세요',
    reviewProgress: '정기적인 진행 상황 검토를 고려하세요',
    setMilestone: '진행 상황을 추적하기 위해 마일스톤을 설정하는 것을 고려하세요',
    addEvidence: '검토를 위해 완료 증거를 추가하는 것을 고려하세요',
  },
  report: {
    weeklyTitle: '주간 보고서: {start} ~ {end}',
    highlights: '이번 주 하이라이트',
    challenges: '과제',
    nextWeek: '다음 주 계획',
    productivityScore: '생산성 점수',
    completedTasks: '완료된 태스크 수',
    completedGoals: '완료된 목표 수',
  },
  common: {
    today: '오늘',
    thisWeek: '이번 주',
    nextWeek: '다음 주',
    overdue: '기한 초과',
    onTrack: '정상 진행 중',
  },
};

const messages: Record<Language, I18nMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
};

class I18n {
  private language: Language;
  private messages: I18nMessages;

  constructor(language: Language = 'zh-CN') {
    this.language = language;
    this.messages = messages[language];
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.messages = messages[language];
  }

  getLanguage(): Language {
    return this.language;
  }

  t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.');
    let value: unknown = this.messages;

    for (const k of keys) {
      value = (value as Record<string, unknown>)[k];
      if (value === undefined) {
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
    }

    return value;
  }

  priority(p: Priority): string {
    return this.messages.priority[p];
  }

  riskLevel(r: RiskLevel): string {
    return this.messages.riskLevel[r];
  }
}

export { I18n, I18nMessages, messages };
export default I18n;
