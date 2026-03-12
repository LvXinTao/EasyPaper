import { AppError, ErrorCode, createErrorResponse } from '@/lib/errors';

describe('AppError', () => {
  it('creates an error with code and message', () => {
    const err = new AppError('INVALID_FILE_TYPE', 'Only PDF files are supported');
    expect(err.code).toBe('INVALID_FILE_TYPE');
    expect(err.message).toBe('Only PDF files are supported');
    expect(err.statusCode).toBe(400);
  });

  it('maps error codes to correct HTTP status codes', () => {
    expect(new AppError('FILE_TOO_LARGE', '').statusCode).toBe(413);
    expect(new AppError('PAPER_NOT_FOUND', '').statusCode).toBe(404);
    expect(new AppError('PARSING_FAILED', '').statusCode).toBe(500);
    expect(new AppError('API_KEY_MISSING', '').statusCode).toBe(400);
    expect(new AppError('VALIDATION_ERROR', '').statusCode).toBe(400);
  });
});

describe('createErrorResponse', () => {
  it('creates a NextResponse with correct format', () => {
    const response = createErrorResponse('INVALID_FILE_TYPE', 'Only PDF files');
    expect(response.status).toBe(400);
  });
});
