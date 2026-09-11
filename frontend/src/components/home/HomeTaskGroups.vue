<template>
	<div
		v-cy="'showTasks'"
		class="is-max-width-desktop has-text-start"
	>
		<Message
			v-if="filteredLabels.length > 0"
			class="label-filter-info mbs-4"
		>
			<i18n-t
				keypath="task.show.filterByLabel"
				tag="span"
				class="filter-label-text"
			>
				<template #label>
					<XLabel
						v-for="label in filteredLabels"
						:key="label.id"
						:label="label"
					/>
				</template>
			</i18n-t>
			<BaseButton
				v-tooltip="$t('task.show.clearLabelFilter')"
				class="clear-filter-button"
				:aria-label="$t('task.show.clearLabelFilter')"
				@click="clearLabelFilter"
			>
				<Icon icon="times" />
			</BaseButton>
		</Message>

		<Message
			v-if="savedFilterIgnored"
			class="mbe-2"
		>
			{{ $t('task.show.savedFilterIgnored') }}
		</Message>

		<template v-if="!loading && (!tasks || tasks.length === 0) && showNothingToDo">
			<h3 class="has-text-centered mbs-6">
				{{ $t('task.show.noTasks') }}
			</h3>
			<LlamaCool class="llama-cool" />
		</template>

		<section
			v-for="group in visibleGroups"
			:key="group"
			class="task-group"
		>
			<h2 class="mbe-2">
				{{ groupTitles[group] }}
			</h2>
			<Card
				:padding="false"
				class="has-overflow"
				:has-content="false"
				:loading="loading"
			>
				<ul class="p-2 tasks">
					<li
						v-for="task in groupedTasks[group]"
						:key="task.id"
					>
						<SingleTaskInProject
							:show-project="true"
							:the-task="task"
							:can-mark-as-done="(projectStore.projects[task.projectId]?.maxPermission ?? 0) > PERMISSIONS.READ"
							@taskUpdated="updateTasks"
						/>
					</li>
				</ul>
			</Card>
		</section>
		<div
			v-if="!(tasks && tasks.length > 0)"
			:class="{ 'is-loading': loading}"
			class="spinner"
		/>
	</div>
</template>

<script setup lang="ts">
import {computed, ref, watch, watchEffect} from 'vue'
import {useI18n} from 'vue-i18n'

import {setTitle} from '@/helpers/setTitle'

import BaseButton from '@/components/base/BaseButton.vue'
import Icon from '@/components/misc/Icon'
import Message from '@/components/misc/Message.vue'
import SingleTaskInProject from '@/components/tasks/partials/SingleTaskInProject.vue'
import XLabel from '@/components/tasks/partials/Label.vue'
import LlamaCool from '@/assets/llama-cool.svg?component'
import {groupTasksByDay, HOME_TASK_GROUP_ORDER, type HomeTaskGroup} from '@/components/home/groupTasksByDay'
import {useJalaliCalendar} from '@/composables/useJalaliCalendar'
import type {ITask} from '@/modelTypes/ITask'
import {useAuthStore} from '@/stores/auth'
import {useTaskStore} from '@/stores/tasks'
import {useProjectStore} from '@/stores/projects'
import {useLabels} from '@/composables/useLabels'
import type {TaskFilterParams} from '@/services/taskCollection'
import TaskCollectionService from '@/services/taskCollection'
import {PERMISSIONS} from '@/constants/permissions'

const props = defineProps<{
	labelIds?: string[],
}>()

const emit = defineEmits<{
	'tasksLoaded': true,
	'clearLabelFilter': void,
}>()

const authStore = useAuthStore()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const {getLabelById} = useLabels()
const {t} = useI18n({useScope: 'global'})
const {isJalali, timeZone} = useJalaliCalendar()

const tasks = ref<ITask[]>([])
const showNothingToDo = ref<boolean>(false)
const taskCollectionService = ref(new TaskCollectionService())

