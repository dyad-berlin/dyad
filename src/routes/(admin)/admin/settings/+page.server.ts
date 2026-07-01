import {
	getEmailNotificationsEnabled,
	getMembershipGating,
	getFreeInteractionQuota
} from '$lib/server/app-settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [emailNotificationsEnabled, membershipGating, freeInteractionQuota] = await Promise.all([
		getEmailNotificationsEnabled(),
		getMembershipGating(),
		getFreeInteractionQuota()
	]);
	return { emailNotificationsEnabled, membershipGating, freeInteractionQuota };
};
