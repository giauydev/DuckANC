const SFX_FILES = {
    on: "sfx/on.MP3",
    off: "sfx/off.MP3",
    connected: "sfx/connected.MP3",
    disconnect: "sfx/disconnect.MP3"
};

const audioMap = new Map();
const readyMap = new Map();

function getAudio(effect) {
    if (audioMap.has(effect)) return audioMap.get(effect);

    const path = SFX_FILES[effect];
    if (!path) throw new Error(`Unknown SFX: ${effect}`);

    const id = `sfx-${effect}`;
    let audio = document.getElementById(id);

    if (!audio) {
        audio = document.createElement("audio");
        audio.id = id;
        audio.preload = "auto";
        audio.playsInline = true;
        document.body.appendChild(audio);
    }

    audio.src = chrome.runtime.getURL(path);
    audio.volume = 1;
    audio.muted = false;
    audio.setAttribute("playsinline", "");
    audioMap.set(effect, audio);
    return audio;
}

function waitForReady(effect, audio) {
    if (readyMap.has(effect)) return readyMap.get(effect);

    const promise = new Promise((resolve, reject) => {
        if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            resolve();
            return;
        }

        let settled = false;
        const cleanup = () => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("canplay", onReady);
            audio.removeEventListener("loadeddata", onReady);
            audio.removeEventListener("error", onError);
        };
        const onReady = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };
        const onError = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(`Failed to load ${effect}: ${audio.error?.message || "media error"}`));
        };

        audio.addEventListener("canplaythrough", onReady, { once: true });
        audio.addEventListener("canplay", onReady, { once: true });
        audio.addEventListener("loadeddata", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });
        audio.load();
    });

    readyMap.set(effect, promise);
    promise.catch(() => readyMap.delete(effect));
    return promise;
}

async function playSFX(effect) {
    const audio = getAudio(effect);

    await waitForReady(effect, audio);

    audio.pause();
    try { audio.currentTime = 0; } catch {}
    audio.volume = 1;
    audio.muted = false;

    const waitForEnded = () => new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            audio.removeEventListener("ended", finish);
            audio.removeEventListener("error", finish);
            resolve();
        };
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });

        
        const timeoutMs = Math.max(1500, Number.isFinite(audio.duration) ? audio.duration * 1000 + 750 : 5000);
        setTimeout(finish, timeoutMs);
    });

    try {
        const endedPromise = waitForEnded();
        await audio.play();
        await endedPromise;
    } catch (firstError) {
        
        readyMap.delete(effect);
        audio.load();
        await waitForReady(effect, audio);
        try { audio.currentTime = 0; } catch {}
        const endedPromise = waitForEnded();
        await audio.play();
        await endedPromise;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "OFFSCREEN_PING") {
        sendResponse({ success: true });
        return false;
    }

    if (message?.type !== "PLAY_SFX") return false;

    playSFX(message.effect)
        .then(() => sendResponse({ success: true }))
        .catch(error => {
            console.error("[Audio Ducking] SFX playback error:", error);
            sendResponse({ success: false, error: String(error?.message || error) });
        });

    return true;
});
