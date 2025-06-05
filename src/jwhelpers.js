export const jwPlayerInstances = new Map(); // Track JW Player instances
// JW Player detection and control
export function findJWPlayerInstances() {
  const instances = [];
  
  // Method 1: Check for global jwplayer function (since its usually left global)
  if (typeof window.jwplayer === 'function') {
    try {
      // Try to get all player instances if it exists(?.) otherwise its empty[]
      const players = window.jwplayer.getAllPlayers?.() || [];
      instances.push(...players); // push all players found
      
      // Also try tha  return [...new Set(instances)]; default instance
      const defaultPlayer = window.jwplayer();
      // if it exists and it has a container to interact with the DOM add it
      if (defaultPlayer && defaultPlayer.getContainer) {
        instances.push(defaultPlayer);
      }
    } catch (error) {
      console.log("Error accessing jwplayer instances:", error);
    }
  }
  
  // Method 2: Look for JW Player containers in DOM
  const jwContainers = document.querySelectorAll(
    '[id*="jwplayer"], [class*="jwplayer"], [id*="jw-player"], [class*="jw-player"]'
  );
  
  jwContainers.forEach(container => {
    // Try to get player instance from container
    if (container.id && typeof window.jwplayer === 'function') {
      try {
        const player = window.jwplayer(container.id);
        if (player && player.getContainer) {
          instances.push(player);
        }
      } catch (error) {
        // Silently continue
      }
    }
  });
  
  return [...new Set(instances)]; // Remove duplicates
}

// Control JW Player volume
export function muteJWPlayer(player, reason = "ad-detected") {
  try {
    if (player && typeof player.setMute === 'function') {
      player.setMute(true);
      jwPlayerInstances.set(player, { mutedByUs: true, reason });
      console.log(`JW Player muted due to: ${reason}`);
      return true;
    }
  } catch (error) {
    console.error("Failed to mute JW Player:", error);
  }
  return false;
}

export function unmuteJWPlayer(player) {
  try {
    if (player && typeof player.setMute === 'function') {
      const state = jwPlayerInstances.get(player);
      if (state?.mutedByUs) {
        player.setMute(false);
        jwPlayerInstances.set(player, { mutedByUs: false });
        console.log("JW Player unmuted");
        return true;
      }
    }
  } catch (error) {
    console.error("Failed to unmute JW Player:", error);
  }
  return false;
}

// Check if JW Player is playing an ad
export function isJWPlayerAd(player) {
  try {
    if (!player) return false;
    
    // Method 1: Check if player has ad-related methods/state
    if (typeof player.getAdBlock === 'function' && player.getAdBlock()) {
      return true;
    }
    
    // Method 2: Check current item/playlist for ad indicators
    if (typeof player.getPlaylistItem === 'function') {
      const item = player.getPlaylistItem(); // it return an object with lots of info about the currently displayed video
      if (item && item.file) {
        const parser = document.createElement("a");
        parser.href = item.file;
        console.log('Checking if the item is an ad -> ', item);
        return isAdDomain(parser.hostname);
      }
    }
    
    // Method 3: Check advertising state
    if (typeof player.getAdvertising === 'function') {
      const adState = player.getAdvertising();
      if (adState && adState.tag) {// the tag is the href for the ad
        // skip the add if the button is exposed
        // TEST: testing to see if it will skip the ad
        player.on('adTime', (e) => {
          if (e.position >= adState.skipoffset) {
            const skipBtn = document.querySelector('.jw-skip');
            if (skipBtn) {
              skipBtn.click();
            }
          }
        });
        return true;
      }
    }
    
    // Listen for ad events (this sets up listeners for future detection)
    if (typeof player.on === 'function') {
      player.on('adBlock', () => {
        console.log("JW Player ad detected via adBlock event");
        muteJWPlayer(player, "jw-adblock");
      });
      
      player.on('adComplete', () => {
        console.log("JW Player ad completed");
        unmuteJWPlayer(player);
      });
      
      player.on('adSkipped', () => {
        console.log("JW Player ad skipped");
        unmuteJWPlayer(player);
      });
    }
    
  } catch (error) {
    console.error("Error checking JW Player ad state:", error);
  }
  
  return false;
}
