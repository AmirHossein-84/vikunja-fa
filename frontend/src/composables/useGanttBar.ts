import { ref } from 'vue'

import {useGanttDirection} from '@/composables/useGanttDirection'

export type GanttBarDateType = 'both' | 'startOnly' | 'endOnly'

export interface GanttBarModel {
	id: string
	start: Date
	end: Date
	meta?: {
		label?: string
		color?: string
		hasActualDates?: boolean
		dateType?: GanttBarDateType
		isDone?: boolean
		task?: unknown
		isParent?: boolean
		hasDerivedDates?: boolean
		indentLevel?: number
	}
}
export interface UseGanttBarOptions {
	model: GanttBarModel
	timelineStart: Date
	timelineEnd: Date
	onUpdate?: (id: string, newStart: Date, newEnd: Date) => void
}

export function useGanttBar(options: UseGanttBarOptions) {
	const dragging = ref(false)
	const selected = ref(false)
	const focused = ref(false)
	const {isRtl} = useGanttDirection()

	function onFocus() {
		focused.value = true
	}

	function onBlur() {
		focused.value = false
	}

	function changeSize(direction: 'left' | 'right', modifier: -1 | 1) {
		const newStart = new Date(options.model.start)
		const newEnd = new Date(options.model.end)

		if (direction === 'left') {
			// Shift+Left: Expand task to the left (move start date earlier)
			newStart.setDate(newStart.getDate() - 1 * modifier)
		} else {
			// Shift+Right: Expand task to the right (move end date later)  
			newEnd.setDate(newEnd.getDate() + 1 * modifier)
		}

		// Validate that start is before end (maintain minimum 1 day duration)
		if (newStart < newEnd) {
			options.model.start = newStart
			options.model.end = newEnd

			if (options.onUpdate) {
				options.onUpdate(options.model.id, newStart, newEnd)
			}
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		// In rtl locales the timeline runs right-to-left, so Left means later
		// dates and Right means earlier ones: swap the arrows up front and the
		// edge-aware logic below keeps working unchanged.
		const code = e.code === 'ArrowLeft'
			? (isRtl.value ? 'ArrowRight' : 'ArrowLeft')
			: e.code === 'ArrowRight'
				? (isRtl.value ? 'ArrowLeft' : 'ArrowRight')
				: e.code

		// task expanding
		if (e.shiftKey) {
			if (code === 'ArrowLeft') {
				e.preventDefault()
				changeSize('left', 1)
			}
			if (code === 'ArrowRight') {
				e.preventDefault()
				changeSize('right', 1)
			}
		}
		// task shrinking
		else if (e.ctrlKey) {
			if (code === 'ArrowLeft') {
				e.preventDefault()
				changeSize('left', -1)
			}
			if (code === 'ArrowRight') {
				e.preventDefault()
				changeSize('right', -1)
			}
		}
		// task movement
		else if (code === 'ArrowLeft' || code === 'ArrowRight') {
			e.preventDefault()

			const dir = code === 'ArrowRight' ? 1 : -1
			const newStart = new Date(options.model.start)
			newStart.setDate(newStart.getDate() + dir)
			const newEnd = new Date(options.model.end)
			newEnd.setDate(newEnd.getDate() + dir)

			options.model.start = newStart
			options.model.end = newEnd

			if (options.onUpdate) {
				options.onUpdate(options.model.id, newStart, newEnd)
			}
		}
	}

	return {
		dragging,
		selected,
		focused,
		onFocus,
		onBlur,
		onKeyDown,
	}
}
