'use strict';

const {
  COLOR_MAP,
  isValidPattern,
  isDuplicateRule,
  groupTabsByTitle,
  countTabsByGroup,
  findMergeableGroups,
} = require('../utils');

// ─────────────────────────────────────────────────────────────────────────────
// COLOR_MAP
// ─────────────────────────────────────────────────────────────────────────────
describe('COLOR_MAP', () => {
  test('contains all 8 Chrome group colors', () => {
    const keys = Object.keys(COLOR_MAP);
    expect(keys).toHaveLength(8);
    ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'].forEach(color => {
      expect(COLOR_MAP).toHaveProperty(color);
    });
  });

  test('each entry has chrome and hex fields', () => {
    Object.values(COLOR_MAP).forEach(entry => {
      expect(entry).toHaveProperty('chrome');
      expect(entry).toHaveProperty('hex');
      expect(entry.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidPattern
// ─────────────────────────────────────────────────────────────────────────────
describe('isValidPattern', () => {
  test.each([
    ['github.com',       true],
    ['sub.domain.co.uk', true],
    ['my-site.org',      true],
    ['a.io',             true],
  ])('returns true for valid domain %s', (input, expected) => {
    expect(isValidPattern(input)).toBe(expected);
  });

  test.each([
    ['',                   false],
    [null,                 false],
    [undefined,            false],
    ['   ',                false],
    ['github',             false],   // no TLD
    ['http://github.com',  false],   // has protocol
    ['github.com/path',    false],   // has path
    ['not a domain',       false],   // spaces
  ])('returns false for invalid input %s', (input, expected) => {
    expect(isValidPattern(input)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isDuplicateRule
// ─────────────────────────────────────────────────────────────────────────────
describe('isDuplicateRule', () => {
  const rules = [
    { pattern: 'github.com',   groupName: 'Dev' },
    { pattern: 'youtube.com',  groupName: 'Video' },
  ];

  test('returns false for empty rules array', () => {
    expect(isDuplicateRule([], 'github.com', 'Dev')).toBe(false);
  });

  test('returns true when pattern matches exactly', () => {
    expect(isDuplicateRule(rules, 'github.com', 'NewGroup')).toBe(true);
  });

  test('returns true when groupName matches exactly', () => {
    expect(isDuplicateRule(rules, 'newsite.com', 'Dev')).toBe(true);
  });

  test('matching is case-insensitive for pattern', () => {
    expect(isDuplicateRule(rules, 'GITHUB.COM', 'UniqueGroup')).toBe(true);
  });

  test('matching is case-insensitive for groupName', () => {
    expect(isDuplicateRule(rules, 'newsite.com', 'dev')).toBe(true);
  });

  test('returns false when neither pattern nor groupName match', () => {
    expect(isDuplicateRule(rules, 'slack.com', 'Work')).toBe(false);
  });

  test('respects excludeIndex — allows editing own rule', () => {
    // Editing rule at index 0 to have same pattern/name should NOT be duplicate
    expect(isDuplicateRule(rules, 'github.com', 'Dev', 0)).toBe(false);
  });

  test('excludeIndex still catches duplicate with OTHER rules', () => {
    // Editing index 0 but now using youtube.com (belongs to index 1)
    expect(isDuplicateRule(rules, 'youtube.com', 'UniqueGroup', 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupTabsByTitle
// ─────────────────────────────────────────────────────────────────────────────
describe('groupTabsByTitle', () => {
  test('returns empty object for empty array', () => {
    expect(groupTabsByTitle([])).toEqual({});
  });

  test('indexes groups by title', () => {
    const groups = [
      { id: 1, title: 'Dev',   windowId: 10 },
      { id: 2, title: 'Video', windowId: 10 },
      { id: 3, title: 'Dev',   windowId: 20 },
    ];
    const result = groupTabsByTitle(groups);
    expect(result['Dev']).toHaveLength(2);
    expect(result['Video']).toHaveLength(1);
  });

  test('ignores groups with no title', () => {
    const groups = [
      { id: 1, title: '',        windowId: 10 },
      { id: 2, title: undefined, windowId: 10 },
      { id: 3, title: 'Dev',     windowId: 10 },
    ];
    const result = groupTabsByTitle(groups);
    expect(Object.keys(result)).toEqual(['Dev']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// countTabsByGroup
// ─────────────────────────────────────────────────────────────────────────────
describe('countTabsByGroup', () => {
  test('returns empty object for empty array', () => {
    expect(countTabsByGroup([])).toEqual({});
  });

  test('counts tabs per group correctly', () => {
    const tabs = [
      { id: 1, groupId: 10 },
      { id: 2, groupId: 10 },
      { id: 3, groupId: 20 },
    ];
    const result = countTabsByGroup(tabs);
    expect(result[10]).toBe(2);
    expect(result[20]).toBe(1);
  });

  test('ignores ungrouped tabs (groupId === -1)', () => {
    const tabs = [
      { id: 1, groupId: -1 },
      { id: 2, groupId: 10 },
    ];
    const result = countTabsByGroup(tabs);
    expect(result[-1]).toBeUndefined();
    expect(result[10]).toBe(1);
  });

  test('ignores tabs with null/undefined groupId', () => {
    const tabs = [
      { id: 1, groupId: null },
      { id: 2, groupId: undefined },
      { id: 3, groupId: 10 },
    ];
    const result = countTabsByGroup(tabs);
    expect(Object.keys(result)).toEqual(['10']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findMergeableGroups
// ─────────────────────────────────────────────────────────────────────────────
describe('findMergeableGroups', () => {
  test('returns empty array when no groups', () => {
    expect(findMergeableGroups([])).toEqual([]);
  });

  test('returns empty array when all groups are in the same window', () => {
    const groups = [
      { id: 1, title: 'Dev',   windowId: 10 },
      { id: 2, title: 'Video', windowId: 10 },
    ];
    expect(findMergeableGroups(groups)).toEqual([]);
  });

  test('returns group title when same title appears in multiple windows', () => {
    const groups = [
      { id: 1, title: 'Dev', windowId: 10 },
      { id: 2, title: 'Dev', windowId: 20 },
    ];
    const result = findMergeableGroups(groups);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Dev');
    expect(result[0][1]).toHaveLength(2);
  });

  test('returns only titles that span multiple windows', () => {
    const groups = [
      { id: 1, title: 'Dev',   windowId: 10 },
      { id: 2, title: 'Dev',   windowId: 20 },
      { id: 3, title: 'Video', windowId: 10 }, // only in window 10
    ];
    const result = findMergeableGroups(groups);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Dev');
  });

  test('handles three windows for the same title', () => {
    const groups = [
      { id: 1, title: 'Dev', windowId: 10 },
      { id: 2, title: 'Dev', windowId: 20 },
      { id: 3, title: 'Dev', windowId: 30 },
    ];
    const result = findMergeableGroups(groups);
    expect(result).toHaveLength(1);
    expect(result[0][1]).toHaveLength(3);
  });
});
