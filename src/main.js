import { fetchAdServersList} from "./adServers.js";
import { isAd, findAdVideos, handleVideoMuting }from "./helpers.js"
// Cache for ad domains
let adDomainsCache = new Set();

// Create a test element
const testDiv = document.createElement("div");
testDiv.style.position = "fixed";
testDiv.style.top = "0";
testDiv.style.left = "0";
testDiv.style.padding = "10px";
testDiv.style.backgroundColor = "blue";
testDiv.style.color = "white";
testDiv.style.zIndex = "999999";
testDiv.textContent = "🎯 Content Script is Running!";
document.body.appendChild(testDiv);


let adServersFetched = false;

async function startAdMuting() {
  if (!adServersFetched) {
    await fetchAdServersList();
    adServersFetched = true;
  }
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  handleVideoMuting();
}

function scoutForVideos() {
  const videos = document.getElementsByTagName("video");
  if (videos.length > 0) {
    console.log("Video tag detected! Starting ad muting logic.");
    startAdMuting();
    scoutObserver.disconnect();
  }
}

const scoutObserver = new MutationObserver(scoutForVideos);

function initialize() {
  // If there are videos already, start immediately
  if (document.getElementsByTagName("video").length > 0) {
    startAdMuting();
  } else {
    // Otherwise, watch for videos being added
    scoutObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log("No video tags found. Watching for new videos...");
  }
}

initialize();
