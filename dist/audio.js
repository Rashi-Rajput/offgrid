const noop = () => {};
const pack = { langs: ["en-US"], processLocally: true };
const commands = new Set(["next", "repeat", "previous", "start timer", "start metronome", "stop metronome"]);

/** Local audio controller. Call installPack and startMetronome from a user gesture. */
export function createAudio({
  onTranscript = noop, onCommand = noop, onStatus = noop, onTimer = noop,
  onBeat = noop, onListening = noop,
} = {}) {
  const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const synth = globalThis.speechSynthesis;
  synth?.getVoices(); // Some browsers populate the list asynchronously on first access.
  let desired = null, recognizer = null, restart = 0, generation = 0;
  let utterance = null, disposed = false, listenReady = false;
  let deadline = 0, timer = 0, lastSecond = -1;
  let context = null, beatLoop = 0;

  function detach() {
    clearTimeout(restart);
    if (!recognizer) return;
    const old = recognizer;
    recognizer = null;
    old.onstart = old.onresult = old.onend = old.onerror = null;
    old.abort();
    onListening(false);
  }

  function stopListening() {
    generation++;
    desired = null;
    listenReady = false;
    detach();
  }

  function begin() {
    if (!desired || !listenReady || utterance || disposed || recognizer) return false;
    const mode = desired;
    const current = new Recognition();
    if (!("processLocally" in current)) {
      stopListening();
      onStatus("Offline speech is unavailable. Use the text controls.");
      return false;
    }
    current.processLocally = true;
    current.lang = "en-US";
    current.continuous = mode === "commands";
    current.interimResults = false;
    recognizer = current;
    current.onstart = () => onListening(true);
    current.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length && recognizer === current; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;
        if (mode === "incident") {
          stopListening();
          onTranscript(text);
        } else {
          const command = text.toLowerCase().replace(/[.!?,]/g, "").replace(/\s+/g, " ").trim();
          if (commands.has(command)) onCommand(command);
        }
      }
    };
    current.onerror = ({error}) => {
      if (error === "no-speech" && mode === "commands") return;
      stopListening();
      onStatus("Voice input stopped (" + error + "). Use text or retry the microphone.");
    };
    current.onend = () => {
      if (recognizer !== current) return;
      recognizer = null;
      onListening(false);
      if (mode === "commands") restart = setTimeout(begin, 300);
      else {
        desired = null;
        onStatus("No incident captured. Tap the microphone to try again.");
      }
    };
    try {
      current.start();
      return true;
    } catch {
      stopListening();
      onStatus("The microphone could not start. Check microphone permissions.");
      return false;
    }
  }

  async function listen(mode) {
    if (disposed || !["incident", "commands"].includes(mode)) return false;
    stopListening();
    const request = generation;
    desired = mode;
    if (mode === "incident") stopSpeaking();
    try {
      const state = await Recognition?.available?.(pack);
      if (generation !== request || disposed) return false;
      if (state !== "available") {
        stopListening();
        onStatus(state === "downloadable" || state === "downloading"
          ? "Install the English offline voice pack before using the microphone."
          : "Offline speech is unavailable. Use the text controls.");
        return false;
      }
      listenReady = true;
      return utterance ? true : begin();
    } catch {
      if (generation === request) {
        stopListening();
        onStatus("Offline speech access is blocked. Use the text controls.");
      }
      return false;
    }
  }

  async function installPack() {
    if (disposed) return false;
    try {
      const ok = await Recognition?.install?.(pack);
      if (!disposed) onStatus(ok ? "English offline voice pack ready." : "Offline voice pack installation unavailable.");
      return Boolean(ok);
    } catch {
      if (!disposed) onStatus("Voice pack installation failed. Check connectivity and browser permissions.");
      return false;
    }
  }

  function resumeListening() {
    clearTimeout(restart);
    if (!disposed && desired && listenReady) restart = setTimeout(begin, 300);
  }

  function stopSpeaking() {
    if (!utterance) return;
    utterance.onend = utterance.onerror = null;
    utterance = null;
    synth.cancel();
    resumeListening();
  }

  function speak(text) {
    if (disposed || !text) return false;
    stopSpeaking();
    const voice = synth?.getVoices().find(v => v.localService && /^en(?:[-_]|$)/i.test(v.lang));
    if (!voice || !globalThis.SpeechSynthesisUtterance) {
      onStatus("Install an English system voice to hear offline readouts.");
      return false;
    }
    detach();
    const speech = new SpeechSynthesisUtterance(text);
    speech.voice = voice;
    speech.lang = voice.lang;
    utterance = speech;
    speech.onend = speech.onerror = event => {
      if (utterance !== speech) return;
      utterance = null;
      if (event?.type === "error") onStatus("Readout unavailable. Use the card text.");
      resumeListening();
    };
    try {
      synth.speak(speech);
      return true;
    } catch {
      utterance = null;
      resumeListening();
      onStatus("Readout unavailable. Use the card text.");
      return false;
    }
  }

  function stopTimer() {
    clearInterval(timer);
    deadline = 0;
    lastSecond = -1;
  }

  function tick() {
    if (!deadline) return;
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (left === lastSecond) return;
    lastSecond = left;
    if (!left) stopTimer();
    onTimer(left);
  }

  function startTimer(seconds) {
    if (disposed || !Number.isSafeInteger(seconds) || seconds <= 0) return false;
    if (deadline > Date.now()) return true;
    stopTimer();
    deadline = Date.now() + seconds * 1000;
    timer = setInterval(tick, 200);
    tick();
    return true;
  }

  function stopMetronome() {
    clearInterval(beatLoop);
    if (context && context.state !== "closed") void context.close().catch(noop);
    context = null;
  }

  async function startMetronome(bpm = 110) {
    if (disposed || !Number.isFinite(bpm) || bpm < 100 || bpm > 120) return false;
    if (context?.state === "running") return true;
    stopMetronome();
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    let audio;
    try {
      audio = new Audio();
      context = audio;
      await audio.resume();
      if (context !== audio) return false;
      let next = audio.currentTime;
      const period = 60 / bpm;
      function schedule() {
        if (audio.state !== "running") return;
        const now = audio.currentTime;
        if (next < now) next = now; // Never replay missed clicks after suspension.
        if (next > now + 0.07) return;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 800;
        gain.gain.setValueAtTime(0.0001, next);
        gain.gain.exponentialRampToValueAtTime(0.18, next + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, next + 0.055);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(next);
        oscillator.stop(next + 0.06);
        next += period;
        onBeat();
      }
      beatLoop = setInterval(schedule, 25);
      schedule();
      return true;
    } catch {
      if (context === audio || !audio) {
        stopMetronome();
        if (!disposed) onStatus("Metronome unavailable. Check device audio permissions.");
      }
      return false;
    }
  }

  function destroy() {
    disposed = true;
    stopListening();
    stopSpeaking();
    stopTimer();
    stopMetronome();
    globalThis.document?.removeEventListener("visibilitychange", tick);
  }

  globalThis.document?.addEventListener("visibilitychange", tick);
  return {listen, installPack, stopListening, speak, stopSpeaking, startTimer, stopTimer,
    startMetronome, stopMetronome, destroy};
}
