import { isAdDomain } from "./adServers";

// Performance optimization: Use a throttled function for checking
export let lastCheckTime = 0;
export const THROTTLE_DELAY = 300; // Check at most once every 300ms

// Track videos and their current sources to detect changes
export const videoSources = new WeakMap();
export const setupVideos = new WeakSet();

// ad detection that checks video sources
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

export function checkVideoSource(video) {
  if (!video) return;
  
  const currentSrc = video.currentSrc || video.src;
  const previousSrc = videoSources.get(video);
  
  // Only process if the source has changed or this is the first check
  if (currentSrc !== previousSrc) {
    videoSources.set(video, currentSrc);
    
    if (currentSrc && isVideoAd(video)) {
      console.log("Ad detected. Muting video player:", currentSrc);
      video.muted = true;
      
      // Send message to background script
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "adDetected", url: currentSrc });
      }
      
      // Listen for the ad to end or source to change again
      const handleEnd = () => {
        console.log("Ad ended or changed. Checking mute state.");
        waitForSourceChange(video, () => {
          video.muted = false;
          console.log("Unmuting video after ad ended.");
        });
      };
      
      video.addEventListener("ended", handleEnd, { once: true });
      video.addEventListener("loadstart", handleEnd, { once: true });
    } else if (currentSrc && !isVideoAd(video)) {
      // This is regular content, ensure it's not muted by our extension
      // Only unmute if we were the ones who muted it (basic check)
      if (video.muted && previousSrc && isVideoAd({ src: previousSrc })) {
        console.log("Regular content detected. Unmuting video player.");
        video.muted = false;
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

// Function to check if an element is likely an ad
export function isAd(element) {
  if (element.tagName === "VIDEO" && element.src) {
    const parser = document.createElement("a");
    parser.href = element.src;
    if (isAdDomain(parser.hostname)) {
      return true;
    }
  }

  const adIndicators = [
    "advertisement",
    "advert",
    "ad-container",
    "ad-wrapper",
    "ad-unit",
    "ad-slot",
    "ad-banner",
    "advertisement-container",
    "advertisement-wrapper",
    "advertisement-unit",
    "advertisement-slot",
    "advertisement-banner",
  ];

  const classNames = element.className.toString().toLowerCase();
  if (adIndicators.some((indicator) => classNames.includes(indicator))) {
    return true;
  }

  if (
    element.hasAttribute("data-ad") ||
    element.hasAttribute("data-advertisement") ||
    element.hasAttribute("data-ad-unit")
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

// Function to handle video muting
export function handleVideoMuting() {
  const video_elms = findAdVideos();

  video_elms.forEach((video) => {
    if (!video.paused && !video.muted) {
      video.muted = true;
      console.log("Ad detected. Muted the video player.");

      video.addEventListener("ended", () => {
        video.muted = false;
      });
    }
  });
}
