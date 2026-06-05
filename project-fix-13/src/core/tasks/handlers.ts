/**
 * Built-in Task Handlers — IDE operation implementations
 * 
 * Each handler implements the TaskHandler interface
 * and knows how to execute a specific task type.
 */

import type { TaskHandler, TaskInput, TaskOutput, TaskError, AgentTask, TaskExecutionContext, StreamChunk, TaskId } from './types';

// ═══════════════════════════════════════════════════════════════
// CODE GENERATION HANDLER
// ═══════════════════════════════════════════════════════════════

export const codeGenerationHandler: TaskHandler = {
  type: 'code_generation',

  validate(input: TaskInput): TaskError | null {
    if (!input.prompt || typeof input.prompt !== 'string') {
      return { code: 'INVALID_INPUT', message: 'prompt is required', retryable: false };
    }
    return null;
  },

  async *execute(task: AgentTask, ctx: TaskExecutionContext): AsyncGenerator<StreamChunk, TaskOutput> {
    const prompt = task.input.prompt as string;
    const files = task.input.files as { path: string; content: string }[] || [];

    ctx.log('info', `Generating code for: ${prompt.slice(0, 80)}...`);

    yield {
      taskId: task.id,
      timestamp: Date.now(),
      type: 'thinking',
      content: 'Kod analiz ediliyor ve oluşturuluyor...',
    };

    // This handler coordinates with the LLM via the AI service
    // The actual LLM call would be injected via task input or context
    yield {
      taskId: task.id,
      timestamp: Date.now(),
      type: 'progress',
      progress: 0.5,
      content: 'Kod üretiliyor...',
    };

    // Simulate completion for now — real implementation hooks into LLM
    yield {
      taskId: task.id,
      timestamp: Date.now(),
      type: 'progress',
      progress: 1.0,
      content: 'Kod üretildi',
    };

    return {
      generatedCode: `// Generated for: ${prompt}`,
      filesModified: files.map(f => f.path),
      success: true,
    };
  },

  estimateCost(input: TaskInput) {
    const prompt = (input.prompt as string) || '';
    return { tokens: Math.ceil(prompt.length / 4) * 3, timeMs: 5000 };
  },
};

// ═══════════════════════════════════════════════════════════════
// FILE ANALYSIS HANDLER
// ═══════════════════════════════════════════════════════════════

