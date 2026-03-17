document.addEventListener("DOMContentLoaded", () => {
  const addRuleForm = document.getElementById("addRuleForm");
  const patternInput = document.getElementById("pattern");
  const groupNameInput = document.getElementById("groupName");
  const rulesContainer = document.getElementById("rulesContainer");
  const emptyState = document.getElementById("emptyState");
  const saveButton = document.getElementById("saveButton");
  const colorPicker = document.getElementById("colorPicker");
  const statusMessage = document.getElementById("statusMessage");

  let groupingRules = [];
  let selectedColor = "blue"; // Default color

  // COLOR_MAP, isValidPattern, isDuplicateRule, findMergeableGroups, countTabsByGroup
  // are provided by utils.js (loaded before this script in options.html).
  const colorMap = COLOR_MAP;

  // Initialize color picker
  function initializeColorPicker() {
    const colorOptions = colorPicker.querySelectorAll(".color-option");
    
    colorOptions.forEach(option => {
      option.addEventListener("click", () => {
        // Remove selected class from all options
        colorOptions.forEach(opt => opt.classList.remove("selected"));
        // Add selected class to clicked option
        option.classList.add("selected");
        selectedColor = option.dataset.color;
      });
    });
  }

  // Show status message
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message show ${isError ? 'status-error' : 'status-success'}`;
    
    setTimeout(() => {
      statusMessage.classList.remove("show");
    }, 3000);
  }

  // Render all rules in the UI
  function renderRules() {
    rulesContainer.innerHTML = "";
    
    if (groupingRules.length === 0) {
      rulesContainer.appendChild(emptyState);
      return;
    }

    groupingRules.forEach((rule, ruleIndex) => {
      const ruleElement = createRuleElement(rule, ruleIndex);
      rulesContainer.appendChild(ruleElement);
    });
  }

  // Create a single rule element
  function createRuleElement(rule, ruleIndex) {
    const ruleDiv = document.createElement("div");
    ruleDiv.className = "rule-item";
    ruleDiv.dataset.index = ruleIndex;

    const ruleInfo = document.createElement("div");
    ruleInfo.className = "rule-info";

    // Pattern display/edit
    const patternDiv = document.createElement("div");
    patternDiv.className = "rule-pattern";
    patternDiv.textContent = rule.pattern;

    // Group info container
    const groupDiv = document.createElement("div");
    groupDiv.className = "rule-group";

    const colorIndicator = document.createElement("div");
    colorIndicator.className = "group-color";
    colorIndicator.style.backgroundColor = colorMap[rule.color]?.hex || colorMap.blue.hex;

    const groupNameSpan = document.createElement("span");
    groupNameSpan.className = "rule-group-name";
    groupNameSpan.textContent = `Group: ${rule.groupName}`;

    groupDiv.appendChild(colorIndicator);
    groupDiv.appendChild(groupNameSpan);

    ruleInfo.appendChild(patternDiv);
    ruleInfo.appendChild(groupDiv);

    // Action buttons container
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "rule-actions";

    const editButton = document.createElement("button");
    editButton.className = "btn btn-edit";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEditRule(ruleDiv, rule, ruleIndex));

    const removeButton = document.createElement("button");
    removeButton.className = "btn btn-danger";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => startDeleteRule(ruleDiv, ruleIndex));

    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(removeButton);

    ruleDiv.appendChild(ruleInfo);
    ruleDiv.appendChild(actionsDiv);

    return ruleDiv;
  }

  // Start editing a rule
  function startEditRule(ruleDiv, rule, ruleIndex) {
    ruleDiv.classList.add("editing");
    
    const ruleInfo = ruleDiv.querySelector(".rule-info");
    const actionsDiv = ruleDiv.querySelector(".rule-actions");
    
    // Replace pattern text with input
    const patternDiv = ruleInfo.querySelector(".rule-pattern");
    const patternInput = document.createElement("input");
    patternInput.type = "text";
    patternInput.className = "rule-pattern editable";
    patternInput.value = rule.pattern;
    patternDiv.replaceWith(patternInput);
    
    // Replace group name with input
    const groupNameSpan = ruleInfo.querySelector(".rule-group-name");
    const groupNameInput = document.createElement("input");
    groupNameInput.type = "text";
    groupNameInput.className = "rule-group-name editable";
    groupNameInput.value = rule.groupName;
    groupNameSpan.replaceWith(groupNameInput);
    
    // Add color picker for editing
    const colorPickerDiv = document.createElement("div");
    colorPickerDiv.className = "edit-color-picker";
    
    Object.keys(colorMap).forEach(colorKey => {
      const colorOption = document.createElement("div");
      colorOption.className = `color-option ${rule.color === colorKey ? 'selected' : ''}`;
      colorOption.style.backgroundColor = colorMap[colorKey].hex;
      colorOption.dataset.color = colorKey;
      colorOption.addEventListener("click", () => {
        colorPickerDiv.querySelectorAll(".color-option").forEach(opt => opt.classList.remove("selected"));
        colorOption.classList.add("selected");
      });
      colorPickerDiv.appendChild(colorOption);
    });
    
    ruleInfo.appendChild(colorPickerDiv);
    
    // Replace action buttons
    actionsDiv.innerHTML = "";
    
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-save-edit";
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => saveEditRule(ruleDiv, ruleIndex, patternInput, groupNameInput, colorPickerDiv));
    
    const cancelButton = document.createElement("button");
    cancelButton.className = "btn btn-cancel-edit";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => cancelEditRule(ruleIndex));
    
    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);
    
    // Focus on pattern input
    patternInput.focus();
  }

  // Save edited rule
  function saveEditRule(_ruleDiv, ruleIndex, patternInput, groupNameInput, colorPickerDiv) {
    const newPattern = patternInput.value.trim();
    const newGroupName = groupNameInput.value.trim();
    const selectedColorOption = colorPickerDiv.querySelector(".color-option.selected");
    const newColor = selectedColorOption ? selectedColorOption.dataset.color : "blue";

    // Validation
    if (!newPattern || !newGroupName) {
      showStatus("Please fill in both pattern and group name!", true);
      return;
    }

    if (!isValidPattern(newPattern)) {
      showStatus("Please enter a valid domain pattern (e.g., github.com)", true);
      return;
    }

    // Check for duplicates (excluding current rule)
    if (isDuplicateRule(groupingRules, newPattern, newGroupName, ruleIndex)) {
      showStatus("A rule with this pattern or group name already exists!", true);
      return;
    }

    // Update the rule
    groupingRules[ruleIndex] = {
      pattern: newPattern,
      groupName: newGroupName,
      color: newColor
    };

    renderRules();
    showStatus("Rule updated successfully!");
  }

  // Cancel editing
  function cancelEditRule() {
    renderRules(); // Just re-render to restore original state
  }

  // Start delete process with confirmation
  function startDeleteRule(ruleDiv, ruleIndex) {
    ruleDiv.classList.add("deleting");
    
    const actionsDiv = ruleDiv.querySelector(".rule-actions");
    const originalContent = actionsDiv.innerHTML;
    
    actionsDiv.innerHTML = "";
    
    const confirmText = document.createElement("span");
    confirmText.textContent = "Delete this rule?";
    confirmText.style.color = "#d32f2f";
    confirmText.style.fontWeight = "500";
    confirmText.style.marginRight = "10px";
    
    const confirmButton = document.createElement("button");
    confirmButton.className = "btn btn-danger";
    confirmButton.textContent = "Yes, Delete";
    confirmButton.addEventListener("click", () => confirmDeleteRule(ruleIndex));
    
    const cancelButton = document.createElement("button");
    cancelButton.className = "btn btn-cancel-edit";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      ruleDiv.classList.remove("deleting");
      actionsDiv.innerHTML = originalContent;
      // Re-bind event listeners
      const editBtn = actionsDiv.querySelector(".btn-edit");
      const deleteBtn = actionsDiv.querySelector(".btn-danger");
      editBtn.addEventListener("click", () => startEditRule(ruleDiv, groupingRules[ruleIndex], ruleIndex));
      deleteBtn.addEventListener("click", () => startDeleteRule(ruleDiv, ruleIndex));
    });
    
    actionsDiv.appendChild(confirmText);
    actionsDiv.appendChild(confirmButton);
    actionsDiv.appendChild(cancelButton);
  }

  // Confirm and execute deletion
  function confirmDeleteRule(ruleIndex) {
    groupingRules.splice(ruleIndex, 1);
    renderRules();
    showStatus("Rule deleted successfully!");
  }

  // Load existing rules from storage
  function loadRules() {
    chrome.storage.local.get(["groupingRules"], (result) => {
      groupingRules = result.groupingRules || [];
      
      // Migrate old rules that don't have color property
      groupingRules = groupingRules.map(rule => ({
        pattern: rule.pattern,
        groupName: rule.groupName,
        color: rule.color || "blue" // Default to blue for existing rules
      }));
      
      renderRules();
    });
  }

  // Handle form submission
  function handleFormSubmit(event) {
    event.preventDefault();
    
    const newPattern = patternInput.value.trim();
    const newGroupName = groupNameInput.value.trim();

    // Validation
    if (!newPattern || !newGroupName) {
      showStatus("Please fill in both pattern and group name!", true);
      return;
    }

    if (!isValidPattern(newPattern)) {
      showStatus("Please enter a valid domain pattern (e.g., github.com)", true);
      return;
    }

    if (isDuplicateRule(groupingRules, newPattern, newGroupName)) {
      showStatus("A rule with this pattern or group name already exists!", true);
      return;
    }

    // Add the new rule
    const newRule = {
      pattern: newPattern,
      groupName: newGroupName,
      color: selectedColor
    };

    groupingRules.push(newRule);
    
    // Clear form
    patternInput.value = "";
    groupNameInput.value = "";
    
    // Reset color selection to blue
    colorPicker.querySelectorAll(".color-option").forEach(opt => opt.classList.remove("selected"));
    colorPicker.querySelector('[data-color="blue"]').classList.add("selected");
    selectedColor = "blue";
    
    renderRules();
    showStatus("Rule added successfully!");
  }

  // Save rules to storage
  function saveRules() {
    if (groupingRules.length === 0) {
      showStatus("No rules to save!", true);
      return;
    }

    chrome.storage.local.set({ groupingRules }, () => {
      if (chrome.runtime.lastError) {
        showStatus("Error saving rules: " + chrome.runtime.lastError.message, true);
      } else {
        showStatus("All rules saved successfully! 🎉");
      }
    });
  }

  // ── Merge Tab Groups ─────────────────────────────────────────────────────────

  const mergeContainer = document.getElementById("mergeContainer");
  const refreshMergeBtn = document.getElementById("refreshMergeBtn");

  /** Clears the merge container and shows a single paragraph message. */
  function setMergeMessage(text, color) {
    const p = document.createElement("p");
    p.style.cssText = `color:${color};text-align:center;padding:20px`;
    p.textContent = text;
    mergeContainer.replaceChildren(p);
  }

  async function loadMergeableGroups() {
    setMergeMessage("Scanning windows…", "#888");

    let allGroups, allTabs;
    try {
      [allGroups, allTabs] = await Promise.all([
        chrome.tabGroups.query({}),
        chrome.tabs.query({})
      ]);
    } catch (e) {
      setMergeMessage(`Error: ${e.message}`, "#c00");
      return;
    }

    const tabCountByGroup = countTabsByGroup(allTabs);
    const mergeables = findMergeableGroups(allGroups);

    if (mergeables.length === 0) {
      mergeContainer.className = "merge-empty-state";
      mergeContainer.textContent = "No duplicate groups found across windows. All good! ✅";
      return;
    }

    mergeContainer.className = "";
    mergeContainer.replaceChildren();

    for (const [title, groups] of mergeables) {
      const item = document.createElement("div");
      item.className = "merge-group-item";

      const nameEl = document.createElement("div");
      nameEl.className = "merge-group-name";
      nameEl.textContent = `"${title}" — ${groups.length} windows`;
      item.appendChild(nameEl);

      const list = document.createElement("div");
      list.className = "merge-window-list";

      groups.forEach((group) => {
        const entry = document.createElement("div");
        entry.className = "merge-window-entry";

        const label = document.createElement("span");
        const tabCount = tabCountByGroup[group.id] || 0;
        label.textContent = `Window ${group.windowId}  ·  ${tabCount} tab${tabCount !== 1 ? "s" : ""}`;

        const mergeBtn = document.createElement("button");
        mergeBtn.className = "btn btn-merge";
        mergeBtn.textContent = "Merge into this window";
        mergeBtn.addEventListener("click", () => mergeGroupsInto(group, groups, allTabs));

        entry.appendChild(label);
        entry.appendChild(mergeBtn);
        list.appendChild(entry);
      });

      item.appendChild(list);
      mergeContainer.appendChild(item);
    }
  }

  async function mergeGroupsInto(targetGroup, allGroupsForTitle, allTabs) {
    const sourceGroups = allGroupsForTitle.filter(g => g.id !== targetGroup.id);

    for (const sourceGroup of sourceGroups) {
      const tabsToMove = allTabs.filter(t => t.groupId === sourceGroup.id);
      if (tabsToMove.length === 0) continue;

      const tabIds = tabsToMove.map(t => t.id);

      try {
        // Move tabs to the target window first
        for (const tabId of tabIds) {
          await chrome.tabs.move(tabId, { windowId: targetGroup.windowId, index: -1 });
        }
        // Then add them to the target group
        await chrome.tabs.group({ groupId: targetGroup.id, tabIds });
      } catch (e) {
        showStatus(`Error merging: ${e.message}`, true);
        return;
      }
    }

    showStatus(`Merged all "${targetGroup.title}" groups into window ${targetGroup.windowId}! 🎉`);
    // Refresh the merge list
    loadMergeableGroups();
  }

  // Initialize the options page
  function initialize() {
    initializeColorPicker();
    loadRules();

    // Event listeners
    addRuleForm.addEventListener("submit", handleFormSubmit);
    saveButton.addEventListener("click", saveRules);
    refreshMergeBtn.addEventListener("click", loadMergeableGroups);
    
    // Auto-save when rules change (optional)
    // Uncomment if you want automatic saving
    // const autoSaveInterval = setInterval(() => {
    //   if (groupingRules.length > 0) {
    //     chrome.storage.local.set({ groupingRules });
    //   }
    // }, 2000);
  }

  // Start the application
  initialize();
});
