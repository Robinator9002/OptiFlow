/**
 * OptiFlow Documentation Main Script
 * Version 4.0 - Search Implementation, Active Nav Highlighting
 */
document.addEventListener("DOMContentLoaded", () => {
    // --- 1. DYNAMICALLY SET ACTIVE NAVIGATION LINK ---
    const currentPage = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll("nav a");
    navLinks.forEach((link) => {
        if (link.getAttribute("href") === currentPage) {
            link.parentElement.classList.add("active");
        }
    });

    // --- 2. THEME SWITCHER LOGIC ---
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

    // --- 3. ADVANCED SMART-HIDING HEADER LOGIC ---
    const header = document.querySelector("header");
    const pinToggle = document.getElementById("pin-header-toggle");

    if (header && pinToggle) {
        let lastScrollY = window.scrollY;
        let isTicking = false;
        let scrollUpDistance = 0;
        const showThreshold = 150; // Pixel, die man nach oben scrollen muss

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
            if (isPinned) {
                header.classList.remove("header-hidden");
            }
        };

        const savedPinState =
            localStorage.getItem("doc_header_pinned") === "true";
        setPinState(savedPinState);

        pinToggle.addEventListener("click", () => {
            const isCurrentlyPinned = header.classList.contains("is-pinned");
            localStorage.setItem("doc_header_pinned", !isCurrentlyPinned);
            setPinState(!isCurrentlyPinned);
        });

        const updateHeader = () => {
            if (header.classList.contains("is-pinned")) {
                isTicking = false;
                return;
            }
            const currentScrollY = window.scrollY;
            if (currentScrollY < 150) {
                header.classList.remove("header-hidden");
            } else if (currentScrollY > lastScrollY) {
                header.classList.add("header-hidden");
                scrollUpDistance = 0;
            } else {
                scrollUpDistance += lastScrollY - currentScrollY;
                if (scrollUpDistance > showThreshold) {
                    header.classList.remove("header-hidden");
                }
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

    // --- 4. ACCORDION LOGIC ---
    const accordionItems = document.querySelectorAll(".accordion-item");
    if (accordionItems.length > 0) {
        // Open the first item by default if it exists on the page
        const firstItem = accordionItems[0];
        if (firstItem) {
            const firstButton = firstItem.querySelector(".accordion-header");
            const firstContent = firstItem.querySelector(".accordion-content");
            if (firstButton && firstContent) {
                firstButton.classList.add("active");
                firstContent.style.maxHeight = firstContent.scrollHeight + "px";
                firstContent.style.paddingTop = "1.5em";
                firstContent.style.paddingBottom = "1.5em";
            }
        }

        accordionItems.forEach((item) => {
            const button = item.querySelector(".accordion-header");
            const content = item.querySelector(".accordion-content");

            if (button && content) {
                button.addEventListener("click", () => {
                    const isActive = button.classList.contains("active");

                    // Close all items
                    accordionItems.forEach((otherItem) => {
                        otherItem
                            .querySelector(".accordion-header")
                            .classList.remove("active");
                        const otherContent =
                            otherItem.querySelector(".accordion-content");
                        otherContent.style.maxHeight = null;
                        otherContent.style.paddingTop = null;
                        otherContent.style.paddingBottom = null;
                    });

                    // If the clicked item was not active, open it
                    if (!isActive) {
                        button.classList.add("active");
                        content.style.maxHeight = content.scrollHeight + "px";
                        content.style.paddingTop = "1.5em";
                        content.style.paddingBottom = "1.5em";
                    }
                });
            }
        });
    }

    // --- 5. SEARCH IMPLEMENTATION ---
    const searchInput = document.getElementById("doc-search-input");
    const searchResultsContainer = document.getElementById("search-results");
    let searchIndex = [];
    let activeResultIndex = -1;

    // Fetch the search index
    if (searchInput && searchResultsContainer) {
        fetch("search-index.json")
            .then((response) => response.json())
            .then((data) => {
                searchIndex = data;
            })
            .catch((error) =>
                console.error("Error loading search index:", error)
            );

        // Function to perform search and render results
        const performSearch = () => {
            const query = searchInput.value.trim().toLowerCase();
            if (query.length < 2) {
                hideResults();
                return;
            }

            const results = searchIndex.filter(
                (item) =>
                    item.title.toLowerCase().includes(query) ||
                    item.content.toLowerCase().includes(query)
            );

            renderResults(results, query);
        };

        // Function to render results
        const renderResults = (results, query) => {
            searchResultsContainer.innerHTML = "";
            if (results.length === 0) {
                searchResultsContainer.innerHTML =
                    '<div class="search-no-results">Keine Ergebnisse gefunden</div>';
            } else {
                const regex = new RegExp(`(${query})`, "gi");
                results.slice(0, 10).forEach((result) => {
                    // Limit to 10 results
                    const title = result.title.replace(
                        regex,
                        "<mark>$1</mark>"
                    );
                    const pathParts = result.path.split("#");
                    const cleanPath = pathParts[0];

                    const link = document.createElement("a");
                    link.href = result.path;
                    link.innerHTML = `
                        <span class="result-title">${title}</span>
                        <span class="result-path">${cleanPath}</span>
                    `;
                    searchResultsContainer.appendChild(link);
                });
            }
            showResults();
            activeResultIndex = -1; // Reset active index
        };

        const showResults = () =>
            searchResultsContainer.classList.add("visible");
        const hideResults = () =>
            searchResultsContainer.classList.remove("visible");

        // Event Listeners
        searchInput.addEventListener("input", performSearch);
        searchInput.addEventListener("focus", performSearch);

        // Hide results when clicking outside
        document.addEventListener("click", (e) => {
            if (!header.contains(e.target)) {
                hideResults();
            }
        });

        // Keyboard navigation
        searchInput.addEventListener("keydown", (e) => {
            const results = searchResultsContainer.querySelectorAll("a");
            if (results.length === 0) return;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    activeResultIndex =
                        (activeResultIndex + 1) % results.length;
                    updateActiveResult(results);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    activeResultIndex =
                        (activeResultIndex - 1 + results.length) %
                        results.length;
                    updateActiveResult(results);
                    break;
                case "Enter":
                    e.preventDefault();
                    if (activeResultIndex > -1) {
                        results[activeResultIndex].click();
                    }
                    break;
                case "Escape":
                    hideResults();
                    break;
            }
        });

        const updateActiveResult = (results) => {
            results.forEach((res) => res.classList.remove("result-active"));
            if (activeResultIndex > -1) {
                const activeResult = results[activeResultIndex];
                activeResult.classList.add("result-active");
                activeResult.scrollIntoView({ block: "nearest" });
            }
        };
    }
});
