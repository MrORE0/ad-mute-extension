// src/main.js - Optimized Version
import { fetchAdServersList, isAdDomain } from "./adServers.js";

// Performance optimization: Use a throttled function for checking
let lastCheckTime = 0;
const THROTTLE_DELAY = 500; // Check at most once every 500ms

// Track which videos we've already processed
const processedVideos = new WeakSet();

// Optimized ad detection that only checks video sources
function isVideoAd(video) {
  if (!video || !video.src) return false;
  
  // Parse the video source URL
  const parser = document.createElement("a");
  parser.href = video.src;
  
  // Check if the hostname matches known ad domains
  return isAdDomain(parser.hostname);
}

// Process newly added videos
function checkVideos() {
  const now = Date.now();
  
  // Throttle checks to prevent excessive CPU usage
  if (now - lastCheckTime < THROTTLE_DELAY) return;
  lastCheckTime = now;

  // Only get video elements - much more efficient than scanning all elements
  const videos = document.getElementsByTagName("video");
  
  if (videos.length === 0) return;
  
  for (const video of videos) {
    // Skip videos we've already processed
    if (processedVideos.has(video)) continue;
    
    // Mark this video as processed
    processedVideos.add(video);
    
    // Set up one-time listeners for source changes
    video.addEventListener("loadedmetadata", () => checkVideoSource(video), { once: true });
    
    // Also check it now in case it's already loaded
    checkVideoSource(video);
  }
}

function checkVideoSource(video) {
  if (isVideoAd(video)) {
    // This is an ad video, mute it
    console.log("Ad detected. Muting video player.");
    video.muted = true;
    
    // Listen for the ad to end
    video.addEventListener("ended", () => {
      console.log("Ad ended. Unmuting.");
      video.muted = false;
    }, { once: true });
  }
}

// Use a more targeted mutation observer that only watches for new videos
const videoObserver = new MutationObserver((mutations) => {
  // Check if any videos were added in these mutations
  let hasNewVideos = false;
  
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        // Check if the node is a video or contains videos
        if (node.tagName === 'VIDEO' || 
            (node.getElementsByTagName && node.getElementsByTagName('video').length > 0)) {
          hasNewVideos = true;
          break;
        }
      }
      if (hasNewVideos) break;
    }
  }
  
  // Only run the expensive check if we actually found new videos
  if (hasNewVideos) {
    checkVideos();
  }
});

// Initialize the extension
async function initialize() {
  // First fetch the ad servers list
  await fetchAdServersList();
  
  // Check any existing videos
  checkVideos();
  
  // Start observing the DOM for new videos
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Add a periodic check (as a backup)
  const checkInterval = setInterval(checkVideos, 2000);
  
  // Clean up when navigating away
  window.addEventListener('beforeunload', () => {
    videoObserver.disconnect();
    clearInterval(checkInterval);
  });
}

// Start the extension once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
