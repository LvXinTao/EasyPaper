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

// Mock Web API globals for Next.js route handlers in jsdom environment
// These are required for testing API routes that use Request/Response
// Even in Node 20+, jsdom environment may not have these properly configured

// @ts-expect-error Mocking Request for jsdom
globalThis.Request = class Request {
  method: string;
  url: string;
  headers: Headers;
  private _body: string | null;

  constructor(input: string | { url: string }, init?: { method?: string; headers?: Record<string, string> | Headers; body?: string }) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers || {});
    this._body = init?.body || null;
  }

  async json() {
    return this._body ? JSON.parse(this._body) : {};
  }

  async text() {
    return this._body || '';
  }
};

// @ts-expect-error Mocking Response for jsdom
globalThis.Response = class Response {
  status: number;
  headers: Headers;
  ok: boolean;
  private _body: unknown;

  constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> | Headers }) {
    this._body = body;
    this.status = init?.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers || {});
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }

  static json(data: unknown, init?: { status?: number; headers?: Record<string, string> | Headers }) {
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers || {});
    if (!headers.get('content-type')) {
      headers.set('content-type', 'application/json');
    }
    return new Response(JSON.stringify(data), { ...init, headers });
  }
};

// @ts-expect-error Mocking Headers for jsdom
globalThis.Headers = class Headers {
  private _map: Map<string, string>;

  constructor(init?: Record<string, string> | Iterable<[string, string]>) {
    this._map = new Map();
    if (init) {
      if (typeof init !== 'object') return;
      // Check if it's iterable
      try {
        for (const [key, value] of init as Iterable<[string, string]>) {
          this._map.set(key.toLowerCase(), value);
        }
      } catch {
        for (const [key, value] of Object.entries(init as Record<string, string>)) {
          this._map.set(key.toLowerCase(), value);
        }
      }
    }
  }

  get(name: string) {
    return this._map.get(name.toLowerCase()) || null;
  }

  set(name: string, value: string) {
    this._map.set(name.toLowerCase(), value);
  }

  append(name: string, value: string) {
    const existing = this._map.get(name.toLowerCase());
    this._map.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
  }

  delete(name: string) {
    this._map.delete(name.toLowerCase());
  }

  has(name: string) {
    return this._map.has(name.toLowerCase());
  }

  forEach(callback: (value: string, key: string) => void) {
    this._map.forEach((value, key) => callback(value, key));
  }

  entries() {
    return this._map.entries();
  }

  keys() {
    return this._map.keys();
  }

  values() {
    return this._map.values();
  }

  [Symbol.iterator]() {
    return this._map.entries();
  }
};

if (typeof globalThis.TextEncoder === 'undefined') {
  // @ts-expect-error Mocking TextEncoder
  globalThis.TextEncoder = class TextEncoder {
    encode(input: string) {
      return Buffer.from(input);
    }
  };
}

if (typeof globalThis.TextDecoder === 'undefined') {
  // @ts-expect-error Mocking TextDecoder
  globalThis.TextDecoder = class TextDecoder {
    decode(input?: Buffer) {
      return input?.toString() || '';
    }
  };
}

// Mock ReadableStream for Node.js < 20 and jsdom environment
if (typeof globalThis.ReadableStream === 'undefined') {
  // @ts-expect-error Mocking ReadableStream
  globalThis.ReadableStream = class ReadableStream {
    private _chunks: Uint8Array[] = [];
    private _closed = false;

    constructor(underlyingSource?: { start?: (controller: unknown) => void }) {
      if (underlyingSource?.start) {
        const controller = {
          enqueue: (chunk: Uint8Array) => {
            this._chunks.push(chunk);
          },
          close: () => {
            this._closed = true;
          },
          error: (e: Error) => {
            throw e;
          },
        };
        underlyingSource.start(controller);
      }
    }

    getReader() {
      const chunks = this._chunks;
      let index = 0;
      return {
        read: async () => {
          if (index < chunks.length) {
            return { done: false, value: chunks[index++] };
          }
          return { done: true, value: undefined };
        },
      };
    }
  };
}

// Mock next/server NextResponse for API route tests
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => data,
    }),
  },
}));