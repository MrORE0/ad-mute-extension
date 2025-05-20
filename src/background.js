// Cache for ad domains
let adDomainsCache = new Set();

// Check what browser we are on
let browserAPI = chrome;
if (typeof browser !== "undefined") {
  browserAPI = browser;
}

// Listen for extension installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("Ad Muter extension installed");
});

console.log("Background is running.");
// Listen for messages from content script
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "adDetected") {
    console.log("Ad detected on page:", sender.tab.url);
  }
});
