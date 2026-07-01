const STORAGE_KEY = 'spatial-reader-theme';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'light';

	// Intentionally always dark: the light theme is retired pending a redesign, so
	// getInitialTheme ignores any stored preference and returns dark. toggle() and
	// persist() are kept dormant for when a theme-preference UI returns.
	return 'dark';
}

class ThemeStore {
	current = $state<Theme>('light');

	constructor() {
		if (typeof window !== 'undefined') {
			this.current = getInitialTheme();
			this.applyTheme();
		}
	}

	toggle() {
		this.current = this.current === 'light' ? 'dark' : 'light';
		this.applyTheme();
		this.persist();
	}

	private applyTheme() {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', this.current);
		}
	}

	private persist() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, this.current);
		}
	}
}

export const themeStore = new ThemeStore();
