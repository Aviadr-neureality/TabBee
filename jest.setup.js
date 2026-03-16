'use strict';

/**
 * Global Chrome API mock injected before every test file.
 *
 * Each API method is a jest.fn(). Default implementations mirror how the
 * real Chrome APIs behave (Promise-based for MV3, callback-based for older
 * patterns used in background.js).
 *
 * Individual tests can override any mock via .mockResolvedValue() /
 * .mockImplementation() etc. — all mocks are cleared between tests
 * automatically (clearMocks: true in jest.config.js).
 */

global.chrome = {
  runtime: {
    lastError: null,
  },

  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },

  tabs: {
    get: jest.fn().mockResolvedValue(null),
    query: jest.fn((query, callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    }),
    group: jest.fn((options, callback) => {
      if (callback) {
        callback(99);
        return;
      }
      return Promise.resolve(99);
    }),
    move: jest.fn().mockResolvedValue({}),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onCreated: {
      addListener: jest.fn(),
    },
    onAttached: {
      addListener: jest.fn(),
    },
  },

  tabGroups: {
    query: jest.fn().mockResolvedValue([]),
    update: jest.fn((id, props, callback) => {
      if (callback) {
        callback();
        return;
      }
      return Promise.resolve();
    }),
  },
};
