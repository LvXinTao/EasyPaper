import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PARSING_FAILED'
  | 'ANALYSIS_FAILED'
  | 'API_KEY_MISSING'
  | 'API_CALL_FAILED'
  | 'PAPER_NOT_FOUND'
  | 'NOTE_NOT_FOUND'
  | 'VALIDATION_ERROR';

const STATUS_MAP: Record<ErrorCode, number> = {
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 413,
  PARSING_FAILED: 500,
  ANALYSIS_FAILED: 500,
  API_KEY_MISSING: 400,
  API_CALL_FAILED: 502,
  PAPER_NOT_FOUND: 404,
  NOTE_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.details = details;
  }
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  const statusCode = STATUS_MAP[code];
  return NextResponse.json(
    { error: { code, message, ...(details && { details }) } },
    { status: statusCode }
  );
}
