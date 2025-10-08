// Default mapping (you can edit in popup)
const DEFAULT_MAPPING = {
  name: "Anthony Smith",
  email: "anthony@example.com",
  roll: "B23CS001",
  college: "Example University",
  __default: "",
};

// UI wiring
const ta = document.getElementById("mapping");
const saveBtn = document.getElementById("save");
const fillBtn = document.getElementById("fill");
const defaultsBtn = document.getElementById("defaults");

function loadMappingToUI(mapping) {
  ta.value = JSON.stringify(mapping, null, 2);
}

chrome.storage.local.get(["formMapping"], (res) => {
  loadMappingToUI(res.formMapping || DEFAULT_MAPPING);
});

saveBtn.addEventListener("click", () => {
  try {
    const obj = JSON.parse(ta.value);
    chrome.storage.local.set({ formMapping: obj }, () =>
      alert("Mapping saved.")
    );
  } catch (e) {
    alert("Invalid JSON: " + e.message);
  }
});

defaultsBtn.addEventListener("click", () => {
  chrome.storage.local.set({ formMapping: DEFAULT_MAPPING }, () =>
    loadMappingToUI(DEFAULT_MAPPING)
  );
});

// Fill button: get mapping and inject fill script into page
fillBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.storage.local.get(["formMapping"], (res) => {
    const mapping = res.formMapping || DEFAULT_MAPPING;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (mappingArg) => {
        // ---------- injected code starts ----------
        const mapping = mappingArg || {};

        function getTextFromAria(el) {
          const ids =
            (el.getAttribute && el.getAttribute("aria-labelledby")) || "";
          if (!ids) return "";
          return ids
            .split(/\s+/)
            .map((id) => {
              const node = document.getElementById(id);
              return node ? node.innerText.trim() : "";
            })
            .filter(Boolean)
            .join(" ")
            .trim();
        }

        function findQuestionText(el) {
          // 1) try aria-labelledby
          const ariaText = getTextFromAria(el);
          if (ariaText) return ariaText;

          // 2) climb ancestors trying to find question title nodes (multiple fallbacks)
          let ancestor = el;
          for (let depth = 0; depth < 6 && ancestor; depth++) {
            ancestor = ancestor.parentElement;
            if (!ancestor) break;
            // common selectors where Google places question text
            const title = ancestor.querySelector(
              'div[role="heading"], .freebirdFormviewerComponentsQuestionBaseTitle, .freebirdFormviewerComponentsQuestionText, .freebirdFormviewerViewItemsItemItemTitle'
            );
            if (title && title.innerText.trim()) return title.innerText.trim();
            // also try any visible label-like text
            const candidate = Array.from(
              ancestor.querySelectorAll("label, span, div")
            ).find((n) => {
              const t = (n.innerText || "").trim();
              // heuristic: must be short and non-empty and not contain "Required" only
              return t && t.length < 200 && !/required/i.test(t);
            });
            if (candidate) {
              const text = (candidate.innerText || "").trim();
              if (text) return text;
            }
          }

          // 3) sibling text nodes fallback
          let prev = el.previousElementSibling;
          while (prev) {
            const t = (prev.innerText || "").trim();
            if (t) return t;
            prev = prev.previousElementSibling;
          }

          return "";
        }

        function normalize(s) {
          return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        }

        // create normalized mapping for quick lookup
        const normalizedMap = {};
        for (const k in mapping) {
          if (!mapping.hasOwnProperty(k)) continue;
          normalizedMap[normalize(k)] = mapping[k];
        }

        // Fill text-like controls (inputs, textarea)
        const textSelector =
          'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';
        const inputs = Array.from(document.querySelectorAll(textSelector));
        inputs.forEach((el) => {
          try {
            const q = normalize(findQuestionText(el));
            let answer = null;

            // exact question text match
            if (q && normalizedMap[q]) answer = normalizedMap[q];

            // keyword heuristics
            if (!answer && q) {
              if (q.includes("email") || q.includes("e-mail"))
                answer = normalizedMap["email"] || normalizedMap["e-mail"];
              else if (q.includes("name"))
                answer =
                  normalizedMap["name"] ||
                  normalizedMap["full name"] ||
                  normalizedMap["your name"];
              else if (
                q.includes("roll") ||
                q.includes("roll no") ||
                q.includes("roll number")
              )
                answer = normalizedMap["roll"] || normalizedMap["roll number"];
              else if (
                q.includes("college") ||
                q.includes("university") ||
                q.includes("institute")
              )
                answer = normalizedMap["college"];
              else if (q.includes("phone") || q.includes("mobile"))
                answer = normalizedMap["phone"] || normalizedMap["mobile"];
            }

            // fallback default answer
            if (!answer && mapping.__default) answer = mapping.__default;

            if (
              answer !== null &&
              answer !== undefined &&
              (answer + "").length > 0
            ) {
              el.focus();
              el.value = answer;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } catch (e) {
            console.warn("Autofill text input error", e);
          }
        });

        // Fill radio groups (click option whose label text matches mapping)
        const radioGroups = Array.from(
          document.querySelectorAll(
            'div[role="radiogroup"], .quantumWizTogglePaperRadioGroup, .freebirdFormviewerComponentsQuestionRadioRoot'
          )
        );
        radioGroups.forEach((group) => {
          try {
            const q = normalize(findQuestionText(group));
            let desired = normalizedMap[q];
            // fallback keyword
            if (!desired && q.includes("gender") && normalizedMap["gender"])
              desired = normalizedMap["gender"];
            if (!desired) return;

            const options = group.querySelectorAll(
              'div[role="radio"], .docssharedWizToggleLabeledContainer, .quantumWizTogglePaperRadioOption'
            );
            options.forEach((opt) => {
              const label = (opt.innerText || "").trim().toLowerCase();
              if (
                label &&
                desired.toLowerCase() &&
                label.includes(desired.toLowerCase())
              ) {
                try {
                  opt.click();
                } catch (e) {
                  opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                }
              }
            });
          } catch (e) {
            console.warn("Autofill radio error", e);
          }
        });

        // Fill checkboxes (accept array or single string)
        const checkboxGroups = Array.from(
          document.querySelectorAll(
            '.freebirdFormviewerComponentsQuestionCheckboxRoot, div[role="group"], div[role="list"]'
          )
        );
        checkboxGroups.forEach((group) => {
          try {
            const q = normalize(findQuestionText(group));
            const rawDesired = normalizedMap[q];
            if (!rawDesired) return;
            const desiredArr = Array.isArray(rawDesired)
              ? rawDesired
              : [rawDesired];
            const opts = group.querySelectorAll(
              'div[role="checkbox"], .docssharedWizToggleLabeledContainer'
            );
            opts.forEach((opt) => {
              const label = (opt.innerText || "").trim().toLowerCase();
              desiredArr.forEach((d) => {
                if (label && d && label.includes(d.toLowerCase())) {
                  try {
                    opt.click();
                  } catch (e) {
                    opt.dispatchEvent(
                      new MouseEvent("click", { bubbles: true })
                    );
                  }
                }
              });
            });
          } catch (e) {
            console.warn("Autofill checkbox error", e);
          }
        });

        // Simple <select> handling (native selects)
        const selects = Array.from(document.querySelectorAll("select"));
        selects.forEach((s) => {
          try {
            const q = normalize(findQuestionText(s));
            const desired = normalizedMap[q];
            if (!desired) return;
            for (const opt of s.options) {
              if (opt.text.toLowerCase().includes(desired.toLowerCase())) {
                s.value = opt.value;
                s.dispatchEvent(new Event("change", { bubbles: true }));
                break;
              }
            }
          } catch (e) {
            console.warn("Autofill select error", e);
          }
        });

        console.log("Smart autofill finished.");
        // ---------- injected code ends ----------
      },
      args: [mapping],
    });
  });
});
