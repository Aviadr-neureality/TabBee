'use strict';

/**
 * Tests for background.js
 *
 * The module is re-required before each test to get a fresh dynamicRules
 * state. The Chrome global mock is set up in jest.setup.js and cleared
 * automatically between tests (clearMocks: true in jest.config.js).
 */

let bg;

beforeEach(() => {
  jest.resetModules();
  bg = require('../background');
});

// ─────────────────────────────────────────────────────────────────────────────
// getTabGroups
// ─────────────────────────────────────────────────────────────────────────────
describe('getTabGroups', () => {
  test('returns groups when chrome.tabGroups.query is available', async () => {
    const fakeGroups = [{ id: 1, title: 'Dev', windowId: 10 }];
    // getTabGroups uses the callback form of chrome.tabGroups.query
    chrome.tabGroups.query.mockImplementation((query, callback) => {
      if (callback) { callback(fakeGroups); return; }
      return Promise.resolve(fakeGroups);
    });

    const result = await bg.getTabGroups();
    expect(result).toEqual(fakeGroups);
  });

  test('returns [] when chrome.tabGroups is not available', async () => {
    const savedTabGroups = chrome.tabGroups;
    delete chrome.tabGroups;

    const result = await bg.getTabGroups();
    expect(result).toEqual([]);

    chrome.tabGroups = savedTabGroups;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupTab — early-exit guards
// ─────────────────────────────────────────────────────────────────────────────
describe('groupTab — early exits', () => {
  test('returns early for null tab', async () => {
    await bg.groupTab(null);
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test('returns early when tab has no id', async () => {
    await bg.groupTab({ url: 'https://github.com' });
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test('returns early when tab has no url', async () => {
    await bg.groupTab({ id: 1 });
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test.each([
    'chrome://newtab/',
    'chrome://settings/',
    'chrome-extension://abc123/options.html',
    'about:blank',
    'about:newtab',
  ])('returns early for internal URL: %s', async (url) => {
    await bg.groupTab({ id: 1, url });
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test('returns early when chrome.tabs.get rejects (tab no longer exists)', async () => {
    chrome.tabs.get.mockRejectedValue(new Error('No tab with id: 1'));

    await expect(
      bg.groupTab({ id: 1, url: 'https://github.com' })
    ).resolves.toBeUndefined();

    expect(chrome.tabGroups.query).not.toHaveBeenCalled();
  });

  test('returns early when freshTab.status is "loading"', async () => {
    chrome.tabs.get.mockResolvedValue({
      id: 1,
      url: 'https://github.com',
      status: 'loading',
      windowId: 10,
    });

    await bg.groupTab({ id: 1, url: 'https://github.com' });
    expect(chrome.tabGroups.query).not.toHaveBeenCalled();
  });

  test('returns early when freshTab has no url (redirected to blank)', async () => {
    chrome.tabs.get.mockResolvedValue({ id: 1, url: '', status: 'complete', windowId: 10 });

    await bg.groupTab({ id: 1, url: 'https://github.com' });
    expect(chrome.tabGroups.query).not.toHaveBeenCalled();
  });

  test('returns early when no rules match the tab URL', async () => {
    bg._setRules([{ pattern: 'youtube.com', groupName: 'Video', color: 'red' }]);
    chrome.tabs.get.mockResolvedValue({
      id: 1, url: 'https://github.com', status: 'complete', windowId: 10,
    });

    await bg.groupTab({ id: 1, url: 'https://github.com' });
    expect(chrome.tabs.group).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupTab — adding to an EXISTING group
// ─────────────────────────────────────────────────────────────────────────────
describe('groupTab — adds tab to existing group', () => {
  beforeEach(() => {
    bg._setRules([{ pattern: 'github.com', groupName: 'Dev', color: 'blue' }]);
    chrome.tabs.get.mockResolvedValue({
      id: 5, url: 'https://github.com/foo', status: 'complete', windowId: 10,
    });
    chrome.tabGroups.query.mockResolvedValue([
      { id: 42, title: 'Dev', windowId: 10 },
    ]);
  });

  test('calls chrome.tabs.group with the existing groupId', async () => {
    await bg.groupTab({ id: 5, url: 'https://github.com/foo' });
    expect(chrome.tabs.group).toHaveBeenCalledWith({ groupId: 42, tabIds: 5 });
  });

  test('does NOT call chrome.tabGroups.update (group already exists)', async () => {
    await bg.groupTab({ id: 5, url: 'https://github.com/foo' });
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupTab — creating a NEW group
// ─────────────────────────────────────────────────────────────────────────────
describe('groupTab — creates a new group', () => {
  beforeEach(() => {
    bg._setRules([{ pattern: 'github.com', groupName: 'Dev', color: 'purple' }]);
    // First call: initial tab fetch (no groupId yet).
    // Second call: re-fetch after chrome.tabs.group — Chrome has now assigned groupId 77.
    chrome.tabs.get
      .mockResolvedValueOnce({ id: 7, url: 'https://github.com/bar', status: 'complete', windowId: 10 })
      .mockResolvedValue({ id: 7, url: 'https://github.com/bar', status: 'complete', windowId: 10, groupId: 77 });
    // No existing groups in this window
    chrome.tabGroups.query.mockResolvedValue([]);
    chrome.tabs.group.mockResolvedValue(77);
  });

  test('creates a new group by calling chrome.tabs.group with only tabIds', async () => {
    await bg.groupTab({ id: 7, url: 'https://github.com/bar' });
    expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: 7 });
  });

  test('calls chrome.tabGroups.update with the rule name and color', async () => {
    await bg.groupTab({ id: 7, url: 'https://github.com/bar' });
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(77, { title: 'Dev', color: 'purple' });
  });

  test('defaults to color "blue" when rule has no color', async () => {
    bg._setRules([{ pattern: 'github.com', groupName: 'Dev' }]);
    await bg.groupTab({ id: 7, url: 'https://github.com/bar' });
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(77, { title: 'Dev', color: 'blue' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupTab — error handling
// ─────────────────────────────────────────────────────────────────────────────
describe('groupTab — error handling', () => {
  beforeEach(() => {
    bg._setRules([{ pattern: 'github.com', groupName: 'Dev', color: 'blue' }]);
    chrome.tabs.get.mockResolvedValue({
      id: 9, url: 'https://github.com', status: 'complete', windowId: 10,
    });
    chrome.tabGroups.query.mockResolvedValue([]);
  });

  test('retries when "Tabs cannot be edited right now" with retryCount < 3', async () => {
    jest.useFakeTimers();
    // Fail with the lock error on the promise-based group call (existing-group path)
    chrome.tabGroups.query.mockResolvedValue([{ id: 11, title: 'Dev', windowId: 10 }]);
    chrome.tabs.group.mockRejectedValue(new Error('Tabs cannot be edited right now'));
    // tabs.get needs to resolve for every retry attempt
    chrome.tabs.get.mockResolvedValue({
      id: 9, url: 'https://github.com', status: 'complete', windowId: 10,
    });

    await bg.groupTab({ id: 9, url: 'https://github.com' }, 0);

    // One call so far; the retry is scheduled via setTimeout
    expect(chrome.tabs.get).toHaveBeenCalledTimes(1);

    // Advance timers and flush the microtask queue for the retry's async work
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve(); // flush nested promises

    // tabs.get should have been called a second time by the retry
    expect(chrome.tabs.get).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  test('does not retry when retryCount >= 3', async () => {
    jest.useFakeTimers();
    chrome.tabGroups.query.mockResolvedValue([{ id: 11, title: 'Dev', windowId: 10 }]);
    chrome.tabs.group.mockRejectedValue(new Error('Tabs cannot be edited right now'));
    chrome.tabs.get.mockResolvedValue({
      id: 9, url: 'https://github.com', status: 'complete', windowId: 10,
    });

    await bg.groupTab({ id: 9, url: 'https://github.com' }, 3);

    jest.runAllTimers();
    await Promise.resolve();

    // No retry — tabs.get called only once
    expect(chrome.tabs.get).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test.each([
    'No tab with id: 9',
    'Tab is not in the expected window',
    'Cannot access contents of url',
  ])('handles transition error gracefully: "%s"', async (msg) => {
    chrome.tabGroups.query.mockResolvedValue([{ id: 11, title: 'Dev', windowId: 10 }]);
    chrome.tabs.group.mockRejectedValue(new Error(msg));

    await expect(
      bg.groupTab({ id: 9, url: 'https://github.com' })
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleTabUpdate
// ─────────────────────────────────────────────────────────────────────────────
describe('handleTabUpdate', () => {
  // handleTabUpdate calls the module-internal groupTab directly, so we verify
  // its side effects (chrome.tabs.get called) rather than spy on the export.

  test('triggers tab grouping when status is "complete" and URL is present', async () => {
    chrome.tabs.get.mockResolvedValue({
      id: 1, url: 'https://github.com', status: 'complete', windowId: 10,
    });
    const tab = { id: 1, url: 'https://github.com' };

    bg.handleTabUpdate(1, { status: 'complete' }, tab);
    await Promise.resolve(); // flush microtasks

    // groupTab ran → it called chrome.tabs.get to fetch fresh state
    expect(chrome.tabs.get).toHaveBeenCalledWith(1);
  });

  test('does NOT trigger grouping when status is "loading"', async () => {
    const tab = { id: 1, url: 'https://github.com' };

    bg.handleTabUpdate(1, { status: 'loading' }, tab);
    await Promise.resolve();

    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test('does NOT trigger grouping when URL is missing', async () => {
    const tab = { id: 1, url: '' };

    bg.handleTabUpdate(1, { status: 'complete' }, tab);
    await Promise.resolve();

    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _setRules / _getRules
// ─────────────────────────────────────────────────────────────────────────────
describe('_setRules / _getRules', () => {
  test('_setRules updates the internal rules array', () => {
    const rules = [{ pattern: 'slack.com', groupName: 'Work', color: 'green' }];
    bg._setRules(rules);
    expect(bg._getRules()).toEqual(rules);
  });

  test('_setRules with empty array clears rules', () => {
    bg._setRules([{ pattern: 'x.com', groupName: 'X', color: 'blue' }]);
    bg._setRules([]);
    expect(bg._getRules()).toEqual([]);
  });
});
