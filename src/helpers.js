import { isAdDomain, isVideoAd, isAdIframe } from "./adServers.js";
import { findAllVideos, setupVideoListeners, videoStates, videoSources, setupAdEndListeners, handleRegularContent } from "./videoUtils.js";
import { muteTab, unmuteTab, tabMutedByUs, tabMuteReason } from "./tabMuting.js";
import { findJWPlayerInstances, isJWPlayerAd } from "./jwhelpers.js";

// Performance optimization: Use a throttled function for checking
export let lastCheckTime = 0;
export const THROTTLE_DELAY = 300; // Check at most once every 300ms

// Track videos and their current sources to detect changes
export const videoListeners = new WeakSet();

// Track JW Player monitoring state
let jwPlayerMonitoringSetup = false;

// Set up JW Player monitoring
function setupJWPlayerMonitoring() {
  if (jwPlayerMonitoringSetup) return;
  
  // Only proceed if JW Player is actually available
  if (typeof window.jwplayer !== "function") return;
  
  jwPlayerMonitoringSetup = true;
  console.log("JW Player detected - setting up monitoring");

  const setupPlayerListeners = (player) => {
    try {
      if (typeof player.on !== "function") return;

      // Handle ad events
      player.on("adImpression", () => {
        console.log("JW Player ad started");
         muteTab("jw-player-ad-unmutable");
      });

      player.on("adComplete", () => {
        console.log("JW Player ad completed");
        unmuteTab();
      });

      player.on("adSkipped", () => {
        console.log("JW Player ad skipped");
        unmuteTab();
      });

      // Check for ads when playback starts
      player.on("play", () => {
        console.log(player + "is playing. Checking if it's an ad...")
        if (isJWPlayerAd(player)) {
            muteTab("jw-player-ad-unmutable");
          }
        }
      });

    } catch (error) {
      console.log("Error setting up JW Player listeners:", error);
    }
  };

  // Set up listeners for existing players
  const checkExistingPlayers = () => {
    const players = findJWPlayerInstances();
    players.forEach(setupPlayerListeners);
  };

  checkExistingPlayers();
  
  // Check for new players periodically for a limited time
  let checkCount = 0;
  const maxChecks = 15; // Check for 30 seconds max
  
  const playerCheckInterval = setInterval(() => {
    checkExistingPlayers();
    checkCount++;
    
    if (checkCount >= maxChecks) {
      clearInterval(playerCheckInterval);
    }
  }, 2000);

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

// Find iframes that are positioned over videos (overlay ads)
export function findOverlayAdIframes(video) {
  if (!video) return [];

  const videoRect = video.getBoundingClientRect();
  const overlayIframes = [];

  // Get all iframes in the document
  const iframes = document.getElementsByTagName("iframe");

  for (const iframe of iframes) {
    // Skip if not an ad iframe
    if (!isAdIframe(iframe)) continue;

    const iframeRect = iframe.getBoundingClientRect();

    // Check if iframe overlaps with video
    const isOverlapping = !(
      iframeRect.right < videoRect.left ||
      iframeRect.left > videoRect.right ||
      iframeRect.bottom < videoRect.top ||
      iframeRect.top > videoRect.bottom
    );

    if (isOverlapping) {
      overlayIframes.push(iframe);
    }
  }

  return overlayIframes;
}

// Check if we can effectively mute ads on this page
export function canMuteAds() {
  const videos = findAllVideos();
  const jwPlayers = findJWPlayerInstances();

  // If no media elements at all, return false
  if (videos.length === 0 && jwPlayers.length === 0) {
    return false;
  }

  // If we have JW Players, we can probably mute effectively
  if (jwPlayers.length > 0) {
    return true;
  }

  // For HTML5 videos, check just the first few to get a sense
  // Most sites either have all controllable or all protected videos
  const sampleSize = Math.min(3, videos.length);
  let controllableCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    try {
      if (videos[i].muted !== undefined) {
        controllableCount++;
      }
    } catch (error) {
      // Protected video
    }
  }

  // If most of our sample is controllable, assume the rest are too
  return controllableCount / sampleSize > 0.5;
}

export function waitForSourceChange(video, callback) {
  const observer = new MutationObserver(() => {
    if (!isVideoAd(video)) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(video, {
    attributes: true,
    attributeFilter: ["src"],
  });
}

// Process all video elements including JW Player instances
export function checkAllVideos() {
  const now = Date.now();

  // Throttle checks to prevent excessive CPU usage
  if (now - lastCheckTime < THROTTLE_DELAY) return;
  lastCheckTime = now;

  // Set up JW Player monitoring if needed
  setupJWPlayerMonitoring();

  // Get all video elements (including shadow DOM and canvas)
  const videos = findAllVideos();

  // Check JW Player instances first
  const jwPlayers = findJWPlayerInstances();
  jwPlayers.forEach((player) => {
    if (isJWPlayerAd(player)) {
        muteTab("jw-player-ad-unmutable");
    }
  });

  // Then check regular videos
  if (videos.length === 0 && jwPlayers.length === 0) return;

  for (const video of videos) {
    setupVideoListeners(video);
  }
}

// Enhanced function to check if an element is likely an ad
export function isAd(element) {
  if (element.tagName === "VIDEO" && element.src) {
    const parser = document.createElement("a");
    parser.href = element.src;
    if (isAdDomain(parser.hostname)) {
      return true;
    }
  }

  if (element.tagName === "IFRAME" && element.src) {
    return isAdIframe(element);
  }

  const adIndicators = [
    "advertisement",
    "advert",
    "ad-container",
    "ad-wrapper",
    "ad-unit",
    "ad-slot",
    "ad-banner",
    "ad-overlay",
    "ad-popup",
    "advertisement-container",
    "advertisement-wrapper",
    "advertisement-unit",
    "advertisement-slot",
    "advertisement-banner",
    "advertisement-overlay",
    "advertisement-popup",
  ];

  const classNames = element.className.toString().toLowerCase();
  if (adIndicators.some((indicator) => classNames.includes(indicator))) {
    return true;
  }

  if (
    element.hasAttribute("data-ad") ||
    element.hasAttribute("data-advertisement") ||
    element.hasAttribute("data-ad-unit") ||
    element.hasAttribute("data-ad-overlay")
  ) {
    return true;
  }

  return false;
}

