import { isAdDomain } from './adServers.js';
export const jwPlayerInstances = new Map(); // Track JW Player instances

const JW_PLAYER_PATTERNS = {
  // Existing patterns
  id: [
    'jwplayer',
    'jw-player',
    'jw_player',
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
    'player-root',
    'video'
  ],
  
  class: [
    'jwplayer',
    'jw-player',
    'jw_player',
    'topPlayer',
    'videoPlayer',
    'mediaPlayer',
    'streamPlayer',
    'player-container',
    'player-wrapper',
    'player-placeholder',
    'player-holder',
    'player-component',
    'video-container',
    'media-container',
    'stream-container',
    'watchingsection',
    'playerplaceholder',
    'video_view'
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



// Find JW Player instances (not DOM containers)
export function findJWPlayerInstances() {
  const instances = [];

  // Method 1: Check for global jwplayer function
  if (typeof window.jwplayer === 'function') {
    try {
      const players = (typeof window.jwplayer.getAllPlayers === 'function')
        ? window.jwplayer.getAllPlayers()
        : [];
      instances.push(...players);

      const defaultPlayer = window.jwplayer();
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
    if (container.id) {
      try {
        const player = window.jwplayer(container.id);
        if (player && player.getContainer && typeof player.on === 'function') {
          console.log(`Found JW Player instance via enhanced detection: ${container.id}`);
          instances.push(player);
        }
      } catch (error) {
        try {
          if (container._jwplayer || container.jwplayer) {
            const player = container._jwplayer || container.jwplayer;
            if (player && typeof player.on === 'function') {
              console.log(`Found JW Player instance via element property: ${container.id}`);
              instances.push(player);
            }
          }
        } catch (innerError) {
          console.log(`Could not initialize JW Player for container: ${container.id}`, innerError);
        }
      }
    }
  });

  return [...new Set(instances)];
}





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

// Check if JW Player is playing an ad
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
        
        // Import ad domain check
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
