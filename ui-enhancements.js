document.addEventListener('DOMContentLoaded', () => {
    const translations = {
        vi: {
            desc: "bởi giauydev v2.0.1",
            extStatus: "Kích hoạt tiện ích",
            activeTarget: "Mục tiêu (Tab hiện tại)",
            silent: "Đang im lặng",
            playing: "Đang phát",
            loading: "Đang tải...",
            activeTab: "• TAB HIỆN TẠI",
            volTitle: "Âm lượng tab khác",
            volNote1: "Khi tab hiện tại có tiếng, các tab khác sẽ giảm còn",
            volNote2: "âm lượng.",
            sfxTitle: "Hiệu ứng âm thanh",
            sfxDesc: "Bật/tắt hiệu ứng âm thanh giống AirPods",
            ancTitle: "ANC Mode",
            ancDesc: "Khử tiếng ồn (Giống AirPods Noise Cancellation)",
            customTitle: "Cài đặt chuyên sâu",
            customDesc: "Dành cho người muốn tinh chỉnh chi tiết",
            duckFade: "Tốc độ giảm âm (Duck)",
            duckFadeDesc: "Thời gian làm mờ/giảm âm thanh các tab khác.",
            restoreFade: "Tốc độ khôi phục (Restore)",
            restoreFadeDesc: "Thời gian khôi phục lại âm lượng ban đầu.",
            ancFreq: "Tần số ANC",
            ancFreqDesc: "Tần số càng thấp = hiệu ứng cách âm càng mạnh.",
            resetBtn: "Đặt lại cài đặt",
            resetTitle: "Đặt lại cài đặt",
            sfxDelay: "Độ trễ SFX",
            sfxDelayDesc: "Khoảng chờ trước khi phát SFX chuyển trạng thái.",
            silenceThreshold: "Ngưỡng im lặng",
            silenceThresholdDesc: "Thời gian im lặng liên tục trước khi chạy ANC-off SFX.",
            silenceRestoreVolume: "Âm lượng trước SFX",
            silenceRestoreVolumeDesc: "Sau ngưỡng im lặng, âm lượng chỉ khôi phục đến mức này trước khi phát SFX.",
        supportMe: "Ủng hộ tớ 1 ly cà phê",
            footerNote: "Sử dụng tai nghe cho trải nghiệm tốt nhất"
        },
        en: {
            desc: "by giauydev v2.0.1",
            extStatus: "Extension Status",
            activeTarget: "Active Target",
            silent: "Silent",
            playing: "Playing",
            loading: "Loading...",
            activeTab: "• ACTIVE TAB",
            volTitle: "Other tabs volume",
            volNote1: "When the target plays sound, other tabs lower to",
            volNote2: "volume.",
            sfxTitle: "Sound Effects",
            sfxDesc: "Turn on/off Airpods SFX",
            ancTitle: "ANC Mode",
            ancDesc: "AirPods Noise Cancellation effect",
            customTitle: "Advanced Settings",
            customDesc: "Fine-tuning for power users",
            duckFade: "Duck speed",
            duckFadeDesc: "Fade-out duration for background tabs.",
            restoreFade: "Restore speed",
            restoreFadeDesc: "Fade-in duration when restoring volume.",
            ancFreq: "ANC Frequency",
            ancFreqDesc: "Lower frequency = stronger muffled effect.",
            resetBtn: "Reset Settings",
            resetTitle: "Reset Settings",
            sfxDelay: "SFX delay",
            sfxDelayDesc: "Delay before transition SFX plays.",
            silenceThreshold: "Silence threshold",
            silenceThresholdDesc: "Continuous silence before the ANC-off SFX plays.",
            silenceRestoreVolume: "Volume before SFX",
            silenceRestoreVolumeDesc: "After the silence threshold, volume only restores to this level before the SFX plays.",
        supportMe: "Buy me a coffee",
            footerNote: "Use headphones for the best experience"
        }
    };

    let currentLang = localStorage.getItem('duckAncLang') || 'vi';

    const langToggleBtn = document.getElementById('langToggle');
    const langDropdown = document.getElementById('langDropdown');
    const langOptions = document.querySelectorAll('.lang-option');

    function applyLanguage(lang) {
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                el.innerText = translations[lang][key];
            }
        });

        
        langOptions.forEach(opt => {
            opt.classList.remove('active');
            if (opt.getAttribute('data-lang') === lang) {
                opt.classList.add('active');
                
                
                const svgClone = opt.querySelector('svg').cloneNode(true);
                langToggleBtn.innerHTML = '';
                langToggleBtn.appendChild(svgClone);
            }
        });
    }

    
    langToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('show');
    });

    
    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedLang = option.getAttribute('data-lang');
            currentLang = selectedLang;
            localStorage.setItem('duckAncLang', currentLang);
            applyLanguage(currentLang);
            langDropdown.classList.remove('show');
        });
    });

    
    document.addEventListener('click', (e) => {
        if (!langToggleBtn.contains(e.target) && !langDropdown.contains(e.target)) {
            langDropdown.classList.remove('show');
        }
    });

    
    const resetBtn = document.getElementById('resetSettings');
    if (resetBtn) {
        const applyResetLabel = () => {
            const title = (translations[currentLang] && translations[currentLang].resetTitle) || 'Reset Settings';
            resetBtn.title = title;
            resetBtn.setAttribute('aria-label', title);
        };
        applyResetLabel();
        const originalApplyLanguage = applyLanguage;
        
        applyLanguage = (lang) => {
            originalApplyLanguage(lang);
            const title = (translations[lang] && translations[lang].resetTitle) || 'Reset Settings';
            resetBtn.title = title;
            resetBtn.setAttribute('aria-label', title);
        };
    }

    
    applyLanguage(currentLang);
    
    let currentTheme = localStorage.getItem('duckAncTheme') || 'dark';
    const bodyEl = document.body;
    const themeIcon = document.getElementById('themeIcon');

    
    const moonPath = "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z";
    
    const sunPath = "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z";

    function applyTheme(theme) {
        bodyEl.setAttribute('data-theme', theme);
        
        themeIcon.innerHTML = `<path d="${theme === 'light' ? moonPath : sunPath}"/>`;
    }

    const themeBtn = document.getElementById('themeToggle');
    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('duckAncTheme', currentTheme);
        applyTheme(currentTheme);
    });

    
    applyTheme(currentTheme);
});
