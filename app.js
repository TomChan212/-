// --- State ---
let nameList = [];
let filterValue = 'all'; // 'all' | 'deficit' | 'balance'

const TEMPLATE_STORAGE_KEY = '院友零用金_匯出範本';
const TEMPLATE_SLOTS_KEY = '院友零用金_範本槽';
const TEMPLATE_SELECTED_KEY = '院友零用金_範本選擇';
const DEFAULT_TEMPLATE = `{name}
您好，有關院友零用金{typeLabel}，截至{date}為{dollarPart}。
請幫忙入數(交現金或WHATSAPP入數紙)，謝謝您。
財務資訊 - 匯豐銀行 
零用金戶口：111-135398-006
Helping Hand`;

/** @type {Record<number, string>} Slots 1..4, default only slot 1 exists */
let templateSlots = { 1: DEFAULT_TEMPLATE };
/** Which slot is currently shown in the modal (for editing) */
let currentTemplateSlot = 1;
/** Which slot's template is used when 匯出 */
let selectedExportSlot = 1;
const MAX_SLOTS = 4;

// --- DOM references ---
const dataBody = document.getElementById('dataBody');
const btnImport = document.getElementById('btnImport');
const btnExport = document.getElementById('btnExport');
const importFile = document.getElementById('importFile');
const namesDatalist = document.getElementById('namesDatalist');
const templateModal = document.getElementById('templateModal');
const templateTextarea = document.getElementById('templateTextarea');
const btnTemplate = document.getElementById('btnTemplate');
const btnTemplateSave = document.getElementById('btnTemplateSave');
const btnTemplateCancel = document.getElementById('btnTemplateCancel');
const templateSlotButtons = document.getElementById('templateSlotButtons');
const btnSlotAdd = document.getElementById('btnSlotAdd');
const btnTemplateDelete = document.getElementById('btnTemplateDelete');
const helpModal = document.getElementById('helpModal');
const btnHelp = document.getElementById('btnHelp');
const btnHelpClose = document.getElementById('btnHelpClose');
const previewOutput = document.getElementById('previewOutput');
const btnClear = document.getElementById('btnClear');

/**
 * Get names currently selected in other rows (optionally exclude one input, e.g. the focused one).
 * @param {HTMLInputElement|null} exceptInput - If given, do not count this input's value as "used".
 */
function getUsedNames(exceptInput) {
  const used = new Set();
  dataBody.querySelectorAll('.name-input').forEach(input => {
    if (input === exceptInput) return;
    const val = input.value.trim();
    if (val) used.add(val);
  });
  return used;
}

/**
 * Populate datalist: show names from nameList that are not selected in other rows.
 * When exceptInput is given (e.g. the focused field), its value is not counted as used so it stays in the list.
 */
function refreshNameOptions(exceptInput = null) {
  const used = getUsedNames(exceptInput);
  const available = nameList.filter(name => !used.has(name));
  namesDatalist.innerHTML = '';
  available.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    namesDatalist.appendChild(opt);
  });
}

/**
 * Refresh the list when focus or value changes (so selected names disappear, cleared names reappear).
 */
function refreshDatalistForCurrentFocus() {
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains('name-input')) {
    refreshNameOptions(active);
  } else {
    refreshNameOptions(null);
  }
}

/**
 * 匯入: read names from selected file (names.txt), one per line.
 */
const importFileNameEl = document.getElementById('importFileName');
btnImport.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', () => {
  const file = importFile.files[0];
  if (!file) return;
  if (importFileNameEl) importFileNameEl.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = (e.target.result || '').trim();
    nameList = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    refreshNameOptions(null);
    importFile.value = '';
  };
  reader.readAsText(file, 'UTF-8');
});

/**
 * Get name for a row (single name input).
 */
function getRowName(row) {
  const input = row.querySelector('.name-input');
  return input && input.value ? input.value.trim() : '';
}

function getRowDate(row) {
  const el = row.querySelector('.date-input');
  return el ? el.value : '';
}

function getRowType(row) {
  const btn = row.querySelector('.btn-type');
  return btn && btn.dataset.type === 'deficit' ? '結欠' : '結餘';
}

function getRowAmount(row) {
  const el = row.querySelector('.amount-input');
  if (!el || el.value === '') return '';
  return el.value;
}

/**
 * Get the template string used for 匯出 (from selected slot).
 */
