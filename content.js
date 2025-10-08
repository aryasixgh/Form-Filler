// Helper to normalize text
function normalizeText(str) {
  return str.replace(/\s+/g, " ").trim().toLowerCase();
}

// Scan all fields in Google Form
function scanFormFields() {
  const questions = document.querySelectorAll('div[role="listitem"]');
  const fields = [];

  questions.forEach((q) => {
    let labelElem =
      q.querySelector('div[role="heading"] span') ||
      q.querySelector('div[role="heading"]');
    const label = labelElem ? labelElem.innerText.trim() : "Unnamed Field";

    const input = q.querySelector(
      'input[type="text"], input[type="email"], input[type="number"]'
    );
    const textarea = q.querySelector("textarea");
    const radios = q.querySelectorAll('div[role="radio"]');
    const checkboxes = q.querySelectorAll('div[role="checkbox"]');

    if (input || textarea || radios.length || checkboxes.length) {
      let type = "text";
      if (textarea) type = "textarea";
      else if (radios.length) type = "radio";
      else if (checkboxes.length) type = "checkbox";

      fields.push({ label, type });
    }
  });

  console.log("Detected fields:", fields);
  return fields;
}

// Fill fields using mapping
function fillFormFields(mapping) {
  const questions = document.querySelectorAll('div[role="listitem"]');

  questions.forEach((q) => {
    let labelElem =
      q.querySelector('div[role="heading"] span') ||
      q.querySelector('div[role="heading"]');
    const label = labelElem ? labelElem.innerText.trim() : null;
    if (!label || !(label in mapping)) return;

    const value = mapping[label];

    // Text / textarea
    const input = q.querySelector(
      'input[type="text"], input[type="email"], input[type="number"]'
    );
    const textarea = q.querySelector("textarea");
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (textarea) {
      textarea.value = value;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Radio buttons
    const radios = q.querySelectorAll('div[role="radio"]');
    radios.forEach((r) => {
      const optionText = normalizeText(r.innerText);
      if (optionText === normalizeText(value)) {
        r.click();
        r.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        r.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        r.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // Checkboxes (comma-separated)
    const checkboxes = q.querySelectorAll('div[role="checkbox"]');
    if (checkboxes.length) {
      const values = value.split(",").map((v) => normalizeText(v));
      checkboxes.forEach((c) => {
        const optionText = normalizeText(c.innerText);
        if (values.includes(optionText)) {
          c.click();
          c.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          c.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          c.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  });
}

// Listen to messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scanFields") sendResponse({ fields: scanFormFields() });
  if (msg.action === "fillFields") {
    fillFormFields(msg.mapping);
    sendResponse({ success: true });
  }
  return true; // Keep port open for async
});
