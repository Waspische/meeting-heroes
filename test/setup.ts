import { vi } from 'vitest';

// In-memory mock for chrome.storage.local
const store: Record<string, any> = {};

const chromeStorageMock = {
  local: {
    get: vi.fn((keys: string | string[] | Record<string, any>, callback?: (result: Record<string, any>) => void) => {
      let result: Record<string, any> = {};
      if (typeof keys === 'string') {
        result[keys] = store[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(k => { result[k] = store[k]; });
      } else if (keys && typeof keys === 'object') {
        Object.keys(keys).forEach(k => { result[k] = store[k] !== undefined ? store[k] : keys[k]; });
      } else {
        result = { ...store };
      }
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, any>, callback?: () => void) => {
      Object.assign(store, items);
      if (callback) callback();
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[], callback?: () => void) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach(k => delete store[k]);
      if (callback) callback();
      return Promise.resolve();
    }),
    clear: vi.fn((callback?: () => void) => {
      Object.keys(store).forEach(k => delete store[k]);
      if (callback) callback();
      return Promise.resolve();
    })
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

const chromeRuntimeMock = {
  sendMessage: vi.fn((_message: any, callback?: (response: any) => void) => {
    if (callback) callback({ success: true, data: [] });
    return Promise.resolve({ success: true, data: [] });
  }),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  onInstalled: {
    addListener: vi.fn()
  },
  lastError: null
};

(globalThis as any).chrome = {
  storage: chromeStorageMock,
  runtime: chromeRuntimeMock,
  tabs: {
    query: vi.fn().mockResolvedValue([])
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
    insertCSS: vi.fn().mockResolvedValue([])
  }
};

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

// Mock localStorage
const localStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStore[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete localStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStore).forEach(k => delete localStore[k]); }),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
