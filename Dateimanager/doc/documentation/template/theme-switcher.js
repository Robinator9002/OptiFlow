/**
 * OptiFlow Documentation Theme Switcher
 * Version 1.1 - Anti-Flicker Update
 *
 * This script handles the theme switching logic for the documentation.
 * The initial theme is set by an inline script in the <head> to prevent flickering.
 * This script handles the button interactivity.
 */
document.addEventListener("DOMContentLoaded", () => {
    // Ensure lucide icons are created
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Find all theme switchers on the page
    const allSwitchers = document.querySelectorAll(".theme-switcher");

    if (allSwitchers.length === 0) {
        return;
    }

    // Function to apply a theme to the root element and update button states
    const applyTheme = (theme) => {
        // Apply theme to the root <html> element
        document.documentElement.removeAttribute("data-theme");

        if (theme !== "default") {
            document.documentElement.setAttribute("data-theme", theme);
        }

        // Update the 'active' class on all buttons in all switchers
        allSwitchers.forEach((switcher) => {
            const buttons = {
                default: switcher.querySelector("#theme-default"),
                dark: switcher.querySelector("#theme-dark"),
                contrast: switcher.querySelector("#theme-contrast"),
            };

            // Remove active class from all buttons
            Object.values(buttons).forEach((btn) => {
                if (btn) btn.classList.remove("active");
            });

            // Add active class to the correct button
            if (buttons[theme]) {
                buttons[theme].classList.add("active");
            }
        });
    };

    // Attach click event listeners to all buttons
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

    // On page load, get the saved theme and ensure the buttons are in the correct state
    // The actual theme is already applied by the inline script in <head>
    const savedTheme = localStorage.getItem("doc_theme") || "default";
    applyTheme(savedTheme);
});
