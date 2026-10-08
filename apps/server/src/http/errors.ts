import type { ErrorEnvelope, Issue } from '@trafaret/core';

/** An error with an HTTP status and a stable code; rendered as the error envelope. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly issues: Issue[] | undefined;

  constructor(statusCode: number, code: string, message: string, issues?: Issue[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}

export function errorBody(code: string, message: string, issues?: Issue[]): ErrorEnvelope {
  return { error: issues === undefined ? { code, message } : { code, message, issues } };
}
