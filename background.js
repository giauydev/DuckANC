const DEFAULT_SETTINGS = {
    enabled: true,

    
    
    duckVolume: 15,

    
    
    soundEffects: true,

    
    audioBlur: true,

    
    
    blurFrequency: 1800,

    
    
    sfxDelay: 500,

    
    duckDuration: 1000,
    restoreDuration: 900,

    
    silenceThreshold: 10,
    silenceRestoreVolume: 50
};

let settings = {
    ...DEFAULT_SETTINGS
};


let activeTargetTabId = null;


let targetPlaying = false;


const LONG_SILENCE_DEFAULT_MS = 10000;

function getLongSilenceMs() {
    return clamp(Number(settings.silenceThreshold) * 1000, 1000, 60000);
}
let silenceTimer = null;
let silenceToken = 0;
let longSilenceSfxActive = false;

function clearSilenceTimer() {
    if (silenceTimer !== null) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
    silenceToken++;
}

function scheduleLongSilenceSFX(tabId) {
    clearSilenceTimer();
    const token = silenceToken;

    silenceTimer = setTimeout(() => {
        silenceTimer = null;

        
        stateQueue = stateQueue.then(async () => {
            if (token !== silenceToken || !settings.enabled) return;

            try {
                const state = await getTargetState();
                if (state.tab?.id !== tabId || state.playing) return;

                
                
                await duckAllTabs();

                
                
                await new Promise(resolve =>
                    setTimeout(resolve, clamp(settings.duckDuration, 50, 3000))
                );

                if (token !== silenceToken || !settings.enabled) {
                    await restoreAllTabs(220);
                    return;
                }

                await restoreAllTabsPartial(
                    settings.silenceRestoreVolume,
                    settings.restoreDuration
                );

                if (token !== silenceToken || !settings.enabled) {
                    await restoreAllTabs(220);
                    return;
                }

                const played = await playAirPodsSFX("off");


                if (token !== silenceToken || !settings.enabled) {
                    await restoreAllTabs(220);
                    return;
                }

                if (played !== false) {
                    longSilenceSfxActive = true;
                }
            } catch (error) {
                console.warn("[Audio Ducking] Long-silence SFX failed:", error);
                
                await restoreAllTabs(220);
            }
        }).catch(error => {
            console.error("[Audio Ducking] Long-silence transition error:", error);
        });
    }, getLongSilenceMs());
}

let extensionConnectionState = null; 


const modifiedTabs = new Map();


let stateQueue = Promise.resolve();






async function loadSettings() {
    const saved = await chrome.storage.local.get({
        ...DEFAULT_SETTINGS,
        airpodsSfx: undefined
    });

    
    
    let mergedSoundEffects =
        saved.soundEffects !== undefined
            ? Boolean(saved.soundEffects)
            : true;

    if (saved.airpodsSfx !== undefined) {
        mergedSoundEffects =
            mergedSoundEffects && Boolean(saved.airpodsSfx);
    }

    const missing = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (saved[key] === undefined && key !== "soundEffects") {
            missing[key] = value;
        }
    }

    if (saved.soundEffects !== mergedSoundEffects) {
        missing.soundEffects = mergedSoundEffects;
    }

    if (Object.keys(missing).length) {
        await chrome.storage.local.set(missing);
    }

    settings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        ...missing,
        soundEffects: mergedSoundEffects
    };

    
    if (saved.airpodsSfx !== undefined) {
        await chrome.storage.local.remove("airpodsSfx");
    }
}


function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.max(
        min,
        Math.min(max, value)
    );
}






async function getActiveTab() {
    const tabs =
        await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        });

    return tabs[0] || null;
}






function isUnsupportedTab(tab) {
    if (!tab?.url) {
        return true;
    }

    return (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("devtools://") ||
        tab.url.startsWith("view-source:")
    );
}






async function getTargetState() {
    const tab = await getActiveTab();

    if (!tab?.id) {
        return {
            tab: null,
            playing: false
        };
    }

    return {
        tab,
        playing: tab.audible === true
    };
}






