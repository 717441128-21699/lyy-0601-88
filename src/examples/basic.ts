import { EfficiencyGoalSDK } from '../index';
import { addDays } from '../utils';

async function main() {
  console.log('=== Efficiency Goal SDK 使用示例 ===\n');

  const sdk = new EfficiencyGoalSDK({
    language: 'zh-CN',
  });

  console.log('1. 创建目标');
  const targetDate = addDays(new Date(), 30);
  const goal = await sdk.goals.createGoal({
    title: '学习 TypeScript 高级特性',
    description: '在 30 天内掌握 TypeScript 的高级特性',
    category: '学习',
    tags: ['TypeScript', '学习', '技能提升'],
    priority: 'high',
    targetDate,
  });
  console.log('创建的目标:', goal!.title, '-', goal!.id);
  console.log();

  console.log('2. 自动拆分里程碑');
  const milestones = await sdk.autoSplitMilestones(goal!.id, 4);
  if (milestones) {
    console.log('拆分的里程碑:');
    milestones.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.title} - ${m.targetDate.toLocaleDateString()}`);
    });
  }
  console.log();

  console.log('3. 创建任务');
  const task1 = sdk.tasks.createTask({
    title: '学习泛型编程',
    description: '学习 TypeScript 中的泛型编程',
    goalId: goal!.id,
    priority: 'high',
    estimatedMinutes: 120,
    dueDate: addDays(new Date(), 7),
    tags: ['TypeScript', '泛型'],
  });
  console.log('创建任务1:', task1.title);

  const task2 = sdk.tasks.createTask({
    title: '学习装饰器模式',
    description: '学习 TypeScript 中的装饰器',
    goalId: goal!.id,
    priority: 'medium',
    estimatedMinutes: 90,
    dueDate: addDays(new Date(), 14),
    tags: ['TypeScript', '装饰器'],
  });
  console.log('创建任务2:', task2.title);

  const task3 = sdk.tasks.createTask({
    title: '学习类型体操',
    description: '练习 TypeScript 类型体操',
    goalId: goal!.id,
    priority: 'urgent',
    estimatedMinutes: 180,
    dueDate: addDays(new Date(), 3),
    tags: ['TypeScript', '类型体操'],
  });
  console.log('创建任务3:', task3.title);
  console.log();

  console.log('4. 任务拆分示例');
  const subtasks = await sdk.splitTask(task1.id, { parts: 3 });
  if (subtasks) {
    console.log('任务拆分为:');
    subtasks.forEach((st, i) => {
      console.log(`  ${i + 1}. ${st.title}`);
    });
  }
  console.log();

  console.log('5. 优先级排序');
  const sortedTasks = await sdk.sortTasks('priority');
  console.log('按优先级排序后的任务:');
  sortedTasks.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.priority}] ${t.title}`);
  });
  console.log();

  console.log('6. 添加阻塞标记');
  const blocker = await sdk.addBlockerToTask(
    task2.id,
    '需要先完成泛型编程的学习'
  );
  if (blocker) {
    console.log('添加阻塞:', blocker.description);
    console.log('任务2状态:', (await sdk.tasks.getTask(task2.id))?.status);
  }
  console.log();

  console.log('7. 解决阻塞');
  const resolved = await sdk.resolveTaskBlocker(
    task2.id,
    blocker!.id,
    '已完成泛型编程学习'
  );
  if (resolved) {
    console.log('已解决阻塞:', resolved.resolution);
    console.log('任务2状态:', (await sdk.tasks.getTask(task2.id))?.status);
  }
  console.log();

  console.log('8. 延期风险评估');
  await sdk.goals.updateGoalProgress(goal!.id, 15);
  const risk = await sdk.assessGoalRisk(goal!.id);
  if (risk) {
    console.log('风险等级:', sdk.i18n.riskLevel(risk.level), `(${risk.score}分)`);
    console.log('风险因素:');
    risk.factors.forEach(f => console.log(`  - ${f}`));
    console.log('建议:');
    risk.suggestions.forEach(s => console.log(`  - ${s}`));
  }
  console.log();

  console.log('9. 生成每日清单');
  const checklist = await sdk.getDailyChecklist();
  console.log(`日期: ${checklist.date.toLocaleDateString()}`);
  console.log('今日任务:');
  checklist.tasks.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.priority}] ${t.title} - ${t.progress}%`);
  });
  console.log('建议行动:');
  checklist.suggestedActions.forEach(a => console.log(`  - ${a}`));
  console.log();

  console.log('10. 下一步行动推荐');
  const nextActions = await sdk.getNextActions(5);
  console.log('推荐的下一步行动:');
  nextActions.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.priority}] ${a.description}`);
    console.log(`     原因: ${a.reason}`);
    if (a.estimatedMinutes) {
      console.log(`     预计时间: ${a.estimatedMinutes}分钟`);
    }
  });
  console.log();

  console.log('11. 添加完成证据');
  const evidence = await sdk.addEvidenceToTask(
    task1.id,
    'text',
    '完成了泛型编程的基础学习，编写了10个练习例子',
    '学习笔记'
  );
  if (evidence) {
    console.log('添加证据:', evidence.description);
  }
  console.log();

  console.log('12. 创建复盘记录');
  await sdk.tasks.updateTaskStatus(task3.id, 'completed');
  const review = await sdk.createQuickReview(goal!.id, 4);
  if (review) {
    console.log('复盘摘要:', review.summary);
    console.log('评分:', review.rating, '/ 5');
    console.log('成就:');
    review.achievements.forEach(a => console.log(`  - ${a}`));
    console.log('经验教训:');
    review.lessons.forEach(l => console.log(`  - ${l}`));
    console.log('下一步:');
    review.nextActions.forEach(n => console.log(`  - ${n}`));
  }
  console.log();

  console.log('13. 生成周报');
  const report = await sdk.getWeeklyReport();
  console.log('周报标题:', report.fullText.split('\n')[0]);
  console.log('生产力评分:', report.productivityScore, '/ 100');
  console.log('完成目标数:', report.totalGoalsCompleted);
  console.log('完成任务数:', report.totalTasksCompleted);
  console.log('平均进度:', report.averageProgress, '%');
  console.log('本周亮点:');
  report.highlights.slice(0, 3).forEach(h => console.log(`  - ${h}`));
  console.log();

  console.log('14. 统计汇总');
  const stats = await sdk.getSummaryStats();
  console.log('目标统计:');
  console.log(`  总数: ${stats.goals.total}, 完成: ${stats.goals.completed}, 进行中: ${stats.goals.inProgress}`);
  console.log(`  延期: ${stats.goals.delayed}, 有风险: ${stats.goals.atRisk}`);
  console.log(`  平均进度: ${stats.goals.averageProgress}%, 完成率: ${stats.goals.completionRate}%`);
  console.log('任务统计:');
  console.log(`  总数: ${stats.tasks.total}, 完成: ${stats.tasks.completed}, 进行中: ${stats.tasks.inProgress}`);
  console.log(`  阻塞: ${stats.tasks.blocked}, 待处理: ${stats.tasks.pending}, 延期: ${stats.tasks.delayed}`);
  console.log(`  平均进度: ${stats.tasks.averageProgress}%, 完成率: ${stats.tasks.completionRate}%`);
  console.log();

  console.log('15. 历史趋势（最近7天）');
  const trends = await sdk.getTrendData(7);
  console.log('日期       | 完成任务 | 完成目标 | 平均进度 | 生产力评分');
  console.log('-----------|----------|----------|----------|------------');
  trends.forEach(t => {
    console.log(
      `${t.date.toLocaleDateString().padEnd(10)} | ${String(t.completedTasks).padStart(8)} | ${String(t.completedGoals).padStart(8)} | ${String(t.averageProgress + '%').padStart(8)} | ${String(t.productivityScore).padStart(10)}`
    );
  });
  console.log();

  console.log('16. 多语言切换');
  sdk.setLanguage('en-US');
  const riskEn = await sdk.assessGoalRisk(goal!.id);
  console.log('Risk Level (English):', sdk.i18n.riskLevel(riskEn!.level));
  sdk.setLanguage('ja-JP');
  console.log('優先度 (Japanese):', sdk.i18n.priority('urgent'));
  sdk.setLanguage('zh-CN');
  console.log();

  console.log('17. 评分计算');
  const goalScore = await sdk.calculateGoalScore(goal!.id);
  const taskScore = await sdk.calculateTaskScore(task3.id);
  console.log('目标得分:', goalScore);
  console.log('任务3得分:', taskScore);
  console.log();

  console.log('18. 合并重复任务检测');
  const duplicateTask = sdk.tasks.createTask({
    title: '学习类型体操',
    goalId: goal!.id,
    priority: 'high',
    dueDate: addDays(new Date(), 3),
  });
  const duplicates = await sdk.findDuplicateTasks();
  console.log('发现重复任务组:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('重复任务:');
    duplicates[0].forEach(t => console.log(`  - ${t.title} (${t.id.slice(0, 8)}...)`));
  }
  const merged = await sdk.mergeDuplicateTasks();
  console.log('合并后任务总数:', merged.length);
  console.log();

  console.log('19. 工作负载平衡');
  const workload = await sdk.getWorkloadBalance(8);
  console.log('是否过载:', workload.overloaded);
  workload.suggestions.forEach(s => console.log(`  - ${s}`));
  console.log();

  console.log('20. 激励消息');
  const message = await sdk.getMotivationalMessage();
  console.log('激励消息:', message);
  console.log();

  console.log('21. 周报全文');
  console.log('='.repeat(60));
  console.log(report.fullText);
  console.log('='.repeat(60));
  console.log();

  console.log('=== 示例完成 ===');
}

main().catch(console.error);
