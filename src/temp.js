// Enhanced JW Player detection patterns
const JW_PLAYER_PATTERNS = {
  // Existing patterns
  id: [
    'jwplayer',
    'jw-player',
    'jw_player',
    // New patterns for broader detection
    'watching-player',
    'video-player',
    'media-player',
    'stream-player',
    'player-container',
    'player-wrapper',
    'player-placeholder',
    'player-holder',
    'player-element',
    'player-target',
    'player-mount',
    'player-root'
  ],
  
  class: [
    'jwplayer',
    'jw-player',
    'jw_player',
    // New patterns
    'TopPlayer',
    'VideoPlayer',
    'MediaPlayer',
    'StreamPlayer',
    'player-container',
    'player-wrapper',
    'player-placeholder',
    'player-holder',
    'player-component',
    'video-container',
    'media-container',
    'stream-container'
  ],
  
  // Data attributes that might indicate JW Player
  dataAttributes: [
    'data-jwplayer',
    'data-jw-player',
    'data-player',
    'data-video-player',
    'data-media-player',
    'data-player-id',
    'data-player-config'
  ]
};

// Enhanced function to find JW Player instances
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
    
    // Method 3: Enhanced DOM container search
    if (instances.length === 0) {
      console.log("No instances found via API, searching DOM containers with enhanced patterns...");
      
      const containers = findPotentialJWPlayerContainers();
      
      containers.forEach(container => {
        if (container.id) {
          try {
            const player = window.jwplayer(container.id);
            if (player && player.getContainer && typeof player.on === 'function') {
              console.log(`Found JW Player instance via enhanced detection: ${container.id}`);
              instances.push(player);
            }
          } catch (error) {
            // Try alternative initialization methods
            try {
              // Sometimes JW Player instances are stored in data attributes or element properties
              if (container._jwplayer || container.jwplayer) {
                const player = container._jwplayer || container.jwplayer;
                if (player && typeof player.on === 'function') {
                  console.log(`Found JW Player instance via element property: ${container.id}`);
                  instances.push(player);
                }
              }
            } catch (innerError) {
              // Skip invalid containers
              console.log(`Could not initialize JW Player for container: ${container.id}`, innerError);
            }
          }
        }
      });
    }
    
    // Method 4: Check for JW Player instances in global scope
    if (instances.length === 0) {
      // Sometimes JW Player instances are stored in global variables
      const globalPlayerVars = ['player', 'jwPlayer', 'videoPlayer', 'mediaPlayer'];
      
      globalPlayerVars.forEach(varName => {
        if (window[varName] && typeof window[varName].on === 'function') {
          console.log(`Found JW Player instance in global variable: ${varName}`);
          instances.push(window[varName]);
        }
      });
    }
    
  } catch (error) {
    console.log("Error finding JW Player instances:", error);
  }
  
  return [...new Set(instances)]; // Remove duplicates
}

// Find potential JW Player containers using enhanced patterns
function findPotentialJWPlayerContainers() {
  const containers = new Set();
  
  // Search by ID patterns
  JW_PLAYER_PATTERNS.id.forEach(pattern => {
    // Exact match
    const exactMatch = document.getElementById(pattern);
    if (exactMatch) containers.add(exactMatch);
    
    // Partial match (contains pattern)
    const partialMatches = document.querySelectorAll(`[id*="${pattern}"]`);
    partialMatches.forEach(el => containers.add(el));
  });
  
  // Search by class patterns
  JW_PLAYER_PATTERNS.class.forEach(pattern => {
    // Exact class match
    const exactMatches = document.getElementsByClassName(pattern);
    Array.from(exactMatches).forEach(el => containers.add(el));
    
    // Partial class match
    const partialMatches = document.querySelectorAll(`[class*="${pattern}"]`);
    partialMatches.forEach(el => containers.add(el));
  });
  
  // Search by data attributes
  JW_PLAYER_PATTERNS.dataAttributes.forEach(attr => {
    const matches = document.querySelectorAll(`[${attr}]`);
    matches.forEach(el => containers.add(el));
  });
  
  // Additional heuristic: look for divs with "player" in id/class that have specific characteristics
  const allDivs = document.getElementsByTagName('div');
  Array.from(allDivs).forEach(div => {
    const id = div.id?.toLowerCase() || '';
    const className = div.className?.toString().toLowerCase() || '';
    
    // Check if element has "player" in id or class AND has characteristics of a video player
    if ((id.includes('player') || className.includes('player')) && 
        (div.offsetWidth > 200 && div.offsetHeight > 150)) { // Reasonable video player size
      
      // Additional checks for video player characteristics
      const hasVideoRelatedContent = 
        id.includes('video') || className.includes('video') ||
        id.includes('media') || className.includes('media') ||
        id.includes('stream') || className.includes('stream') ||
        id.includes('watch') || className.includes('watch') ||
        div.querySelector('video') || // Contains video element
        div.querySelector('canvas') || // Contains canvas (for video rendering)
        div.style.backgroundImage; // Has background image (poster/thumbnail)
      
      if (hasVideoRelatedContent) {
        console.log(`Found potential JW Player container via heuristics: ${div.id || div.className}`);
        containers.add(div);
      }
    }
  });
  
  return Array.from(containers);
}

