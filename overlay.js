// Debug: Confirm script loaded
console.log("🎮 Overlay.js injected!");

// Create the overlay
const overlay = document.createElement("div");
overlay.id = "queue-position-overlay";
overlay.textContent = "Loading Q";
document.body.appendChild(overlay);

// Listen for messages
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "UPDATE_QUEUE_POSITION") {
    overlay.textContent = `Position: #${request.position}`;
  }
  return true; // Required for Chrome MV3
});

// Signal to background.js that the content script is ready
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });