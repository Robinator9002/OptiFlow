/**
 * OptiFlow Documentation Main Script
 * Version 3.0 - Delayed Smart Header with Pin-Toggle & Theme Switcher
 */
document.addEventListener("DOMContentLoaded", () => {
    // --- 1. THEME SWITCHER LOGIC (unverändert) ---
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
    const allSwitchers = document.querySelectorAll(".theme-switcher");
    if (allSwitchers.length > 0) {
        const applyTheme = (theme) => {
            document.documentElement.removeAttribute("data-theme");
            if (theme !== "default") {
                document.documentElement.setAttribute("data-theme", theme);
            }
            allSwitchers.forEach((switcher) => {
                const buttons = {
                    default: switcher.querySelector("#theme-default"),
                    dark: switcher.querySelector("#theme-dark"),
                    contrast: switcher.querySelector("#theme-contrast"),
                };
                Object.values(buttons).forEach((btn) => {
                    if (btn) btn.classList.remove("active");
                });
                if (buttons[theme]) {
                    buttons[theme].classList.add("active");
                }
            });
        };
        allSwitchers.forEach((switcher) => {
            const buttons = {
                default: switcher.querySelector("#theme-default"),
                dark: switcher.querySelector("#theme-dark"),
                contrast: switcher.querySelector("#theme-contrast"),
            };
            Object.keys(buttons).forEach((themeKey) => {
                const button = buttons[themeKey];
                if (button) {
                    button.addEventListener("click", () => {
                        localStorage.setItem("doc_theme", themeKey);
                        applyTheme(themeKey);
                    });
                }
            });
        });
        const savedTheme = localStorage.getItem("doc_theme") || "default";
        applyTheme(savedTheme);
    }

    // --- 2. ADVANCED SMART-HIDING HEADER LOGIC ---
    const header = document.querySelector("header");
    const pinToggle = document.getElementById("pin-header-toggle");

    if (header && pinToggle) {
        let lastScrollY = window.scrollY;
        let isTicking = false;
        let scrollUpDistance = 0;
        const showThreshold = 800; // Pixel, die man nach oben scrollen muss

        // Function to set the pin state
        const setPinState = (isPinned) => {
            header.classList.toggle("is-pinned", isPinned);
            pinToggle.innerHTML = isPinned
                ? '<i data-lucide="pin-off"></i>'
                : '<i data-lucide="pin"></i>';
            pinToggle.title = isPinned
                ? "Kopfzeile lösen"
                : "Kopfzeile fixieren";
            if (typeof lucide !== "undefined") {
                lucide.createIcons({
                    nodes: [pinToggle],
                });
            }
            // If we pin it, make sure it's visible
            if (isPinned) {
                header.classList.remove("header-hidden");
            }
        };

        // Check localStorage for saved pin state
        const savedPinState =
            localStorage.getItem("doc_header_pinned") === "true";
        setPinState(savedPinState);

        // Event listener for the pin button
        pinToggle.addEventListener("click", () => {
            const isCurrentlyPinned = header.classList.contains("is-pinned");
            localStorage.setItem("doc_header_pinned", !isCurrentlyPinned);
            setPinState(!isCurrentlyPinned);
        });

        const updateHeader = () => {
            // Do nothing if the header is pinned
            if (header.classList.contains("is-pinned")) {
                isTicking = false;
                return;
            }

            const currentScrollY = window.scrollY;

            // Show header if we are near the top
            if (currentScrollY < 150) {
                header.classList.remove("header-hidden");
                isTicking = false;
                return;
            }

            if (currentScrollY < lastScrollY) {
                // Scrolling Up
                scrollUpDistance += lastScrollY - currentScrollY;
                if (scrollUpDistance > showThreshold) {
                    header.classList.remove("header-hidden");
                }
            } else if (currentScrollY > lastScrollY) {
                // Scrolling Down
                header.classList.add("header-hidden");
                scrollUpDistance = 0; // Reset distance when scrolling down
            }

            lastScrollY = currentScrollY;
            isTicking = false;
        };

        window.addEventListener("scroll", () => {
            if (!isTicking) {
                window.requestAnimationFrame(updateHeader);
                isTicking = true;
            }
        });

        const setHeaderHeight = () => {
            const headerHeight = header.offsetHeight;
            document.documentElement.style.setProperty(
                "--header-height",
                `${headerHeight}px`
            );
        };

        setHeaderHeight();
        window.addEventListener("resize", setHeaderHeight);
    }
});