// Enhanced function to check if JW Player is playing an ad
export function isJWPlayerAd(player) {
  try {
    if (!player) return false;
    
    // Method 1: Check ad block state
    if (typeof player.getAdBlock === 'function' && player.getAdBlock()) {
      console.log('JW Player ad detected via getAdBlock()');
      return true;
    }
    
    // Method 2: Check current playlist item for ad domains
    if (typeof player.getPlaylistItem === 'function') {
      const item = player.getPlaylistItem();
      if (item && item.file) {
        const parser = document.createElement("a");
        parser.href = item.file;
        
        if (isAdDomain(parser.hostname)) {
          console.log('JW Player ad detected via domain:', parser.hostname);
          return true;
        }
      }
    }
    
    // Method 3: Check advertising configuration
    if (typeof player.getAdvertising === 'function') {
      const adState = player.getAdvertising();
      if (adState && adState.tag) {
        console.log('JW Player has ad configuration');
        return true;
      }
    }
    
    // Method 4: Check player state and container for ad indicators
    const container = player.getContainer?.();
    if (container) {
      // Look for ad-specific elements or classes
      const adElements = container.querySelectorAll(`
        .jw-ad, .jw-advertising, [class*="ad-"], [class*="advertisement"],
        .jw-skip, .jw-ad-container, .jw-overlay-ad,
        [id*="ad"], [id*="advertisement"]
      `);
      
      if (adElements.length > 0) {
        console.log('JW Player ad detected via DOM elements');
        return true;
      }
      
      // Check for ad-related text content
      const containerText = container.textContent?.toLowerCase() || '';
      if (containerText.includes('advertisement') || 
          containerText.includes('sponsored') || 
          containerText.includes('skip ad')) {
        console.log('JW Player ad detected via text content');
        return true;
      }
    }
    
    // Method 5: Check player events and properties
    if (typeof player.getState === 'function') {
      const state = player.getState();
      
      // Some additional checks based on player state
      if (state === 'playing' || state === 'buffering') {
        // Check if current time indicates pre-roll ad (often starts at 0 and is short)
        const position = player.getPosition?.() || 0;
        const duration = player.getDuration?.() || 0;
        
        // If it's a very short video (< 60 seconds) starting from 0, might be an ad
        if (duration > 0 && duration < 60 && position < 5) {
          // Additional check: see if there are skip buttons or ad indicators
          const container = player.getContainer?.();
          if (container) {
            const skipButton = container.querySelector('.jw-skip, [class*="skip"]');
            if (skipButton) {
              console.log('JW Player ad detected via skip button presence');
              return true;
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error("Error checking JW Player ad state:", error);
  }
  
  return false;
}

// Function to setup enhanced monitoring for the specific case you found
export function setupJWPlayerMonitoring() {
  // Monitor for the specific pattern you identified
  const watchingPlayerElements = document.querySelectorAll('[id*="watching-player"]');
  
  watchingPlayerElements.forEach(element => {
    console.log('Found watching-player element:', element);
    
    // Try to initialize JW Player on this element
    if (element.id && typeof window.jwplayer === 'function') {
      try {
        const player = window.jwplayer(element.id);
        if (player && typeof player.on === 'function') {
          console.log(`Successfully initialized JW Player on: ${element.id}`);
          setupPlayerAdListeners(player);
        }
      } catch (error) {
        console.log(`Could not initialize JW Player on ${element.id}:`, error);
      }
    }
    
    // Also monitor for changes to this element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // Re-check for JW Player initialization
          setTimeout(() => {
            if (typeof window.jwplayer === 'function') {
              try {
                const player = window.jwplayer(element.id);
                if (player && typeof player.on === 'function') {
                  setupPlayerAdListeners(player);
                }
              } catch (error) {
                // Ignore errors
              }
            }
          }, 1000);
        }
      });
    });
    
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true
    });
  });
}

function setupPlayerAdListeners(player) {
  try {
    if (typeof player.on !== 'function') return;

    // Handle ad events
    player.on('adImpression', () => {
      console.log('JW Player ad started');
      // Your muting logic here
    });

    player.on('adComplete', () => {
      console.log('JW Player ad completed');
      // Your unmuting logic here
    });

    player.on('adSkipped', () => {
      console.log('JW Player ad skipped');
      // Your unmuting logic here
    });

    // Check for ads when playback starts
    player.on('play', () => {
      if (isJWPlayerAd(player)) {
        console.log('JW Player playing ad content');
        // Your muting logic here
      }
    });
    
    console.log('Successfully set up JW Player ad listeners');
  } catch (error) {
    console.log('Error setting up JW Player listeners:', error);
  }
}
