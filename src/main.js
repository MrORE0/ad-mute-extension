import { fetchAdServersList } from "./adServers.js";
import { checkAllVideos, setupVideoListeners } from "./helpers.js";

// Stats tracking
let stats = {
  videoAds: 0,
  overlayAds: 0,
  tabMutes: 0
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getStats') {
    sendResponse(stats);
  }
});

// Enhanced mutation observer that watches for new videos, iframes, and attribute changes
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  
  for (const mutation of mutations) {
    // Check for new nodes
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the node is a video/iframe or contains videos/iframes
          if (node.tagName === 'VIDEO' || 
              node.tagName === 'IFRAME' ||
              (node.getElementsByTagName && 
               (node.getElementsByTagName('video').length > 0 || 
                node.getElementsByTagName('iframe').length > 0))) {
            shouldCheck = true;
            break;
          }
        }
      }
    }
    
    // Check for attribute changes on video elements
    if (mutation.type === 'attributes' && 
        mutation.target.tagName === 'VIDEO' && 
        (mutation.attributeName === 'src' || 
         mutation.attributeName === 'currentSrc' ||
         mutation.attributeName === 'style')) {
      setupVideoListeners(mutation.target);
      shouldCheck = true;
    }
    
    // Check for attribute changes on iframe elements (src changes, style changes for positioning)
    if (mutation.type === 'attributes' && 
        mutation.target.tagName === 'IFRAME' && 
        (mutation.attributeName === 'src' || 
         mutation.attributeName === 'style' ||
         mutation.attributeName === 'class')) {
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
  try {
    console.log("Initializing Enhanced Ad Muter extension...");
    
    // First fetch the ad servers list
    await fetchAdServersList();
    
    // Check any existing videos
    checkAllVideos();
    
    // Start observing the DOM for changes
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'currentSrc', 'style', 'class']
    });
    
    // Add a periodic check as a backup (less frequent)
    const checkInterval = setInterval(checkAllVideos, 3000);
    
    // Listen for ad detection events to update stats
    const originalSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function(message, ...args) {
      if (message.type === 'adDetected') {
        switch (message.adType) {
          case 'video-src':
            stats.videoAds++;
            break;
          case 'overlay-iframe':
            stats.overlayAds++;
            break;
        }
      }
      return originalSendMessage.call(this, message, ...args);
    };
    
    // Additional check for scroll events (overlay ads might appear on scroll)
    const scrollHandler = () => {
      requestAnimationFrame(checkAllVideos);
    };
    
    // Throttle scroll events
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(scrollHandler, 200);
    }, { passive: true });
    
    // Check on window resize (layout changes might affect overlay positioning)
    window.addEventListener('resize', () => {
      requestAnimationFrame(checkAllVideos);
    });
    
    // Clean up when navigating away
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      clearInterval(checkInterval);
      clearTimeout(scrollTimeout);
    });
    
    console.log("Enhanced Ad Muter extension initialized successfully");
    
  } catch (error) {
    console.error("Failed to initialize Enhanced Ad Muter extension:", error);
  }
}

// Start the extension once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
