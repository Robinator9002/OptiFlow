/**
 * OptiFlow Documentation Main Script
 * Version 7.2 - Added global keyboard shortcuts for search (Ctrl+F, type-to-search)
 */
document.addEventListener("DOMContentLoaded", () => {
    // --- Parts that can run early ---

    // 1. DYNAMICALLY SET ACTIVE NAVIGATION LINK
    const currentPage = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll("nav a");
    navLinks.forEach((link) => {
        const linkHref = link.getAttribute("href").split("#")[0];
        if (
            linkHref === currentPage ||
            (currentPage === "" && linkHref === "index.html")
        ) {
            link.parentElement.classList.add("active");
        }
    });

    // 2. THEME SWITCHER LOGIC
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
    const allSwitchers = document.querySelectorAll(".theme-switcher-floating");
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

    // 3. ADVANCED SMART-HIDING HEADER LOGIC
    const header = document.querySelector("header");
    const pinToggle = document.getElementById("pin-header-toggle");

    if (header && pinToggle) {
        let lastScrollY = window.scrollY;
        let isTicking = false;
        let scrollUpDistance = 0;
        const showThreshold = 1000;

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

    // --- 4. ACCORDION LOGIC (with Deep Linking) ---
    const accordionItems = document.querySelectorAll(".accordion-item");
    if (accordionItems.length > 0) {
        let deepLinked = false;
        const hash = window.location.hash;

        const openAccordionItem = (item) => {
            accordionItems.forEach((otherItem) => {
                const otherButton =
                    otherItem.querySelector(".accordion-header");
                const otherContent =
                    otherItem.querySelector(".accordion-content");
                if (otherItem === item) {
                    otherButton.classList.add("active");
                    otherContent.style.maxHeight =
                        otherContent.scrollHeight + "px";
                    otherContent.style.paddingTop = "1.5em";
                    otherContent.style.paddingBottom = "1.5em";
                } else {
                    otherButton.classList.remove("active");
                    otherContent.style.maxHeight = null;
                    otherContent.style.paddingTop = null;
                    otherContent.style.paddingBottom = null;
                }
            });
        };

        if (hash) {
            const targetId = hash.substring(1);
            const targetElement = document.getElementById(targetId);
            if (
                targetElement &&
                targetElement.classList.contains("accordion-item")
            ) {
                openAccordionItem(targetElement);
                setTimeout(() => {
                    targetElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                }, 300);
                deepLinked = true;
            }
        }

        if (!deepLinked) {
            openAccordionItem(accordionItems[0]);
        }

        accordionItems.forEach((item) => {
            const button = item.querySelector(".accordion-header");
            const content = item.querySelector(".accordion-content");
            if (button && content) {
                button.addEventListener("click", () => {
                    const isActive = button.classList.contains("active");
                    if (isActive) {
                        button.classList.remove("active");
                        content.style.maxHeight = null;
                        content.style.paddingTop = null;
                        content.style.paddingBottom = null;
                    } else {
                        openAccordionItem(item);
                    }
                });
            }
        });
    }

    // --- 5. CUSTOM SEARCH IMPLEMENTATION ---
    const searchInput = document.getElementById("doc-search-input");
    const searchResultsContainer = document.getElementById("search-results");
    let activeResultIndex = -1;

    const searchData = [
        {
            id: "index_uebersicht",
            title: "Willkommen bei OptiFlow",
            content:
                "Willkommen zur offiziellen und vollständigen Dokumentation des OptiFlow Dateimanagers. Übersicht, Einführung, Startseite.",
            path: "index.html#uebersicht",
        },
        {
            id: "index_was_macht_besonders",
            title: "Was macht OptiFlow besonders?",
            content:
                "Blitzschnelle Suche, invertierte Indexierung, Inhaltsanalyse, PDFs, Word, OCR Texterkennung, Relevanzbewertung, Datenbereinigung, Duplikate, alte Dateien, Sicherheit, MinHash.",
            path: "index.html#was-macht-optiflow-besonders",
        },
        {
            id: "index_navigation",
            title: "Navigation durch die Dokumentation",
            content:
                "Anleitung zur Nutzung der Dokumentation. Installation, Erste Schritte, Funktionen, Einstellungen, Datenmanagement, Technik, Sicherheit, Fehlerbehebung, Tastenkürzel.",
            path: "index.html#navigation",
        },
        {
            id: "installation_windows",
            title: "Installation unter Windows (One-Click-Installer)",
            content:
                "Einfachste Weg für Windows. Setup.exe herunterladen und ausführen. Erstellt Verknüpfungen auf Desktop und im Startmenü.",
            path: "installation.html#windows-installer",
        },
        {
            id: "installation_manuell",
            title: "Manuelle Installation für Linux & Experten",
            content:
                "ZIP-Paket für Linux, Entwickler, portable Nutzung. start.bat für Windows, start.sh für Linux.",
            path: "installation.html#manuelle-installation",
        },
        {
            id: "installation_datenablage",
            title: "Speicherort der Daten",
            content:
                "Wo werden Daten wie users.json, index.json gespeichert? Wichtig für Backup. AppData, Programmordner, data Ordner.",
            path: "installation.html#manuelle-installation",
        },
        {
            id: "erste_schritte_anmeldung",
            title: "Erste Schritte: Admin-Anmeldung",
            content:
                "Erster Benutzer wird Administrator. Passwort vergeben. Admin anlegen. Erstanmeldung.",
            path: "erste_schritte.html#schritt1-anmeldung",
        },
        {
            id: "erste_schritte_scanner",
            title: "Erste Schritte: Scanner konfigurieren",
            content:
                "Zielordner und Dateitypen festlegen. Index & Scanner Tab. Konfiguration speichern.",
            path: "erste_schritte.html#schritt2-scanner-konfigurieren",
        },
        {
            id: "erste_schritte_scan",
            title: "Erste Schritte: Der erste Scan",
            content:
                "Indexierung starten. Auf 'Dateien scannen' klicken. System bereit für die Suche.",
            path: "erste_schritte.html#schritt3-indexierung",
        },
        {
            id: "funktionen_benutzer_suche",
            title: "Globale Suche und In-Datei-Suche",
            content:
                "Suchen mit UND/ODER Verknüpfung. Relevanz-Sortierung. Pfeiltasten. Vorschau mit Snippets und Highlighting.",
            path: "funktionen_benutzer.html#die-suche",
        },
        {
            id: "funktionen_admin_tabs",
            title: "Admin-Funktionen: Index, Duplikate, alte Dateien, OCR",
            content:
                "Index & Scanner Tab: Index aktualisieren, neu aufbauen, laden, löschen. Entduplizierung: Duplikate mit MinHash finden. Alte Dateien aufspüren. PDF zu OCR.",
            path: "funktionen_admin.html#index-management",
        },
        {
            id: "einstellungen_uebersicht",
            title: "Übersicht der Einstellungen",
            content:
                "Alle anpassbaren Optionen. Erscheinungsbild, Suche, Scanner, OCR, Analyse, Benutzerverwaltung, Datenbank, System-Events.",
            path: "einstellungen.html#einstellungen-intro",
        },
        {
            id: "einstellungen-erscheinungsbild",
            title: "Einstellungen: Erscheinungsbild & Bedienung",
            content:
                "Theme, Dark Mode, Dunkelmodus, Kontrast, Schriftgröße anpassen. Kosmetische Einstellungen.",
            path: "einstellungen.html#einstellungen-erscheinungsbild",
        },
        {
            id: "einstellungen-suche",
            title: "Einstellungen: Suche & Relevanz",
            content:
                "Maximale Suchergebnisse, Relevanz-Scores, Gewichtung, Punktesystem, Vorschau-Snippets, In-Datei-Suche konfigurieren.",
            path: "einstellungen.html#einstellungen-suche",
        },
        {
            id: "einstellungen-scanner",
            title: "Einstellungen: Scanner & Indexierung",
            content:
                "Leistung, CPU-Kerne, Verzögerung, ignorierte Verzeichnisse, Dateitypen für Scan festlegen.",
            path: "einstellungen.html#einstellungen-scanner",
        },
        {
            id: "einstellungen-ocr",
            title: "Einstellungen: OCR-Texterkennung",
            content:
                "Qualität, Geschwindigkeit, DPI, Ausgabe-Optionen, Tesseract, OCR-Sprache anpassen für PDF.",
            path: "einstellungen.html#einstellungen-ocr",
        },
        {
            id: "einstellungen-alte-dateien",
            title: "Einstellungen: Analyse Veralteter Dateien",
            content:
                "Filter, Alter in Tagen, Limits und Sortierung für die Suche nach alten Dateien festlegen.",
            path: "einstellungen.html#einstellungen-alte-dateien",
        },
        {
            id: "einstellungen-duplikate",
            title: "Einstellungen: Analyse von Dateiduplikaten",
            content:
                "MinHash Algorithmus, Shingle-Länge, Signaturgröße, Ähnlichkeitsschwellenwert für Entduplizierung anpassen.",
            path: "einstellungen.html#einstellungen-duplikate",
        },
        {
            id: "einstellungen-benutzer",
            title: "Einstellungen: Konten & Benutzerverwaltung",
            content:
                "Eigenes Konto, Benutzernamen ändern, Passwort ändern, Konto löschen. Admin-Status, Passwörter zurücksetzen, Benutzer löschen.",
            path: "einstellungen.html#einstellungen-benutzer",
        },
        {
            id: "einstellungen-datenbank",
            title: "Einstellungen: Datenbank & Backup",
            content:
                "Interaktion mit JSON-Dateien, users.json, index.json. Herunterladen, ansehen, bearbeiten. Backup und Wiederherstellung.",
            path: "einstellungen.html#einstellungen-datenbank",
        },
        {
            id: "einstellungen-server",
            title: "Einstellungen: Server & Geplante Aufgaben",
            content:
                "Globale Servereinstellungen. Geplante Aufgaben, Events erstellen. Scanner automatisch aktualisieren. Server herunterfahren.",
            path: "einstellungen.html#einstellungen-server",
        },
        {
            id: "datenmanagement_backup_restore",
            title: "Datenmanagement: Backup und Wiederherstellung",
            content:
                "Anleitung zur Sicherung und Wiederherstellung. Backup erstellen. Manuelles Wiederherstellen durch Ersetzen der .json Dateien im data-Ordner.",
            path: "datenmanagement.html#workflow-cards",
        },
        {
            id: "datenmanagement_reset",
            title: "Notfall-Reset für Admin-Passwort",
            content:
                "Admin-Passwort vergessen? Löschen der users.json setzt Benutzerverwaltung zurück.",
            path: "datenmanagement.html#reset-warning-section",
        },
        {
            id: "troubleshooting_network_error",
            title: "Fehlerbehebung: Network Error",
            content:
                "Problem: Frontend kann Backend nicht erreichen. Lösungen: Warten, App neu starten, data-Ordner umbenennen.",
            path: "troubleshooting.html#problem-network-error",
        },
        {
            id: "troubleshooting_login_freeze",
            title: "Fehlerbehebung: Login friert ein",
            content:
                "Problem: Endloser Lade-Spinner beim Anmelden. Ursache: Backend überlastet. Lösung: Warten.",
            path: "troubleshooting.html#problem-login-freeze",
        },
        {
            id: "technik_architektur",
            title: "Technik: Architektur",
            content:
                "Client-Server-Architektur. Frontend React, TypeScript. Backend Python, FastAPI. RESTful API.",
            path: "technik_sicherheit.html#architektur",
        },
        {
            id: "technik_suche",
            title: "Technik: Suchtechnologie",
            content:
                "Invertierter Index für schnelle Suche. Relevanz-Scoring, TF-IDF. Treffer im Dateinamen.",
            path: "technik_sicherheit.html#suchtechnologie",
        },
        {
            id: "tastenkürzel_global",
            title: "Tastenkürzel: Global",
            content:
                "Shortcuts: F1 Hilfe, Strg+1-5 Tab-Wechsel, Strg+, Einstellungen, Escape.",
            path: "tastenkürzel.html#global-shortcuts",
        },
    ];

    const performSearch = () => {
        if (!searchInput) return;
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            hideResults();
            return;
        }

        const searchTerms = query.split(" ").filter(Boolean);
        const results = [];

        searchData.forEach((doc) => {
            let score = 0;
            const lowerCaseTitle = doc.title.toLowerCase();
            const lowerCaseContent = doc.content.toLowerCase();

            searchTerms.forEach((term) => {
                if (lowerCaseTitle.includes(term)) {
                    score += 10; // Higher score for title matches
                }
                if (lowerCaseContent.includes(term)) {
                    score += 1; // Lower score for content matches
                }
            });

            if (score > 0) {
                const allTermsFound = searchTerms.every(
                    (term) =>
                        lowerCaseTitle.includes(term) ||
                        lowerCaseContent.includes(term)
                );

                if (allTermsFound) {
                    results.push({ doc, score });
                }
            }
        });

        results.sort((a, b) => b.score - a.score);
        const finalDocs = results.map((result) => result.doc);
        renderResults(finalDocs, query);
    };

    const renderResults = (results, query) => {
        if (!searchResultsContainer) return;
        searchResultsContainer.innerHTML = "";
        if (results.length === 0) {
            searchResultsContainer.innerHTML =
                '<div class="search-no-results">Keine Ergebnisse gefunden</div>';
        } else {
            const highlightRegex = new RegExp(
                `(${query.split(" ").filter(Boolean).join("|")})`,
                "gi"
            );
            results.slice(0, 10).forEach((doc) => {
                if (!doc) return;

                const title = doc.title.replace(
                    highlightRegex,
                    "<mark>$1</mark>"
                );
                const cleanPath = doc.path.split("#")[0];

                const link = document.createElement("a");
                link.href = doc.path;
                link.innerHTML = `<span class="result-title">${title}</span><span class="result-path">${cleanPath}</span>`;
                searchResultsContainer.appendChild(link);
            });
        }
        showResults();
        activeResultIndex = -1;
    };

    const showResults = () => {
        if (searchResultsContainer)
            searchResultsContainer.classList.add("visible");
    };
    const hideResults = () => {
        if (searchResultsContainer)
            searchResultsContainer.classList.remove("visible");
    };

    if (searchInput && searchResultsContainer) {
        searchInput.addEventListener("input", performSearch);
        searchInput.addEventListener("focus", performSearch);

        document.addEventListener("click", (e) => {
            if (header && !header.contains(e.target)) {
                hideResults();
            }
        });

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
                    } else if (results.length > 0) {
                        results[0].click();
                    }
                    break;
                // Escape is now handled globally
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

    // --- 6. GLOBAL KEYBOARD SHORTCUTS ---
    document.addEventListener("keydown", (e) => {
        if (!searchInput) return;

        // Handle Ctrl+F (or Cmd+F on Mac) to focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }

        // Handle Escape key to blur search and hide results
        if (e.key === "Escape") {
            if (document.activeElement === searchInput) {
                searchInput.blur();
                hideResults();
            }
        }

        // Handle "type-to-search" functionality
        const isTypingInInput =
            ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
            e.target.isContentEditable;
        const isCharacterKey =
            e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

        if (
            !isTypingInInput &&
            isCharacterKey &&
            document.activeElement !== searchInput
        ) {
            e.preventDefault();
            searchInput.focus();
            searchInput.value = e.key;
            performSearch();
        }
    });
});
