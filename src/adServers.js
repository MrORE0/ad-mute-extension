let adDomainsCache = new Set();

export async function fetchAdServersList() {
  try {
    //TODO: cache these somewhere instead of always fething them, store until browser is quit
    const response = await fetch("https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt");
    const text = await response.text();

    const domains = text
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1];
      })
      .filter((domain) => domain && domain.includes("."));

    adDomainsCache = new Set(domains);
    console.log(`Loaded ${adDomainsCache.size} ad domains`);
  } catch (error) {
    console.error("Failed to fetch ad servers list:", error);
  }
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
