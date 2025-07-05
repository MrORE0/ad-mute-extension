import { isAd } from "./adDetection.js";
import { muteTab, unmuteTab } from './tabMuting.js'

function muteAdIfNeeded(video) {
  if (isAd(video)) {
    video.muted = true;
    console.log("Detected ad")
    muteTab();
    console.log('[EXT] Muted ad');
  } else {
    video.muted = false;
    console.log("AD ended.")
    unmuteTab();
    console.log('[EXT] Content video, unmuted');
  }
}

function isMainContent(element) {
  const mainContentIndicators = [
    'main', 'content', 'primary', 'center', 'middle',
    'watch', 'player', 'video', 'stream', 'media',
    'container', 'wrapper', 'body', 'article',
    'watchingplayers', 'videoplayer', 'mediaplayer',
    'playback', 'viewer', 'theatre', 'theater',
    'fullscreen', 'cinema', 'embed'
  ];
  let current = element;
  while (current && current !== document.body) {
    const className = current.className?.toString().toLowerCase() || '';
    const id = current.id?.toLowerCase() || '';
    const tagName = current.tagName.toLowerCase();
    if (['main', 'article', 'section'].includes(tagName)) return true;
    if (mainContentIndicators.some(ind => className.includes(ind) || id.includes(ind))) return true;
    current = current.parentElement;
  }
  return false;
}

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
  let current = element, levels = 0;
  while (current && current !== document.body && levels < 3) {
    const className = current.className?.toString().toLowerCase() || '';
    const id = current.id?.toLowerCase() || '';
    const tagName = current.tagName.toLowerCase();
    if (['aside', 'nav', 'header', 'footer'].includes(tagName)) return true;
    if (sideIndicators.some(ind => className.includes(ind) || id.includes(ind))) return true;
    if (current.hasAttribute('data-ad') || current.hasAttribute('data-advertisement') || current.hasAttribute('data-sponsored')) return true;
    if (current.tagName === 'VIDEO') {
      const rect = current.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 150) return true;
    }
    current = current.parentElement;
    levels++;
  }
  return false;
}

function init() {
  const videos = Array.from(document.getElementsByTagName('video'))
    .filter(v => !isSideContent(v) && isMainContent(v));

  console.log("videos found after filtering.", videos);
  const mainVideo = videos[0];
  if (mainVideo) {
    muteAdIfNeeded(mainVideo);
    mainVideo.addEventListener('durationchange', () => muteAdIfNeeded(mainVideo));
    mainVideo.addEventListener('loadedmetadata', () => muteAdIfNeeded(mainVideo));
  } else {
    console.log("NO MAIN CONTENT VIDEO FOUND");
  }
}

if (window._adMuteIframeInitialized) {
  // Already initialized in this iframe
  console.log("[EXT] iframe-muter.js already initialized, skipping.");
} else {
  init();
  window._adMuteIframeInitialized = true;
}
