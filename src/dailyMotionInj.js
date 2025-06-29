const clickPromise = new Promise(r => window.addEventListener('click', r, { once:true }));

async function removeRedSign() {
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


function redSign() {
  const overlay = document.createElement("div");
  overlay.setAttribute("id", "dm-ad-overlay");
  overlay.style.position = "fixed";
  overlay.style.top = "20px";
  overlay.style.right = "20px";
  overlay.style.width = "300px";
  overlay.style.height = "100px";
  overlay.style.backgroundColor = "red";
  overlay.style.color = "white";
  overlay.style.fontSize = "20px";
  overlay.style.fontWeight = "bold";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.border = "5px solid black";
  overlay.style.borderRadius = "10px";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "999999";
  overlay.textContent = "🔴 SCRIPT RUNNING!";
  document.body.appendChild(overlay);
  console.log("Big red square added - script is running");
  volume = player.playerVolume;
  console.log("Current volume is:", volume);
  player.setMute(true);
  player.setVolume(0); // just in case
}

function init() {
  // Make iframes more visible with yellow background
  console.log("Initializing the Injector...")
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    iframe.style.backgroundColor = "yellow";
    iframe.style.border = "30px solid orange";
    iframe.style.opacity = "0.8";
    console.log("Made iframe more visible:", iframe);
  }

  if (window.dailymotion){
    window.dailymotion.getPlayer("player_embed_script_placeholder").then(p => {
      player = p;
      console.log("Player loaded:", player);
      console.log("State of player:", player.getState());
      player

      // ✅ Only attach listener once
      player.on("ad_start", redSign);
      player.on("ad_end", removeRedSign);

    }).catch(err => {
      console.error("❌ Failed to get player:", err);
    });
  }else{
    console.log("No window.dailymotion was found.")
  }
}

let player;
let volume;
init();
