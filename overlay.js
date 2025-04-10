// Debug: Confirm script loaded
console.log("🎮 Overlay.js injected!");

// Create the overlay only if we're not in an iframe
if (window.self === window.top) {
  // Create the overlay
  const overlay = document.createElement("div");
  overlay.id = "queue-position-overlay";
  overlay.textContent = "Loading Q";
  
  // Only append once DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(overlay);
      // Notify for test environment
      if (window.postMessage) {
        window.postMessage({
          type: "EXTENSION_LOG", 
          message: "Overlay added to DOM"
        }, "*");
      }
    });
  } else {
    document.body.appendChild(overlay);
    // Notify for test environment
    if (window.postMessage) {
      window.postMessage({
        type: "EXTENSION_LOG", 
        message: "Overlay added to DOM (immediately)"
      }, "*");
    }
  }
  
  // Keep track of last position to avoid unnecessary DOM updates
  let lastPosition = null;

  // Listen for messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "UPDATE_QUEUE_POSITION") {
      // Log for testing
      console.log(`Received queue position update: ${request.position}`);
      
      // Only update DOM if position changed
      if (lastPosition !== request.position) {
        lastPosition = request.position;
        overlay.textContent = `Position: #${request.position}`;
        
        // Notify test environment
        if (window.postMessage) {
          window.postMessage({
            type: "EXTENSION_LOG", 
            message: `Updated overlay to position: #${request.position}`
          }, "*");
        }
      }
    }
    return true; // Required for Chrome MV3
  });

  // Signal to background.js that the content script is ready
  chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" })
    .catch(error => {
      console.log("Failed to notify background script:", error);
      // This normally happens in testing when the background script isn't ready yet
      if (window.postMessage) {
        window.postMessage({
          type: "EXTENSION_LOG", 
          message: "Could not connect to background script yet"
        }, "*");
      }
    });
}