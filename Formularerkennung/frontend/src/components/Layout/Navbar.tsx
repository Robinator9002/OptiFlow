// src/components/Layout/NavbarTop.tsx
import React from "react";
import type { TabKey } from "../../App"; // Pfad ggf. anpassen
import type { UserPublic } from "../../api/api";
import { UserRole } from "../../api/api"; // UserRole importieren

interface NavbarTopProps {
	activeTab: TabKey;
	onTabChange: (tab: TabKey) => void;
	currentUser: UserPublic | null;
	onLogout: () => void;
	// Diese Liste kommt von App.tsx und enthält nur die für die Navbar relevanten Tabs
	availableTabs: TabKey[];
}

// Definition der Navigations-Items.
// "settings" ist jetzt ein regulärer Tab.
interface NavItemConfig {
	key: TabKey;
	label: string;
	icon?: string;
	condition?: (user: UserPublic | null) => boolean; // Kann weiterhin für spezifische Labels/Icons pro Rolle genutzt werden
}

// Konfiguration aller möglichen Navigations-Items, die in der Navbar erscheinen könnten.
// App.tsx filtert dies basierend auf der Rolle und übergibt die `availableTabs`-Prop.
const allPossibleNavItems: NavItemConfig[] = [
	{
		key: "formsList",
		label: "Übersicht",
		condition: (user) =>
			user?.role === UserRole.ADMIN || user?.role === UserRole.MITARBEITER,
	},
	// "newForm" ist kein direkter Navbar-Tab
	{
		key: "filledForms",
		label: "Formular-Eingänge",
		condition: (user) =>
			user?.role === UserRole.ADMIN || user?.role === UserRole.MITARBEITER,
	},
	{
		key: "filledForms",
		label: "Meine Formulare",
		condition: (user) => user?.role === UserRole.KUNDE,
	},
	{ key: "settings", label: "Einstellungen" }, // "settings" ist für alle eingeloggten Benutzer
];

const NavbarTop: React.FC<NavbarTopProps> = ({
	activeTab,
	onTabChange,
	currentUser,
	onLogout,
	availableTabs,
}) => {
	// Filtere die `allPossibleNavItems` basierend auf den `availableTabs`, die von App.tsx kommen.
	// Und wende die spezifische `condition` an (nützlich für unterschiedliche Labels desselben TabKeys).
	const visibleNavItems = allPossibleNavItems
		.filter(
			(item) =>
				availableTabs.includes(item.key) &&
				(item.condition ? item.condition(currentUser) : true)
		)
		.reduce((acc, current) => {
			// Verhindere doppelte Keys, bevorzuge spezifischere (z.B. Kunden-Label für filledForms)
			const existing = acc.find((item) => item.key === current.key);
			if (existing) {
				if (
					current.condition &&
					currentUser &&
					current.condition(currentUser)
				) {
					return acc.filter((item) => item.key !== current.key).concat(current);
				}
				return acc;
			}
			return acc.concat(current);
		}, [] as NavItemConfig[]);

	return (
		<nav className="app-navbar-top">
			<ul className="navbar-tabs">
				{visibleNavItems.map((item) => (
					<li key={`${item.key}-${item.label}`}>
						{" "}
						{/* Eindeutiger Key */}
						<button
							className={`navbar-tab-button ${
								activeTab === item.key ? "active" : ""
							}`}
							onClick={() => onTabChange(item.key)}
							aria-current={activeTab === item.key ? "page" : undefined}
						>
							{item.label}
						</button>
					</li>
				))}
			</ul>
			{currentUser && (
				<div className="navbar-user-section">
					<span
						className="navbar-username"
						title={currentUser.email || currentUser.username}
					>
						{currentUser.username} ({currentUser.role})
					</span>
					<button
						onClick={onLogout}
						className="button button-danger navbar-logout-button"
						title="Abmelden"
					>
						Abmelden
					</button>
				</div>
			)}
		</nav>
	);
};

export default NavbarTop;
