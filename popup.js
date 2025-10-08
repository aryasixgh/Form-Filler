// popup.js

const formContainer = document.getElementById("fields");
const scanBtn = document.getElementById("scan");
const saveBtn = document.getElementById("save");
const autofillBtn = document.getElementById("autofill");

// Load saved mapping on startup
chrome.storage.local.get(["formMapping"], (res) => {
  if (res.formMapping) {
    populateForm(res.formMapping);
  }
});

function populateForm(mapping) {
  formContainer.innerHTML = "";
  for (const key in mapping) {
    addField(key, mapping[key]);
  }
}

function addField(label, value = "") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <label>${label}</label>
    <input type="text" value="${value}" data-label="${label}">
  `;
  formContainer.appendChild(wrapper);
}

scanBtn.addEventListener("click", async () => {
  console.log("Scanning fields...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "getFields" }, (res) => {
    if (chrome.runtime.lastError) {
      console.error("Error:", chrome.runtime.lastError.message);
      alert(
        "Could not connect to content script. Try reloading the form page."
      );
      return;
    }

    if (res && res.fields && res.fields.length > 0) {
      console.log("Fields found:", res.fields);
      formContainer.innerHTML = "";
      res.fields.forEach((f) => addField(f.label));
    } else {
      console.warn("No fields detected or empty response:", res);
      alert("No fields detected on this page.");
    }
  });
});

saveBtn.addEventListener("click", () => {
  const mapping = {};
  document.querySelectorAll("input[data-label]").forEach((input) => {
    mapping[input.dataset.label] = input.value;
  });
  chrome.storage.local.set({ formMapping: mapping }, () => {
    alert("Mapping saved!");
  });
});

autofillBtn.addEventListener("click", async () => {
  const mapping = {};
  document.querySelectorAll("input[data-label]").forEach((input) => {
    mapping[input.dataset.label] = input.value;
  });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "autofill", mapping });
});
