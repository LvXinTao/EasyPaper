import { parsePdfWithMarker } from '@/lib/marker';
import { spawn } from 'child_process';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('parsePdfWithMarker', () => {
  it('returns parsed markdown on success', async () => {
    const mockProcess = { stdout: { on: jest.fn() }, stderr: { on: jest.fn() }, on: jest.fn() };
    mockSpawn.mockReturnValue(mockProcess as any);
    const promise = parsePdfWithMarker('/test.pdf', '/output');
    const stdoutCallback = mockProcess.stdout.on.mock.calls.find((c: any[]) => c[0] === 'data')![1];
    stdoutCallback(Buffer.from('# Parsed Content\n\nSome text'));
    const closeCallback = mockProcess.on.mock.calls.find((c: any[]) => c[0] === 'close')![1];
    closeCallback(0);
    const result = await promise;
    expect(result).toBe('# Parsed Content\n\nSome text');
  });

  it('rejects on non-zero exit code', async () => {
    const mockProcess = { stdout: { on: jest.fn() }, stderr: { on: jest.fn() }, on: jest.fn() };
    mockSpawn.mockReturnValue(mockProcess as any);
    const promise = parsePdfWithMarker('/test.pdf', '/output');
    const stderrCallback = mockProcess.stderr.on.mock.calls.find((c: any[]) => c[0] === 'data')![1];
    stderrCallback(Buffer.from('Error occurred'));
    const closeCallback = mockProcess.on.mock.calls.find((c: any[]) => c[0] === 'close')![1];
    closeCallback(1);
    await expect(promise).rejects.toThrow('PDF parsing failed');
  });
});
