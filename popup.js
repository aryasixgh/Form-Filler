const scanBtn = document.getElementById("scanFields");
const fillBtn = document.getElementById("fillFields");
const mappingInput = document.getElementById("mappingInput");

// Scan fields on current tab
scanBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "scanFields" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error:", chrome.runtime.lastError.message);
      alert(
        "❌ Could not communicate with the page. Make sure a Google Form is open."
      );
      return;
    }

    if (response && response.fields && response.fields.length > 0) {
      const mapping = {};
      response.fields.forEach((f) => (mapping[f.label] = ""));
      mappingInput.value = JSON.stringify(mapping, null, 2);
    } else {
      alert("No fields detected!");
    }
  });
});

// Fill fields using mapping from textarea
fillBtn.addEventListener("click", async () => {
  let mapping;
  try {
    mapping = JSON.parse(mappingInput.value);
  } catch (e) {
    alert("Invalid JSON format");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(
    tab.id,
    { action: "fillFields", mapping },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message);
        alert(
          "❌ Could not send data to page. Make sure a Google Form is open."
        );
        return;
      }

      if (response && response.success) alert("✅ Fields filled successfully!");
    }
  );
});
