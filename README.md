# OffGrid Medic

A browser-based, adult wilderness first-aid training demo. The five locally authored cards link to their sources. The app requires clinical review before field use. Treat an actual emergency as an emergency and activate professional rescue as soon as possible.

## Run locally

From this directory, serve the static app using Python 3.

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [the field console](http://localhost:8000). On another device, deploy `dist/` to an HTTPS origin. Localhost and HTTPS support service workers, location requests, and microphone permissions.

Select available equipment, describe the incident, or open a protocol from the index. Before disconnecting, wait for the offline cache to finish and install the English speech pack on a compatible browser. Verify a reload in airplane mode on the actual demo device. Speech recognition, a local English readout voice, the offline shell, and the optional Gemini model each have separate readiness requirements. Text and touch controls work with the cached app.

## Enable hybrid inference

1. Register a web app in your Firebase project. Enable Firebase AI Logic with the Gemini Developer API backend. Register the demo domain in App Check with a reCAPTCHA Enterprise site key. [Firebase hybrid setup](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) · [App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
2. Replace `firebaseConfig = null` in `dist/config.js` with the public web app configuration and set `appCheckSiteKey` to the public site key. Keep service account credentials and Gemini API secrets out of client files. The cloud model name can be changed in the same file. [Supported cloud models](https://firebase.google.com/docs/ai-logic/models)
3. Regenerate the offline manifest, reload the app and allow its new worker to activate. For a Nano demo, use a Chrome installation with a downloaded model and the Prompt API enabled for the app origin. Test both routes with gear that has an approved use for the selected card. [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)

The deterministic local matcher selects a candidate protocol. The SDK receives its fixed instructions and allowed equipment roles. Each model may select only item IDs from those roles. The app validates the result, then looks up each item's text locally. Clinical instructions, warnings, timers, and rescue observations come from local code or user input. The cloud prompt omits coordinates and the incident transcript.

The engine reports the SDK's inference source and measures elapsed time until the first nonempty streamed chunk. The routing control requests a real mode. Unconfigured, failed, and timed-out requests use the local gear index with an empty first-token metric. [Firebase hybrid routing](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options) · [Structured responses](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output)

## Development

After changing any asset in `dist/`, rebuild the content-addressed offline manifest with Node.js 22.16+.

```powershell
node update-cache.mjs
node --test
```

The checked-in Firebase browser modules are version 12.8.0 from Google's official gstatic distribution. Their Firebase App imports resolve to the local sibling file for offline use. License terms are in `dist/vendor/LICENSE.txt`. The engine tests exercise both stream paths using the real SDK with simulated network and browser model responses. Live model access and device voice support require testing with your own project and hardware.
