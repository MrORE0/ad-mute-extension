let adDomainsCache = new Set();

export async function fetchAdServersList() {
  try {
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
    "gcdn.2mdn.net"
  ];
  return commonAdDomains.some((domain) => hostname.includes(domain));
}
