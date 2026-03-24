// Mock File class for Node.js test environment (Node < 20)
// This file runs before all tests to ensure File is available globally

class MockFile {
  content: Buffer;
  name: string;
  type: string;

  constructor(content: string | Buffer, name: string, options?: { type?: string }) {
    this.content = Buffer.isBuffer(content) ? content : Buffer.from(content);
    this.name = name;
    this.type = options?.type || '';
  }

  get size(): number {
    return this.content.length;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = this.content.buffer.slice(
      this.content.byteOffset,
      this.content.byteOffset + this.content.byteLength
    ) as ArrayBuffer;
    return Promise.resolve(buffer);
  }
}

// Set up global File if not available (Node.js < 20)
if (typeof globalThis.File === 'undefined') {
  // @ts-expect-error Mocking File for Node.js
  globalThis.File = MockFile;
}