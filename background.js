// Maximum number of retry attempts to avoid infinite loops
const MAX_RETRIES = 5;

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

// Keep track of active Pokémon Center tabs
let activePokemonCenterTabs = new Set();

// Monitor tab updates to track Pokémon Center tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("pokemoncenter.com")) {
    activePokemonCenterTabs.add(tabId);
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activePokemonCenterTabs.delete(tabId);
});

// Monitor Pokémon Center's queue API
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.includes("_Incapsula_Resource?SWWRGTS=")) {
      fetch(details.url)
        .then((response) => response.json())
        .then((data) => {
          // Only send to the tab that made the request
          if (details.tabId && details.tabId !== -1) {
            sendPositionToTab(details.tabId, data.pos);
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
  },
  { urls: ["*://*.pokemoncenter.com/*"] }
);
