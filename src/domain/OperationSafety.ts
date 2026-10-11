export interface OperationSafety {
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
}

export function classifyMethod(method: string): OperationSafety {
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  return { readOnly, destructive: !readOnly, idempotent: readOnly || ['PUT', 'DELETE'].includes(method) };
}
