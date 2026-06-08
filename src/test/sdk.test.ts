import { EfficiencyGoalSDK, FileStorage } from '../index';
import { addDays } from '../utils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function runTests() {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        result.then(
          () => {
            console.log(`✅ ${name}`);
            passed++;
          },
          (err) => {
            console.log(`❌ ${name}`);
            console.error(`   Error: ${err.message}`);
            failed++;
            errors.push(`${name}: ${err.message}`);
          }
        );
      } else {
        console.log(`✅ ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.log(`❌ ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
      errors.push(`${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(message);
    }
  }

  console.log('='.repeat(70));
  console.log('Efficiency Goal SDK - 完整功能测试');
  console.log('='.repeat(70));
  console.log();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-test-'));
  const testFile = path.join(tempDir, 'test-data.json');

  try {
    console.log('【1/8】基础功能测试');
    console.log('-'.repeat(70));

    const sdk = new EfficiencyGoalSDK({
      language: 'zh-CN',
      strictValidation: true,
    });

    test('创建目标', async () => {
      const goal = await sdk.goals.createGoal({
        title: '完成季度项目',
        description: '在本季度内完成项目开发',
        category: '工作',
        tags: ['项目', '重要'],
        priority: 'high',
        targetDate: addDays(new Date(), 90),
      });
      assert(goal.title === '完成季度项目', '目标标题不正确');
      assert(goal.priority === 'high', '目标优先级不正确');
      assert(goal.status === 'not_started', '目标状态不正确');
      assert(goal.progress === 0, '目标进度不正确');
    });

    test('空标题验证', async () => {
      let threw = false;
      try {
        await sdk.goals.createGoal({
          title: '',
          targetDate: addDays(new Date(), 30),
        });
      } catch (e) {
        threw = true;
      }
      assert(threw, '空标题应该抛出错误');
    });

    test('非法日期验证', async () => {
      let threw = false;
      try {
        await sdk.goals.createGoal({
          title: '测试目标',
          targetDate: new Date('invalid-date'),
        });
      } catch (e) {
        threw = true;
      }
      assert(threw, '非法日期应该抛出错误');
    });

    test('创建任务', async () => {
      const goal = await sdk.goals.createGoal({
        title: '测试目标',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '完成需求分析',
        goalId: goal.id,
        priority: 'high',
        estimatedMinutes: 120,
        dueDate: addDays(new Date(), 7),
      });
      assert(task.title === '完成需求分析', '任务标题不正确');
      assert(task.goalId === goal.id, '任务关联目标不正确');
    });

    console.log();
    console.log('【2/8】任务拆分和优先级排序');
    console.log('-'.repeat(70));

    test('任务拆分', async () => {
      const goal = await sdk.goals.createGoal({
        title: '大目标',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '大型任务',
        goalId: goal.id,
        estimatedMinutes: 300,
      });
      const subtasks = await sdk.tasks.splitTask(task.id, { parts: 3 });
      assert(subtasks !== null, '拆分子任务失败');
      assert(subtasks!.length === 3, '子任务数量不正确');
      assert(subtasks![0].estimatedMinutes === 100, '子任务预估时间不正确');
    });

    test('负数拆分数量验证', async () => {
      const goal = await sdk.goals.createGoal({
        title: '测试目标',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '测试任务',
        goalId: goal.id,
      });
      let threw = false;
      try {
        await sdk.tasks.splitTask(task.id, { parts: -1 });
      } catch (e) {
        threw = true;
      }
      assert(threw, '负数拆分数量应该抛出错误');
    });

    test('优先级排序', async () => {
      const sortSDK = new EfficiencyGoalSDK();
      const goal = await sortSDK.goals.createGoal({
        title: '排序测试',
        targetDate: addDays(new Date(), 30),
      });
      sortSDK.tasks.createTask({ title: '低优先级', goalId: goal.id, priority: 'low' });
      sortSDK.tasks.createTask({ title: '紧急任务', goalId: goal.id, priority: 'urgent' });
      sortSDK.tasks.createTask({ title: '中优先级', goalId: goal.id, priority: 'medium' });
      sortSDK.tasks.createTask({ title: '高优先级', goalId: goal.id, priority: 'high' });
      const tasks = await sortSDK.tasks.listTasks();
      const sorted = sortSDK.tasks.sortTasks(tasks, 'priority');
      assert(sorted[0].priority === 'urgent', '排序后第一个应该是紧急');
      assert(sorted[1].priority === 'high', '排序后第二个应该是高');
      assert(sorted[2].priority === 'medium', '排序后第三个应该是中');
      assert(sorted[3].priority === 'low', '排序后第四个应该是低');
    });

    console.log();
    console.log('【3/8】阻塞和进度管理');
    console.log('-'.repeat(70));

    test('添加阻塞', async () => {
      const goal = await sdk.goals.createGoal({
        title: '阻塞测试',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '被阻塞的任务',
        goalId: goal.id,
      });
      const blocker = await sdk.tasks.addBlocker(task.id, '等待其他团队提供接口');
      assert(blocker !== null, '添加阻塞失败');
      assert(blocker!.description === '等待其他团队提供接口', '阻塞描述不正确');
      const updatedTask = await sdk.tasks.getTask(task.id);
      assert(updatedTask!.status === 'blocked', '任务状态应该变为阻塞');
    });

    test('解决阻塞', async () => {
      const goal = await sdk.goals.createGoal({
        title: '解决阻塞测试',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '任务',
        goalId: goal.id,
      });
      const blocker = await sdk.tasks.addBlocker(task.id, '依赖问题');
      const resolved = await sdk.tasks.resolveBlocker(task.id, blocker!.id, '依赖已解决');
      assert(resolved !== null, '解决阻塞失败');
      assert(resolved!.resolution === '依赖已解决', '解决描述不正确');
      const updatedTask = await sdk.tasks.getTask(task.id);
      assert(updatedTask!.status !== 'blocked', '任务状态应该解除阻塞');
    });

    test('计算进度', async () => {
      const goal = await sdk.goals.createGoal({
        title: '进度测试',
        targetDate: addDays(new Date(), 30),
      });
      await sdk.goals.updateGoalProgress(goal.id, 50);
      const updatedGoal = await sdk.goals.getGoal(goal.id);
      assert(updatedGoal!.progress === 50, '进度更新不正确');
    });

    console.log();
    console.log('【4/8】评分规则和NaN防护');
    console.log('-'.repeat(70));

    test('部分评分规则合并', () => {
      const customSDK = new EfficiencyGoalSDK({
        scoringRule: {
          priorityWeights: { urgent: 50, high: 30, medium: 20, low: 10 },
          onTimeBonus: 20,
        },
      });
      const rule = customSDK.scoring.getRule();
      assert(rule.priorityWeights.urgent === 50, '自定义优先级权重不正确');
      assert(rule.onTimeBonus === 20, '自定义按时奖励不正确');
      assert(rule.earlyBonus === 15, '未设置的应该沿用默认值');
      assert(rule.latePenalty === -15, '未设置的惩罚应该沿用默认值');
    });

    test('评分规则缺字段时使用默认值', () => {
      const customSDK = new EfficiencyGoalSDK({
        scoringRule: {
          priorityWeights: { urgent: 100, high: undefined as any, medium: 20, low: 10 },
        },
      });
      const rule = customSDK.scoring.getRule();
      assert(rule.priorityWeights.urgent === 100, '自定义值应该生效');
      assert(rule.priorityWeights.high === 30, 'undefined应该回退到默认值');
    });

    test('评分计算不出现NaN', async () => {
      const goal = await sdk.goals.createGoal({
        title: '评分测试',
        targetDate: addDays(new Date(), 30),
        priority: 'high',
      });
      const score = sdk.scoring.calculateGoalScore(goal);
      assert(!isNaN(score), '目标评分不应该是NaN');
      assert(typeof score === 'number', '评分应该是数字');

      const task = sdk.tasks.createTask({
        title: '任务评分测试',
        priority: 'high',
      });
      const taskScore = sdk.scoring.calculateTaskScore(task);
      assert(!isNaN(taskScore), '任务评分不应该是NaN');
    });

    console.log();
    console.log('【5/8】每日清单和提醒');
    console.log('-'.repeat(70));

    test('每日清单包含逾期任务', async () => {
      const checklistSDK = new EfficiencyGoalSDK();
      const goal = await checklistSDK.goals.createGoal({
        title: '清单测试',
        targetDate: addDays(new Date(), 30),
      });
      sdk.tasks.createTask({
        title: '逾期任务',
        goalId: goal.id,
        dueDate: addDays(new Date(), -5),
        priority: 'high',
      });
      sdk.tasks.createTask({
        title: '今日任务',
        goalId: goal.id,
        dueDate: new Date(),
        priority: 'medium',
      });
      sdk.tasks.createTask({
        title: '下周任务',
        goalId: goal.id,
        dueDate: addDays(new Date(), 7),
        priority: 'low',
      });

      const checklist = await sdk.getDailyChecklist();
      assert(Array.isArray(checklist.overdueTasks), '应该有逾期任务数组');
      assert(Array.isArray(checklist.todayTasks), '应该有今日任务数组');
      assert(Array.isArray(checklist.upcomingTasks), '应该有未来任务数组');
      assert(Array.isArray(checklist.unreadReminders), '应该有未读提醒数组');
      assert(Array.isArray(checklist.readReminders), '应该有已读提醒数组');
    });

    test('生成提醒并标记已读', async () => {
      const reminderSDK = new EfficiencyGoalSDK({ language: 'zh-CN' });
      const today = new Date();
      const goal = await reminderSDK.goals.createGoal({
        title: '提醒测试',
        targetDate: addDays(today, 5),
        startDate: addDays(today, 2),
      });
      const reminders = await reminderSDK.generateAllReminders();
      assert(reminders.length > 0, '应该生成提醒');

      const testReminder = reminders[0];
      assert(testReminder.isRead === false, '新生成的提醒应该是未读状态');

      const marked = await reminderSDK.markReminderAsRead(testReminder.id);
      assert(marked !== null, '标记已读失败');
      assert(marked!.isRead === true, '提醒应该标记为已读');
      assert(marked!.sentAt !== undefined, '应该有发送时间');

      const allReminders = await reminderSDK.getAllReminders();
      const reloaded = allReminders.find((r: any) => r.id === testReminder.id);
      assert(reloaded !== undefined, '应该能从存储中重新加载提醒');
      assert(reloaded!.isRead === true, '重新加载的提醒应该保持已读状态');

      const checklist = await reminderSDK.getDailyChecklist();
      const unreadIds = checklist.unreadReminders.map(r => r.id);
      assert(!unreadIds.includes(testReminder.id), '已读提醒不应该出现在未读列表中');
    });

    console.log();
    console.log('【6/8】复盘和证据管理');
    console.log('-'.repeat(70));

    test('添加完成证据', async () => {
      const goal = await sdk.goals.createGoal({
        title: '证据测试',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '需要证据的任务',
        goalId: goal.id,
      });
      const evidence = await sdk.addEvidenceToTask(
        task.id,
        'text',
        '完成了代码编写，共500行',
        '代码提交记录'
      );
      assert(evidence !== null, '添加证据失败');
      assert(evidence!.type === 'text', '证据类型不正确');
      assert(evidence!.content === '完成了代码编写，共500行', '证据内容不正确');
    });

    test('空证据内容验证', async () => {
      const goal = await sdk.goals.createGoal({
        title: '证据验证测试',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({
        title: '测试任务',
        goalId: goal.id,
      });
      let threw = false;
      try {
        await sdk.addEvidenceToTask(task.id, 'text', '');
      } catch (e) {
        threw = true;
      }
      assert(threw, '空证据内容应该抛出错误');
    });

    test('创建快速复盘', async () => {
      const goal = await sdk.goals.createGoal({
        title: '复盘测试',
        targetDate: addDays(new Date(), 30),
      });
      const task = sdk.tasks.createTask({ title: '已完成任务', goalId: goal.id });
      await sdk.tasks.updateTask(task.id, { status: 'completed' });
      const review = await sdk.createQuickReview(goal.id, 4, '本周进展顺利');
      assert(review !== null, '创建复盘失败');
      assert(review!.rating === 4, '评分不正确');
      assert(review!.achievements.length >= 0, '应该有成就列表');
    });

    console.log();
    console.log('【7/8】统计汇总和周报');
    console.log('-'.repeat(70));

    test('生成周报', async () => {
      const reportSDK = new EfficiencyGoalSDK();
      const goal = await reportSDK.goals.createGoal({
        title: '周报测试目标',
        targetDate: addDays(new Date(), 30),
      });
      const task = reportSDK.tasks.createTask({
        title: '已完成工作',
        goalId: goal.id,
      });
      await reportSDK.tasks.updateTask(task.id, { status: 'completed', completedAt: new Date() });
      const report = await reportSDK.getWeeklyReport();
      assert(report.totalTasksCompleted >= 0, '应该有完成任务数');
      assert(report.productivityScore >= 0, '应该有生产力评分');
      assert(report.fullText.length > 0, '应该有周报文本');
      assert(report.fullText.includes('#'), '周报应该是Markdown格式');
    });

    test('查询历史趋势', async () => {
      const trends = await sdk.getTrendData(7);
      assert(trends.length === 7, '应该返回7天的数据');
      trends.forEach(day => {
        assert(day.date instanceof Date, '日期应该是Date对象');
        assert(typeof day.completedTasks === 'number', '完成任务数应该是数字');
        assert(typeof day.productivityScore === 'number', '生产力评分应该是数字');
        assert(!isNaN(day.productivityScore), '生产力评分不应该是NaN');
      });
    });

    test('汇总统计', async () => {
      const stats = await sdk.getSummaryStats();
      assert(stats.goals.total >= 0, '目标总数应该是非负数');
      assert(stats.tasks.total >= 0, '任务总数应该是非负数');
      assert(typeof stats.productivity.score === 'number', '生产力评分应该是数字');
    });

    console.log();
    console.log('【8/8】文件存储和导入导出');
    console.log('-'.repeat(70));

    test('文件存储持久化', async () => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }

      const fileStorage = new FileStorage(testFile);
      const fileSDK = new EfficiencyGoalSDK({
        storageAdapter: fileStorage,
      });

      const goal = await fileSDK.goals.createGoal({
        title: '持久化测试目标',
        targetDate: addDays(new Date(), 30),
      });
      const task = fileSDK.tasks.createTask({
        title: '持久化测试任务',
        goalId: goal.id,
      });

      await fileStorage.saveToFileSync();

      const fileStorage2 = new FileStorage(testFile);
      const fileSDK2 = new EfficiencyGoalSDK({
        storageAdapter: fileStorage2,
      });

      const loadedGoal = await fileSDK2.goals.getGoal(goal.id);
      const loadedTask = await fileSDK2.tasks.getTask(task.id);

      assert(loadedGoal !== null, '应该能加载保存的目标');
      assert(loadedGoal!.title === '持久化测试目标', '目标标题应该一致');
      assert(loadedTask !== null, '应该能加载保存的任务');
      assert(loadedTask!.title === '持久化测试任务', '任务标题应该一致');
    });

    test('导出JSON', async () => {
      const exportSDK = new EfficiencyGoalSDK();
      const goal = await exportSDK.goals.createGoal({
        title: '导出测试',
        targetDate: addDays(new Date(), 30),
      });
      sdk.tasks.createTask({
        title: '导出任务',
        goalId: goal.id,
      });

      const json = await exportSDK.exportData({ pretty: true, exportedBy: 'test' });
      const parsed = JSON.parse(json);

      assert(parsed.version === '1.0.0', '版本号不正确');
      assert(parsed.exportedBy === 'test', '导出者不正确');
      assert(Array.isArray(parsed.goals), '应该有目标数组');
      assert(Array.isArray(parsed.tasks), '应该有任务数组');
      assert(parsed.goals.length >= 1, '应该至少有一个目标');
    });

    test('导入JSON - skip策略', async () => {
      const importSDK = new EfficiencyGoalSDK();
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        goals: [{
          id: 'test-goal-1',
          title: '导入测试目标',
          priority: 'high',
          status: 'in_progress',
          progress: 50,
          startDate: new Date().toISOString(),
          targetDate: addDays(new Date(), 30).toISOString(),
          milestones: [],
          taskIds: [],
          blockers: [],
          reviews: [],
          evidences: [],
          reminderIds: [],
          tags: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        tasks: [{
          id: 'test-task-1',
          title: '导入测试任务',
          priority: 'medium',
          status: 'todo',
          progress: 0,
          subtaskIds: [],
          blockers: [],
          evidences: [],
          tags: [],
          reminderIds: [],
          order: 0,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        reminders: [],
        reviews: [],
      };

      const result = await importSDK.importData(JSON.stringify(exportData), {
        duplicateStrategy: 'skip',
        versionCheck: 'compatible',
      });

      assert(result.success === true, '导入应该成功');
      assert(result.imported.goals === 1, '应该导入1个目标');
      assert(result.imported.tasks === 1, '应该导入1个任务');
      assert(result.skipped.goals === 0, '不应该跳过目标');

      const result2 = await importSDK.importData(JSON.stringify(exportData), {
        duplicateStrategy: 'skip',
        versionCheck: 'compatible',
      });
      assert(result2.imported.goals === 0, '重复导入应该跳过目标');
      assert(result2.skipped.goals === 1, '应该跳过1个目标');
    });

    test('导入JSON - rename策略', async () => {
      const renameSDK = new EfficiencyGoalSDK();
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        goals: [{
          id: 'rename-goal',
          title: '重命名测试',
          priority: 'high',
          status: 'not_started',
          progress: 0,
          startDate: new Date().toISOString(),
          targetDate: addDays(new Date(), 30).toISOString(),
          milestones: [],
          taskIds: [],
          blockers: [],
          reviews: [],
          evidences: [],
          reminderIds: [],
          tags: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        tasks: [],
        reminders: [],
        reviews: [],
      };

      await renameSDK.importData(JSON.stringify(exportData), {
        duplicateStrategy: 'skip',
        versionCheck: 'ignore',
      });

      const result = await renameSDK.importData(JSON.stringify(exportData), {
        duplicateStrategy: 'rename',
        versionCheck: 'ignore',
      });

      assert(result.imported.goals === 1, '应该导入1个目标（重命名ID）');
      assert(result.skipped.goals === 0, '不应该跳过目标');
    });

    console.log();
    console.log('='.repeat(70));
    console.log('多语言支持测试');
    console.log('-'.repeat(70));

    test('多语言切换', async () => {
      const i18nSDK = new EfficiencyGoalSDK({ language: 'zh-CN' });
      const goal = await i18nSDK.goals.createGoal({
        title: '多语言测试',
        targetDate: addDays(new Date(), 30),
      });
      await i18nSDK.goals.updateGoalProgress(goal.id, 10);

      const riskCN = await i18nSDK.assessGoalRisk(goal.id);
      const riskTextCN = i18nSDK.i18n.riskLevel(riskCN!.level);
      assert(typeof riskTextCN === 'string', '中文风险等级应该是字符串');

      i18nSDK.setLanguage('en-US');
      const riskEN = await i18nSDK.assessGoalRisk(goal.id);
      const riskTextEN = i18nSDK.i18n.riskLevel(riskEN!.level);
      assert(typeof riskTextEN === 'string', '英文风险等级应该是字符串');
      assert(riskTextCN !== riskTextEN, '不同语言的翻译应该不同');

      i18nSDK.setLanguage('ja-JP');
      const priorityText = i18nSDK.i18n.priority('urgent');
      assert(priorityText === '緊急', '日文优先级应该正确');

      i18nSDK.setLanguage('ko-KR');
      const priorityTextKO = i18nSDK.i18n.priority('high');
      assert(typeof priorityTextKO === 'string', '韩文优先级应该是字符串');
    });

    console.log();
    console.log('='.repeat(70));
    console.log('推荐引擎测试');
    console.log('-'.repeat(70));

    test('下一步行动推荐', async () => {
      const recSDK = new EfficiencyGoalSDK();
      const goal = await recSDK.goals.createGoal({
        title: '推荐测试',
        targetDate: addDays(new Date(), 30),
        priority: 'high',
      });
      sdk.tasks.createTask({
        title: '紧急任务',
        goalId: goal.id,
        priority: 'urgent',
        dueDate: addDays(new Date(), 1),
      });
      sdk.tasks.createTask({
        title: '高优任务',
        goalId: goal.id,
        priority: 'high',
        dueDate: addDays(new Date(), 3),
      });

      const actions = await recSDK.getNextActions(5);
      assert(Array.isArray(actions), '应该返回数组');
      assert(actions.length > 0, '应该有推荐行动');
      actions.forEach(action => {
        assert(typeof action.description === 'string', '行动描述应该是字符串');
        assert(action.priority !== undefined, '行动应该有优先级');
        assert(typeof action.reason === 'string', '行动应该有原因');
      });
    });

    test('工作负载平衡建议', async () => {
      const workloadSDK = new EfficiencyGoalSDK();
      for (let i = 0; i < 10; i++) {
        workloadSDK.tasks.createTask({
          title: `任务${i + 1}`,
          estimatedMinutes: 120,
          dueDate: addDays(new Date(), i),
        });
      }
      const workload = await workloadSDK.getWorkloadBalance(8);
      assert(typeof workload.overloaded === 'boolean', '过载状态应该是布尔值');
      assert(Array.isArray(workload.suggestions), '建议应该是数组');
      assert(workload.suggestions.length > 0, '应该有工作负载建议');
    });

    test('激励消息', async () => {
      const msgSDK = new EfficiencyGoalSDK();
      const message = await msgSDK.getMotivationalMessage();
      assert(typeof message === 'string', '激励消息应该是字符串');
      assert(message.length > 0, '激励消息不应该为空');
    });

  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log();
  console.log('='.repeat(70));
  console.log(`测试完成: 通过 ${passed}, 失败 ${failed}`);
  console.log('='.repeat(70));

  if (errors.length > 0) {
    console.log();
    console.log('错误详情:');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
