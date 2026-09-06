const DEFAULT_POPUP_SETTINGS = {
    enabled: true,
    duckVolume: 15,
    soundEffects: true,
    audioBlur: true,
    blurFrequency: 100,
    duckDuration: 950,
    restoreDuration: 900,
    sfxDelay: 500,
    silenceThreshold: 10,
    silenceRestoreVolume: 50,
    targetTabId: null,
    targetTitle: "",
    targetUrl: "",
    targetPlaying: false
};

let settings = { ...DEFAULT_POPUP_SETTINGS };
let extensionEnabled = true;
let targetPlaying = false;
let loading = true;
let settingsSaveInFlight = false;

function byId(id) {
    return document.getElementById(id);
}

function applySettingsToUI() {
    const enabled = byId("enabled");
    const volume = byId("volume");
    const volumeValue = byId("volumeValue");
    const soundEffects = byId("soundEffects");
    const audioBlur = byId("audioBlur");

    if (enabled) enabled.checked = Boolean(settings.enabled);
    if (volume) volume.value = Number(settings.duckVolume ?? 15);
    if (volumeValue) volumeValue.textContent = String(Number(settings.duckVolume ?? 15));
    if (soundEffects) soundEffects.checked = Boolean(settings.soundEffects);
    if (audioBlur) audioBlur.checked = Boolean(settings.audioBlur);

    setCustomUI("duckDuration", settings.duckDuration, "ms");
    setCustomUI("restoreDuration", settings.restoreDuration, "ms");
    setCustomUI("blurFrequency", settings.blurFrequency, "Hz");
    setCustomUI("sfxDelay", settings.sfxDelay, "ms");
    setCustomUI("silenceThreshold", settings.silenceThreshold, "s");
    setCustomUI("silenceRestoreVolume", settings.silenceRestoreVolume, "%");

    extensionEnabled = Boolean(settings.enabled);
    targetPlaying = Boolean(settings.targetPlaying);

    renderTarget();
    renderStatus();
    updateModelBlur();
}

async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: "GET_SETTINGS"
        });

        settings = {
            ...DEFAULT_POPUP_SETTINGS,
            ...(response && typeof response === "object" ? response : {})
        };
    } catch (error) {
        console.debug("[Audio Ducking] GET_SETTINGS failed:", error);
        settings = {
            ...DEFAULT_POPUP_SETTINGS,
            ...settings
        };
    }

    loading = false;
    applySettingsToUI();
}

function renderTarget() {
    const name = byId("targetName");
    const url = byId("targetUrl");
    if (!name || !url) return;

    if (!settings.targetTabId) {
        name.textContent = "Không có tab";
        url.textContent = "-";
        return;
    }

    name.textContent = settings.targetTitle || "Untitled";
    url.textContent = settings.targetUrl || "-";
}

function renderStatus() {
    const element = byId("status");
    if (!element) return;

    if (targetPlaying) {
        element.textContent = "🔊 Playing";
        element.className = "value on";
    } else {
        element.textContent = "🔇 Silent";
        element.className = "value off";
    }
}

function updateModelBlur() {
    const modelContainer = byId("modelContainer");
    if (!modelContainer) return;

    modelContainer.classList.toggle(
        "blurred",
        !extensionEnabled || !targetPlaying
    );
}

async function save() {
    const payload = {
        type: "SAVE_SETTINGS",
        enabled: Boolean(settings.enabled),
        duckVolume: Number(settings.duckVolume ?? 15),
        soundEffects: Boolean(settings.soundEffects),
        audioBlur: Boolean(settings.audioBlur),
        blurFrequency: Number(settings.blurFrequency),
        duckDuration: Number(settings.duckDuration),
        restoreDuration: Number(settings.restoreDuration),
        sfxDelay: Number(settings.sfxDelay),
        silenceThreshold: Number(settings.silenceThreshold),
        silenceRestoreVolume: Number(settings.silenceRestoreVolume)
    };

    settingsSaveInFlight = true;
    try {
        const result = await chrome.runtime.sendMessage(payload);
        if (!result?.success) {
            console.debug("[Audio Ducking] Settings save failed:", result);
            return false;
        }

        
        extensionEnabled = Boolean(settings.enabled);
        targetPlaying = Boolean(settings.targetPlaying);
        applySettingsToUI();
        return true;
    } catch (error) {
        console.debug("[Audio Ducking] SAVE_SETTINGS failed:", error);
        return false;
    } finally {
        settingsSaveInFlight = false;
    }
}

