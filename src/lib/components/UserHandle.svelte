<script lang="ts">
	// A username as a link to the member's public page. Use wherever a handle
	// appears in text — headings, attributions, status lines — so usernames
	// navigate consistently. Inherits the surrounding text colour; underlines
	// on hover. (Inside an <a>-wrapped card, render the plain string instead —
	// nested anchors are invalid HTML.)
	let { username }: { username: string } = $props();
</script>

<a class="user-handle" href="/users/{username}">@{username}</a>

<style>
	.user-handle {
		color: inherit;
		text-decoration: none;
	}
	.user-handle:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
