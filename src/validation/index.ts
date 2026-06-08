import { 
  CreateGoalInput, 
  CreateTaskInput, 
  SplitTaskOptions,
  ScoringRule,
  CompletionEvidence,
  SDKError,
  ValidationResult,
  Priority,
  GoalPeriod,
  ErrorCode,
} from '../types';
import { defaultScoringRule } from '../scoring';
import { generateId } from '../utils';

class Validator {
  private strictMode: boolean;

  constructor(strictMode: boolean = false) {
    this.strictMode = strictMode;
  }

  private createError(code: ErrorCode, message: string, field?: string, details?: Record<string, unknown>): SDKError {
    return { code, message, field, details };
  }

  private validateTitle(title: string, fieldName: string = 'title'): SDKError | null {
    if (!title || typeof title !== 'string') {
      return this.createError('EMPTY_TITLE', `${fieldName} 不能为空`, fieldName);
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return this.createError('EMPTY_TITLE', `${fieldName} 不能为空`, fieldName);
    }
    if (this.strictMode && trimmed.length > 200) {
      return this.createError('EMPTY_TITLE', `${fieldName} 长度不能超过 200 字符`, fieldName);
    }
    return null;
  }

  private validateDate(date: Date | undefined, fieldName: string, required: boolean = false): SDKError | null {
    if (required && !date) {
      return this.createError('INVALID_DATE', `${fieldName} 是必填项`, fieldName);
    }
    if (date !== undefined) {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return this.createError('INVALID_DATE', `${fieldName} 必须是有效的日期`, fieldName);
      }
    }
    return null;
  }

  private validateNumber(value: number | undefined, fieldName: string, min?: number, max?: number): SDKError | null {
    if (value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) {
      return this.createError('MISSING_REQUIRED_FIELD', `${fieldName} 必须是数字`, fieldName);
    }
    if (min !== undefined && value < min) {
      return this.createError('INVALID_PARTS', `${fieldName} 不能小于 ${min}`, fieldName, { min, value });
    }
    if (max !== undefined && value > max) {
      return this.createError('MISSING_REQUIRED_FIELD', `${fieldName} 不能大于 ${max}`, fieldName, { max, value });
    }
    return null;
  }

  private validateEnum<T extends string>(value: T | undefined, allowed: T[], fieldName: string): SDKError | null {
    if (value === undefined) return null;
    if (!allowed.includes(value)) {
      return this.createError('MISSING_REQUIRED_FIELD', `${fieldName} 必须是 ${allowed.join(', ')} 之一`, fieldName, { allowed, value });
    }
    return null;
  }

  validateCreateGoalInput(input: CreateGoalInput): ValidationResult<CreateGoalInput> {
    const errors: SDKError[] = [];

    const titleError = this.validateTitle(input.title, 'title');
    if (titleError) errors.push(titleError);

    const targetDateError = this.validateDate(input.targetDate, 'targetDate', true);
    if (targetDateError) errors.push(targetDateError);

    const startDateError = this.validateDate(input.startDate, 'startDate');
    if (startDateError) errors.push(startDateError);

    if (input.startDate && input.targetDate && input.startDate > input.targetDate) {
      errors.push(this.createError('INVALID_DATE', 'startDate 不能晚于 targetDate', 'startDate'));
    }

    const priorityError = this.validateEnum<Priority>(input.priority, ['urgent', 'high', 'medium', 'low'], 'priority');
    if (priorityError) errors.push(priorityError);

    const periodError = this.validateEnum<GoalPeriod>(input.period, ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'], 'period');
    if (periodError) errors.push(periodError);

    if (input.tags && !Array.isArray(input.tags)) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', 'tags 必须是数组', 'tags'));
    }

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    const normalizedInput: CreateGoalInput = {
      ...input,
      title: input.title.trim(),
      priority: input.priority || 'medium',
      startDate: input.startDate || new Date(),
      tags: input.tags || [],
      metadata: input.metadata || {},
    };

    return { success: true, data: normalizedInput };
  }

  validateCreateTaskInput(input: CreateTaskInput): ValidationResult<CreateTaskInput> {
    const errors: SDKError[] = [];

    const titleError = this.validateTitle(input.title, 'title');
    if (titleError) errors.push(titleError);

    const dueDateError = this.validateDate(input.dueDate, 'dueDate');
    if (dueDateError) errors.push(dueDateError);

    const startDateError = this.validateDate(input.startDate, 'startDate');
    if (startDateError) errors.push(startDateError);

    if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
      errors.push(this.createError('INVALID_DATE', 'startDate 不能晚于 dueDate', 'startDate'));
    }

    const priorityError = this.validateEnum<Priority>(input.priority, ['urgent', 'high', 'medium', 'low'], 'priority');
    if (priorityError) errors.push(priorityError);

    const estimateError = this.validateNumber(input.estimatedMinutes, 'estimatedMinutes', 1);
    if (estimateError) errors.push(estimateError);

    if (input.tags && !Array.isArray(input.tags)) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', 'tags 必须是数组', 'tags'));
    }

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    const normalizedInput: CreateTaskInput = {
      ...input,
      title: input.title.trim(),
      priority: input.priority || 'medium',
      tags: input.tags || [],
      metadata: input.metadata || {},
    };

    return { success: true, data: normalizedInput };
  }

  validateSplitTaskOptions(options: SplitTaskOptions): ValidationResult<SplitTaskOptions> {
    const errors: SDKError[] = [];

    const partsError = this.validateNumber(options.parts, 'parts', 1, 20);
    if (partsError) errors.push(partsError);

    if (options.subtaskTitles) {
      if (!Array.isArray(options.subtaskTitles)) {
        errors.push(this.createError('MISSING_REQUIRED_FIELD', 'subtaskTitles 必须是数组', 'subtaskTitles'));
      } else {
        for (let i = 0; i < options.subtaskTitles.length; i++) {
          const titleError = this.validateTitle(options.subtaskTitles[i], `subtaskTitles[${i}]`);
          if (titleError) errors.push(titleError);
        }
      }
    }

    if (options.parts && options.subtaskTitles && options.parts !== options.subtaskTitles.length) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', 'parts 和 subtaskTitles 长度不一致', 'parts'));
    }

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    return {
      success: true,
      data: {
        parts: options.parts || 3,
        subtaskTitles: options.subtaskTitles,
        autoEstimate: options.autoEstimate !== false,
      },
    };
  }

  validateScoringRule(rule: Partial<ScoringRule>): ValidationResult<ScoringRule> {
    const errors: SDKError[] = [];

    if (rule.name) {
      const nameError = this.validateTitle(rule.name, 'name');
      if (nameError) errors.push(nameError);
    }

    if (rule.priorityWeights) {
      if (typeof rule.priorityWeights !== 'object') {
        errors.push(this.createError('INVALID_SCORING_RULE', 'priorityWeights 必须是对象', 'priorityWeights'));
      } else {
        const priorities: Priority[] = ['urgent', 'high', 'medium', 'low'];
        for (const p of priorities) {
          const weight = rule.priorityWeights[p];
          if (weight !== undefined) {
            if (typeof weight !== 'number' || weight < 0) {
              errors.push(this.createError('INVALID_SCORING_RULE', `priorityWeights.${p} 必须是非负数字`, `priorityWeights.${p}`));
            }
          }
        }
      }
    }

    const numericFields: (keyof ScoringRule)[] = [
      'onTimeBonus', 'earlyBonus', 'latePenalty', 'blockerPenalty',
      'milestoneBonus', 'evidenceBonus', 'reviewBonus'
    ];
    for (const field of numericFields) {
      if (rule[field] !== undefined) {
        if (typeof rule[field] !== 'number' || isNaN(rule[field] as number)) {
          errors.push(this.createError('INVALID_SCORING_RULE', `${field} 必须是数字`, field as string));
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    const mergedRule: ScoringRule = {
      ...defaultScoringRule,
      ...rule,
      priorityWeights: {
        ...defaultScoringRule.priorityWeights,
        ...(rule.priorityWeights || {}),
      },
      id: rule.id || generateId(),
      name: rule.name || defaultScoringRule.name,
    };

    return { success: true, data: mergedRule };
  }

  validateCompletionEvidence(evidence: { type: string; content: string; description?: string }): ValidationResult<{ type: string; content: string; description?: string }> {
    const errors: SDKError[] = [];

    const validTypes = ['text', 'image', 'link', 'file'];
    if (!validTypes.includes(evidence.type)) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', `type 必须是 ${validTypes.join(', ')} 之一`, 'type'));
    }

    if (!evidence.content || evidence.content.trim().length === 0) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', 'content 不能为空', 'content'));
    }

    if (this.strictMode && evidence.content.length > 5000) {
      errors.push(this.createError('MISSING_REQUIRED_FIELD', 'content 长度不能超过 5000 字符', 'content'));
    }

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    return { success: true, data: evidence };
  }

  validateReminder(reminder: { message: string; scheduledAt: Date }): ValidationResult<{ message: string; scheduledAt: Date }> {
    const errors: SDKError[] = [];

    if (!reminder.message || reminder.message.trim().length === 0) {
      errors.push(this.createError('EMPTY_TITLE', 'message 不能为空', 'message'));
    }

    const dateError = this.validateDate(reminder.scheduledAt, 'scheduledAt', true);
    if (dateError) errors.push(dateError);

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    return { success: true, data: reminder };
  }

  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }
}

export { Validator };
export default Validator;
