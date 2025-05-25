
import { fetchAdServersList } from "./adServers.js";
import { checkAllVideos, setupVideoListeners } from "./helpers.js";

// Enhanced mutation observer that watches for new videos and attribute changes
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  
  for (const mutation of mutations) {
    // Check for new nodes
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the node is a video or contains videos
          if (node.tagName === 'VIDEO' || 
              (node.getElementsByTagName && node.getElementsByTagName('video').length > 0)) {
            shouldCheck = true;
            break;
          }
        }
      }
    }
    
    // Check for attribute changes on video elements
    if (mutation.type === 'attributes' && 
        mutation.target.tagName === 'VIDEO' && 
        (mutation.attributeName === 'src' || mutation.attributeName === 'currentSrc')) {
      setupVideoListeners(mutation.target);
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
    console.log("Initializing Ad Muter extension...");
    
    // First fetch the ad servers list
    await fetchAdServersList();
    
    // Check any existing videos
    checkAllVideos();
    
    // Start observing the DOM for changes
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'currentSrc']
    });
    // Add a periodic check as a backup (less frequent)
    const checkInterval = setInterval(checkAllVideos, 3000);
    
    // Clean up when navigating away
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      clearInterval(checkInterval);
    });
    
    console.log("Ad Muter extension initialized successfully");
    
  } catch (error) {
    console.error("Failed to initialize Ad Muter extension:", error);
  }
}

// Start the extension once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
