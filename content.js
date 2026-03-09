(() => {
  "use strict";

  const BOT_TAG = "[StarfoxViewingSubmitter]";
  const MIN_REFRESH_MS = 60_000;
  const MAX_REFRESH_MS = 300_000;
  const BLOCKED_LABEL_SNIPPETS = ["cannot attend", "date is fully booked"];
  const STATUS_ID = "starfox-viewing-submitter-status";

  let refreshScheduled = false;
  let statusElement = null;

  const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const nowLabel = () => new Date().toLocaleTimeString();

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
    wrapper.style.maxWidth = "320px";
    wrapper.style.padding = "10px 12px";
    wrapper.style.borderRadius = "10px";
    wrapper.style.background = "rgba(17, 24, 39, 0.92)";
    wrapper.style.color = "#F9FAFB";
    wrapper.style.font = "12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif";
    wrapper.style.zIndex = "2147483647";
    wrapper.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    wrapper.style.pointerEvents = "none";
    wrapper.innerHTML = [
      '<div style="font-weight:600;margin-bottom:2px;">Starfox Viewing Submitter</div>',
      '<div data-role="state">Starting…</div>',
      '<div data-role="time" style="opacity:.8;margin-top:2px;"></div>',
    ].join("");

    document.body.appendChild(wrapper);
    statusElement = wrapper;
    return statusElement;
  };

  const setStatus = (state, details = "") => {
    const ui = ensureStatusUi();
    const stateNode = ui.querySelector('[data-role="state"]');
    const timeNode = ui.querySelector('[data-role="time"]');
    if (stateNode) {
      stateNode.textContent = details ? `${state} · ${details}` : state;
    }
    if (timeNode) {
      timeNode.textContent = `Updated ${nowLabel()}`;
    }
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

    const delay = randomInt(MIN_REFRESH_MS, MAX_REFRESH_MS);
    const seconds = Math.round(delay / 1000);
    setStatus("Waiting for availability", `refresh in ${seconds}s`);
    console.log(`${BOT_TAG} Refreshing in ${seconds} seconds`);

    setTimeout(() => {
      location.reload();
    }, delay);
  };

  const submitBooking = async () => {
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

  const start = () => {
    if (window.__flatfoxBotStarted) return;
    window.__flatfoxBotStarted = true;
    ensureStatusUi();
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
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