setTimeout(() => showNothingToDo.value = true, 100)

const filteredLabels = computed(() => {
	if (!props.labelIds || props.labelIds.length === 0) {
		return []
	}
	return props.labelIds
		.map(id => getLabelById(Number(id)))
		.filter(label => label !== null && label !== undefined)
})

const savedFilterIgnored = computed(() => {
	return filteredLabels.value.length > 0
		&& filterIdUsedOnOverview.value
		&& typeof projectStore.projects[filterIdUsedOnOverview.value] !== 'undefined'
})

const groupedTasks = computed(() => groupTasksByDay(tasks.value, {
	jalali: isJalali.value,
	timeZone: timeZone.value,
}))

const visibleGroups = computed<HomeTaskGroup[]>(() => HOME_TASK_GROUP_ORDER
	.filter(group => (groupedTasks.value[group]?.length ?? 0) > 0))

const groupTitles = computed<Record<HomeTaskGroup, string>>(() => ({
	overdue: t('home.overdue'),
	today: t('input.datepickerRange.ranges.today'),
	tomorrow: t('input.datepickerRange.ranges.tomorrow'),
	upcoming: t('navigation.upcoming'),
	someday: t('home.someday'),
}))

const userAuthenticated = computed(() => authStore.authenticated)
const loading = computed(() => taskStore.isLoading || taskCollectionService.value.loading)
const filterIdUsedOnOverview = computed(() => authStore.settings?.frontendSettings?.filterIdUsedOnOverview)

function clearLabelFilter() {
	emit('clearLabelFilter')
}

async function loadGroupedTasks(filterId: number | null | undefined) {
	// FIXME: HACK! This should never happen.
	// Since this route is authentication only, users would get an error message if they access the page unauthenticated.
	// Since this component is mounted as the home page before unauthenticated users get redirected
	// to the login page, they will almost always see the error message.
	if (!userAuthenticated.value) {
		return
	}

	const params: TaskFilterParams = {
		sort_by: ['due_date', 'id'],
		order_by: ['asc', 'desc'],
		filter: 'done = false',
		filter_include_nulls: false,
		s: '',
		expand: ['comment_count', 'is_unread'],
	}

	// Add label filtering
	if (props.labelIds && props.labelIds.length > 0) {
		const labelFilter = `labels in ${props.labelIds.join(', ')}`
		params.filter += params.filter ? ` && ${labelFilter}` : labelFilter
	}

	let projectId = null
	if (filterId && typeof projectStore.projects[filterId] !== 'undefined'
		&& (!props.labelIds || props.labelIds.length === 0)) {
		projectId = filterId
	}

	tasks.value = await taskStore.loadTasks(params, projectId)
	emit('tasksLoaded', true)
}

// FIXME: this modification should happen in the store
function updateTasks(updatedTask: ITask) {
	for (let t = 0; t < tasks.value.length; t++) {
		if (tasks.value[t].id === updatedTask.id) {
			tasks.value[t] = updatedTask
			// Move the task to the end of the done tasks if it is now done
			if (updatedTask.done) {
				tasks.value.splice(t, 1)
				tasks.value.push(updatedTask)
			}
			break
		}
	}
}

watch(
	[filterIdUsedOnOverview],
	([filterId]) => loadGroupedTasks(filterId),
	{immediate: true},
)
watchEffect(() => setTitle(t('task.show.titleCurrent')))
</script>

<style lang="scss" scoped>
.tasks {
	list-style: none;
	margin: 0;
}

.task-group {
	margin-block-start: 1.5rem;
}

.llama-cool {
	margin: 3rem auto 0;
	display: block;
}

.label-filter-info {
	.clear-filter-button {
		margin-inline-start: auto;
		padding: 0.25rem 0.5rem;

		&:hover {
			color: var(--danger);
		}
	}

	:deep(.message.info) {
		inline-size: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
}
</style>
