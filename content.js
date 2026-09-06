(() => {

    if (
        window.__ACTIVE_TAB_AUDIO_DUCKING__
    ) {
        return;
    }

    window.__ACTIVE_TAB_AUDIO_DUCKING__ =
        true;


    
    
    

    const DEFAULT_DUCK_DURATION =
        950;

    const DEFAULT_RESTORE_DURATION =
        900;

    const DEFAULT_BLUR_FREQUENCY =
        100;


    
    
    

    let audioContext = null;


    function getAudioContext() {

        if (!audioContext) {

            audioContext =
                new AudioContext();
        }

        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume()
                .catch(() => {});
        }

        return audioContext;
    }


    
    
    

    const mediaStates =
        new Map();


    
    function createMediaState(
        element
    ) {

        if (
            mediaStates.has(element)
        ) {
            return mediaStates.get(
                element
            );
        }


        try {

            const ctx =
                getAudioContext();


            const source =
                ctx.createMediaElementSource(
                    element
                );


            const gain =
                ctx.createGain();


            const filter =
                ctx.createBiquadFilter();


            filter.type =
                "lowpass";


            filter.frequency.value =
                22000;


            filter.Q.value =
                0.7;


            source.connect(gain);

            gain.connect(filter);

            filter.connect(
                ctx.destination
            );


            const state = {

                source,

                gain,

                filter,

                
                originalGain: 1,

                
                originalFrequency:
                    22000,

                originalElementVolume:
                    Number.isFinite(Number(element.volume))
                        ? Number(element.volume)
                        : 1,

                originalElementMuted:
                    Boolean(element.muted),

                hardMuted: false,

                ducked: false
            };


            mediaStates.set(
                element,
                state
            );


            return state;

        } catch (error) {

            
            console.debug(
                "[Audio Ducking] Media unsupported:",
                error
            );

            return null;
        }
    }


    
    
    

    function getMedia() {

        return [
            ...document.querySelectorAll(
                "audio, video"
            )
        ];
    }


    
    
    

    function scheduleEase(param, from, to, startTime, durationSeconds) {

        const duration = Math.max(0.05, durationSeconds);
        const steps = Math.max(12, Math.min(30, Math.round(duration * 24)));

        param.cancelScheduledValues(startTime);
        param.setValueAtTime(from, startTime);

        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const eased = t * t * (3 - 2 * t);
            param.linearRampToValueAtTime(
                from + (to - from) * eased,
                startTime + duration * t
            );
        }
    }


    
    
    

    function duckMedia(
        element,
        targetVolume,
        duration,
        shouldBlur,
        blurFrequency,
        instant = false
    ) {

        const state =
            createMediaState(
                element
            );

        if (!state) {
            return;
        }


        const ctx =
            getAudioContext();


        const now =
            ctx.currentTime;


        
        
        const seconds =
            Math.max(
                0.05,
                Number(duration) /
                    1000
            );


        const target =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(targetVolume)
                )
            );


        
        const currentGain =
            state.gain.gain.value;


        const currentFrequency =
            state.filter.frequency.value;


        
        if (instant) {
            state.gain.gain.cancelScheduledValues(now);
            state.gain.gain.setValueAtTime(target, now);
        } else {
            scheduleEase(
                state.gain.gain,
                currentGain,
                target,
                now,
                seconds
            );
        }

        
        if (target === 0) {
            if (!state.hardMuted) {
                state.originalElementVolume =
                    Number.isFinite(Number(element.volume))
                        ? Number(element.volume)
                        : 1;
                state.originalElementMuted =
                    Boolean(element.muted);
            }

            state.hardMuted = true;
            element.volume = 0;
            element.muted = true;
        } else if (state.hardMuted) {
            element.volume =
                Math.max(0, Math.min(1, Number(state.originalElementVolume)));
            element.muted = state.originalElementMuted;
            state.hardMuted = false;
        }


        
        if (shouldBlur) {

            const frequency =
                Math.max(
                    100,
                    Math.min(
                        1800,
                        Number(
                            blurFrequency
                        ) ||
                            DEFAULT_BLUR_FREQUENCY
                    )
                );

            if (instant) {
                state.filter.frequency.cancelScheduledValues(now);
                state.filter.frequency.setValueAtTime(
                    frequency,
                    now
                );
            } else {
                scheduleEase(
                    state.filter.frequency,
                    currentFrequency,
                    frequency,
                    now,
                    seconds
                );
            }

        } else {

            if (instant) {
                state.filter.frequency.cancelScheduledValues(now);
                state.filter.frequency.setValueAtTime(
                    22000,
                    now
                );
            } else {
                scheduleEase(
                    state.filter.frequency,
                    currentFrequency,
                    22000,
                    now,
                    seconds
                );
            }
        }


        state.ducked =
            true;
    }


    
    
    

    function restoreMedia(
        element,
        duration,
        useBlurEase = true
    ) {

        const state =
            mediaStates.get(
                element
            );

        if (!state) {
            return;
        }


        if (!state.ducked) {
            return;
        }


        state.ducked =
            false;


        const ctx =
            getAudioContext();


        const now =
            ctx.currentTime;


        const seconds =
            Math.max(
                0.05,
                Number(duration) /
                    1000
            );


        const currentGain =
            state.gain.gain.value;


        const currentFrequency =
            state.filter
                .frequency.value;


        
        scheduleEase(
            state.gain.gain,
            currentGain,
            state.originalGain,
            now,
            seconds
        );

        if (useBlurEase) {
            scheduleEase(
                state.filter.frequency,
                currentFrequency,
                state.originalFrequency,
                now,
                seconds
            );
        } else {
            state.filter.frequency.cancelScheduledValues(now);
            state.filter.frequency.setValueAtTime(
                state.originalFrequency,
                now
            );
        }

        if (state.hardMuted) {
            element.volume =
                Math.max(0, Math.min(1, Number(state.originalElementVolume)));
            element.muted = state.originalElementMuted;
            state.hardMuted = false;
        }
    }


    
    
    

    function duckAll(
        message
    ) {

        const media =
            getMedia();


        const targetVolume =
            Number(
                message.volume
            );


        const duration =
            Number(
                message.duration
            ) ||
            DEFAULT_DUCK_DURATION;


        const shouldBlur =
            Boolean(
                message.blur
            );


        const blurFrequency =
            Number(
                message.blurFrequency
            ) ||
            DEFAULT_BLUR_FREQUENCY;

        const instant =
            Boolean(
                message.instant
            );


        for (
            const element
            of media
        ) {

            duckMedia(
                element,
                targetVolume,
                duration,
                shouldBlur,
                blurFrequency,
                instant
            );
        }
    }


    
    
    

    function restoreAll(
        message
    ) {

        const duration =
            Number(
                message.duration
            ) ||
            DEFAULT_RESTORE_DURATION;

        const useBlurEase =
            message.blur !== false;

        for (
            const element
            of mediaStates.keys()
        ) {

            restoreMedia(
                element,
                duration,
                useBlurEase
            );
        }
    }


    
    
    

    function restoreAllPartial(
        message
    ) {
        const duration =
            Number(
                message.duration
            ) ||
            DEFAULT_RESTORE_DURATION;

        const volumeRatio =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(message.volumeRatio)
                )
            );

        const useBlurEase =
            message.blur !== false;

        for (
            const element
            of mediaStates.keys()
        ) {
            const state =
                mediaStates.get(
                    element
                );

            if (!state) {
                continue;
            }

            const ctx =
                getAudioContext();

            const now =
                ctx.currentTime;

            const seconds =
                Math.max(
                    0.05,
                    Number(duration) /
                        1000
                );

            scheduleEase(
                state.gain.gain,
                state.gain.gain.value,
                state.originalGain * volumeRatio,
                now,
                seconds
            );

            if (useBlurEase) {
                scheduleEase(
                    state.filter.frequency,
                    state.filter.frequency.value,
                    state.originalFrequency,
                    now,
                    seconds
                );
            } else {
                state.filter.frequency.cancelScheduledValues(now);
                state.filter.frequency.setValueAtTime(
                    state.originalFrequency,
                    now
                );
            }

            if (state.hardMuted) {
                element.volume =
                    Math.max(0, Math.min(1, Number(state.originalElementVolume)));
                element.muted = state.originalElementMuted;
                state.hardMuted = false;
            }

            state.ducked = true;
        }
    }






    let currentlyDucked =
        false;

    let lastDuckConfig = {
        volume: 0.15,
        duration: 900,
        blur: true,
        blurFrequency: 100,
        instant: false
    };


    const observer =
        new MutationObserver(
            mutations => {

                
                if (!currentlyDucked) {
                    return;
                }


                
                for (
                    const mutation
                    of mutations
                ) {

                    for (
                        const node
                        of mutation.addedNodes
                    ) {

                        if (
                            node.nodeType !==
                            Node.ELEMENT_NODE
                        ) {
                            continue;
                        }


                        const media = [];


                        if (
                            node.matches?.(
                                "audio, video"
                            )
                        ) {

                            media.push(node);
                        }


                        media.push(
                            ...(
                                node.querySelectorAll?.(
                                    "audio, video"
                                ) || []
                            )
                        );


                        for (
                            const element
                            of media
                        ) {

                            duckMedia(
                                element,
                                lastDuckConfig.volume,
                                lastDuckConfig.duration,
                                lastDuckConfig.blur,
                                lastDuckConfig.blurFrequency,
                                lastDuckConfig.instant
                            );
                        }
                    }
                }
            }
        );


    if (
        document.documentElement
    ) {

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }


    
    
    

    chrome.runtime.onMessage.addListener(
        (
            message,
            sender,
            sendResponse
        ) => {

            
            if (
                message.type ===
                "DUCK"
            ) {

                currentlyDucked =
                    true;


                lastDuckConfig = {
                    volume:
                        Number.isFinite(Number(message.volume))
                            ? Number(message.volume)
                            : 0.15,

                    duration:
                        Number(
                            message.duration
                        ) ||
                        DEFAULT_DUCK_DURATION,

                    blur:
                        Boolean(
                            message.blur
                        ),

                    blurFrequency:
                        Number(
                            message.blurFrequency
                        ) ||
                        DEFAULT_BLUR_FREQUENCY,

                    instant:
                        Boolean(
                            message.instant
                        )
                };


                duckAll(
                    lastDuckConfig
                );


                sendResponse({
                    success: true
                });

                return true;
            }


            
            if (
                message.type ===
                "RESTORE"
            ) {

                currentlyDucked =
                    false;


                restoreAll(
                    message
                );


                sendResponse({
                    success: true
                });

                return true;
            }

            if (
                message.type ===
                "RESTORE_PARTIAL"
            ) {
                restoreAllPartial(
                    message
                );

                sendResponse({
                    success: true
                });

                return true;
            }
        }
    );

})();
