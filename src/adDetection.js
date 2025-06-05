import { isAdDomain, isAdIframe } from "./adServers.js";

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
