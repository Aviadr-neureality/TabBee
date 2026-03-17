/********************************
 * 1. Load rules from storage
 ********************************/
let dynamicRules = [];

// On extension startup, load rules once
chrome.storage.local.get(["groupingRules"], (result) => {
  dynamicRules = result.groupingRules || [];
});
chrome.tabs.query({}, tabs => tabs.forEach(groupTab));
// Listen for storage changes and update dynamicRules in real time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.groupingRules) {
    dynamicRules = changes.groupingRules.newValue || [];
    console.log("Updated grouping rules:", dynamicRules);
  }
});

/********************************
 * 2. Access tabGroups safely
 ********************************/
function getTabGroups() {
  return new Promise((resolve) => {
    if (chrome.tabGroups && typeof chrome.tabGroups.query === "function") {
      chrome.tabGroups.query({}, resolve);
    } else {
      resolve([]); // Return empty if tabGroups not available
    }
  });
}

/********************************
 * 3. Core grouping logic
 ********************************/
async function groupTab(tab, retryCount = 0) {
  if (!tab || !tab.id || !tab.url) return;

  // Skip internal Chrome pages – they can't be grouped and grouping them
  // during a split-view transition is the main source of crashes.
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:") ||
    tab.url === "about:blank"
  ) {
    return;
  }

  // Always fetch fresh tab state before touching groups.
  // During split-view Chrome moves tabs between windows; the tab object
  // passed by the event may already be stale (wrong windowId / status).
  let freshTab;
  try {
    freshTab = await chrome.tabs.get(tab.id);
  } catch {
    // Tab no longer exists (closed mid-flight)
    return;
  }

  // Only group fully-loaded tabs; skip if the tab is still transitioning
  // between windows (status will be "loading" while Chrome moves it).
  if (!freshTab.url || freshTab.status !== "complete") return;

  // Check each rule in dynamicRules
  for (const rule of dynamicRules) {
    let urlObj;
    try {
      urlObj = new URL(freshTab.url);
    } catch {}
    const host = urlObj?.hostname || "";

    if (host.endsWith(rule.pattern)) {
      console.log(`Tab ${freshTab.id} with URL ${freshTab.url} matches rule: ${rule.pattern}`);

      try {
        // Find or create the group for this rule in the tab's *current* window
        const groups = await chrome.tabGroups.query({ windowId: freshTab.windowId });
        const existingGroup = groups.find((g) => g.title === rule.groupName);

        if (existingGroup) {
          // Add the tab to an existing group
          await chrome.tabs.group({ groupId: existingGroup.id, tabIds: freshTab.id });
          console.log(`Tab ${freshTab.id} added to existing group "${existingGroup.title}"`);
        } else {
          // Create a new group, then name and colour it
          const newGroupId = await chrome.tabs.group({ tabIds: freshTab.id });
          await chrome.tabGroups.update(newGroupId, {
            title: rule.groupName,
            color: rule.color || "blue",
          });
          console.log(`Created new group "${rule.groupName}" (id ${newGroupId}, color ${rule.color || "blue"})`);
        }
      } catch (error) {
        const msg = error.message || "";
        if (msg.includes("Tabs cannot be edited right now") && retryCount < 3) {
          console.warn(`Retrying to group tab ${freshTab.id} due to temporary lock... (${retryCount + 1}/3)`);
          setTimeout(() => groupTab(freshTab, retryCount + 1), 500);
        } else if (msg.includes("No group with id")) {
          console.error(`Group ID invalid or deleted: ${msg}`);
        } else if (
          msg.includes("No tab with id") ||
          msg.includes("Cannot access contents of url") ||
          msg.includes("Tab is not in the expected window")
        ) {
          // Tab was moved or closed during the split-view transition – safe to ignore
          console.warn(`Skipping tab ${freshTab.id} due to window transition: ${msg}`);
        } else {
          console.error(`Error grouping tab ${freshTab.id}:`, msg);
        }
      }

      break; // Stop at the first matching rule
    }
  }
}

/********************************
 * 4. Listen to tab events
 ********************************/
function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url) {
    groupTab(tab);
  }
}

// 4A: Fired when a tab is updated
chrome.tabs.onUpdated.addListener(handleTabUpdate);

// 4B: Fired when a tab is created
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.status === "complete" && tab.url) {
    groupTab(tab);
  } else {
    // If not loaded, wait for it to complete
    const listener = (updatedTabId, changeInfo, updatedTab) => {
      if (
        updatedTabId === tab.id &&
        changeInfo.status === "complete" &&
        updatedTab.url
      ) {
        groupTab(updatedTab);
        chrome.tabs.onUpdated.removeListener(listener);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  }
});

// 4C: Fired when a tab is moved to a different window (e.g. split-view).
// Re-apply grouping rules in the new window once Chrome settles.
chrome.tabs.onAttached.addListener(async (tabId) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && tab.status === "complete") {
      groupTab(tab);
    }
  } catch {
    // Tab may not be ready yet; the subsequent onUpdated event will cover it
  }
});

// ---------------------------------------------------------------------------
// Node.js / Jest exports — no-op in the browser service-worker context
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    groupTab,
    handleTabUpdate,
    getTabGroups,
    /** Test helper: replace the in-memory rules array. */
    _setRules: (rules) => { dynamicRules = rules; },
    /** Test helper: read the current rules array. */
    _getRules: () => dynamicRules,
  };
}
