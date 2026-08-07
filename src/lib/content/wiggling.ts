// Wiggling — dyad's conversation series. Extracted from the page component so
// the content flows through the ContentService port like the newsletter.
import { env } from '$env/dynamic/public';
import { storageUrl } from '$lib/utils/storage-url';
// Type-only import: no runtime cycle with content.ts importing the data below.
import type { WigglingVoice } from '$lib/services/content';

export type { WigglingVoice };

// Reel sources: prefer PUBLIC_VIDEO_BASE_URL (sovereign host), else the public
// videos bucket. In local dev the default Supabase URL is the LOCAL stack (no
// videos bucket), so the reels wouldn't play; this base defaults to the public
// bucket in every env. Files still live under the videos/voices/ prefix.
const videoBase =
	env.PUBLIC_VIDEO_BASE_URL ??
	'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos';

// Kaspar stays archived — no kaspar.mp4 in the bucket to serve.
// { src: `${videoBase}/voices/kaspar.mp4`, name: 'Kaspar' },
//
// Poster frames live in the 'newsletter assets' bucket, not videos/: that
// one accepts video mime types only. Served as webp — the source PNGs were
// 1.8-3.2MB each and a poster loads before anyone presses play, so three of
// them would have cost ~8MB on arrival. These are 41-69kB.
//
// Built with storageUrl() rather than a hand-written base: it encodes the
// space in the bucket name and resolves the host through
// PUBLIC_STORAGE_BASE_URL, so these follow the assets everywhere else on
// the site if they ever move to a sovereign host. A literal base string
// would have kept pointing at Supabase after such a move, and shown up
// only as three broken thumbnails.
const poster = (name: string) => storageUrl('newsletter assets', `voices/${name}.webp`);

export const wigglingVoices: WigglingVoice[] = [
	{
		src: `${videoBase}/voices/pauline.mp4`,
		poster: poster('pauline'),
		name: 'Pauline Gwet',
		episode: 'https://www.youtube.com/watch?v=yaChHM7iIIo'
	},
	{
		src: `${videoBase}/voices/ali.mp4`,
		poster: poster('ali'),
		name: 'Ali Nezamolmaleki',
		episode: 'https://www.youtube.com/watch?v=48hVieSCBbo'
	},
	{
		src: `${videoBase}/voices/sude.mp4`,
		poster: poster('sude'),
		name: 'Sude Elverdi',
		episode: 'https://www.youtube.com/watch?v=bqX0Mx_YmfY'
	}
];
