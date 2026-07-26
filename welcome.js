/**
 * Welcome page script (external — Chrome MV3 forbids inline scripts).
 */
(async function () {
  try {
    await chrome.storage.local.set({ onboarding_completed: true });
  } catch (e) {}

  var skip = document.getElementById("skipWelcome");
  if (skip) {
    skip.addEventListener("click", function () {
      window.close();
    });
  }
})();
