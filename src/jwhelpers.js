export const jwPlayerInstances = new Map(); // Track JW Player instances

// Find JW Player instances (not DOM containers)
export function findJWPlayerInstances() {
  const instances = [];
  
  // Only check if JW Player is actually loaded
  if (typeof window.jwplayer !== 'function') {
    return instances;
  }
  
  try {
    // Method 1: Get all player instances from JW Player API
    const players = window.jwplayer.getAllPlayers?.() || [];
    instances.push(...players);
    
    // Method 2: Try default instance
    const defaultPlayer = window.jwplayer();
    if (defaultPlayer && defaultPlayer.getContainer && !instances.includes(defaultPlayer)) {
      instances.push(defaultPlayer);
    }
    
    // Method 3: Check DOM containers only if we have no instances yet
    if (instances.length === 0) {
      console.log("No instances found, searching DOM containers...")
      const jwContainers = document.querySelectorAll('[id*="jwplayer"], [id*="jw-player"]');
      
      jwContainers.forEach(container => {
        if (container.id) {
          try {
            const player = window.jwplayer(container.id);
            if (player && player.getContainer && typeof player.on === 'function') {
              instances.push(player);
            }
          } catch (error) {
            // Skip invalid containers
          }
        }
      });
    }
  } catch (error) {
    console.log("Error finding JW Player instances:", error);
  }
  
  return [...new Set(instances)]; // Remove duplicates
}

// Check if JW Player is playing an ad
export function isJWPlayerAd(player) {
  try {
    if (!player) return false;
    
    // Method 1: Check ad block state
    if (typeof player.getAdBlock === 'function' && player.getAdBlock()) {
      return true;
    }
    
    // Method 2: Check current playlist item for ad domains
    if (typeof player.getPlaylistItem === 'function') {
      const item = player.getPlaylistItem();
      if (item && item.file) {
        const parser = document.createElement("a");
        parser.href = item.file;
        
        // Import ad domain check
        import('./adServers.js').then(({ isAdDomain }) => {
          if (isAdDomain(parser.hostname)) {
            console.log('JW Player ad detected via domain:', parser.hostname);
            return true;
          }
        });
      }
    }
    
    // Method 3: Check advertising configuration
    if (typeof player.getAdvertising === 'function') {
      const adState = player.getAdvertising();
      if (adState && adState.tag) {
        console.log('JW Player has ad configuration');
        
        // Try to skip ads when possible
        if (typeof player.on === 'function') {
          player.on('adTime', (event) => {
            if (event.position >= (adState.skipoffset || 5)) {
              const skipBtn = document.querySelector('.jw-skip');
              if (skipBtn && skipBtn.style.display !== 'none') {
                console.log('Attempting to skip JW Player ad');
                skipBtn.click();
              }
            }
          });
        }
        
        return true;
      }
    }
    
    // Method 4: Check player state for ad indicators
    if (typeof player.getState === 'function') {
      const state = player.getState();
      // Some JW Players indicate ad state in their status
      if (state === 'buffering' || state === 'playing') {
        // Additional check for ad-specific elements in player container
        const container = player.getContainer();
        if (container) {
          const adElements = container.querySelectorAll('.jw-ad, .jw-advertising, [class*="ad-"]');
          if (adElements.length > 0) {
            return true;
          }
        }
      }
    }
    
  } catch (error) {
    console.error("Error checking JW Player ad state:", error);
  }
  
  return false;
}