async function refreshStatus() {
    try {
        const state = await chrome.runtime.sendMessage({
            type: "GET_STATUS"
        });

        if (!state || typeof state !== "object") return;

        if (!settingsSaveInFlight) {
            extensionEnabled = Boolean(state.enabled);
            settings.enabled = extensionEnabled;
        }
        targetPlaying = Boolean(state.targetPlaying);

        settings.targetTabId = state.targetTabId ?? null;

        if (state.targetTitle !== undefined) {
            settings.targetTitle = state.targetTitle || "";
        }
        if (state.targetUrl !== undefined) {
            settings.targetUrl = state.targetUrl || "";
        }

        renderTarget();
        renderStatus();
        updateModelBlur();

        
        
        const enabled = byId("enabled");
        if (enabled && document.activeElement !== enabled) {
            enabled.checked = extensionEnabled;
        }
    } catch (error) {
        console.debug("[Audio Ducking] Status error:", error);
    }
}

function setCustomUI(id, value, unit) {
    const input = byId(id);
    const label = byId(`${id}Value`);
    if (input) input.value = Number(value);
    if (label) label.textContent = `${Number(value)} ${unit}`;
}

function setupCustomSettings() {
    const wrapper = document.querySelector(".custom-settings");
    const toggle = byId("customToggle");
    const panel = byId("customPanel");
    const chevron = byId("customChevron");
    const reset = byId("resetSettings");

    if (!toggle || !panel) return;

    const setOpen = (open) => {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        wrapper?.classList.toggle("open", open);
        if (chevron) {
            chevron.setAttribute("aria-hidden", "true");
        }
    };

    const togglePanel = () => {
        setOpen(panel.hidden);
    };

    toggle.addEventListener("click", togglePanel);
    toggle.setAttribute("role", "button");
    toggle.setAttribute("tabindex", "0");
    toggle.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            togglePanel();
        }
    });

    const controls = [
        ["duckDuration", 50, 3000, "ms"],
        ["restoreDuration", 50, 3000, "ms"],
        ["blurFrequency", 100, 1800, "Hz"],
        ["sfxDelay", 0, 2000, "ms"],
        ["silenceThreshold", 1, 60, "s"],
        ["silenceRestoreVolume", 0, 100, "%"]
    ];

    for (const [id, min, max, unit] of controls) {
        const input = byId(id);
        if (!input) continue;

        input.addEventListener("input", () => {
            const value = Math.max(min, Math.min(max, Number(input.value)));
            settings[id] = value;
            setCustomUI(id, value, unit);
        });

        input.addEventListener("change", save);
    }

    reset?.addEventListener("click", async () => {
        settings = {
            ...settings,
            enabled: DEFAULT_POPUP_SETTINGS.enabled,
            duckVolume: DEFAULT_POPUP_SETTINGS.duckVolume,
            soundEffects: DEFAULT_POPUP_SETTINGS.soundEffects,
            audioBlur: DEFAULT_POPUP_SETTINGS.audioBlur,
            blurFrequency: DEFAULT_POPUP_SETTINGS.blurFrequency,
            duckDuration: DEFAULT_POPUP_SETTINGS.duckDuration,
            restoreDuration: DEFAULT_POPUP_SETTINGS.restoreDuration,
            sfxDelay: DEFAULT_POPUP_SETTINGS.sfxDelay,
            silenceThreshold: DEFAULT_POPUP_SETTINGS.silenceThreshold,
            silenceRestoreVolume: DEFAULT_POPUP_SETTINGS.silenceRestoreVolume
        };

        applySettingsToUI();
        await save();
    });
}


function setupControls() {
    const enabled = byId("enabled");
    const volume = byId("volume");
    const soundEffects = byId("soundEffects");
    const audioBlur = byId("audioBlur");

    enabled?.addEventListener("change", async (event) => {
        settings.enabled = Boolean(event.target.checked);
        extensionEnabled = settings.enabled;
        updateModelBlur();
        await save();
    });

    volume?.addEventListener("input", () => {
        const value = Math.max(0, Math.min(100, Number(eventValue(volume, 15))));
        settings.duckVolume = value;
        const volumeValue = byId("volumeValue");
        if (volumeValue) volumeValue.textContent = String(value);
    });

    volume?.addEventListener("change", save);

    soundEffects?.addEventListener("change", async (event) => {
        settings.soundEffects = Boolean(event.target.checked);
        await save();
    });

    audioBlur?.addEventListener("change", async (event) => {
        settings.audioBlur = Boolean(event.target.checked);
        await save();
    });
}

function eventValue(element, fallback) {
    const value = Number(element.value);
    return Number.isFinite(value) ? value : fallback;
}

function setupModel() {
    const model = byId("headphoneModel");
    const modelContainer = byId("modelContainer");
    if (!model || !modelContainer) return;

    model.addEventListener("load", () => {
        modelContainer.classList.add("model-loaded");
        modelContainer.classList.remove("error");
    });

    model.addEventListener("error", (error) => {
        console.error("[Audio Ducking] Model error:", error);
        modelContainer.classList.add("error");
    });
}


setupModel();
setupControls();
setupCustomSettings();

void loadSettings();
void refreshStatus();

setInterval(() => {
    void refreshStatus();
}, 500);
