const API_URL = "https://bnfktvsyfkic5f5eegvcnsmqda0pzpnw.lambda-url.ap-south-1.on.aws";
const $ = s => document.querySelector(s);
const state = { stars: 0, tags: {} }; // tags: name -> "up" | "down"
let cfg, rid;

async function init() {
  rid = new URLSearchParams(location.search).get("r");
  try {
    const all = await (await fetch("restaurants.json")).json();
    cfg = all[rid];
  } catch (e) {}
  if (!cfg) { document.body.innerHTML = "<p class='err' style='padding:24px'>Restaurant not found.</p>"; return; }
  $("#name").textContent = cfg.name;
  renderStars(); renderTags();
  if (cfg.feedbackUrl) { $("#private").href = cfg.feedbackUrl; $("#private").hidden = false; }
  $("#gen").onclick = generate;
  $("#regen").onclick = generate;
  $("#post").onclick = post;
}

function renderStars() {
  const box = $("#stars"); box.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.textContent = "★"; b.setAttribute("aria-label", i + " stars");
    b.className = i <= state.stars ? "on" : "";
    b.onclick = () => { state.stars = i; renderStars(); };
    box.appendChild(b);
  }
}

function renderTags() {
  const box = $("#tags"); box.innerHTML = "";
  cfg.tags.forEach(t => {
    const b = document.createElement("button");
    b.textContent = t; b.className = state.tags[t] || "";
    b.onclick = () => {
      const next = { undefined: "up", up: "down", down: undefined }[state.tags[t]];
      if (next) state.tags[t] = next; else delete state.tags[t];
      renderTags();
    };
    box.appendChild(b);
  });
}

async function generate() {
  const err = $("#err"); err.hidden = true;
  const liked = Object.keys(state.tags).filter(t => state.tags[t] === "up");
  const disliked = Object.keys(state.tags).filter(t => state.tags[t] === "down");
  const note = $("#note").value.trim(), dish = $("#dish").value.trim();
  if (!state.stars) return showErr("Please pick a star rating first.");
  if (!liked.length && !disliked.length && !note) return showErr("Tap at least one thing, or add a line of your own.");
  const btn = $("#gen"); btn.disabled = true; btn.textContent = "Writing…";
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant: cfg.name, cuisine: cfg.cuisine, stars: state.stars, liked, disliked, dish, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    $("#draft").value = data.review;
    $("#result").hidden = false;
    $("#result").scrollIntoView({ behavior: "smooth" });
  } catch (e) { showErr("Couldn't write the draft. Please try again."); }
  btn.disabled = false; btn.textContent = "Write my review draft";
}

function post() {
  const text = $("#draft").value.trim();
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
  window.open("https://search.google.com/local/writereview?placeid=" + encodeURIComponent(cfg.placeId), "_blank");
}

function showErr(m) { const e = $("#err"); e.textContent = m; e.hidden = false; }
init();
