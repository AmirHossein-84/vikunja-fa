import {useAuthStore} from '@/stores/auth'
// TODO: only import needed languages
import FlatpickrLanguages from 'flatpickr/dist/l10n'
import type { key } from 'flatpickr/dist/types/locale'
import { computed } from 'vue'

// flatpickr/dist/l10n is UMD, and bundlers disagree on the shape of its
// default import: dev/test builds expose the locale map itself (with `en`),
// while the production bundle wraps it in a namespace under `.default`.
// Without normalizing, `en` resolves to undefined in production, the locale
// ends up without firstDayOfWeek, and flatpickr renders a broken month grid
// (only the current month's days, no leading/trailing days).
export function resolveFlatpickrLocales(mod: unknown): Record<string, object> | undefined {
	const locales = mod as Record<string, object> | undefined
	return locales?.en ? locales : (locales?.default as Record<string, object> | undefined)
}

export function useFlatpickrLanguage() {
	const authStore = useAuthStore()

	return computed(() => {
		const locales = resolveFlatpickrLocales(FlatpickrLanguages)
		let language = { ...locales?.en }
		const userLanguage = authStore.settings.language
		
		if (userLanguage) {
			const langPair = userLanguage.split('-')
			const code = userLanguage === 'vi-VN' ? 'vn' : 'en'
			language = { ...(locales?.[langPair?.[0] as key] || locales?.[code]) }
		}
		
		// weekStart defaults to Sunday (0) when the user never picked one, which is
		// falsy: fall back to the locale default then. This gives fa-IR Saturday
		// while leaving every other locale on its own default. An explicit
		// non-Sunday choice is always respected.
		language.firstDayOfWeek = authStore.settings.weekStart || language.firstDayOfWeek
		return language
	})
}
