import { fetchAdServersList } from "./adServers.js";
import { checkAllVideos } from "./helpers.js";
import { findJWPlayerInstances, isJWPlayerAd, muteJWPlayer } from "./jwhelpers.js";
import { setupVideoListeners } from "./videoUtils.js";
import { muteTab } from "./tabMuting.js";

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

// JW Player detection function
function setupJWPlayerMonitoring() {
  // Check if JW Player is available
  if (typeof window.jwplayer === "function") {
    console.log("JW Player detected on page");

    // Monitor JW Player instances
    const checkJWPlayers = () => {
      const players = findJWPlayerInstances();
      players.forEach((player) => {
        try {
          // Set up event listeners for ads
          if (typeof player.on === "function") {
            player.on("adBlock", () => {
              console.log("JW Player ad blocked");
              stats.jwPlayerAds++;
            });

            player.on("adRequest", () => {
              console.log("JW Player ad requested");
            });

            player.on("adImpression", () => {
              console.log("JW Player ad impression");
              stats.jwPlayerAds++;
            });
          }
        } catch (error) {
          console.log("Error setting up JW Player monitoring:", error);
        }
      });
    };

    // Check immediately and then periodically
    checkJWPlayers();
    setInterval(checkJWPlayers, 2000);
  }

  // Also check for JW Player loading after initial page load
  const checkForJWPlayer = () => {
    if (typeof window.jwplayer === "function" && !window._jwPlayerMonitoringSetup) {
      window._jwPlayerMonitoringSetup = true;
      setupJWPlayerMonitoring();
    }
  };

  // Check periodically for JW Player to load
  const jwPlayerCheckInterval = setInterval(() => {
    checkForJWPlayer();

    // Stop checking after 30 seconds
    if (Date.now() - window._extensionStartTime > 30000) {
      clearInterval(jwPlayerCheckInterval);
    }
  }, 1000);
}

// Enhanced mutation observer that watches for new videos, iframes, JW Player elements, and attribute changes
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  let shouldCheckJWPlayer = false;

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

          // Check for JW Player containers
          if (node.id && (node.id.includes("jwplayer") || node.id.includes("jw-player"))) {
            shouldCheckJWPlayer = true;
            shouldCheck = true;
          }

          if (node.className && (node.className.toString().includes("jwplayer") || node.className.toString().includes("jw-player"))) {
            shouldCheckJWPlayer = true;
            shouldCheck = true;
          }

          // Check for script tags loading JW Player
          if (node.tagName === "SCRIPT" && node.src && (node.src.includes("jwplayer") || node.src.includes("jw-player"))) {
            shouldCheckJWPlayer = true;
            console.log("JW Player script detected:", node.src);

            // Wait a bit for JW Player to initialize
            setTimeout(() => {
              setupJWPlayerMonitoring();
              checkAllVideos();
            }, 2000);
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

    // Check for attribute changes on canvas elements (might be used for video rendering)
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
      shouldCheckJWPlayer = true;
      shouldCheck = true;
    }

    if (shouldCheck) break;
  }

  // Only run the check if we found relevant changes
  if (shouldCheck) {
    // Use requestAnimationFrame to avoid blocking the main thread
    requestAnimationFrame(() => {
      // First check JW Player if needed
      if (shouldCheckJWPlayer) {
        const jwPlayers = findJWPlayerInstances();
        jwPlayers.forEach((player) => {
          if (isJWPlayerAd(player)) {
            if (!muteJWPlayer(player, "jw-player-ad")) {
              muteTab("jw-player-ad-unmutable");
            }
          }
        });
      }
      // Then check regular videos
      checkAllVideos();
    });
  }
});

// Initialize the extension
async function initialize() {
  // Prevent double initialization
  if (isInitialized) return;
  isInitialized = true;

  try {
    console.log("Initializing Enhanced Ad Muter Extension");

    // Set extension start time for tracking
    window._extensionStartTime = Date.now();

    // Fetch ad servers list
    await fetchAdServersList();

    // Set up JW Player monitoring
    setupJWPlayerMonitoring();

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

    // Set up periodic checks for missed elements
    setInterval(() => {
      checkAllVideos();
    }, 5000);

    console.log("Enhanced Ad Muter initialization complete");
  } catch (error) {
    console.error("Error initializing Enhanced Ad Muter:", error);
    // Reset initialization flag if there was an error
    isInitialized = false;
  }
}

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Also initialize on page load to catch any missed elements
window.addEventListener("load", () => {
  // Only initialize if not already initialized
  if (!isInitialized) {
    setTimeout(initialize, 1000);
  }
});

// Export stats for debugging
window.adMuterStats = stats;
