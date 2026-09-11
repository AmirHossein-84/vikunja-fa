import {describe, expect, it} from 'vitest'
import {groupTasksByDay, HOME_TASK_GROUP_ORDER} from './groupTasksByDay'
import type {ITask} from '@/modelTypes/ITask'

function fakeTask(id: number, dueDate: Date | null): ITask {
	return {id, dueDate} as unknown as ITask
}

// 2026-09-11T10:00:00Z is 13:30 in Asia/Tehran on Shahrivar 20, 1405 (Friday).
const NOW = new Date('2026-09-11T10:00:00.000Z')

describe('groupTasksByDay jalali', () => {
	const opts = {jalali: true, timeZone: 'Asia/Tehran', now: NOW}

	it('buckets tasks around the Tehran day boundaries', () => {
		const groups = groupTasksByDay([
			fakeTask(1, new Date('2026-09-10T20:00:00.000Z')), // 23:30 previous day -> overdue
			fakeTask(2, new Date('2026-09-11T06:00:00.000Z')), // 09:30 today -> today
			fakeTask(3, new Date('2026-09-11T21:00:00.000Z')), // 00:30 next day -> tomorrow
			fakeTask(4, new Date('2026-09-20T00:00:00.000Z')), // upcoming
			fakeTask(5, null), // someday
		], opts)
		expect(groups.overdue.map(t => t.id)).toEqual([1])
		expect(groups.today.map(t => t.id)).toEqual([2])
		expect(groups.tomorrow.map(t => t.id)).toEqual([3])
		expect(groups.upcoming.map(t => t.id)).toEqual([4])
		expect(groups.someday.map(t => t.id)).toEqual([5])
	})

	it('keeps the input order inside each group', () => {
		const groups = groupTasksByDay([
			fakeTask(2, new Date('2026-09-11T08:00:00.000Z')),
			fakeTask(1, new Date('2026-09-11T06:00:00.000Z')),
		], opts)
		expect(groups.today.map(t => t.id)).toEqual([2, 1])
	})
})

describe('groupTasksByDay gregorian', () => {
	const opts = {jalali: false, timeZone: 'UTC', now: NOW}

	it('buckets tasks around UTC midnight boundaries', () => {
		const groups = groupTasksByDay([
			fakeTask(1, new Date('2026-09-10T12:00:00.000Z')),
			fakeTask(2, new Date('2026-09-11T23:59:00.000Z')),
			fakeTask(3, new Date('2026-09-12T00:00:00.000Z')),
			fakeTask(4, new Date('2026-10-01T00:00:00.000Z')),
			fakeTask(5, null),
		], opts)
		expect(groups.overdue.map(t => t.id)).toEqual([1])
		expect(groups.today.map(t => t.id)).toEqual([2])
		expect(groups.tomorrow.map(t => t.id)).toEqual([3])
		expect(groups.upcoming.map(t => t.id)).toEqual([4])
		expect(groups.someday.map(t => t.id)).toEqual([5])
	})
})

describe('HOME_TASK_GROUP_ORDER', () => {
	it('renders overdue first and someday last', () => {
		expect(HOME_TASK_GROUP_ORDER).toEqual(['overdue', 'today', 'tomorrow', 'upcoming', 'someday'])
	})
})
