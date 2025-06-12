import { isVideoAd } from "./adServers.js";
import { tabMutedByUs, unmuteTab, muteTab, tabMuteReason } from "./tabMuting.js";

// Track videos and their current sources to detect changes
export const videoSources = new WeakMap();
export const videoListeners = new WeakSet();
export const videoStates = new WeakMap(); // Track if video was muted by us

// Handle video source ads
async function handleVideoSourceAd(video, currentSrc) {
  console.log("Attempting to mute tab. Video source ad detected: ", currentSrc);

  try {
    video.muted = true;
    videoStates.set(video, { mutedByUs: true, reason: "video-src-ad" });
    const tabMuted = await muteTab("video-is-ad"); //needed as a variable

    if (tabMuted) {
      console.log("Successfully muted tab.");
    } else {
      console.log("Unsuccessfully muted tab.");
    }

    // Send message to background script
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "adDetected",
        url: currentSrc,
        adType: "video-src",
      });
    }

    // Listen for the ad to end - pass the actual tab mute status
    setupAdEndListeners(video, tabMuted);
    return true;
  } catch (error) {
    console.log("Failed to mute tab", error);

    // Send message with fallback flag
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "adDetected",
        url: currentSrc,
        adType: "video-src",
        fallbackToTabMute: true,
      });
    }
    return false;
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

// Check if element is in main content area
function isMainContent(element) {
  const mainContentIndicators = [
    'main', 'content', 'primary', 'center', 'middle',
    'watch', 'player', 'video', 'stream', 'media',
    'container', 'wrapper', 'body', 'article',
    'watchingplayers', 'videoplayer', 'mediaplayer',
    'playback', 'viewer', 'theatre', 'theater',
    'fullscreen', 'cinema', 'embed'
  ];

  // Check element and all its parents
  let current = element;
  while (current && current !== document.body) {
    const className = current.className?.toString().toLowerCase() || '';
    const id = current.id?.toLowerCase() || '';
    const tagName = current.tagName.toLowerCase();

    // Check for semantic main content elements
    if (['main', 'article', 'section'].includes(tagName)) {
      return true;
    }

    // Check for main content indicators in class names and IDs
    const hasMainIndicator = mainContentIndicators.some(indicator => 
      className.includes(indicator) || id.includes(indicator)
    );

    if (hasMainIndicator) {
      console.log(`Main content detected via: ${className || id || tagName}`);
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

// Check if element is side/auxiliary content
function isSideContent(element) {
  const sideIndicators = [
    'sidebar', 'aside', 'nav', 'navigation', 'menu',
    'header', 'footer', 'advertisement', 'ad-', 'ads',
    'social', 'share', 'comment', 'related', 'recommendation',
    'widget', 'banner', 'promo', 'adcolumn', 'adspace',
    'thumbnail', 'preview', 'miniature', 'small',
    'secondary', 'auxiliary', 'complementary', 'extra',
    'sponsored', 'promoted', 'commercial', 'marketing',
    'overlay', 'popup', 'modal', 'tooltip', 'notification',
    'breadcrumb', 'pagination', 'filter', 'sort',
    'tabs', 'accordion', 'carousel', 'slider',
    'meta', 'info', 'details', 'description', 'caption',
    'toolbar', 'controls', 'settings', 'options'
  ];

  // Check element and its immediate parents (up to 3 levels)
  let current = element;
  let levels = 0;
  
  while (current && current !== document.body && levels < 3) {
    const className = current.className?.toString().toLowerCase() || '';
    const id = current.id?.toLowerCase() || '';
    const tagName = current.tagName.toLowerCase();

    // Check for semantic HTML5 side content elements
    if (['aside', 'nav', 'header', 'footer'].includes(tagName)) {
      console.log(`Side content detected via semantic tag: ${tagName}`);
      return true;
    }

    // Check class names and IDs for side content indicators
    const hasSideIndicator = sideIndicators.some(indicator => 
      className.includes(indicator) || id.includes(indicator)
    );

    if (hasSideIndicator) {
      console.log(`Side content detected via: ${className || id || tagName}`);
      return true;
    }

    // Check for common ad/promotional attributes
    if (current.hasAttribute('data-ad') || 
        current.hasAttribute('data-advertisement') ||
        current.hasAttribute('data-sponsored')) {
      console.log(`Side content detected via ad attributes`);
      return true;
    }

    // Check for small video dimensions (likely thumbnails)
    if (current.tagName === 'VIDEO') {
      const rect = current.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 150) {
        console.log(`Side content detected via small video dimensions: ${rect.width}x${rect.height}`);
        return true;
      }
    }

    current = current.parentElement;
    levels++;
  }

  return false;
}

// Enhanced filtering that prioritizes main content
function filterVideos(videos) {
  const videoArray = Array.from(videos);
  const mainContentVideos = [];
  const otherVideos = [];

  videoArray.forEach(video => {
    // Skip videos that are clearly side content
    if (isSideContent(video)) {
      console.log(`Filtering out side content video:`, video);
      return;
    }

    // Prioritize videos in main content areas
    if (isMainContent(video)) {
      console.log(`Adding main content video:`, video);
      mainContentVideos.push(video);
    } else {
      otherVideos.push(video);
    }
  });

  // If we found videos in main content areas, prefer those
  // Otherwise, include other videos that aren't side content
  if (mainContentVideos.length > 0) {
    console.log(`Using ${mainContentVideos.length} main content videos`);
    return mainContentVideos;
  } else {
    console.log(`No main content videos found, using ${otherVideos.length} other videos`);
    return otherVideos;
  }
}

// Enhanced video detection that includes shadow DOM and canvas
export function findAllVideos() {
  const videos = [];

  // Standard video elements
  videos.push(...filterVideos(document.getElementsByTagName("video")));

  // Videos in shadow DOM
  videos.push(...filterVideos(findShadowVideos()));
  
  // Debug overlay for filtered videos
  for (const v of videos) {
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(255, 255, 0, 0.3)"; // translucent yellow
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "9999";

    v.style.position = "relative"; // ensure the video can host an overlay
    v.parentNode.insertBefore(overlay, v.nextSibling);
  }

  // Check for canvas elements that might be rendering video
  const canvases = Array.from(document.getElementsByTagName("canvas"));
  const filteredCanvases = canvases.filter(canvas => {
    // Skip canvas elements in side content
    if (isSideContent(canvas)) {
      return false;
    }

    // Check if canvas has video-like properties or is in a video container
    const parent = canvas.closest('[id*="player"], [class*="player"], [id*="video"], [class*="video"]');
    if (parent && isMainContent(canvas)) {
      // This canvas might be rendering video content in main area
      canvas._isVideoCanvas = true;
      return true;
    }
    return false;
  });

  videos.push(...filteredCanvases);

  console.log(`Total videos found: ${videos.length} (after filtering)`);
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
    console.log("Ad ended or changed. Checking mute state...", wasTabMuted, tabMutedByUs);

    if (wasTabMuted && tabMutedByUs) {
      console.log("Unmuting tab.");
      await unmuteTab();
    } else {
      waitForSourceChange(video, () => {
        console.log("Waiting for source change.");
        if (videoStates.get(video)?.mutedByUs) {
          video.muted = false;
          videoStates.set(video, { mutedByUs: false });
          console.log("Unmuting video after ad ended.");
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
