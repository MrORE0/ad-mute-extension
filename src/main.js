import { fetchAdServersList } from "./adServers.js";
import { checkAllVideos } from "./helpers.js";
import { setupVideoListeners } from "./videoUtils.js";

// Stats tracking
let stats = {
  videoAds: 0,
  overlayAds: 0,
  tabMutes: 0,
  jwPlayerAds: 0,
};

// Track initialization state
let isInitialized = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getStats") {
    sendResponse(stats);
  }
});

// Enhanced mutation observer that watches for new videos, iframes, JW Player elements, and attribute changes
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;

  for (const mutation of mutations) {
    // Check for new nodes
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the node is a video/iframe or contains videos/iframes
          if (
            node.tagName === "VIDEO" ||
            node.tagName === "IFRAME" ||
            node.tagName === "CANVAS" ||
            (node.getElementsByTagName &&
              (node.getElementsByTagName("video").length > 0 ||
                node.getElementsByTagName("iframe").length > 0 ||
                node.getElementsByTagName("canvas").length > 0))
          ) {
            shouldCheck = true;
          }

          // Check for JW Player containers or scripts
          if (
            (node.id && (node.id.includes("jwplayer") || node.id.includes("jw-player"))) ||
            (node.className && (node.className.toString().includes("jwplayer") || node.className.toString().includes("jw-player"))) ||
            (node.tagName === "SCRIPT" && node.src && (node.src.includes("jwplayer") || node.src.includes("jw-player")))
          ) {
            shouldCheck = true;
            console.log("JW Player element detected:", node);
          }
        }
      }
    }

    // Check for attribute changes on video elements
    if (
      mutation.type === "attributes" &&
      mutation.target.tagName === "VIDEO" &&
      (mutation.attributeName === "src" || mutation.attributeName === "currentSrc" || mutation.attributeName === "style")
    ) {
      setupVideoListeners(mutation.target);
      shouldCheck = true;
    }

    // Check for attribute changes on iframe elements
    if (
      mutation.type === "attributes" &&
      mutation.target.tagName === "IFRAME" &&
      (mutation.attributeName === "src" || mutation.attributeName === "style" || mutation.attributeName === "class")
    ) {
      shouldCheck = true;
    }

    // Check for attribute changes on canvas elements
    if (
      mutation.type === "attributes" &&
      mutation.target.tagName === "CANVAS" &&
      (mutation.attributeName === "style" ||
        mutation.attributeName === "class" ||
        mutation.attributeName === "width" ||
        mutation.attributeName === "height")
    ) {
      shouldCheck = true;
    }

    // Check for changes to JW Player containers
    if (
      mutation.type === "attributes" &&
      mutation.target.id &&
      (mutation.target.id.includes("jwplayer") || mutation.target.id.includes("jw-player"))
    ) {
      shouldCheck = true;
    }

    if (shouldCheck) break;
  }

  // Only run the check if we found relevant changes
  if (shouldCheck) {
    // Use requestAnimationFrame to avoid blocking the main thread
    requestAnimationFrame(checkAllVideos);
  }
});

// Initialize the extension
async function initialize() {
  // Prevent double initialization
  if (isInitialized) return;
  isInitialized = true;

  try {
    console.log("Initializing Ad Muter Extension");

    // Set extension start time for tracking
    window._extensionStartTime = Date.now();

    // Fetch ad servers list
    await fetchAdServersList();
    setupRegularVideoDetection();

    console.log("Ad Muter initialization complete");
  } catch (error) {
    console.error("Error initializing Ad Muter:", error);
    // Reset initialization flag if there was an error
    isInitialized = false;
  }
}

// Separate function for regular video detection
function setupRegularVideoDetection() {
  console.log("Setting up regular video detection");

  // Initial check for existing videos
  checkAllVideos();

  // Start observing DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "currentSrc", "style", "class", "width", "height"],
  });

  // Also observe head for dynamically loaded scripts
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }
}

// Check if this is a Dailymotion page
const isDailymotionPage =
  location.hostname.includes("dailymotion.com") ||
  document.querySelector('script[src*="dailymotion.com/player"]') ||
  document.querySelector('iframe[src*="dailymotion.com"]');

window.addEventListener("load", () => {
  // Only initialize if not already initialized
  if (!isInitialized && !isDailymotionPage) {
    setTimeout(initialize, 500);
  } else if (isDailymotionPage) {
    console.log("Dailymotion page detected.");
    // console.log("Injecting Dailymotion script...");
    //
    // // Send message to background script to inject the script
    // chrome.runtime.sendMessage({type: "injectDailymotionScript"});

  }
});
