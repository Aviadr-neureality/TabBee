/**
 * utils.js — Pure utility functions shared by background.js, options.js, and tests.
 *
 * This file uses a UMD-style export so it works both as a plain browser <script>
 * (functions become globals) and as a CommonJS module (require('./utils')).
 */
'use strict';

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

const COLOR_MAP = {
  blue:   { chrome: 'blue',   hex: '#4285f4' },
  red:    { chrome: 'red',    hex: '#ea4335' },
  yellow: { chrome: 'yellow', hex: '#fbbc04' },
  green:  { chrome: 'green',  hex: '#34a853' },
  pink:   { chrome: 'pink',   hex: '#ff6d9a' },
  purple: { chrome: 'purple', hex: '#9c27b0' },
  cyan:   { chrome: 'cyan',   hex: '#00bcd4' },
  orange: { chrome: 'orange', hex: '#ff9800' },
};

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

/**
 * Returns true when `pattern` looks like a valid domain (e.g. "github.com").
 * Rejects empty strings, plain hostnames without a TLD, and full URLs.
 * @param {string} pattern
 * @returns {boolean}
 */
function isValidPattern(pattern) {
  if (!pattern || pattern.trim().length === 0) return false;
  const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return domainRegex.test(pattern.trim());
}

/**
 * Returns true when a rule with the same `pattern` OR the same `groupName`
 * already exists in `rules`, ignoring the entry at `excludeIndex` (used when
 * editing an existing rule).
 * @param {Array}  rules
 * @param {string} pattern
 * @param {string} groupName
 * @param {number} [excludeIndex=-1]
 * @returns {boolean}
 */
function isDuplicateRule(rules, pattern, groupName, excludeIndex = -1) {
  return rules.some((rule, index) =>
    index !== excludeIndex && (
      rule.pattern.toLowerCase()   === pattern.toLowerCase()   ||
      rule.groupName.toLowerCase() === groupName.toLowerCase()
    )
  );
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

/**
 * Indexes `allGroups` by their title.
 * Groups without a title are skipped.
 * @param {chrome.tabGroups.TabGroup[]} allGroups
 * @returns {Object.<string, chrome.tabGroups.TabGroup[]>}
 */
function groupTabsByTitle(allGroups) {
  const result = {};
  for (const group of allGroups) {
    if (!group.title) continue;
    if (!result[group.title]) result[group.title] = [];
    result[group.title].push(group);
  }
  return result;
}

/**
 * Returns a map of groupId → number-of-tabs for all grouped tabs.
 * Tabs that are not in any group (groupId === TAB_GROUP_ID_NONE / -1) are ignored.
 * @param {chrome.tabs.Tab[]} allTabs
 * @returns {Object.<number, number>}
 */
function countTabsByGroup(allTabs) {
  const result = {};
  for (const tab of allTabs) {
    if (tab.groupId !== null && tab.groupId !== undefined && tab.groupId !== -1) {
      result[tab.groupId] = (result[tab.groupId] || 0) + 1;
    }
  }
  return result;
}

/**
 * Returns entries from `allGroups` where the same title appears in more than
 * one window — i.e. candidates for merging.
 * @param {chrome.tabGroups.TabGroup[]} allGroups
 * @returns {Array.<[string, chrome.tabGroups.TabGroup[]]>}
 */
function findMergeableGroups(allGroups) {
  const byTitle = groupTabsByTitle(allGroups);
  return Object.entries(byTitle).filter(([, groups]) => {
    const windowIds = new Set(groups.map(g => g.windowId));
    return windowIds.size > 1;
  });
}

// ---------------------------------------------------------------------------
// Export — Node.js (CommonJS) or browser globals
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  // Node.js / Jest
  module.exports = {
    COLOR_MAP,
    isValidPattern,
    isDuplicateRule,
    groupTabsByTitle,
    countTabsByGroup,
    findMergeableGroups,
  };
} else {
  // Browser: `const` declarations don't attach to `window` automatically,
  // so we expose them explicitly via `globalThis`.
  /* global globalThis */
  globalThis.COLOR_MAP = COLOR_MAP;
  globalThis.isValidPattern = isValidPattern;
  globalThis.isDuplicateRule = isDuplicateRule;
  globalThis.groupTabsByTitle = groupTabsByTitle;
  globalThis.countTabsByGroup = countTabsByGroup;
  globalThis.findMergeableGroups = findMergeableGroups;
}
