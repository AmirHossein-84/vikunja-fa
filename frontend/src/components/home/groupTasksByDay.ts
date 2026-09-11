import {addJalaliDays, instantToJalali, type JalaliDate} from '@/helpers/time/jalali'
import {formatGregorianKebab} from '@/components/date/dateRanges'
import type {ITask} from '@/modelTypes/ITask'

export type HomeTaskGroup = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'someday'

export const HOME_TASK_GROUP_ORDER: HomeTaskGroup[] = ['overdue', 'today', 'tomorrow', 'upcoming', 'someday']

export interface GroupTasksByDayOptions {
	// Jalali calendar with Persian day boundaries, or Gregorian ones.
	jalali: boolean
	// IANA timezone the day boundaries are calculated in.
	timeZone: string
	// Reference instant, defaults to now. Accepts Date for testability.
	now?: Date
}

function pad(n: number): string {
	return String(n).padStart(2, '0')
}

function jalaliDayString(date: JalaliDate): string {
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

// Calendar-day strings compare lexicographically when zero-padded, which keeps
// the bucketing immune to DST transitions (a day is not always 86400s).
function gregorianTomorrow(todayKebab: string): string {
	const [y, m, d] = todayKebab.split('-').map(Number)
	const next = new Date(Date.UTC(y, m - 1, d) + 86400000)
	return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

function resolveDayBounds(opts: GroupTasksByDayOptions): {today: string, tomorrow: string} | null {
	const now = opts.now ?? new Date()
	if (opts.jalali) {
		const parts = instantToJalali(now, opts.timeZone)
		if (parts === null) {
			return null
		}
		return {
			today: jalaliDayString(parts),
			tomorrow: jalaliDayString(addJalaliDays(parts, 1)),
		}
	}
	const today = formatGregorianKebab(now, opts.timeZone)
	return {today, tomorrow: gregorianTomorrow(today)}
}

function dueDayString(due: Date, opts: GroupTasksByDayOptions): string | null {
	if (opts.jalali) {
		const parts = instantToJalali(due, opts.timeZone)
		return parts === null ? null : jalaliDayString(parts)
	}
	return formatGregorianKebab(due, opts.timeZone)
}

export function groupTasksByDay(
	tasks: ITask[],
	opts: GroupTasksByDayOptions,
): Record<HomeTaskGroup, ITask[]> {
	const groups: Record<HomeTaskGroup, ITask[]> = {
		overdue: [],
		today: [],
		tomorrow: [],
		upcoming: [],
		someday: [],
	}
	const bounds = resolveDayBounds(opts)
	for (const task of tasks) {
		if (task.dueDate == null) {
			groups.someday.push(task)
			continue
		}
		if (bounds === null) {
			groups.upcoming.push(task)
			continue
		}
		const due = dueDayString(task.dueDate, opts)
		if (due === null) {
			groups.upcoming.push(task)
		} else if (due < bounds.today) {
			groups.overdue.push(task)
		} else if (due === bounds.today) {
			groups.today.push(task)
		} else if (due === bounds.tomorrow) {
			groups.tomorrow.push(task)
		} else {
			groups.upcoming.push(task)
		}
	}
	return groups
}
