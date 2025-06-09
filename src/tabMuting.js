// Tab muting state
export let tabMutedByUs = false;
export let tabMuteReason = null;

// Mute entire tab using chrome API
export async function muteTab(reason = "ad-detected") {
  if (tabMutedByUs){
    return; // Already muted by us
  }else{
    console.log("Muting tab...")
  }

  try {
    // if we are dealing with chrome and not another browser
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const response = await chrome.runtime.sendMessage({
        type: "muteTab",
        reason: reason,
      });

      if (response && response.success) {
        tabMutedByUs = true;
        tabMuteReason = reason;
        console.log(`Tab muted due to: ${reason}`);
        return true;
      }
    }
  } catch (error) {
    console.error("Error while muting tab", error);
  }
  return false;
}

// Unmute entire tab using chrome API
export async function unmuteTab() {
  if (!tabMutedByUs) return; // Not muted by us

  try {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const response = await chrome.runtime.sendMessage({
        type: "unmuteTab",
      });

      if (response && response.success) {
        tabMutedByUs = false;
        tabMuteReason = null;
        console.log("Tab unmuted");
        return true;
      }
    }
  } catch (error) {
    console.error("Failed to unmute tab:", error);
  }

  return false;
}
