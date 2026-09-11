import {computed} from 'vue'

import {i18n, isRTLLanguage, type SupportedLocale} from '@/i18n'

/**
 * Reactive reading direction for the gantt chart. The chart's geometry math
 * (bar x/width from day offsets) is inherently left-to-right, so every place
 * that turns dates into pixels mirrors its result when this is true to keep
 * bars aligned with their day columns in rtl locales.
 */
export function useGanttDirection() {
	const isRtl = computed(() => isRTLLanguage(i18n.global.locale.value as SupportedLocale))
	return {isRtl}
}