function getExportTemplate() {
  const t = templateSlots[selectedExportSlot];
  if (t && t.trim()) return t.trim();
  return DEFAULT_TEMPLATE;
}

/**
 * Build export text for one row using template. Placeholders: {name}, {date}, {typeLabel}, {dollarPart}.
 * For 結欠, dollarPart is --$amount; for 結餘, $amount.
 */
function buildExportText(name, date, type, amount) {
  const typeLabel = type === '結欠' ? '結欠' : '結餘';
  const amountStr = amount === '' ? '0' : amount;
  const dollarPart = type === '結欠' ? `--$${amountStr}` : `$${amountStr}`;
  const tpl = getExportTemplate();
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{date\}/g, date)
    .replace(/\{typeLabel\}/g, typeLabel)
    .replace(/\{dollarPart\}/g, dollarPart);
}

/**
 * Get data rows for preview/export, respecting 結欠/結餘 filter.
 */
function getDataRowsForPreview() {
  const rows = Array.from(dataBody.querySelectorAll('.data-row')).filter(
    (r) => !r.classList.contains('input-row')
  );
  if (filterValue === 'all') return rows;
  return rows.filter((row) => {
    const type = row.dataset.type || 'balance';
    return filterValue === 'deficit' ? type === 'deficit' : type === 'balance';
  });
}

/**
 * Build preview text: data rows only, filtered by 結欠/結餘.
 */
function getPreviewText() {
  const rows = getDataRowsForPreview();
  const blocks = rows.map((row) => {
    const name = getRowName(row);
    const date = getRowDate(row);
    const type = getRowType(row);
    const amount = getRowAmount(row);
    return buildExportText(name, date, type, amount);
  });
  return blocks.join('\n\n');
}

function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build preview HTML: one box per 院友 with separator line; name styled larger and colored.
 * Filtered by 結欠/結餘.
 */
