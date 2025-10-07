document.getElementById("fill").addEventListener("click", async () => {
  // Get the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Inject our auto-fill script into the page
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillGoogleForm,
  });
});

function fillGoogleForm() {
  // Example data to fill
  const formData = {
    "entry.YPqjbf": "Anthony Smith", // Name
    // "entry.654321": "anthony@example.com", // Email
    // "entry.987654": "B23CS001", // Roll Number
  };

  // Loop through each field and fill it
  for (const [fieldName, value] of Object.entries(formData)) {
    const input = document.querySelector(`input[jsname='${fieldName}']`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true })); // helps trigger React/Vue listeners if any
    }
  }

  alert("Form fields filled!");
}
