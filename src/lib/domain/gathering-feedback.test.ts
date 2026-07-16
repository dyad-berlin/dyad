import { describe, it, expect } from 'vitest';
import {
	turnedUp,
	showsPerPersonFeedback,
	showsMeetAgain,
	attendanceAnswered
} from './gathering-feedback.js';

// Pure branch logic for the post-gathering feedback form (U6): attendance is
// mandatory, and per-person feedback is suppressed when the caller didn't turn
// up (co-presence gate). These mirror the DB turnout gate (app.both_present).

describe('gathering feedback co-presence logic', () => {
	describe('turnedUp', () => {
		it('is true only for an attended self-report', () => {
			expect(turnedUp('attended')).toBe(true);
		});
		it('is false for cancelled_before and absent', () => {
			expect(turnedUp('cancelled_before')).toBe(false);
			expect(turnedUp('absent')).toBe(false);
		});
		it('is false before the caller answers', () => {
			expect(turnedUp(null)).toBe(false);
		});
	});

	describe('showsPerPersonFeedback (co-presence gate — R10)', () => {
		it('shows per-person feedback when the caller turned up', () => {
			expect(showsPerPersonFeedback('attended')).toBe(true);
		});
		it('HIDES per-person feedback when the caller did not go', () => {
			expect(showsPerPersonFeedback('absent')).toBe(false);
			expect(showsPerPersonFeedback('cancelled_before')).toBe(false);
		});
	});

	describe('showsMeetAgain', () => {
		it('is shown only when the caller turned up', () => {
			expect(showsMeetAgain('attended')).toBe(true);
			expect(showsMeetAgain('absent')).toBe(false);
		});
	});

	describe('attendanceAnswered (mandatory gate)', () => {
		it('is false until an attendance answer is chosen', () => {
			expect(attendanceAnswered(null)).toBe(false);
		});
		it('is true for every concrete self-report', () => {
			expect(attendanceAnswered('attended')).toBe(true);
			expect(attendanceAnswered('cancelled_before')).toBe(true);
			expect(attendanceAnswered('absent')).toBe(true);
		});
	});
});
