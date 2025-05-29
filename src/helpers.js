import { isAdDomain } from "./adServers";

// Performance optimization: Use a throttled function for checking
export let lastCheckTime = 0;
export const THROTTLE_DELAY = 300; // Check at most once every 300ms

// Track videos and their current sources to detect changes
export const videoSources = new WeakMap();
export const setupVideos = new WeakSet();
export const videoStates = new WeakMap(); // Track if video was muted by us

// Tab muting state
export let tabMutedByUs = false;
export let tabMuteReason = null;

// Enhanced ad detection that checks video sources
export function isVideoAd(video) {
  if (!video) return false;
  
  const videoSrc = video.currentSrc || video.src;
  if (!videoSrc) return false;
  
  try {
    const parser = document.createElement("a");
    parser.href = videoSrc;
    
    return isAdDomain(parser.hostname);
  } catch (error) {
    console.error("Error parsing video URL:", error);
    return false;
  }
}

// Check if an iframe is likely an ad
export function isAdIframe(iframe) {
  if (!iframe || !iframe.src) return false;
  
  try {
    const parser = document.createElement("a");
    parser.href = iframe.src;
    
    return isAdDomain(parser.hostname);
  } catch (error) {
    console.error("Error parsing iframe URL:", error);
    return false;
  }
}

// Find iframes that are positioned over videos (overlay ads)
export function findOverlayAdIframes(video) {
  if (!video) return [];
  
  const videoRect = video.getBoundingClientRect();
  const overlayIframes = [];
  
  // Get all iframes in the document
  const iframes = document.getElementsByTagName('iframe');
  
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

// Hide overlay ad iframes
export function hideOverlayAds(video) {
  const overlayIframes = findOverlayAdIframes(video);
  
  overlayIframes.forEach(iframe => {
    console.log("Hiding overlay ad iframe:", iframe.src);
    iframe.style.display = 'none';
    iframe.setAttribute('data-ad-muter-hidden', 'true');
    
    // Send message to background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ 
        type: "adDetected", 
        url: iframe.src,
        adType: "overlay-iframe"
      });
    }
  });
  
  return overlayIframes.length > 0;
}

// Mute entire tab using chrome API
export async function muteTab(reason = "ad-detected") {
  if (tabMutedByUs) return; // Already muted by us
  
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const response = await chrome.runtime.sendMessage({ 
        type: "muteTab", 
        reason: reason 
      });
      
      if (response && response.success) {
        tabMutedByUs = true;
        tabMuteReason = reason;
        console.log(`Tab muted due to: ${reason}`);
        return true;
      }
    }
  } catch (error) {
    console.error("Failed to mute tab:", error);
  }
  
  return false;
}

// Unmute entire tab using chrome API
export async function unmuteTab() {
  if (!tabMutedByUs) return; // Not muted by us
  
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const response = await chrome.runtime.sendMessage({ 
        type: "unmuteTab" 
      });
      
      if (response && response.success) {
        tabMutedByUs = false;
        tabMuteReason = null;
        console.log("Tab unmuted");
        return true;
      }
    }
  } catch (error) {
    console.error("Failed to unmute tab:", error);
  }
  
  return false;
}

// Check if we can effectively mute ads on this page
export function canMuteAdsEffectively() {
  // Check if videos are mutable (not in protected iframes, etc.)
  const videos = document.getElementsByTagName("video");
  let mutableVideos = 0;
  
  for (const video of videos) {
    try {
      // Try to access video properties to see if we can control it
      const canAccess = video.muted !== undefined && video.currentSrc !== undefined;
      if (canAccess) mutableVideos++;
    } catch (error) {
      // Video is in a cross-origin iframe or otherwise protected
      continue;
    }
  }
  
  // If we have videos but can't control most of them, tab muting might be better
  return videos.length === 0 || mutableVideos / videos.length > 0.7;
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
    attributeFilter: ['src'] 
  });
}

// Show previously hidden overlay ads (when content resumes)
export function showOverlayAds() {
  const hiddenIframes = document.querySelectorAll('iframe[data-ad-muter-hidden="true"]');
  
  hiddenIframes.forEach(iframe => {
    console.log("Showing overlay ad iframe:", iframe.src);
    iframe.style.display = '';
    iframe.removeAttribute('data-ad-muter-hidden');
  });
}

