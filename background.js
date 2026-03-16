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
  if (!tab.url) return;

  // Check each rule in dynamicRules
  for (const rule of dynamicRules) {
    let urlObj;
    try {
      urlObj = new URL(tab.url);
    } catch {}
    const host = urlObj?.hostname || "";

    if (host.endsWith(rule.pattern)) {
      console.log(`Tab ${tab.id} with URL ${tab.url} matches rule: ${rule.pattern}`);

      try {
        // Find or create the group for this rule
        const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
        const existingGroup = groups.find((g) => g.title === rule.groupName);

        if (existingGroup) {
          // Add the tab to an existing group
          await chrome.tabs.group({ groupId: existingGroup.id, tabIds: tab.id });
          console.log(`Tab ${tab.id} added to existing group "${existingGroup.title}"`);
        } else {
          // Create a new group for this tab
          const newGroupId = await new Promise((resolve, reject) => {
            chrome.tabs.group({ tabIds: tab.id }, (groupId) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(groupId);
              }
            });
          });

          if (chrome.tabGroups && typeof chrome.tabGroups.update === "function") {
            const groupColor = rule.color || "blue";
            await new Promise((resolve, reject) => {
              chrome.tabGroups.update(newGroupId, { title: rule.groupName, color: groupColor }, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            });
            console.log(`Created new group "${rule.groupName}" with ID ${newGroupId} and color ${groupColor}`);
          } else {
            console.warn("tabGroups.update is unavailable; can't set group title or color.");
          }
        }
      } catch (error) {
        if (error.message.includes("Tabs cannot be edited right now") && retryCount < 3) {
          console.warn(`Retrying to group tab ${tab.id} due to temporary lock... (${retryCount + 1}/3)`);
          setTimeout(() => groupTab(tab, retryCount + 1), 500);
        } else if (error.message.includes("No group with id")) {
          console.error(`Group ID invalid or deleted: ${error.message}`);
        } else {
          console.error(`Error grouping tab ${tab.id}:`, error.message);
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
