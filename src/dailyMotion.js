import {muteTab, unmuteTab} from "./tabMuting.js";

let playerObserverSetup = false;

export function observeDMplayer(placeholderId = "player_embed_script_placeholder") {
    if (window.dailymotion === undefined) {
      window.dailymotion = { 
        onScriptLoaded: () => {
          // Create a video player when script has loaded
         console.log("hey");
        }
      }
    } else {
      // Script already loaded
     console.log("heeeeeeeeeeey");
    }
  const interval = setInterval(() => {
    const dm = window.dailymotion;
    if (!dm) return;

    // Locate internal object with `players`
    const internal = Object.values(dm).find(obj =>
      obj && typeof obj === "object" && "players" in obj
    );

    const players = internal?.players;
    const isReady = players && Object.keys(players).length > 0;

    if (isReady) {
      clearInterval(interval);
      console.log("✅ Dailymotion player is ready!");

      dm.getPlayer(placeholderId)
        .then(player => {
          console.log("🎯 Player instance acquired:", player);
          player.on("PLAYER_VIDEOCHANGE", () => {
            try {
              const { adIsPlaying } = player.getState();
              console.log("🔁 Video changed. Ad playing?", adIsPlaying);
              adIsPlaying ? muteTab("dm-ad") : unmuteTab("dm-ad");
            } catch (err) {
              console.warn("⚠️ Could not read player state:", err);
            }
          });
        })
        .catch(err => {
          console.error("🔥 getPlayer() failed unexpectedly:", err);
        });
    }
  }, 500);

};

// Function to check if current video source is an ad
//
//


export function checkForAd(videoElement) {
    const src = videoElement.getAttribute("src");
    if (!src) return false;

    const isAd = src.includes("web_video_ads");

    if (isAd) {
      console.log("Ad detected:", src);
      mute();
    } else {
      console.log("Regular content:", src);
    }

    return isAd;
}




function setupListeners(player) {
  console.log("Setting up Dailymotion player listeners");
  
  // Listen for ad state changes
  player.on("PLAYER_VIDEOCHANGE", () => {
    try {
      const state = player.getState();
      console.log("Player state changed:", state);
      
      if (state.adIsPlaying) {
        console.log("Ad detected - muting tab");
        muteTab("dailymotion");
      } else {
        console.log("Content playing - unmuting tab");
        unmuteTab("dailymotion");
      }
    } catch (err) {
      console.warn("Error reading player state:", err);
    }
  });

  // Also listen for ad-specific events if available
  player.on("PLAYER_ADSTART", () => {
    console.log("Ad started - muting tab");
    muteTab("dailymotion");
  });

  player.on("PLAYER_ADEND", () => {
    console.log("Ad ended - unmuting tab");
    unmuteTab("dailymotion");
  });
}

export function waitForDailymotionPlayer() {
  return new Promise((resolve) => {
    console.log("Waiting for Dailymotion player to be ready...");

    // Function to check if everything is ready
    const checkReady = () => {
      // Check if DOM is ready
      if (document.readyState !== 'complete') {
        return false;
      }

      // Check if dailymotion API is loaded
      if (!window.dailymotion) {
        return false;
      }

      // Check if player script is loaded
      const playerScript = document.querySelector('script[src*="dailymotion.com/player"]');
      if (playerScript && !playerScript.complete) {
        return false;
      }
      return true;
    };

    // If already ready, resolve immediately
    if (checkReady()) {
      console.log("Dailymotion player environment is ready");
      resolve();
      return;
    }

    // Wait for window load first
    const onWindowLoad = () => {
      console.log("Window loaded, checking for Dailymotion player...");
      
      // Give it a moment for scripts to initialize
      setTimeout(() => {
        if (checkReady()) {
          resolve();
        } else {
          // Wait a bit more and try again
          setTimeout(() => {
            console.log("Dailymotion player environment ready after delay");
            resolve();
          }, 2000);
        }
      }, 1000);
    };

    if (document.readyState === 'complete') {
      onWindowLoad();
    } else {
      window.addEventListener('load', onWindowLoad, { once: true });
    }
  });
}
