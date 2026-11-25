import "./terrain.js";
import { protocols, match } from "./clinical.js";
import { infer } from "./engine.js";
import { createAudio } from "./audio.js";
const $ = (id) => document.getElementById(id);
const paths = {
  pack: "M6 10V8a6 6 0 0 1 12 0v2 M5 9h14l1 12H4z M8 15h8v4H8z",
  cards: "M3 6h14v12H3z M7 3h14v12",
  book: "M12 6q-5-4-10-2v14q6-2 10 2 5-4 10-2V4q-5-2-10 2v14",
  signal: "M3 18v3m5-8v8m5-13v13m5-18v18",
  jacket: "M8 3l4 3 4-3 4 3 2 11-4 1-1-6v9H7v-9l-1 6-4-1L4 6z M12 6v15",
  poles: "M5 2l13 19M18 2L5 21M4 5l4-2m8 1 4 2M3 17l4 2m9 0 4-2",
  tape: "M3 12a9 6 0 1 0 18 0 9 6 0 0 0-18 0 M8 12a4 2 0 1 0 8 0 4 2 0 0 0-8 0 M3 12v4c2 5 15 6 18 0v-4",
  cord: "M4 18c8 4 18-12 12-14S0 17 6 19 24 6 18 4 M18 13l4 6",
  shirt: "M8 3q4 4 8 0l6 4-3 5-3-2v11H8V10l-3 2-3-5z",
  tool: "M4 16l12-12 5-1-2 6L8 20a3 3 0 0 1-4-4z M7 16l2-2",
  fracture: "M4 4l5 2 2 4-2 3-4-2-2-4z M13 12l3-1 5 6-1 4-5-1-3-5z",
  bleeding: "M12 2C9 7 4 12 4 16a8 7 0 0 0 16 0c0-4-5-9-8-14z",
  hypothermia: "M12 2v20M3 7l18 10M3 17L21 7M9 4l3 3 3-3m-6 16 3-3 3 3",
  burn: "M12 2c3 5-2 7 1 9l4-5c9 12 1 17-5 16-6 0-12-6-6-13 0 4 3 4 3 3-1-4 3-6 3-10z",
  cpr: "M2 10c-2-9 7-10 10-4 4-6 13-5 10 4-1 4-6 8-10 12L3 13m1-1h4l2-3 3 7 2-4h5",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v3m-4 0h8",
};
function icon(id) {
  return (
    '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' +
    paths[id] +
    '"/></svg>'
  );
}
document
  .querySelectorAll("[data-icon]")
  .forEach((i) => (i.innerHTML = icon(i.dataset.icon)));
const names = {
  jacket: "Jacket",
  poles: "Trekking poles",
  tape: "Duct tape",
  cord: "Paracord",
  shirt: "T-shirt",
  tool: "Multi-tool",
};
const selected = new Set();
let topic = null,
  step = 0,
  request = 0,
  voiceNav = false,
  timerActive = false,
  remaining = 0,
  metro = false,
  noticeTimeout,
  care = "",
  pulse = "Unknown",
  gps = "",
  candidate = null;
