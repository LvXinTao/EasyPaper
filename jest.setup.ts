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

// Mock Web API globals for Next.js route handlers
// These are required for testing API routes that use Request/Response
if (typeof globalThis.Request === 'undefined') {
  // @ts-expect-error Mocking Request for Node.js
  globalThis.Request = class Request {
    method: string;
    url: string;
    headers: Map<string, string>;
    private _body: string | null;

    constructor(input: string | { url: string }, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this._body = init?.body || null;
    }

    async json() {
      return this._body ? JSON.parse(this._body) : {};
    }

    async text() {
      return this._body || '';
    }
  };
}

if (typeof globalThis.Response === 'undefined') {
  // @ts-expect-error Mocking Response for Node.js
  globalThis.Response = class Response {
    status: number;
    headers: Headers;
    ok: boolean;
    private _body: unknown;

    constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> | Headers }) {
      this._body = body;
      this.status = init?.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      if (init?.headers instanceof Headers) {
        this.headers = init.headers;
      } else {
        this.headers = new Headers(init?.headers || {});
      }
    }

    async json() {
      return this._body;
    }

    async text() {
      return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
    }

    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> | Headers }) {
      const headers = init?.headers ? new Headers(init.headers) : new Headers();
      if (!headers.get('content-type')) {
        headers.set('content-type', 'application/json');
      }
      return new Response(data, { ...init, headers });
    }
  };
}

if (typeof globalThis.Headers === 'undefined') {
  // @ts-expect-error Mocking Headers for Node.js
  globalThis.Headers = class Headers {
    private _map: Map<string, string>;

    constructor(init?: Record<string, string> | Iterable<[string, string]>) {
      this._map = new Map();
      if (init) {
        // Check if it's iterable (like Headers or Map)
        const isIterable = typeof (init as Iterable<[string, string]>)[Symbol.iterator] === 'function';
        if (isIterable) {
          for (const [key, value] of init as Iterable<[string, string]>) {
            this._map.set(key.toLowerCase(), value);
          }
        } else {
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
}

if (typeof globalThis.TextEncoder === 'undefined') {
  // @ts-expect-error Mocking TextEncoder for Node.js
  globalThis.TextEncoder = class TextEncoder {
    encode(input: string) {
      return Buffer.from(input);
    }
  };
}

if (typeof globalThis.TextDecoder === 'undefined') {
  // @ts-expect-error Mocking TextDecoder for Node.js
  globalThis.TextDecoder = class TextDecoder {
    decode(input?: Buffer) {
      return input?.toString() || '';
    }
  };
}