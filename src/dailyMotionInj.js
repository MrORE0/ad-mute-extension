//mandatory for the unmute to work, it needs user interaction and this simulates it
const clickPromise = new Promise(r => window.addEventListener('click', r, { once: true }));

async function unmutePlayer() {
  // must simulate a user gesture in order to unmute
  await clickPromise;
  try {
    await player.setMute(false);
    await player.setVolume(volume ?? 0.5);
  } catch (err) {
    console.warn('Un-mute was blocked or failed', err);
  }

  console.log("removing sign......");
  document.getElementById("dm-ad-overlay")?.remove();
}


function mutePlayer() {
  volume = player.playerVolume;
  console.log("Current volume is:", volume);
  player.setMute(true);
  player.setVolume(0); // just in case
}

function init() {
  console.log("Initializing the Injector...")
  if (window.dailymotion) {
    window.dailymotion.getPlayer("player_embed_script_placeholder").then(p => {
      player = p;
      console.log("Player loaded:", player);
      console.log("State of player:", player.getState());
      player

      // ✅ Only attach listener once
      player.on("ad_start", mutePlayer);
      player.on("ad_end", unmutePlayer);

    }).catch(err => {
      console.error("❌ Failed to get player:", err);
    });
  } else {
    console.log("No window.dailymotion was found.")
  }
}

let player;
let volume;
init();
