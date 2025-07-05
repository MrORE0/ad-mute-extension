let adDomainsCache = new Set();

export async function fetchAdServersList() {
  if (adDomainsCache.size) {
    console.log("Already cached, fetching from there.")
    return adDomainsCache;
  }

  const { adServers } = await chrome.storage.local.get('adServers');
  if (Array.isArray(adServers) && adServers.length) {
    adDomainsCache = new Set(adServers);
    console.log("Loading adservers from local");
    return adDomainsCache;
  }

  const resp = await fetch(
    'https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt'
  );
  const text = await resp.text();

  const domains = text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/).pop())
    .filter((d) => d.includes('.'));

  adDomainsCache = new Set(domains);

  // store as a plain array. Chrome converts it to JSON under the hood.
  await chrome.storage.local.set({ adServers: [...adDomainsCache] }).then(() =>
    console.log(`Fetched ${adDomainsCache.size} ad domains (cached locally).`));
  return adDomainsCache;
}

export function isAdDomain(hostname) {
  if (adDomainsCache.has(hostname)) {
    return true;
  }
  const commonAdDomains = [
    "doubleclick.net",
    "googleadservices.com",
    "adnxs.com",
    "advertising.com",
    "adform.net",
    "criteo.com",
    "outbrain.com",
    "taboola.com",
    "adroll.com",
    "amazon-adsystem.com",
    "gcdn.2mdn.net",
    "bimg.abv.bg"
  ];
  return commonAdDomains.some((domain) => hostname.includes(domain));
}

// Enhanced ad detection that checks video sources
export function isVideoAd(video) {
  if (!video) return false;

  // Handle canvas elements
  if (video.tagName === "CANVAS") {
    const parent = video.closest('[id*="player"], [class*="player"], [id*="video"], [class*="video"]');
    if (parent && (parent.innerHTML.includes("doubleclick") || parent.innerHTML.includes("googlesyndication"))) {
      return true;
    }
    return false;
  }

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
