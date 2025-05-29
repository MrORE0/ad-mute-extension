// Cache for ad domains
let adDomainsCache = new Set();

// Check what browser we are on
let browserAPI = chrome;
if (typeof browser !== "undefined") {
  browserAPI = browser;
}

// Listen for extension installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("Enhanced Ad Muter extension installed");
});

console.log("Enhanced background is running.");

// Listen for messages from content script
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "adDetected") {
    const adType = request.adType || "unknown";
    const tabUrl = sender.tab ? sender.tab.url : "unknown";

    console.log(`${adType} ad detected on page:`, tabUrl);
    console.log("Ad URL:", request.url);

    // You could add additional logging or analytics here
    // For example, count different types of ads blocked:
    switch (adType) {
      case "video-src":
        console.log("Blocked video source ad");
        break;
      case "overlay-iframe":
        console.log("Blocked overlay iframe ad");
        break;
      case "legacy":
        console.log("Blocked legacy ad detection");
        break;
      default:
        console.log("Blocked unknown ad type");
    }

    // Handle tab muting
    if (request.type === "muteTab" && sender.tab && sender.tab.id !== undefined) {
      chrome.tabs.update(sender.tab.id, { muted: true }, () => {
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for async response
    }

    if (request.type === "unmuteTab" && sender.tab && sender.tab.id !== undefined) {
      chrome.tabs.update(sender.tab.id, { muted: false }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
  }
});
