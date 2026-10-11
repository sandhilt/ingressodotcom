import type * as z from 'zod/v4';
import { classifyMethod } from '../../domain/OperationSafety.ts';

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  operations: Array<{ method: string; path: string }>;
  handler(input: Record<string, unknown>): Promise<unknown>;
}

export function deriveAnnotations(tool: Pick<ToolDefinition, 'title' | 'operations'>) {
  const safety = tool.operations.map(operation => classifyMethod(operation.method));
  return {
    title: tool.title,
    readOnlyHint: safety.length > 0 && safety.every(operation => operation.readOnly),
    destructiveHint: safety.length === 0 || safety.some(operation => operation.destructive),
    idempotentHint: safety.length > 0 && safety.every(operation => operation.idempotent),
    openWorldHint: true,
  };
}
