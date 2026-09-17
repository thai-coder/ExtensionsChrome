/**
 * PropZoneData - Options Page Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const rulesContainer = document.getElementById("rules-container");
  const builtinContainer = document.getElementById("builtin-rules-container");
  const rulesCount = document.getElementById("rules-count");

  const btnAddNew = document.getElementById("btn-add-new-rule");
  const modal = document.getElementById("modal-rule");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const btnSaveRule = document.getElementById("btn-save-rule");
  const btnAddFieldRow = document.getElementById("btn-add-field-row");

  const ruleNameInput = document.getElementById("rule-name");
  const rulePatternInput = document.getElementById("rule-pattern");
  const ruleTemplateInput = document.getElementById("rule-template");
  const fieldsEditor = document.getElementById("fields-editor");
  const toast = document.getElementById("toast");

  let customRules = [];
  let editingRuleId = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2000);
  }

  function loadRules() {
    chrome.storage.local.get(["customRules"], (res) => {
      customRules = res.customRules || [];
      renderCustomRules();
    });
    renderBuiltinRules();
  }

  function renderCustomRules() {
    rulesCount.textContent = `${customRules.length} quy tắc`;
    if (customRules.length === 0) {
      rulesContainer.innerHTML = '<div class="empty-state">Chưa có quy tắc tùy biến nào. Hãy nhấn "+ Thêm Quy Tắc Mới".</div>';
      return;
    }

    rulesContainer.innerHTML = "";
    customRules.forEach((rule, index) => {
      const item = document.createElement("div");
      item.className = "rule-item";
      item.innerHTML = `
        <div class="rule-info">
          <h4>${escapeHtml(rule.name)}</h4>
          <div class="rule-pattern">${escapeHtml(rule.urlPattern)}</div>
          <small style="color:#94a3b8">${rule.fields ? rule.fields.length : 0} trường bóc tách</small>
        </div>
        <div class="rule-actions">
          <button class="btn btn-sm btn-secondary btn-edit" data-id="${rule.id}">Sửa</button>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${rule.id}">Xóa</button>
        </div>
      `;
      rulesContainer.appendChild(item);
    });

    document.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", (e) => openModal(e.target.dataset.id)));
    document.querySelectorAll(".btn-delete").forEach(b => b.addEventListener("click", (e) => deleteRule(e.target.dataset.id)));
  }

  function renderBuiltinRules() {
    const builtin = window.PropZoneRules?.DEFAULT_EXTRACTION_RULES || [];
    builtinContainer.innerHTML = "";
    builtin.forEach(rule => {
      const item = document.createElement("div");
      item.className = "rule-item";
      item.innerHTML = `
        <div class="rule-info">
          <h4>${escapeHtml(rule.name)} <span class="badge">Hệ thống</span></h4>
          <div class="rule-pattern">${escapeHtml(rule.urlPattern)}</div>
        </div>
      `;
      builtinContainer.appendChild(item);
    });
  }

  function addFieldRow(key = "", label = "", selector = "") {
    const row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML = `
      <input type="text" class="f-key" placeholder="Key (vd: price)" value="${escapeHtml(key)}" style="width: 25%">
      <input type="text" class="f-label" placeholder="Tên (vd: Giá)" value="${escapeHtml(label)}" style="width: 25%">
      <input type="text" class="f-selector" placeholder="CSS Selector (vd: .price)" value="${escapeHtml(selector)}" style="width: 45%">
      <button type="button" class="btn btn-sm btn-danger btn-remove-field" style="padding:4px 8px;">&times;</button>
    `;
    row.querySelector(".btn-remove-field").addEventListener("click", () => row.remove());
    fieldsEditor.appendChild(row);
  }

  btnAddFieldRow.addEventListener("click", () => addFieldRow());

  function openModal(ruleId = null) {
    editingRuleId = ruleId;
    fieldsEditor.innerHTML = "";

    if (ruleId) {
      const rule = customRules.find(r => r.id === ruleId);
      if (rule) {
        document.getElementById("modal-title").textContent = "Chỉnh Sửa Quy Tắc";
        ruleNameInput.value = rule.name || "";
        rulePatternInput.value = rule.urlPattern || "";
        ruleTemplateInput.value = rule.outputTemplate || "";
        (rule.fields || []).forEach(f => addFieldRow(f.key, f.label, f.selector));
      }
    } else {
      document.getElementById("modal-title").textContent = "Thêm Quy Tắc Mới";
      ruleNameInput.value = "";
      rulePatternInput.value = "";
      ruleTemplateInput.value = "";
      addFieldRow("title", "Tiêu đề", "h1");
      addFieldRow("value", "Giá trị", ".main-value");
    }

    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
    editingRuleId = null;
  }

  btnCloseModal.addEventListener("click", closeModal);
  btnCancelModal.addEventListener("click", closeModal);
  btnAddNew.addEventListener("click", () => openModal(null));

  btnSaveRule.addEventListener("click", () => {
    const name = ruleNameInput.value.trim();
    const pattern = rulePatternInput.value.trim();
    const template = ruleTemplateInput.value.trim();

    if (!name || !pattern) {
      alert("Vui lòng nhập đầy đủ Tên và URL Pattern!");
      return;
    }

    // Lấy fields
    const fieldRows = fieldsEditor.querySelectorAll(".field-row");
    const fields = [];
    fieldRows.forEach(r => {
      const key = r.querySelector(".f-key").value.trim();
      const label = r.querySelector(".f-label").value.trim();
      const selector = r.querySelector(".f-selector").value.trim();
      if (key && selector) {
        fields.push({ key, label: label || key, selector, type: "text" });
      }
    });

    const newRule = {
      id: editingRuleId || `custom-${Date.now()}`,
      name,
      urlPattern: pattern,
      enabled: true,
      fields,
      outputTemplate: template
    };

    if (editingRuleId) {
      const idx = customRules.findIndex(r => r.id === editingRuleId);
      if (idx !== -1) customRules[idx] = newRule;
    } else {
      customRules.push(newRule);
    }

    chrome.storage.local.set({ customRules }, () => {
      closeModal();
      renderCustomRules();
      showToast("Đã lưu quy tắc thành công!");
    });
  });

  function deleteRule(id) {
    if (!confirm("Bạn có chắc muốn xóa quy tắc này?")) return;
    customRules = customRules.filter(r => r.id !== id);
    chrome.storage.local.set({ customRules }, () => {
      renderCustomRules();
      showToast("Đã xóa quy tắc.");
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  loadRules();
});