const mode = $("route");
function message(s) {
  clearTimeout(noticeTimeout);
  $("notice").textContent = s;
  noticeTimeout = setTimeout(() => ($("notice").textContent = ""), 6000);
}
const audio = createAudio({
  onTranscript: (t) => review(t, true),
  onCommand: command,
  onStatus: message,
  onListening: (v) => {
    if (v) $("voice").textContent = "Listening…";
    else $("voice").innerHTML = "<i>" + icon("mic") + "</i> Start voice intake";
  },
  onTimer: (s) => {
    remaining = s;
    if ($("time")) $("time").textContent = format(s);
    if (!s) {
      timerActive = false;
      message("Timer finished. Recheck the patient.");
      audio.speak("Timer finished. Recheck the patient.");
      if ($("timer")) $("timer").textContent = "Restart timer";
    }
  },
});
function format(s) {
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function paintGear() {
  $("gear").innerHTML = Object.entries(names)
    .map(
      ([id, n]) =>
        '<button class="chip" data-id="' +
        id +
        '" aria-pressed="' +
        selected.has(id) +
        '"><i>' +
        icon(id) +
        "</i>" +
        n +
        '<b aria-hidden="true">' +
        (selected.has(id) ? "✓" : "+") +
        "</b></button>",
    )
    .join("");
  $("count").textContent = selected.size + " SELECTED";
}
$("gear").onclick = (e) => {
  const id = e.target.closest("button")?.dataset.id;
  if (!id) return;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  paintGear();
  if (topic) updateEngine();
};
async function updateEngine() {
  const seq = ++request;
  $("engine").textContent = "Retrieving…";
  $("latency").textContent = "—";
  $("mapping").textContent = "";
  const out = await infer(topic, [...selected], mode.value);
  if (seq !== request) return;
  $("engine").textContent = out.engine;
  $("latency").textContent =
    out.ttft == null ? "—" : Math.round(out.ttft) + " ms";
  $("routeInfo").textContent = out.detail || "";
  $("mapping").textContent = Object.entries(out.gear)
    .map(([key, v]) => names[key] + " · " + v)
    .join(" / ");
}
mode.onchange = () => {
  if (topic) updateEngine();
};
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.shiftKey && e.code === "KeyR") {
    mode.selectedIndex = (mode.selectedIndex + 1) % 3;
    mode.onchange();
    message(mode.selectedOptions[0].text);
  }
});
$("pack").onclick = () => audio.installPack();
function stopWidgets() {
  audio.stopMetronome();
  metro = false;
  audio.stopTimer();
  timerActive = false;
}
function readCard() {
  audio.speak(
    (step === 0 ? topic.warning + " " : "") + topic.steps[step].instruction,
  );
}
function openTopic(p, listen = false) {
  closeModal();
  stopWidgets();
  audio.stopListening();
  topic = p;
  step = 0;
  care = "";
  pulse = "Unknown";
  gps = "";
  voiceNav = listen;
  $("pid").textContent = p.id.toUpperCase();
  render();
  updateEngine();
  $("deckPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  readCard();
  if (listen) enableVoice();
}
async function enableVoice() {
  voiceNav = await audio.listen("commands");
  if ($("hands"))
    $("hands").textContent = voiceNav
      ? "Stop voice commands"
      : "Enable voice commands";
}
function change(n) {
  if (!topic || step + n < 0 || step + n >= topic.steps.length) return;
  step += n;
  audio.stopMetronome();
  metro = false;
  const mapping = $("mapping").textContent;
  render();
  $("mapping").textContent = mapping;
  readCard();
}
function command(cmd) {
  if ($("modal").open) {
    if (candidate && cmd === "next") openTopic(candidate, true);
    else if (candidate && cmd === "repeat")
      audio.speak(
        "Suggested topic: " + candidate.title + ". Say next to open.",
      );
    return;
  }
  if (!topic) return;
  if (cmd === "next") change(1);
  if (cmd === "previous") change(-1);
  if (cmd === "repeat") readCard();
  if (cmd === "start timer" && !timerActive) $("timer")?.click();
  if (cmd === "start metronome" && !metro) $("beat")?.click();
  if (cmd === "stop metronome" && metro) $("beat")?.click();
}
function render() {
  const d = $("deck");
  if (!topic) {
    d.innerHTML =
      '<div class="empty"><i>' +
      icon("cards") +
      "</i><h3>Awaiting incident</h3><p>Describe an incident or choose a protocol to open your first card.</p></div>";
    return;
  }
  const s = topic.steps[step];
  $("deckStatus").textContent = topic.severity;
  d.innerHTML =
    '<div class="warning">' +
    topic.warning +
    '</div><div class="hint">' +
    topic.title.toUpperCase() +
    " · STEP " +
    (step + 1) +
    " OF " +
    topic.steps.length +
    '</div><h3 class="instruction">' +
    s.instruction +
    '</h3><div id="mapping" class="mapping"></div>' +
    (s.timerSeconds || timerActive
      ? '<div class="decktools"><button id="timer">' +
        (timerActive ? "Stop timer" : "Start timer") +
        '</button><strong id="time">' +
        format(timerActive ? remaining : s.timerSeconds) +
        "</strong> " +
        (s.timerLabel || "Active reminder") +
        "</div>"
      : "") +
    (s.bpm ? '<button id="beat">Start 110 BPM metronome</button>' : "") +
    '<div class="decktools"><button id="prev">Previous</button><button id="repeat">Repeat</button><button class="primary" id="next">' +
    (step === topic.steps.length - 1 ? "Prepare SAR payload" : "Next card") +
    '</button></div><div class="decktools"><button id="hands">' +
    (voiceNav ? "Stop voice commands" : "Enable voice commands") +
    '</button><button id="sar">SAR payload</button></div><details><summary>Protocol source</summary><a target="_blank" rel="noreferrer" href="' +
    topic.source +
    '">' +
    topic.title +
    " reference</a></details>";
  $("prev").disabled = !step;
  $("prev").onclick = () => change(-1);
  $("repeat").onclick = readCard;
  $("next").onclick = () =>
    step === topic.steps.length - 1 ? sar() : change(1);
  $("sar").onclick = sar;
  $("hands").onclick = () => {
    if (voiceNav) {
      audio.stopListening();
      voiceNav = false;
      $("hands").textContent = "Enable voice commands";
    } else enableVoice();
  };
  if ($("beat"))
    $("beat").onclick = async () => {
      if (metro) {
        audio.stopMetronome();
        metro = false;
      } else metro = await audio.startMetronome(110);
      if ($("beat"))
        $("beat").textContent = metro
          ? "Stop metronome"
          : "Start 110 BPM metronome";
    };
  if ($("timer"))
    $("timer").onclick = () => {
      if (timerActive) {
        audio.stopTimer();
        timerActive = false;
        const mapping = $("mapping").textContent;
        render();
        $("mapping").textContent = mapping;
      } else if (s.timerSeconds) {
        timerActive = true;
        audio.startTimer(s.timerSeconds);
        $("timer").textContent = "Stop timer";
      }
    };
}
function modal(html) {
  $("dialogContent").innerHTML = html;
  if (!$("modal").open) $("modal").showModal();
}
function closeModal() {
  candidate = null;
  if ($("modal").open) $("modal").close();
}
function intake(t = "") {
  candidate = null;
  audio.stopSpeaking();
  audio.stopListening();
  voiceNav = false;
  if ($("hands")) $("hands").textContent = "Enable voice commands";
  modal(
    '<h2>Incident intake</h2><label for="incident">Describe what you see</label><textarea maxlength="4000" id="incident" placeholder="My friend fell and his lower leg is bent weird…"></textarea><div class="actions"><button class="primary" id="find">Find protocol</button></div><p id="feedback" role="status"></p>',
  );
  $("incident").value = t;
  $("find").onclick = () => review($("incident").value, false);
  $("incident").focus();
}
function review(t, spoken) {
  const p = match(t);
  if (!p) {
    intake(t);
    $("feedback").textContent =
      "No clear match. For a real emergency, seek rescue now. Choose a topic from the protocol index if appropriate.";
    return;
  }
  candidate = p;
  modal(
    '<div class="kicker warm">SUGGESTED PROTOCOL</div><h2>' +
      p.title +
      "</h2><p>" +
      p.warning +
      '</p><p>Confirm this topic matches the situation.</p><div class="actions"><button id="confirm" class="primary">Open triage deck</button><button id="edit">Edit incident</button></div>',
  );
  $("confirm").onclick = () => openTopic(p, spoken);
  $("edit").onclick = () => intake(t);
  if (spoken) {
    audio.speak("Suggested topic: " + p.title + ". Say next to open.");
    audio.listen("commands");
  }
}
$("type").onclick = () => intake();
$("voice").innerHTML = "<i>" + icon("mic") + "</i> Start voice intake";
$("voice").onclick = async () => {
  audio.stopSpeaking();
  voiceNav = false;
  if ($("hands")) $("hands").textContent = "Enable voice commands";
  if (!(await audio.listen("incident"))) intake();
};
$("library").innerHTML = protocols
  .map(
    (p) =>
      '<button class="row" data-id="' +
      p.id +
      '"><i>' +
      icon(p.id) +
      "</i>" +
      p.title +
      '<span aria-hidden="true">›</span></button>',
  )
  .join("");
$("library").onclick = (e) => {
  const p = protocols.find(
    (x) => x.id === e.target.closest("button")?.dataset.id,
  );
  if (p) openTopic(p);
};
$("modal").addEventListener("cancel", () => {
  candidate = null;
  audio.stopListening();
  audio.stopSpeaking();
  voiceNav = false;
});
$("modal").querySelector(".close").onclick = () => {
  candidate = null;
  audio.stopListening();
  audio.stopSpeaking();
  voiceNav = false;
  if ($("hands")) $("hands").textContent = "Enable voice commands";
};
function sar() {
  audio.stopSpeaking();
  modal(
    '<h2>Rescue payload</h2><p>Record observed findings and care you actually provided.</p><button id="loc">Use current GPS</button><label for="care">Care provided</label><input id="care" maxlength="48" placeholder="Unknown"><label for="pulse">Distal pulse</label><select id="pulse"><option>Unknown</option><option>Present</option><option>Absent</option></select><label for="payload">SAR message · <span id="length"></span>/160</label><textarea readonly id="payload"></textarea><button class="primary" id="copy">Copy message</button><p role="status" id="feedback"></p>',
  );
  $("care").value = care;
  $("pulse").value = pulse;
  const session = topic;
  function build() {
    care = $("care").value;
    pulse = $("pulse").value;
    const tx =
      care
        .trim()
        .replace(/[^ -~]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Unknown";
    const base =
      "SOS " +
      (gps || "GPS unknown") +
      " | TOPIC:" +
      topic.id +
      " | SEV:" +
      topic.severity +
      " | PULSE:" +
      pulse +
      " | CARE:";
    const str = base + tx.slice(0, 160 - base.length);
    $("payload").value = str;
    $("length").textContent = str.length;
  }
  $("care").oninput = build;
  $("pulse").onchange = build;
  build();
  $("loc").onclick = () => {
    const feedback = $("feedback");
    if (!navigator.geolocation) {
      feedback.textContent = "GPS unavailable.";
      return;
    }
    feedback.textContent = "Requesting location…";
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (topic !== session || feedback !== $("feedback")) return;
        gps =
          p.coords.latitude.toFixed(5) + "," + p.coords.longitude.toFixed(5);
        build();
        feedback.textContent = "Location added.";
      },
      () =>
        (feedback.textContent = "Location unavailable. GPS remains unknown."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("payload").value);
      $("feedback").textContent =
        "Copied. Send using your rescue communication channel.";
    } catch {
      $("payload").select();
      $("feedback").textContent = "Select and copy the message manually.";
    }
  };
}
let touch = null;
$("deck").addEventListener("touchstart", (e) => (touch = e.changedTouches[0]), {
  passive: true,
});
$("deck").addEventListener("touchend", (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.clientX,
    dy = e.changedTouches[0].clientY - touch.clientY;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 40) change(dx < 0 ? 1 : -1);
  touch = null;
});
function network() {
  $("network").textContent = navigator.onLine
    ? "NETWORK ONLINE"
    : "NETWORK OFFLINE";
}
ononline = onoffline = network;
network();
paintGear();
render();
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => ($("cache").textContent = "Ready"))
    .catch(() => ($("cache").textContent = "Unavailable"));
else $("cache").textContent = "Unavailable";
window.addEventListener("pagehide", () => audio.destroy());
