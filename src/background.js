// Cache for ad domains (if you need it later)
let adDomainsCache = new Set();

// Choose the appropriate API object (chrome or browser)
let browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Listen for extension installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("Enhanced Ad Muter extension installed");
});

console.log("Enhanced background is running.");

// register the file to be injected once on install only
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.scripting.registerContentScripts([{
    id: 'dailyMotionInj',
    matches: ['*://*.dailymotion.com/*'],
    js: ['src/dailyMotionInj.js'],
    world: 'MAIN',
    runAt: 'document_idle',
  }]);
});
// Listen for messages from content scripts or popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //  Handle "adDetected" messages
  if (request.type === "adDetected") {
    const adType = request.adType || "unknown";
    const tabUrl = sender.tab ? sender.tab.url : "unknown";

    console.log(`${adType} ad detected on page:`, tabUrl);
    console.log("Ad URL:", request.url);

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

    sendResponse({ success: true });
    return true;
  }
  if (request.type === "muteTab" && sender.tab && sender.tab.id !== undefined) {
    browserAPI.tabs.update(sender.tab.id, { muted: true }, () => {
      sendResponse({ success: true });
    });
    return true; // Must return true to indicate sendResponse will be called asynchronously
  }

  //  Handle "unmuteTab" messages
  if (request.type === "unmuteTab" && sender.tab && sender.tab.id !== undefined) {
    browserAPI.tabs.update(sender.tab.id, { muted: false }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // If we get here, it means we didn’t match any of the types above
  return false;
}); 