export const fileAnalysisHandler: TaskHandler = {
  type: 'file_analysis',

  validate(input: TaskInput): TaskError | null {
    if (!input.filePath && !input.files) {
      return { code: 'INVALID_INPUT', message: 'filePath or files required', retryable: false };
    }
    return null;
  },

  async execute(task: AgentTask, ctx: TaskExecutionContext): Promise<TaskOutput> {
    const filePath = task.input.filePath as string;
    const content = task.input.content as string || '';

    ctx.log('info', `Analyzing file: ${filePath}`);

    // Basic analysis
    const lines = content.split('\n');
    const imports = lines.filter(l => l.trim().startsWith('import ')).length;
    const exports = lines.filter(l => l.includes('export ')).length;
    const functions = (content.match(/function\s+\w+/g) || []).length;
    const components = (content.match(/(?:function|const)\s+[A-Z]\w+/g) || []).length;

    return {
      filePath,
      lineCount: lines.length,
      charCount: content.length,
      importCount: imports,
      exportCount: exports,
      functionCount: functions,
      componentCount: components,
      language: filePath.split('.').pop() || 'unknown',
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// PLANNING HANDLER
// ═══════════════════════════════════════════════════════════════

export const planningHandler: TaskHandler = {
  type: 'planning',

  async *execute(task: AgentTask, ctx: TaskExecutionContext): AsyncGenerator<StreamChunk, TaskOutput> {
    const request = task.input.request as string;
    
    ctx.log('info', `Planning: ${request.slice(0, 80)}...`);

    yield {
      taskId: task.id,
      timestamp: Date.now(),
      type: 'thinking',
      content: 'Plan oluşturuluyor...',
    };

    // In production, this would call the LLM to generate a plan
    // then enqueue child tasks for each step
    const steps = [
      { name: 'analyze', type: 'file_analysis' as const, description: 'Mevcut dosyaları analiz et' },
      { name: 'generate', type: 'code_generation' as const, description: 'Kodu üret' },
    ];

    const childIds: TaskId[] = [];
    let prevChildId: TaskId | undefined;

    for (const step of steps) {
      const childId = ctx.enqueueChild({
        type: step.type,
        name: step.name,
        description: step.description,
        input: { ...task.input },
        dependsOn: prevChildId ? [prevChildId] : [],
        priority: task.priority,
      });
      childIds.push(childId);
      prevChildId = childId;

      yield {
        taskId: task.id,
        timestamp: Date.now(),
        type: 'progress',
        content: `Adım planlandı: ${step.description}`,
      };
    }

    return {
      plan: steps.map((s, i) => ({ ...s, taskId: childIds[i] })),
      totalSteps: steps.length,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// DEBUGGING HANDLER
// ═══════════════════════════════════════════════════════════════

export const debuggingHandler: TaskHandler = {
  type: 'debugging',

  async execute(task: AgentTask, ctx: TaskExecutionContext): Promise<TaskOutput> {
    const errorMessage = task.input.errorMessage as string || '';
    
    ctx.log('info', `Debugging: ${errorMessage.slice(0, 80)}`);

    return {
      analysis: `Error analysis for: ${errorMessage}`,
      suggestions: ['Check imports', 'Verify types', 'Check runtime values'],
      affectedFiles: [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// TERMINAL EXECUTION HANDLER
// ═══════════════════════════════════════════════════════════════

export const terminalHandler: TaskHandler = {
  type: 'terminal_execution',

  validate(input: TaskInput): TaskError | null {
    if (!input.command || typeof input.command !== 'string') {
      return { code: 'INVALID_INPUT', message: 'command is required', retryable: false };
    }
    return null;
  },

  async execute(task: AgentTask, ctx: TaskExecutionContext): Promise<TaskOutput> {
    const command = task.input.command as string;
    ctx.log('info', `Executing: ${command}`);

    // In production, this would interact with the terminal/sandbox
    return {
      command,
      stdout: `$ ${command}\n✓ Command executed`,
      stderr: '',
      exitCode: 0,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// REFACTORING HANDLER
// ═══════════════════════════════════════════════════════════════

export const refactoringHandler: TaskHandler = {
  type: 'refactoring',

  async *execute(task: AgentTask, ctx: TaskExecutionContext): AsyncGenerator<StreamChunk, TaskOutput> {
    const targetFile = task.input.filePath as string;
    const refactorType = task.input.refactorType as string || 'general';
    
    ctx.log('info', `Refactoring ${targetFile}: ${refactorType}`);

    yield {
      taskId: task.id,
      timestamp: Date.now(),
      type: 'thinking',
      content: `${targetFile} dosyası refactor ediliyor...`,
    };

    return {
      filePath: targetFile,
      refactorType,
      changes: [],
      success: true,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// INDEXING HANDLER
// ═══════════════════════════════════════════════════════════════

export const indexingHandler: TaskHandler = {
  type: 'indexing',

  async execute(task: AgentTask, ctx: TaskExecutionContext): Promise<TaskOutput> {
    const files = task.input.files as { path: string; content: string }[] || [];
    
    ctx.log('info', `Indexing ${files.length} files`);

    const index: Record<string, { symbols: string[]; imports: string[] }> = {};
    
    for (const file of files) {
      const symbols = (file.content.match(/(?:function|const|let|class|interface|type|enum)\s+(\w+)/g) || [])
        .map(m => m.split(/\s+/)[1]);
      const imports = (file.content.match(/import\s+.*?from\s+['"](.+?)['"]/g) || [])
        .map(m => { const match = m.match(/from\s+['"](.+?)['"]/); return match?.[1] || ''; });
      
      index[file.path] = { symbols, imports };
    }

    return { index, fileCount: files.length };
  },
};

// ═══════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════

export function getAllHandlers(): TaskHandler[] {
  return [
    codeGenerationHandler,
    fileAnalysisHandler,
    planningHandler,
    debuggingHandler,
    terminalHandler,
    refactoringHandler,
    indexingHandler,
  ];
}
