(() => {
  "use strict";

  const BOT_TAG = "[StarfoxViewingSubmitter]";
  const MIN_REFRESH_MS = 60_000;
  const MAX_REFRESH_MS = 300_000;
  const BLOCKED_LABEL_SNIPPETS = ["cannot attend", "date is fully booked"];

  let refreshScheduled = false;

  const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();

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
    console.log(`${BOT_TAG} Refreshing in ${seconds} seconds`);

    setTimeout(() => {
      location.reload();
    }, delay);
  };

  const submitBooking = async () => {
    const availableRadio = getCandidateRadio();
    if (!availableRadio) {
      scheduleRefresh();
      return;
    }

    console.log(`${BOT_TAG} Available viewing found`);

    await sleep(randomInt(300, 1200));
    if (!availableRadio.checked) {
      availableRadio.click();
    }

    await sleep(randomInt(1000, 3000));

    const saveButton = document.querySelector('button[aria-label="Save"]');
    if (!(saveButton instanceof HTMLButtonElement)) {
      scheduleRefresh();
      return;
    }

    console.log(`${BOT_TAG} Submitting booking`);
    await sleep(randomInt(200, 800));
    saveButton.click();
  };

  const start = () => {
    if (window.__flatfoxBotStarted) return;
    window.__flatfoxBotStarted = true;

    const initialDelay = randomInt(250, 1500);
    setTimeout(() => {
      submitBooking().catch((error) => {
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
