// This script simulates the Pokémon Center queue request/response
// Add this to your extension for testing, then remove for production

// Log initialization
console.log("🎮 Queue Mock System initialized");

// Configuration for the mock
const MOCK_CONFIG = {
  enabled: true,           // Set to false to disable mocking
  initialPosition: 20,    // Starting queue position
  decrementInterval: 5000, // How often to decrease position (ms)
  decrementAmount: 2,      // How much to decrease by each time
  minPosition: 1           // Lowest position before "resetting" queue
};

// Store for the mock queue position
let mockQueuePosition = MOCK_CONFIG.initialPosition;

// Function to create a mock queue response
function createMockResponse() {
  return {
    pos: mockQueuePosition,
    waitTimeMs: mockQueuePosition * 1000,
    waitTimeSec: mockQueuePosition,
    waitTimeMin: Math.floor(mockQueuePosition / 60)
  };
}

// Function to simulate queue movement
function simulateQueueMovement() {
  if (!MOCK_CONFIG.enabled) return;
  
  // Decrease position
  mockQueuePosition = Math.max(
    mockQueuePosition - MOCK_CONFIG.decrementAmount, 
    MOCK_CONFIG.minPosition
  );
  
  // Log the new position
  console.log(`[MOCK] Queue position updated to: ${mockQueuePosition}`);
  
  // If we're at the lowest position, "reset" the queue after a while
  if (mockQueuePosition === MOCK_CONFIG.minPosition) {
    setTimeout(() => {
      mockQueuePosition = MOCK_CONFIG.initialPosition;
      console.log(`[MOCK] Queue reset to position: ${mockQueuePosition}`);
    }, 10000); // Wait 10 seconds before resetting
  }
}

// Start the queue movement simulation
const intervalId = setInterval(simulateQueueMovement, MOCK_CONFIG.decrementInterval);

// Intercept fetch requests to the queue API
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  // Check if this is a queue API request
  if (MOCK_CONFIG.enabled && url && url.toString().includes("_Incapsula_Resource?SWWRGTS=")) {
    console.log(`[MOCK] Intercepted queue request to: ${url}`);
    
    // Return a mock response instead
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(createMockResponse())
    });
  }
  
  // Pass through all other requests to the original fetch
  return originalFetch.apply(this, arguments);
};

// Listen for mock events from the test page
document.addEventListener("mockWebRequest", (event) => {
  if (MOCK_CONFIG.enabled) {
    const detail = event.detail;
    console.log(`[MOCK] Processing mock web request for URL: ${detail.url}`);
    
    // Send a message to the background script as if this was a real request
    chrome.runtime.sendMessage({
      type: "MOCK_QUEUE_REQUEST",
      url: detail.url,
      tabId: detail.tabId || chrome.runtime.id,
      initiator: detail.initiator || "https://www.pokemoncenter.com"
    }).catch(err => {
      console.log("[MOCK] Failed to send message to background script:", err);
    });
  }
});

// Listen for mock content script messages
document.addEventListener("mockContentScriptMessage", (event) => {
  if (MOCK_CONFIG.enabled && document.getElementById('queue-position-overlay')) {
    const detail = event.detail;
    console.log(`[MOCK] Simulating content script message:`, detail);
    
    // Update the actual overlay if it exists
    const overlay = document.getElementById('queue-position-overlay');
    if (overlay && detail.type === "UPDATE_QUEUE_POSITION") {
      overlay.textContent = `Position: #${detail.position}`;
    }
  }
});

// Add listener for cleanup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "DISABLE_MOCK") {
    clearInterval(intervalId);
    window.fetch = originalFetch;
    console.log("[MOCK] Mock system disabled");
  }
  return true;
});

// Create a fake request to kickstart the process on test page
setTimeout(() => {
  if (window.location.href.includes("test-page.html")) {
    console.log("[MOCK] Initializing on test page");
    
    // Send a message to notify the test page that the mock system is active
    if (window.postMessage) {
      window.postMessage({
        type: "EXTENSION_LOG",
        message: "Mock system initialized"
      }, "*");
    }
  }
}, 1000);