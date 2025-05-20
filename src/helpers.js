import { isAdDomain } from "./adServers";

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
