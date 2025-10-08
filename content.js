// content.js

function getAllFormFields() {
  const fields = [];

  // Each question block
  const questions = document.querySelectorAll('div[role="listitem"]');

  questions.forEach((q) => {
    const labelElem = q.querySelector('div[role="heading"]');
    const label = labelElem?.innerText.trim();

    const input = q.querySelector(
      'input[type="text"], input[type="email"], input[type="number"]'
    );
    const textarea = q.querySelector("textarea");
    const radios = q.querySelectorAll('div[role="radio"]');
    const checkboxes = q.querySelectorAll('div[role="checkbox"]');

    if (
      label &&
      (input || textarea || radios.length > 0 || checkboxes.length > 0)
    ) {
      const type = input
        ? "text"
        : textarea
        ? "textarea"
        : radios.length
        ? "radio"
        : "checkbox";
      fields.push({ label, type });
    }
  });

  console.log("Detected fields:", fields);
  return fields;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getFields") {
    const fields = getAllFormFields();
    sendResponse({ fields });
  }

  if (msg.action === "autofill") {
    const mapping = msg.mapping;
    console.log("Autofilling with mapping:", mapping);

    const questions = document.querySelectorAll('div[role="listitem"]');
    questions.forEach((q) => {
      const labelElem = q.querySelector('div[role="heading"]');
      const label = labelElem?.innerText.trim();
      const value = mapping[label];
      if (!value) return;

      const input = q.querySelector(
        'input[type="text"], input[type="email"], input[type="number"]'
      );
      const textarea = q.querySelector("textarea");

      if (input) {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }

      if (textarea) {
        textarea.focus();
        textarea.value = value;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }

      const radios = q.querySelectorAll('div[role="radio"]');
      if (radios.length > 0) {
        const match = Array.from(radios).find(
          (r) => r.innerText.trim().toLowerCase() === value.toLowerCase()
        );
        if (match) match.click();
      }

      const checkboxes = q.querySelectorAll('div[role="checkbox"]');
      if (checkboxes.length > 0) {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((v) => {
          const match = Array.from(checkboxes).find(
            (c) => c.innerText.trim().toLowerCase() === v.toLowerCase()
          );
          if (match) match.click();
        });
      }
    });
  }

  return true;
});
