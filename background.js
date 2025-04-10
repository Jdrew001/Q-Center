// Configuration
const MAX_RETRIES = 5;
const THROTTLE_TIME = 5000; // Only check queue position every 5 seconds
let lastRequestTime = 0;
let lastProcessedUrl = null;

// Development mode flag - set to true to enable mock testing
const DEV_MODE = true;

// Keep track of processed request URLs to prevent re-processing
const processedUrls = new Set();

// Send queue position ONLY if the content script is ready
function sendPositionToTab(tabId, position, retryCount = 0) {
  // Check if we've exceeded max retries
  if (retryCount >= MAX_RETRIES) {
    console.log(`Max retries (${MAX_RETRIES}) reached for tab ${tabId}. Giving up.`);
    return;
  }

  chrome.tabs.sendMessage(tabId, {
    type: "UPDATE_QUEUE_POSITION",
    position: position
  }).catch((error) => {
    console.log(`Message delayed (retry ${retryCount + 1}/${MAX_RETRIES}):`, error);
    
    // First check if the tab still exists before retrying
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab no longer exists, stop retrying
        console.log(`Tab ${tabId} no longer exists. Stopping retries.`);
        return;
      }
      
      // Retry with exponential backoff (1s, 2s, 4s, etc.)
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
      setTimeout(() => sendPositionToTab(tabId, position, retryCount + 1), backoffTime);
    });
  });
}

// Function to process queue API responses
function processQueueResponse(url, tabId) {
  const currentTime = Date.now();
  
  // Skip if we've seen this exact URL before
  if (processedUrls.has(url)) {
    console.log("Skipping already processed URL");
    return;
  }
  
  // Skip if we've recently checked and not enough time has passed
  if (currentTime - lastRequestTime < THROTTLE_TIME) {
    console.log(`Throttling: Skipping queue check (last check ${currentTime - lastRequestTime}ms ago)`);
    return;
  }
  
  // Remember this URL to avoid re-processing
  processedUrls.add(url);
  lastRequestTime = currentTime;
  lastProcessedUrl = url;
  
  console.log("Processing queue position request:", url.substring(0, 100) + "...");
  
  // Make the actual request to get queue position
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // Only process if the data contains a position
      if (data && typeof data.pos !== 'undefined') {
        console.log("Queue position:", data.pos);
        
        // Check if tabId is valid
        if (tabId && tabId !== -1) {
          sendPositionToTab(tabId, data.pos);
        } else {
          // Fallback to active tab in current window
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              sendPositionToTab(tabs[0].id, data.pos);
            }
          });
        }
      } else {
        console.log("Response didn't contain queue position data");
      }
    })
    .catch(error => {
      console.error("Error fetching queue data:", error);
    });
}

// Periodically clean up the processedUrls set to prevent memory growth
function cleanupProcessedUrls() {
  // Only keep the most recent 50 URLs
  if (processedUrls.size > 50) {
    const urlsToKeep = Array.from(processedUrls).slice(-50);
    processedUrls.clear();
    urlsToKeep.forEach(url => processedUrls.add(url));
  }
  // Schedule next cleanup
  setTimeout(cleanupProcessedUrls, 60000); // Clean up every minute
}
cleanupProcessedUrls(); // Start the cleanup cycle

// Monitor Pokémon Center's queue API with a filter for specific requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only process queue requests with the specific pattern
    if (details.url.includes("_Incapsula_Resource?SWWRGTS=") && 
        (DEV_MODE || (details.initiator && details.initiator.includes("pokemoncenter.com")))) {
      
      processQueueResponse(details.url, details.tabId);
    }
  },
  { urls: ["*://*.pokemoncenter.com/*"] }
);

// For development mode - inject the mock script into Pokémon Center pages
if (DEV_MODE) {
  chrome.scripting.registerContentScripts([{
    id: 'mock-queue',
    js: ['test-mock.js'],
    matches: ['*://*.pokemoncenter.com/*'],
    runAt: 'document_start'
  }])
  .then(() => console.log("Mock script registered"))
  .catch(err => console.error("Error registering mock script:", err));
  
  // Listen for mock events from the content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MOCK_QUEUE_REQUEST") {
      console.log("Received mock queue request");
      processQueueResponse(message.url, message.tabId);
    }
    return true;
  });
}

// Listen for content script ready message
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONTENT_SCRIPT_READY") {
    console.log("Content script is ready");
  }
  return true;
});