export async function checkVideoSource(video) {
  if (!video) return;
  
  const currentSrc = video.currentSrc || video.src;
  const previousSrc = videoSources.get(video);
  let adDetected = false;
  let fallbackToTabMute = false;
  
  // Check for video source ads (existing functionality)
  if (currentSrc !== previousSrc) {
    videoSources.set(video, currentSrc);
    
    if (currentSrc && isVideoAd(video)) {
      console.log("Video source ad detected. Attempting to mute video player:", currentSrc);
      
      try {
        video.muted = true;
        videoStates.set(video, { mutedByUs: true, reason: 'video-src-ad' });
        adDetected = true;
        console.log("Successfully muted video player");
      } catch (error) {
        console.log("Failed to mute video player, will try tab muting:", error);
        fallbackToTabMute = true;
      }
      
      // Send message to background script
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ 
          type: "adDetected", 
          url: currentSrc,
          adType: "video-src",
          fallbackToTabMute: fallbackToTabMute
        });
      }
      
      // If we couldn't mute the video, try tab muting
      if (fallbackToTabMute) {
        const tabMuted = await muteTab("video-ad-unmutable");
        if (tabMuted) {
          adDetected = true;
        }
      }
      
      // Listen for the ad to end or source to change again
      const handleEnd = async () => {
        console.log("Video source ad ended or changed. Checking mute state.");
        
        if (fallbackToTabMute && tabMutedByUs) {
          // Wait a bit then check if ad is really over
          setTimeout(async () => {
            if (!isVideoAd(video)) {
              await unmuteTab();
            }
          }, 1000);
        } else {
          waitForSourceChange(video, () => {
            if (videoStates.get(video)?.mutedByUs) {
              video.muted = false;
              videoStates.set(video, { mutedByUs: false });
              console.log("Unmuting video after video source ad ended.");
            }
          });
        }
      };
      
      video.addEventListener("ended", handleEnd, { once: true });
      video.addEventListener("loadstart", handleEnd, { once: true });
      
    } else if (currentSrc && !isVideoAd(video)) {
      // This is regular content, ensure it's not muted by our extension
      const state = videoStates.get(video);
      if (video.muted && state?.mutedByUs && state?.reason === 'video-src-ad') {
        console.log("Regular content detected. Unmuting video player.");
        video.muted = false;
        videoStates.set(video, { mutedByUs: false });
      }
      
      // If tab was muted due to video ads, unmute it
      if (tabMutedByUs && tabMuteReason === "video-ad-unmutable") {
        await unmuteTab();
      }
    }
  }
  
  // Check for overlay iframe ads (enhanced functionality)
  if (video.offsetParent !== null) { // Only check if video is visible
    const overlayAdsFound = hideOverlayAds(video);
    
    if (overlayAdsFound && !adDetected) {
      // If we found overlay ads but video source is not an ad, try to mute the video
      if (!videoStates.get(video)?.mutedByUs) {
        console.log("Overlay ad detected. Attempting to mute underlying video content.");
        
        try {
          video.muted = true;
          videoStates.set(video, { mutedByUs: true, reason: 'overlay-ad' });
          console.log("Successfully muted underlying video");
        } catch (error) {
          console.log("Failed to mute underlying video, trying tab muting:", error);
          
          // If we can't mute the video and can't effectively control ads, mute the tab
          if (!canMuteAdsEffectively()) {
            await muteTab("overlay-ad-unmutable");
          }
        }
      }
    } else if (!overlayAdsFound && !isVideoAd(video)) {
      // No overlay ads and no video source ad - restore normal state
      const state = videoStates.get(video);
      if (state?.mutedByUs && state?.reason === 'overlay-ad') {
        console.log("No overlay ads detected. Unmuting video.");
        video.muted = false;
        videoStates.set(video, { mutedByUs: false });
        showOverlayAds(); // Show any previously hidden ads if needed
      }
      
      // If tab was muted due to overlay ads, unmute it
      if (tabMutedByUs && tabMuteReason === "overlay-ad-unmutable") {
        await unmuteTab();
      }
    }
  }
}

export function setupVideoListeners(video) {
  if (setupVideos.has(video)) return;
  setupVideos.add(video);
  
  // Listen for various events that indicate source changes
  const events = [
    'loadstart',     // Fired when loading starts
    'loadedmetadata', // Fired when metadata is loaded
    'canplay',       // Fired when video can start playing
    'play',          // Fired when video starts playing
    'playing'        // Fired when video starts playing after being paused
  ];
  
  events.forEach(eventType => {
    video.addEventListener(eventType, () => {
      checkVideoSource(video);
    });
  });
  
  // Also check immediately
  checkVideoSource(video);
}

// Process all video elements
export function checkAllVideos() {
  const now = Date.now();
  
  // Throttle checks to prevent excessive CPU usage
  if (now - lastCheckTime < THROTTLE_DELAY) return;
  lastCheckTime = now;

  // Get all video elements
  const videos = document.getElementsByTagName("video");
  
  if (videos.length === 0) return;
  
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

// Function to find video elements within ads
export function findAdVideos() {
  const allElements = document.getElementsByTagName("*");
  const video_elms = [];

  for (const element of allElements) {
    if (isAd(element)) {
      const videos = element.getElementsByTagName("video");
      for (const video of videos) {
        video_elms.push(video);
      }
    }
  }

  return video_elms;
}

// Function to handle video muting (legacy support)
export async function handleVideoMuting() {
  const video_elms = findAdVideos();

  for (const video of video_elms) {
    if (!video.paused && !video.muted) {
      try {
        video.muted = true;
        videoStates.set(video, { mutedByUs: true, reason: 'legacy' });
        console.log("Ad detected. Muted the video player.");

        video.addEventListener("ended", async () => {
          if (videoStates.get(video)?.mutedByUs) {
            video.muted = false;
            videoStates.set(video, { mutedByUs: false });
          }
        });
      } catch (error) {
        console.log("Failed to mute video, trying tab muting:", error);
        await muteTab("legacy-ad-unmutable");
        break; // Only need to mute tab once
      }
    }
  }
}
