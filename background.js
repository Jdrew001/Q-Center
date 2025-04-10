// Configuration
const MAX_RETRIES = 5;
const THROTTLE_TIME = 5000; // Only check queue position every 5 seconds
let lastRequestTime = 0;
let pendingRequest = null;

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

// Throttled function to fetch queue position
function throttledFetchQueuePosition(url, tabId) {
  const currentTime = Date.now();
  
  // Cancel any pending requests
  if (pendingRequest) {
    clearTimeout(pendingRequest);
    pendingRequest = null;
  }
  
  // If we recently made a request, schedule this one for later
  if (currentTime - lastRequestTime < THROTTLE_TIME) {
    const waitTime = THROTTLE_TIME - (currentTime - lastRequestTime);
    console.log(`Throttling queue request. Will check again in ${waitTime}ms`);
    
    pendingRequest = setTimeout(() => {
      pendingRequest = null;
      throttledFetchQueuePosition(url, tabId);
    }, waitTime);
    
    return;
  }
  
  // Update the last request time
  lastRequestTime = currentTime;
  
  // Make the actual request
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      // Check if tabId is valid
      if (tabId && tabId !== -1) {
        sendPositionToTab(tabId, data.pos);
      } else {
        // Fallback to active tab in current window if request wasn't from a tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            sendPositionToTab(tabs[0].id, data.pos);
          }
        });
      }
    })
    .catch(error => {
      console.error("Error fetching queue data:", error);
    });
}

// Monitor Pokémon Center's queue API with a filter for specific requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only process this specific URL pattern once per THROTTLE_TIME period
    if (details.url.includes("_Incapsula_Resource?SWWRGTS=")) {
      throttledFetchQueuePosition(details.url, details.tabId);
    }
  },
  { urls: ["*://*.pokemoncenter.com/*"] }
);

// Listen for content script ready message
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONTENT_SCRIPT_READY") {
    console.log("Content script is ready");
  }
  return true;
});