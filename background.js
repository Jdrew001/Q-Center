// Send queue position ONLY if the content script is ready
function sendPositionToTab(tabId, position) {
    chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_QUEUE_POSITION",
      position: position
    }).catch((error) => {
      console.log("Message delayed (content script not ready yet):", error);
      // Retry after 1 second
      setTimeout(() => sendPositionToTab(tabId, position), 1000);
    });
  }
  
  // Monitor Pokémon Center's queue API
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (details.url.includes("_Incapsula_Resource?SWWRGTS=")) {
        fetch(details.url)
          .then((response) => response.json())
          .then((data) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                sendPositionToTab(tabs[0].id, data.pos); // Uses safe retry
              }
            });
          });
      }
    },
    { urls: ["*://*.pokemoncenter.com/*"] }
  );