let offscreenReady = false;


async function ensureOffscreen() {
    try {
        if (await chrome.offscreen.hasDocument()) {
            offscreenReady = true;
        } else {
            await chrome.offscreen.createDocument({
                url: "offscreen.html",
                reasons: ["AUDIO_PLAYBACK"],
                justification: "Play short AirPods transition sounds."
            });
            offscreenReady = true;
        }
    } catch (error) {
        
        if (!(await chrome.offscreen.hasDocument().catch(() => false))) {
            throw error;
        }
        offscreenReady = true;
    }

    
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: "OFFSCREEN_PING"
            });
            if (response?.success) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 40));
    }

    throw lastError || new Error("Offscreen document is not ready");
}


async function playSFX(effect) {
    try {
        await ensureOffscreen();

        const response = await chrome.runtime.sendMessage({
            type: "PLAY_SFX",
            effect
        });

        if (!response?.success) {
            console.warn(
                "[Audio Ducking] SFX rejected:",
                response?.error || "unknown error"
            );
            return false;
        }

        return true;

    } catch (error) {
        offscreenReady = false;
        console.warn(
            "[Audio Ducking] SFX error:",
            error
        );
        return false;
    }
}


async function playAirPodsSFX(effect) {
    if (!settings.soundEffects) return;
    return playSFX(effect);
}

async function playConnectionSFX(effect) {
    if (!settings.soundEffects) return;
    return playSFX(effect);
}






async function sendToTab(tabId, message) {
    try {
        await chrome.tabs.sendMessage(
            tabId,
            message
        );

        return true;
    } catch {
        return false;
    }
}






function rememberTab(tab) {
    if (
        !tab?.id ||
        modifiedTabs.has(tab.id)
    ) {
        return;
    }

    modifiedTabs.set(tab.id, {
        originalMuted:
            Boolean(tab.mutedInfo?.muted)
    });
}






async function duckTab(tab) {
    if (!tab?.id) {
        return;
    }

    
    if (
        tab.id === activeTargetTabId
    ) {
        return;
    }

    
    if (isUnsupportedTab(tab)) {
        return;
    }

    rememberTab(tab);

    
    await sendToTab(
        tab.id,
        {
            type: "DUCK",
            volume:
                settings.duckVolume / 100,
            duration:
                settings.duckDuration,
            blur:
                settings.audioBlur,
            blurFrequency:
                settings.blurFrequency
        }
    );
}






async function duckAllTabs() {
    const tabs =
        await chrome.tabs.query({});

    await Promise.all(
        tabs.map(tab =>
            duckTab(tab)
        )
    );
}






async function restoreTab(tabId, duration = settings.restoreDuration) {
    const oldState =
        modifiedTabs.get(tabId);

    if (!oldState) {
        return;
    }

    
    await sendToTab(
        tabId,
        {
            type: "RESTORE",
            duration:
                duration
        }
    );

    
    try {
        const tab =
            await chrome.tabs.get(tabId);

        const currentMuted =
            Boolean(
                tab.mutedInfo?.muted
            );

        if (
            currentMuted !==
            oldState.originalMuted
        ) {
            await chrome.tabs.update(
                tabId,
                {
                    muted:
                        oldState.originalMuted
                }
            );
        }

    } catch {
        
    }

    modifiedTabs.delete(tabId);
}






async function restoreAllTabs(duration = settings.restoreDuration) {
    const ids = [
        ...modifiedTabs.keys()
    ];

    await Promise.all(
        ids.map(id =>
            restoreTab(id, duration)
        )
    );

    modifiedTabs.clear();
}

async function restoreTabPartial(tabId, volumeRatio, duration = settings.restoreDuration) {
    if (!modifiedTabs.has(tabId)) {
        return;
    }

    await sendToTab(
        tabId,
        {
            type: "RESTORE_PARTIAL",
            volumeRatio:
                clamp(Number(volumeRatio), 0, 100) / 100,
            duration
        }
    );
}

