import { isVideoAd } from "./adServers.js";
import { tabMutedByUs, unmuteTab , muteTab, tabMuteReason} from "./tabMuting.js";


// Track videos and their current sources to detect changes
export const videoSources = new WeakMap();
export const videoListeners = new WeakSet();
export const videoStates = new WeakMap(); // Track if video was muted by us

// Handle video source ads
async function handleVideoSourceAd(video, currentSrc) {
  console.log("Video source ad detected. Attempting to mute video player:", currentSrc);

  try {
    video.muted = true;
    videoStates.set(video, { mutedByUs: true, reason: "video-src-ad" });
    console.log("Successfully muted video player");
    await muteTab("video-ad-unmutable");

    // Send message to background script
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "adDetected",
        url: currentSrc,
        adType: "video-src",
      });
    }

    // Listen for the ad to end
    setupAdEndListeners(video, false);
    return true;
  } catch (error) {
    console.log("Failed to mute video player, will try tab muting:", error);

    // Send message with fallback flag
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "adDetected",
        url: currentSrc,
        adType: "video-src",
        fallbackToTabMute: true,
      });
    }

    // Try tab muting as fallback
    const tabMuted = await muteTab("video-ad-unmutable");
    if (tabMuted) {
      setupAdEndListeners(video, true);
      return true;
    }
  }

  return false;
}

// Handle regular content (non-ad)
export async function handleRegularContent(video) {
  // This is regular content, ensure it's not muted by our extension
  const state = videoStates.get(video);
  if (video.muted && state?.mutedByUs && state?.reason === "video-src-ad") {
    console.log("Regular content detected. Unmuting video player.");
    video.muted = false;
    videoStates.set(video, { mutedByUs: false });
  }

  // If tab was muted due to video ads, unmute it
  if (tabMutedByUs && tabMuteReason === "video-ad-unmutable") {
    await unmuteTab();
  }
}

// Handle canvas-based video ads
async function handleCanvasAd(canvas) {
  if (isVideoAd(canvas)) {
    console.log("Canvas-based ad detected, using tab muting");
    await muteTab("canvas-ad");
    return true;
  }
  return false;
}

// Main function to check video source
export async function checkVideoSource(video) {
  if (!video) return;

  // Handle canvas elements
  if (video.tagName === "CANVAS") {
    await handleCanvasAd(video);
    return;
  }

  const currentSrc = video.currentSrc || video.src;
  const previousSrc = videoSources.get(video);

  // Only process if source changed
  if (currentSrc !== previousSrc) {
    videoSources.set(video, currentSrc);

    if (currentSrc && isVideoAd(video)) {
      await handleVideoSourceAd(video, currentSrc);
    } else if (currentSrc && !isVideoAd(video)) {
      await handleRegularContent(video);
    }
  }
}

// Find videos in shadow DOM
export function findShadowVideos() {
  const videos = [];

  function traverseShadowRoots(element) {
    // Check current element
    if (element.tagName === "VIDEO") {
      videos.push(element);
    }

    // Check for shadow root
    if (element.shadowRoot) {
      const shadowVideos = element.shadowRoot.querySelectorAll("video");
      videos.push(...shadowVideos);

      // Recursively check shadow roots within shadow roots
      const shadowElements = element.shadowRoot.querySelectorAll("*");
      shadowElements.forEach(traverseShadowRoots);
    }

    // Check regular children
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
      traverseShadowRoots(children[i]);
    }
  }

  traverseShadowRoots(document.documentElement);
  return videos;
}

// Enhanced video detection that includes shadow DOM and canvas
export function findAllVideos() {
  const videos = [];

  // Standard video elements
  videos.push(...document.getElementsByTagName("video"));

  // Videos in shadow DOM
  videos.push(...findShadowVideos());

  // Check for canvas elements that might be rendering video
  const canvases = document.getElementsByTagName("canvas");
  for (const canvas of canvases) {
    // Check if canvas has video-like properties or is in a video container
    const parent = canvas.closest('[id*="player"], [class*="player"], [id*="video"], [class*="video"]');
    if (parent) {
      // This canvas might be rendering video content
      canvas._isVideoCanvas = true;
      videos.push(canvas);
    }
  }
  return videos;
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

// Setup listeners for when ads end
export function setupAdEndListeners(video, wasTabMuted) {
  const handleEnd = async () => {
    console.log("Video source ad ended or changed. Checking mute state.");

    await unmuteTab();
    if (wasTabMuted && tabMutedByUs) {
      console.log("Trying to unmute tab.")
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

  // Remove existing listeners if any
  video.removeEventListener("ended", handleEnd);
  video.removeEventListener("loadstart", handleEnd);

  // Add new listeners
  video.addEventListener("ended", handleEnd, { once: true });
  video.addEventListener("loadstart", handleEnd, { once: true });
}

export function setupVideoListeners(video) {
  if (videoListeners.has(video)) return;
  videoListeners.add(video);

  // Handle canvas elements differently
  if (video.tagName === "CANVAS") {
    // For canvas, we mainly observe parent element changes
    const parent = video.parentElement;
    if (parent) {
      const observer = new MutationObserver(() => {
        checkVideoSource(video);
      });
      observer.observe(parent, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }
    checkVideoSource(video);
    return;
  }

  // Listen for various events that indicate source changes
  const events = [
    "loadstart", // Fired when loading starts
    "loadedmetadata", // Fired when metadata is loaded
    "canplay", // Fired when video can start playing
    "play", // Fired when video starts playing
    "playing", // Fired when video starts playing after being paused
  ];

  events.forEach((eventType) => {
    video.addEventListener(eventType, () => {
      checkVideoSource(video);
    });
  });

  // Also check immediately
  checkVideoSource(video);
}
