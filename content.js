(() => {
  "use strict";

  const BOT_TAG = "[StarfoxViewingSubmitter]";
  const BLOCKED_LABEL_SNIPPETS = ["cannot attend", "date is fully booked"];
  const STATUS_ID = "starfox-viewing-submitter-status";
  const STORAGE_KEY = "refresh_range_minutes";
  const DEFAULT_MIN_MINUTES = 1;
  const DEFAULT_MAX_MINUTES = 5;
  const ABS_MIN_MINUTES = 1;
  const ABS_MAX_MINUTES = 180;

  let refreshScheduled = false;
  let statusElement = null;
  let refreshCountdownInterval = null;
  let statusState = "Starting...";
  let statusDetails = "";
  let refreshRangeMinutes = {
    min: DEFAULT_MIN_MINUTES,
    max: DEFAULT_MAX_MINUTES,
  };

  const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const nowLabel = () => new Date().toLocaleTimeString();

  const sanitizeMinutes = (minValue, maxValue) => {
    let min = Number.parseInt(String(minValue), 10);
    let max = Number.parseInt(String(maxValue), 10);

    if (!Number.isFinite(min)) min = DEFAULT_MIN_MINUTES;
    if (!Number.isFinite(max)) max = DEFAULT_MAX_MINUTES;

    min = Math.max(ABS_MIN_MINUTES, Math.min(ABS_MAX_MINUTES, min));
    max = Math.max(ABS_MIN_MINUTES, Math.min(ABS_MAX_MINUTES, max));

    if (min > max) {
      [min, max] = [max, min];
    }

    return { min, max };
  };

  const canUseStorage = () =>
    typeof chrome !== "undefined" &&
    !!chrome.storage &&
    !!chrome.storage.local;

  const loadRefreshRange = async () => {
    if (!canUseStorage()) return;

    try {
      const payload = await new Promise((resolve, reject) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(result);
        });
      });

      const stored = payload && payload[STORAGE_KEY];
      if (!stored || typeof stored !== "object") return;

      refreshRangeMinutes = sanitizeMinutes(stored.min, stored.max);
    } catch (error) {
      console.warn(`${BOT_TAG} Failed to load saved range`, error);
    }
  };

  const saveRefreshRange = async (range) => {
    if (!canUseStorage()) return;

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: range }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  };

  const ensureStatusUi = () => {
    if (statusElement && document.body.contains(statusElement)) return statusElement;

    const existing = document.getElementById(STATUS_ID);
    if (existing) {
      statusElement = existing;
      return statusElement;
    }

    const wrapper = document.createElement("div");
    wrapper.id = STATUS_ID;
    wrapper.style.position = "fixed";
    wrapper.style.right = "16px";
    wrapper.style.bottom = "16px";
    wrapper.style.maxWidth = "340px";
    wrapper.style.padding = "10px 12px";
    wrapper.style.borderRadius = "10px";
    wrapper.style.background = "rgba(17, 24, 39, 0.92)";
    wrapper.style.color = "#F9FAFB";
    wrapper.style.font = "12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif";
    wrapper.style.zIndex = "2147483647";
    wrapper.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    wrapper.style.pointerEvents = "auto";
    wrapper.innerHTML = [
      '<div style="font-weight:600;margin-bottom:2px;">Starfox Viewing Submitter</div>',
      '<div data-role="state">Starting...</div>',
      '<div data-role="time" style="opacity:.85;margin-top:2px;"></div>',
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;">',
      '<label style="display:flex;align-items:center;gap:4px;">Min <input data-role="min-minutes" type="number" min="1" max="180" step="1" style="width:58px;background:#111827;color:#F9FAFB;border:1px solid #4B5563;border-radius:6px;padding:2px 4px;"></label>',
      '<label style="display:flex;align-items:center;gap:4px;">Max <input data-role="max-minutes" type="number" min="1" max="180" step="1" style="width:58px;background:#111827;color:#F9FAFB;border:1px solid #4B5563;border-radius:6px;padding:2px 4px;"></label>',
      '<button data-role="save-range" type="button" style="background:#10B981;color:#052E16;border:0;border-radius:6px;padding:4px 8px;font-weight:600;cursor:pointer;">Save</button>',
      "</div>",
      '<div data-role="config-note" style="opacity:.85;margin-top:6px;min-height:16px;"></div>',
    ].join("");

    document.body.appendChild(wrapper);
    statusElement = wrapper;

    const saveButton = wrapper.querySelector('[data-role="save-range"]');
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const minInput = wrapper.querySelector('[data-role="min-minutes"]');
        const maxInput = wrapper.querySelector('[data-role="max-minutes"]');

        const range = sanitizeMinutes(
          minInput && "value" in minInput ? minInput.value : refreshRangeMinutes.min,
          maxInput && "value" in maxInput ? maxInput.value : refreshRangeMinutes.max
        );

        refreshRangeMinutes = range;
        syncRangeInputs();
        renderStatus();

        void saveRefreshRange(range)
          .then(() => {
            setConfigNote(
              refreshScheduled
                ? `Saved ${range.min}-${range.max} min (applies next cycle)`
                : `Saved ${range.min}-${range.max} min`
            );
          })
          .catch(() => {
            setConfigNote("Could not save range", true);
          });
      });
    }

    return statusElement;
  };

  const setConfigNote = (message, isError = false) => {
    const ui = ensureStatusUi();
    const noteNode = ui.querySelector('[data-role="config-note"]');
    if (!noteNode) return;

    noteNode.textContent = message;
    noteNode.style.color = isError ? "#FCA5A5" : "#A7F3D0";

    setTimeout(() => {
      if (noteNode.textContent === message) {
        noteNode.textContent = "";
      }
    }, 3000);
  };

  const syncRangeInputs = () => {
    const ui = ensureStatusUi();
    const minInput = ui.querySelector('[data-role="min-minutes"]');
    const maxInput = ui.querySelector('[data-role="max-minutes"]');

    if (minInput) minInput.value = String(refreshRangeMinutes.min);
    if (maxInput) maxInput.value = String(refreshRangeMinutes.max);
  };

  const renderStatus = () => {
    const ui = ensureStatusUi();
    const stateNode = ui.querySelector('[data-role="state"]');
    const timeNode = ui.querySelector('[data-role="time"]');

    if (stateNode) {
      stateNode.textContent = statusDetails
        ? `${statusState} · ${statusDetails}`
        : statusState;
    }

    if (timeNode) {
      timeNode.textContent =
        `Range ${refreshRangeMinutes.min}-${refreshRangeMinutes.max} min · Updated ${nowLabel()}`;
    }
  };

  const setStatus = (state, details = "") => {
    statusState = state;
    statusDetails = details;
    renderStatus();
  };

  const clearRefreshCountdown = () => {
    if (!refreshCountdownInterval) return;
    clearInterval(refreshCountdownInterval);
    refreshCountdownInterval = null;
  };

  const startRefreshCountdown = (totalSeconds) => {
    clearRefreshCountdown();

    let remainingSeconds = totalSeconds;
    setStatus("Waiting for availability", `refresh in ${remainingSeconds}s`);

    refreshCountdownInterval = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        clearRefreshCountdown();
        return;
      }

      setStatus("Waiting for availability", `refresh in ${remainingSeconds}s`);
    }, 1000);
  };

  const isDisabled = (radio) =>
    radio.disabled || normalize(radio.getAttribute("aria-disabled")) === "true";

  const findAssociatedLabel = (radio) => {
    if (!radio.id) return null;

    try {
      return document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
    } catch {
      return document.querySelector(`label[for="${radio.id.replace(/"/g, '\\"')}"]`);
    }
  };

  const getLabelText = (radio) => {
    const ariaLabel = radio.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel;

    const wrappingLabel = radio.closest("label");
    if (wrappingLabel && wrappingLabel.textContent) return wrappingLabel.textContent;

    const associatedLabel = findAssociatedLabel(radio);
    if (associatedLabel && associatedLabel.textContent) return associatedLabel.textContent;

    return "";
  };

  const isBlockedLabel = (labelText) => {
    const normalizedLabel = normalize(labelText);
    return BLOCKED_LABEL_SNIPPETS.some((snippet) => normalizedLabel.includes(snippet));
  };

  const getCandidateRadio = () => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));

    for (const radio of radios) {
      if (!(radio instanceof HTMLInputElement)) continue;
      if (isDisabled(radio)) continue;

      const labelText = getLabelText(radio);
      // Ignore unlabeled radios to avoid selecting unknown options such as "Cannot attend".
      if (!labelText) continue;
      if (isBlockedLabel(labelText)) continue;

      return radio;
    }

    return null;
  };

  const scheduleRefresh = () => {
    if (refreshScheduled) return;
    refreshScheduled = true;

    const minMs = refreshRangeMinutes.min * 60_000;
    const maxMs = refreshRangeMinutes.max * 60_000;
    const delay = randomInt(minMs, maxMs);
    const seconds = Math.ceil(delay / 1000);

    startRefreshCountdown(seconds);
    console.log(`${BOT_TAG} Refreshing in ${seconds} seconds`);

    setTimeout(() => {
      clearRefreshCountdown();
      location.reload();
    }, delay);
  };

  const submitBooking = async () => {
    clearRefreshCountdown();
    setStatus("Scanning viewing options");

    const availableRadio = getCandidateRadio();
    if (!availableRadio) {
      scheduleRefresh();
      return;
    }

    setStatus("Date found", "preparing selection");
    console.log(`${BOT_TAG} Available viewing found`);

    await sleep(randomInt(300, 1200));
    if (!availableRadio.checked) {
      setStatus("Selecting date");
      availableRadio.click();
    }

    await sleep(randomInt(1000, 3000));

    const saveButton = document.querySelector('button[aria-label="Save"]');
    if (!(saveButton instanceof HTMLButtonElement)) {
      setStatus("Save button unavailable", "will retry");
      scheduleRefresh();
      return;
    }

    setStatus("Submitting booking");
    console.log(`${BOT_TAG} Submitting booking`);
    await sleep(randomInt(200, 800));
    saveButton.click();
    setStatus("Booking submitted", "waiting for page response");
  };

  const start = async () => {
    if (window.__flatfoxBotStarted) return;
    window.__flatfoxBotStarted = true;

    await loadRefreshRange();
    ensureStatusUi();
    syncRangeInputs();
    setStatus("Bot active", "starting scan");

    const initialDelay = randomInt(250, 1500);
    setTimeout(() => {
      submitBooking().catch((error) => {
        setStatus("Error", "check console");
        console.error(`${BOT_TAG} Unexpected error`, error);
        scheduleRefresh();
      });
    }, initialDelay);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void start();
    }, { once: true });
  } else {
    void start();
  }
})();
