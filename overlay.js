// Debug: Confirm script loaded
console.log("🎮 Overlay.js injected!");

// Create the overlay only if we're not in an iframe
if (window.self === window.top) {
  // Check if we're on a queue page
  function isQueuePage() {
    // Check if the URL contains typical queue indicators
    const url = window.location.href.toLowerCase();
    return url.includes("queue") || 
           url.includes("wait") || 
           document.title.toLowerCase().includes("queue") ||
           document.body.innerText.includes("waiting room");
  }

  // Create the overlay
  const overlay = document.createElement("div");
  overlay.id = "queue-position-overlay";
  
  // Initially set display based on whether we're on a queue page
  if (isQueuePage()) {
    overlay.textContent = "Loading Q";
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
  
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

  // Function to check if position should hide the overlay
  function shouldHideOverlay(position) {
    // Hide for position 0, -1, or "PC Queue"
    return position === 0 || 
           position === -1 || 
           position === "PC Queue";
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "UPDATE_QUEUE_POSITION") {
      // Log for testing
      console.log(`Received queue position update: ${request.position}`);
      
      // Convert string numbers to actual numbers for proper comparison
      let position = request.position;
      if (typeof position === 'string' && !isNaN(position)) {
        position = parseInt(position, 10);
      }
      
      // Only update DOM if position changed
      if (lastPosition !== position) {
        lastPosition = position;
        
        // Check if we should hide the overlay
        if (shouldHideOverlay(position)) {
          // Hide the overlay
          overlay.style.display = "none";
          console.log(`Queue position is ${position}, hiding overlay`);
          
          // Notify test environment
          if (window.postMessage) {
            window.postMessage({
              type: "EXTENSION_LOG", 
              message: `Hiding overlay for position: ${position}`
            }, "*");
          }
        } else if (typeof position === 'number' && position > 0) {
          // Show and update the overlay for positive numbers
          overlay.style.display = "flex"; // Ensure it's visible
          overlay.textContent = `Position: #${position}`;
          
          // Notify test environment
          if (window.postMessage) {
            window.postMessage({
              type: "EXTENSION_LOG", 
              message: `Updated overlay to position: #${position}`
            }, "*");
          }
        } else if (isQueuePage() && (position === null || position === undefined)) {
          // If we're on a queue page but don't have a position yet, show "Loading Q"
          overlay.style.display = "flex";
          overlay.textContent = "Loading Q";
        }
      }
          
          // Notify test environment
          if (window.postMessage) {
            window.postMessage({
              type: "EXTENSION_LOG", 
              message: `Updated overlay to position: #${request.position}`
            }, "*");
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