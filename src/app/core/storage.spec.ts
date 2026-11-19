import { TestBed } from '@angular/core/testing';
import { STORAGE, WebJsonStorage } from './storage';

/** In-memory Web Storage; each method can be made to throw like a blocked or full localStorage. */
class FakeStorage implements Storage {
  readonly items = new Map<string, string>();
  failWith: Error | null = null;

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    this.throwIfFailing();
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.throwIfFailing();
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.throwIfFailing();
    this.items.delete(key);
  }

  private throwIfFailing(): void {
    if (this.failWith) {
      throw this.failWith;
    }
  }
}

describe('WebJsonStorage', () => {
  const key = 'prepround.test.v1';
  let backend: FakeStorage;
  let storage: WebJsonStorage;

  beforeEach(() => {
    backend = new FakeStorage();
    storage = new WebJsonStorage(() => backend);
  });

  it('stores a value as JSON and reads it back', () => {
    const value = { ids: ['q-1', 'q-2'], score: 0.5 };

    expect(storage.set(key, value)).toBe(true);

    expect(backend.items.get(key)).toBe(JSON.stringify(value));
    expect(storage.get<typeof value>(key)).toEqual(value);
  });

  it('returns null for a missing key', () => {
    expect(storage.get(key)).toBeNull();
  });

  it('returns null for broken JSON instead of throwing', () => {
    backend.items.set(key, '{"ids": [');

    expect(storage.get(key)).toBeNull();
  });

  it('removes a value', () => {
    storage.set(key, [1, 2]);

    storage.remove(key);

    expect(storage.get(key)).toBeNull();
    expect(backend.items.has(key)).toBe(false);
  });

  it('reports a failed write, e.g. a full quota, as false', () => {
    backend.failWith = new DOMException('The quota has been exceeded.', 'QuotaExceededError');

    expect(storage.set(key, { a: 1 })).toBe(false);
  });

  it('reports a value that cannot be serialized as false', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(storage.set(key, cyclic)).toBe(false);
    expect(backend.items.has(key)).toBe(false);
  });

  it('keeps working when every storage call throws', () => {
    backend.items.set(key, '"kept"');
    backend.failWith = new DOMException('The operation is insecure.', 'SecurityError');

    expect(storage.get(key)).toBeNull();
    expect(storage.set(key, 'x')).toBe(false);
    expect(() => storage.remove(key)).not.toThrow();
  });

  it('keeps working when merely accessing localStorage throws (site data blocked)', () => {
    const blocked = new WebJsonStorage(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });

    expect(blocked.get(key)).toBeNull();
    expect(blocked.set(key, 'x')).toBe(false);
    expect(() => blocked.remove(key)).not.toThrow();
  });
});

describe('STORAGE', () => {
  afterEach(() => localStorage.clear());

  it('is backed by localStorage by default', () => {
    const storage = TestBed.inject(STORAGE);

    expect(storage.set('prepround.test.v1', { a: 1 })).toBe(true);

    expect(localStorage.getItem('prepround.test.v1')).toBe('{"a":1}');
    expect(storage.get('prepround.test.v1')).toEqual({ a: 1 });
  });
});