async function restoreAllTabsPartial(volumeRatio, duration = settings.restoreDuration) {
    const ids = [
        ...modifiedTabs.keys()
    ];

    await Promise.all(
        ids.map(id =>
            restoreTabPartial(
                id,
                volumeRatio,
                duration
            )
        )
    );
}







function updateState(reason = "unknown") {
    stateQueue = stateQueue.then(async () => {
        const { tab, playing } = await getTargetState();
        const newTargetId = tab?.id ?? null;

        if (extensionConnectionState === null) {
            extensionConnectionState = Boolean(settings.enabled);
        } else if (extensionConnectionState !== Boolean(settings.enabled)) {
            extensionConnectionState = Boolean(settings.enabled);
            await playConnectionSFX(settings.enabled ? "connected" : "disconnect");
        }

        if (!settings.enabled) {
            clearSilenceTimer();
            longSilenceSfxActive = false;
            targetPlaying = false;
            await restoreAllTabs();
            activeTargetTabId = newTargetId;
            return;
        }

        const targetChanged = newTargetId !== activeTargetTabId;
        if (targetChanged) {
            clearSilenceTimer();
            longSilenceSfxActive = false;
            await restoreAllTabs();
            activeTargetTabId = newTargetId;
            targetPlaying = false;
        }

        if (!playing) {
            if (targetPlaying) {
                targetPlaying = false;
                
                await restoreAllTabs(220);
                scheduleLongSilenceSFX(newTargetId);
            } else if (modifiedTabs.size > 0 && !longSilenceSfxActive) {
                await restoreAllTabs();
            }
            return;
        }

        
        clearSilenceTimer();

        if (!targetPlaying) {
            targetPlaying = true;

            
            if (longSilenceSfxActive) {
                await playAirPodsSFX("on");
                longSilenceSfxActive = false;
                await new Promise(resolve =>
                    setTimeout(resolve, clamp(settings.sfxDelay, 0, 2000))
                );
            }
        }

        await duckAllTabs();
    }).catch(error => {
        console.error("[Audio Ducking]", error);
    });

    return stateQueue;
}





chrome.tabs.onActivated.addListener(
    async ({ tabId }) => {

        console.log(
            "[Audio Ducking]",
            "Active tab:",
            tabId
        );

        await updateState(
            "tab-activated"
        );
    }
);






chrome.windows.onFocusChanged.addListener(
    async () => {

        await updateState(
            "window-focus"
        );
    }
);






chrome.tabs.onUpdated.addListener(
    async (
        tabId,
        changeInfo,
        tab
    ) => {

        
        if (
            changeInfo.audible !==
            undefined
        ) {

            await updateState(
                "audible-changed"
            );
        }


        
        if (
            changeInfo.url !==
            undefined
        ) {

            
            if (
                tabId ===
                activeTargetTabId
            ) {

                targetPlaying =
                    false;

                await restoreAllTabs();
            }

            await updateState(
                "navigation"
            );
        }


        
        if (
            changeInfo.status ===
                "complete" &&
            targetPlaying &&
            tabId !==
                activeTargetTabId
        ) {

            await duckTab(tab);
        }
    }
);






chrome.tabs.onCreated.addListener(
    async tab => {

        
        if (
            targetPlaying &&
            tab?.id !==
                activeTargetTabId
        ) {

            await duckTab(tab);
        }

        await updateState(
            "tab-created"
        );
    }
);






chrome.tabs.onRemoved.addListener(
    async tabId => {

        modifiedTabs.delete(tabId);

        if (
            tabId ===
            activeTargetTabId
        ) {
            activeTargetTabId = null;

            targetPlaying = false;
        }

        await updateState(
            "tab-removed"
        );
    }
);






chrome.storage.onChanged.addListener(
    async (
        changes,
        area
    ) => {

        if (area !== "local") {
            return;
        }

        await loadSettings();

        
        if (targetPlaying) {

            await duckAllTabs();
        }

        await updateState(
            "settings-changed"
        );
    }
);






chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        
        if (
            message.type ===
            "GET_SETTINGS"
        ) {

            getActiveTab()
                .then(tab => {

                    sendResponse({
                        ...settings,

                        targetTabId:
                            tab?.id ?? null,

                        targetTitle:
                            tab?.title ?? "",

                        targetUrl:
                            tab?.url ?? "",

                        targetPlaying
                    });
                });

            return true;
        }


        
        if (
            message.type ===
            "SAVE_SETTINGS"
        ) {

            const previousEnabled = Boolean(settings.enabled);
            const previousAudioBlur = Boolean(settings.audioBlur);

            const next = {

                enabled:
                    Boolean(
                        message.enabled
                    ),

                duckVolume:
                    clamp(
                        Number(
                            message.duckVolume
                        ),
                        0,
                        100
                    ),

                soundEffects:
                    Boolean(
                        message.soundEffects
                    ),

                audioBlur:
                    Boolean(
                        message.audioBlur
                    ),

                blurFrequency:
                    clamp(
                        Number(
                            message.blurFrequency
                        ),
                        100,
                        1800
                    ),

                duckDuration:
                    clamp(
                        Number(message.duckDuration),
                        50,
                        3000
                    ),

                restoreDuration:
                    clamp(
                        Number(message.restoreDuration),
                        50,
                        3000
                    ),

                sfxDelay:
                    clamp(
                        Number(message.sfxDelay),
                        0,
                        3000
                    ),

                silenceThreshold:
                    clamp(
                        Number(message.silenceThreshold),
                        1,
                        60
                    ),

                silenceRestoreVolume:
                    clamp(
                        Number(message.silenceRestoreVolume),
                        0,
                        100
                    )
            };


            chrome.storage.local
                .set(next)
                .then(async () => {

                    await loadSettings();

                    const nextEnabled = Boolean(settings.enabled);
                    const nextAudioBlur = Boolean(settings.audioBlur);

                    
                    
                    
                    if (previousAudioBlur !== nextAudioBlur && settings.soundEffects) {
                        clearSilenceTimer();
                        longSilenceSfxActive = false;
                        await playAirPodsSFX(nextAudioBlur ? "on" : "off");
                    }

                    
                    
                    if (previousEnabled !== nextEnabled) {
                        extensionConnectionState = nextEnabled;

                        if (nextEnabled) {
                            clearSilenceTimer();
                            longSilenceSfxActive = false;
                            targetPlaying = false;
                            await restoreAllTabs(220);
                            await playConnectionSFX("connected");
                        } else {
                            clearSilenceTimer();
                            longSilenceSfxActive = false;
                            targetPlaying = false;
                            await restoreAllTabs(settings.restoreDuration);
                            await playConnectionSFX("disconnect");
                        }
                    }

                    await updateState("settings-saved");

                    sendResponse({
                        success: true
                    });
                })
                .catch(() => {

                    sendResponse({
                        success: false
                    });
                });

            return true;
        }


        
        if (
            message.type ===
            "GET_STATUS"
        ) {

            sendResponse({
                enabled:
                    settings.enabled,

                duckVolume:
                    settings.duckVolume,

                soundEffects:
                    settings.soundEffects,

                audioBlur:
                    settings.audioBlur,

                blurFrequency:
                    settings.blurFrequency,

                duckDuration:
                    settings.duckDuration,

                restoreDuration:
                    settings.restoreDuration,

                sfxDelay:
                    settings.sfxDelay,

                silenceThreshold:
                    settings.silenceThreshold,

                silenceRestoreVolume:
                    settings.silenceRestoreVolume,

                targetTabId:
                    activeTargetTabId,

                targetPlaying
            });

            return true;
        }
    }
);






setInterval(
    () => {
        updateState("poll");
    },
    700
);






(async () => {

    await loadSettings();

    await updateState(
        "startup"
    );

})();