function getPreviewHtml() {
  const rows = getDataRowsForPreview();
  const parts = [];
  for (const row of rows) {
    const name = getRowName(row);
    const date = getRowDate(row);
    const type = getRowType(row);
    const amount = getRowAmount(row);
    const full = buildExportText(name, date, type, amount);
    const firstLineEnd = full.indexOf('\n');
    const firstLine = firstLineEnd >= 0 ? full.slice(0, firstLineEnd) : full;
    let body = firstLineEnd >= 0 ? full.slice(firstLineEnd + 1) : '';
    const amountStr = amount === '' ? '0' : amount;
    const dollarPart = type === '結欠' ? '--$' + amountStr : '$' + amountStr;
    let bodyHtml = escapeHtml(body);
    const escapedDollar = escapeHtml(dollarPart);
    const amountClass = 'preview-amount' + (type === '結欠' ? ' deficit' : '');
    const amountSpan = '<span class="' + amountClass + '">' + escapedDollar + '</span>';
    const re = new RegExp(escapedDollar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    bodyHtml = bodyHtml.replace(re, amountSpan);
    const blockClass = 'preview-block' + (type === '結欠' ? ' deficit' : '');
    parts.push(
      '<div class="' + blockClass + '">' +
        '<span class="preview-name">' + escapeHtml(firstLine || name) + '</span>' +
        '<pre class="preview-body">' + bodyHtml + '</pre>' +
      '</div>'
    );
  }
  return parts.join('');
}

/**
 * Build export text for download: data rows only (skip input row), with name and date.
 */
function getExportTextForDownload() {
  const rows = Array.from(dataBody.querySelectorAll('.data-row')).filter(
    (r) => !r.classList.contains('input-row')
  );
  const blocks = [];
  for (const row of rows) {
    const name = getRowName(row);
    const date = getRowDate(row);
    if (!name || !date) continue;
    const type = getRowType(row);
    const amount = getRowAmount(row);
    blocks.push(buildExportText(name, date, type, amount));
  }
  return blocks.join('\n\n');
}

/**
 * Update the read-only preview panel on the right.
 */
function updatePreview() {
  if (previewOutput) previewOutput.innerHTML = getPreviewHtml();
}

/**
 * 匯出至 NotePad: 所有列一併匯出至同一個 .txt 檔。
 * Order: newest first (first row = newest, then ... oldest at bottom of file).
 */
function exportAllRowsToTxt() {
  const text = getExportTextForDownload();
  if (!text || text.trim() === '') {
    alert('請至少填寫一列院友名字與截至日期。');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `院友零用金_匯出.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

btnExport.addEventListener('click', exportAllRowsToTxt);

/**
 * Toggle 結欠 / 結餘 for a row; keep row data-type in sync for filter.
 */
function toggleType(btn) {
  const row = btn.closest('.data-row');
  if (btn.dataset.type === 'deficit') {
    btn.dataset.type = 'balance';
    btn.textContent = '結餘';
    btn.classList.remove('deficit');
    if (row) row.dataset.type = 'balance';
  } else {
    btn.dataset.type = 'deficit';
    btn.textContent = '結欠';
    btn.classList.add('deficit');
    if (row) row.dataset.type = 'deficit';
  }
  applyFilter();
  updatePreview();
}

/**
 * Get ordered list of tabbable inputs: name then amount per row (for Tab-only name/number).
 */
function getTabbableInputs() {
  const list = [];
  dataBody.querySelectorAll('.data-row').forEach(row => {
    const nameInput = row.querySelector('.name-input');
    const amountInput = row.querySelector('.amount-input');
    if (nameInput) list.push(nameInput);
    if (amountInput) list.push(amountInput);
  });
  return list;
}

/**
 * Restrict Tab to only name and amount: on Tab/Shift+Tab, move focus between them.
 */
function handleTabKey(e) {
  const el = document.activeElement;
  if (e.key !== 'Tab' || (!el || !el.classList)) return;
  if (!el.classList.contains('name-input') && !el.classList.contains('amount-input')) return;
  const tabbable = getTabbableInputs();
  const idx = tabbable.indexOf(el);
  if (idx === -1) return;
  e.preventDefault();
  if (e.shiftKey) {
    const prev = idx - 1;
    (tabbable[prev] || tabbable[tabbable.length - 1]).focus();
  } else {
    const next = idx + 1;
    (tabbable[next] || tabbable[0]).focus();
  }
}

/**
 * Apply 結欠/結餘 filter: show/hide data rows by data-type. Input row always visible.
 */
function applyFilter() {
  dataBody.querySelectorAll('.data-row').forEach(row => {
    if (row.classList.contains('input-row')) {
      row.classList.remove('row-hidden');
      return;
    }
    const type = row.dataset.type || 'balance';
    const hide =
      filterValue === 'deficit' ? type !== 'deficit' : filterValue === 'balance' ? type !== 'balance' : false;
    row.classList.toggle('row-hidden', hide);
  });
}

/**
 * Get the single input row (first row, 加入 only).
 */
function getInputRow() {
  return dataBody.querySelector('.input-row');
}

/**
 * Commit input row: append its data as a new data row (刪除 only), then clear the input row.
 * On Enter or click 加入.
 */
function commitInputRow() {
  const inputRow = getInputRow();
  if (!inputRow) return;
  const name = getRowName(inputRow);
  const date = getRowDate(inputRow);
  const type = getRowType(inputRow);
  const amount = getRowAmount(inputRow);

  if (!name || !name.trim()) {
    alert('請輸入院友名字。');
    return;
  }
  if (!date || !date.trim()) {
    alert('請輸入截至日期。');
    return;
  }

  const clone = inputRow.cloneNode(true);
  clone.classList.remove('input-row');
  clone.dataset.type = type === '結欠' ? 'deficit' : 'balance';
  clone.querySelector('.name-input').value = name;
  clone.querySelector('.date-input').value = date;
  clone.querySelector('.amount-input').value = amount;
  const typeBtn = clone.querySelector('.btn-type');
  typeBtn.dataset.type = type === '結欠' ? 'deficit' : 'balance';
  typeBtn.textContent = type;
  typeBtn.classList.toggle('deficit', type === '結欠');

  const actionsTd = clone.querySelector('.td-row-actions');
  actionsTd.innerHTML = '<button type="button" class="btn-delete" tabindex="-1">刪除</button>';
  clone.querySelector('.btn-delete').addEventListener('click', function () {
    deleteRow(this.closest('.data-row'));
  });
  clone.querySelector('.btn-type').addEventListener('click', function () {
    toggleType(this);
  });
  bindNameInput(clone.querySelector('.name-input'));
  dataBody.insertBefore(clone, inputRow.nextSibling);

  inputRow.querySelector('.name-input').value = '';
  /* keep date so next entry uses the same date */
  inputRow.querySelector('.amount-input').value = '';
  const inputTypeBtn = inputRow.querySelector('.btn-type');
  inputTypeBtn.dataset.type = 'balance';
  inputTypeBtn.textContent = '結餘';
  inputTypeBtn.classList.remove('deficit');
  inputRow.dataset.type = 'balance';

  applyFilter();
  refreshDatalistForCurrentFocus();
  inputRow.querySelector('.name-input').focus();
  updatePreview();
}

/**
 * Remove a data row. Never remove the input row.
 */
function deleteRow(row) {
  if (row.classList.contains('input-row')) return;
  row.remove();
  refreshDatalistForCurrentFocus();
  updatePreview();
}

/**
 * Clear the list: remove all data rows and reset the input row.
 */
function clearList() {
  if (!confirm('確定要清空所有記錄嗎？')) return;
  const inputRow = getInputRow();
  dataBody.querySelectorAll('.data-row').forEach((row) => {
    if (!row.classList.contains('input-row')) row.remove();
  });
  if (inputRow) {
    inputRow.querySelector('.name-input').value = '';
    inputRow.querySelector('.date-input').value = '';
    inputRow.querySelector('.amount-input').value = '';
    const typeBtn = inputRow.querySelector('.btn-type');
    typeBtn.dataset.type = 'balance';
    typeBtn.textContent = '結餘';
    typeBtn.classList.remove('deficit');
    inputRow.dataset.type = 'balance';
  }
  refreshDatalistForCurrentFocus();
  updatePreview();
}

/**
 * Bind focus and input/change on a name input so the datalist updates:
 * selected names are removed from the list, cleared names are put back.
 */
function bindNameInput(input) {
  if (!input) return;
  input.addEventListener('focus', () => refreshNameOptions(input));
  input.addEventListener('input', refreshDatalistForCurrentFocus);
  input.addEventListener('change', refreshDatalistForCurrentFocus);
}

/**
 * Press [Enter] in the amount input to commit the input row (append data, clear row).
 */
function bindEnterToAddRow(amountInput) {
  if (!amountInput) return;
  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInputRow();
    }
  });
}

// --- 清空 ---
if (btnClear) btnClear.addEventListener('click', clearList);

// --- Filter buttons ---
document.querySelectorAll('.btn-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    filterValue = btn.dataset.filter || 'all';
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
    updatePreview();
  });
});

// --- Tab only between name and amount ---
document.addEventListener('keydown', handleTabKey, true);

// --- 範本 modal: slot buttons (1,2,3,4 and +), default only 1 and + ---
function renderTemplateSlotButtons() {
  templateSlotButtons.innerHTML = '';
  const slots = Object.keys(templateSlots)
    .map(Number)
    .sort((a, b) => a - b);
  slots.forEach((n) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-slot' + (n === currentTemplateSlot ? ' selected' : '');
    btn.textContent = String(n);
    btn.dataset.slot = String(n);
    btn.addEventListener('click', () => switchTemplateSlot(n));
    templateSlotButtons.appendChild(btn);
  });
}

function switchTemplateSlot(slotNum) {
  templateSlots[currentTemplateSlot] = templateTextarea.value;
  currentTemplateSlot = slotNum;
  selectedExportSlot = currentTemplateSlot;
  templateTextarea.value = templateSlots[slotNum] != null ? templateSlots[slotNum] : DEFAULT_TEMPLATE;
  renderTemplateSlotButtons();
  saveTemplateSlotsToStorage();
}

function addTemplateSlot() {
  const existing = Object.keys(templateSlots).map(Number).sort((a, b) => a - b);
  if (existing.length >= MAX_SLOTS) return;
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  templateSlots[currentTemplateSlot] = templateTextarea.value;
  templateSlots[next] = DEFAULT_TEMPLATE;
  currentTemplateSlot = next;
  selectedExportSlot = currentTemplateSlot;
  templateTextarea.value = DEFAULT_TEMPLATE;
  renderTemplateSlotButtons();
  saveTemplateSlotsToStorage();
  if (existing.length >= MAX_SLOTS - 1) btnSlotAdd.style.display = 'none';
}

function openTemplateModal() {
  templateTextarea.value = templateSlots[currentTemplateSlot] != null ? templateSlots[currentTemplateSlot] : DEFAULT_TEMPLATE;
  renderTemplateSlotButtons();
  btnSlotAdd.style.display = Object.keys(templateSlots).length >= MAX_SLOTS ? 'none' : '';
  templateModal.classList.add('is-open');
  templateModal.setAttribute('aria-hidden', 'false');
  templateTextarea.focus();
}

function closeTemplateModal() {
  templateSlots[currentTemplateSlot] = templateTextarea.value;
  selectedExportSlot = currentTemplateSlot;
  saveTemplateSlotsToStorage();
  templateModal.classList.remove('is-open');
  templateModal.setAttribute('aria-hidden', 'true');
  updatePreview();
}

function saveTemplate() {
  templateSlots[currentTemplateSlot] = templateTextarea.value.trim() || DEFAULT_TEMPLATE;
  saveTemplateSlotsToStorage();
  closeTemplateModal();
}

function saveTemplateSlotsToStorage() {
  try {
    localStorage.setItem(TEMPLATE_SLOTS_KEY, JSON.stringify(templateSlots));
    localStorage.setItem(TEMPLATE_SELECTED_KEY, String(selectedExportSlot));
  } catch (e) {}
}

function deleteTemplateSlot() {
  const slots = Object.keys(templateSlots).map(Number).sort((a, b) => a - b);
  if (slots.length <= 1) return;
  templateSlots[currentTemplateSlot] = templateTextarea.value;
  delete templateSlots[currentTemplateSlot];
  const remaining = Object.keys(templateSlots).map(Number).sort((a, b) => a - b);
  currentTemplateSlot = remaining[0];
  selectedExportSlot = currentTemplateSlot;
  templateTextarea.value = templateSlots[currentTemplateSlot] != null ? templateSlots[currentTemplateSlot] : DEFAULT_TEMPLATE;
  saveTemplateSlotsToStorage();
  renderTemplateSlotButtons();
  if (remaining.length < MAX_SLOTS) btnSlotAdd.style.display = '';
}

// --- 說明 modal ---
function openHelpModal() {
  helpModal.classList.add('is-open');
  helpModal.setAttribute('aria-hidden', 'false');
}

function closeHelpModal() {
  helpModal.classList.remove('is-open');
  helpModal.setAttribute('aria-hidden', 'true');
}

btnHelp.addEventListener('click', openHelpModal);
btnHelpClose.addEventListener('click', closeHelpModal);
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) closeHelpModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpModal.classList.contains('is-open')) closeHelpModal();
});

btnTemplate.addEventListener('click', openTemplateModal);
btnTemplateSave.addEventListener('click', saveTemplate);
btnTemplateCancel.addEventListener('click', closeTemplateModal);
btnTemplateDelete.addEventListener('click', deleteTemplateSlot);
btnSlotAdd.addEventListener('click', addTemplateSlot);
templateModal.addEventListener('click', (e) => {
  if (e.target === templateModal) closeTemplateModal();
});
templateTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTemplateModal();
});

// --- Load saved template slots ---
function loadTemplateSlotsFromStorage() {
  try {
    const slotsJson = localStorage.getItem(TEMPLATE_SLOTS_KEY);
    if (slotsJson) {
      const parsed = JSON.parse(slotsJson);
      if (parsed && typeof parsed === 'object') templateSlots = parsed;
    }
    const sel = localStorage.getItem(TEMPLATE_SELECTED_KEY);
    if (sel) {
      const n = parseInt(sel, 10);
      if (n >= 1 && n <= MAX_SLOTS) selectedExportSlot = n;
    }
    const legacy = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (legacy && (!templateSlots[1] || templateSlots[1] === DEFAULT_TEMPLATE)) {
      templateSlots[1] = legacy;
    }
  } catch (e) {}
}
loadTemplateSlotsFromStorage();

// --- Input row: wire events (加入 only; Enter commits) ---
(function initFirstRow() {
  const inputRow = getInputRow();
  if (!inputRow) return;
  inputRow.querySelector('.btn-type').addEventListener('click', function () {
    toggleType(this);
  });
  inputRow.querySelector('.btn-add').addEventListener('click', commitInputRow);
  bindNameInput(inputRow.querySelector('.name-input'));
  bindEnterToAddRow(inputRow.querySelector('.amount-input'));
  applyFilter();
  updatePreview();
})();

// --- Live preview: update when user types in name, date, or amount ---
dataBody.addEventListener('input', (e) => {
  if (e.target.matches('.name-input, .date-input, .amount-input')) updatePreview();
});
dataBody.addEventListener('change', (e) => {
  if (e.target.matches('.name-input, .date-input, .amount-input')) updatePreview();
});
