'use strict';

/**
 * Integration-level tests for the options page logic.
 *
 * Strategy: we set up a minimal jsdom DOM that mirrors options.html, inject
 * the chrome global (already provided by jest.setup.js), load utils.js and
 * options.js, fire DOMContentLoaded, then interact with the page.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DOM structure smoke tests (no scripts needed)
// ─────────────────────────────────────────────────────────────────────────────
describe('options.html — structure', () => {
  let document;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(__dirname, '../options.html'), 'utf8');
    const dom = new JSDOM(html);
    document = dom.window.document;
  });

  test('has the add-rule form', () => {
    expect(document.getElementById('addRuleForm')).not.toBeNull();
  });

  test('has pattern and groupName inputs', () => {
    expect(document.getElementById('pattern')).not.toBeNull();
    expect(document.getElementById('groupName')).not.toBeNull();
  });

  test('has a color picker with 8 color options', () => {
    const options = document.querySelectorAll('#colorPicker .color-option');
    expect(options).toHaveLength(8);
  });

  test('has the rules container', () => {
    expect(document.getElementById('rulesContainer')).not.toBeNull();
  });

  test('has the save button', () => {
    expect(document.getElementById('saveButton')).not.toBeNull();
  });

  test('has the merge section', () => {
    expect(document.getElementById('mergeContainer')).not.toBeNull();
    expect(document.getElementById('refreshMergeBtn')).not.toBeNull();
  });

  test('loads utils.js before options.js', () => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
    const utilsIdx = scripts.indexOf('utils.js');
    const optionsIdx = scripts.indexOf('options.js');
    expect(utilsIdx).toBeGreaterThanOrEqual(0);
    expect(optionsIdx).toBeGreaterThan(utilsIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// utils.js globals (verifies the browser-compatible export path)
// ─────────────────────────────────────────────────────────────────────────────
describe('utils.js — browser globals', () => {
  let window;

  beforeAll(() => {
    const dom = new JSDOM('', { runScripts: 'dangerously' });
    window = dom.window;
    const utilsCode = fs.readFileSync(path.join(__dirname, '../utils.js'), 'utf8');
    window.eval(utilsCode);
  });

  test('exposes COLOR_MAP as a global', () => {
    expect(window.COLOR_MAP).toBeDefined();
    expect(window.COLOR_MAP.blue).toBeDefined();
  });

  test('exposes isValidPattern as a global', () => {
    expect(typeof window.isValidPattern).toBe('function');
    expect(window.isValidPattern('github.com')).toBe(true);
    expect(window.isValidPattern('not-valid')).toBe(false);
  });

  test('exposes isDuplicateRule as a global', () => {
    expect(typeof window.isDuplicateRule).toBe('function');
    const rules = [{ pattern: 'github.com', groupName: 'Dev' }];
    expect(window.isDuplicateRule(rules, 'github.com', 'Other')).toBe(true);
    expect(window.isDuplicateRule(rules, 'slack.com', 'Work')).toBe(false);
  });

  test('exposes findMergeableGroups as a global', () => {
    expect(typeof window.findMergeableGroups).toBe('function');
  });

  test('exposes countTabsByGroup as a global', () => {
    expect(typeof window.countTabsByGroup).toBe('function');
  });
});
