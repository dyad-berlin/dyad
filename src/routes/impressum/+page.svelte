<script lang="ts">
	// German is the authoritative version (we are based in Germany); English is a
	// convenience translation for accessibility. Default to German.
	let lang = $state<'de' | 'en'>('de');
</script>

<svelte:head>
	<title>impressum · dyad. cultivating a culture of conversation</title>
</svelte:head>

<main class="legal-page" lang={lang}>
	<a href="/" class="back-link">
		<svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="vertical-align:middle;margin-right:4px"><path d="M12 15l-5-5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
		dyad.berlin
	</a>

	<div class="lang-toggle" role="group" aria-label="Sprache / Language">
		<button type="button" class:active={lang === 'de'} aria-pressed={lang === 'de'} onclick={() => (lang = 'de')}>DE</button>
		<button type="button" class:active={lang === 'en'} aria-pressed={lang === 'en'} onclick={() => (lang = 'en')}>EN</button>
	</div>

	{#if lang === 'de'}
		<h1>Impressum</h1>
		<p class="subtitle">Angaben gem&auml;&szlig; &sect; 5 DDG</p>

		<section>
			<h2>Anbieter</h2>
			<p>
				Monad Engineering UG (haftungsbeschr&auml;nkt)<br />
				Richard-Sorge-Stra&szlig;e 24<br />
				10249 Berlin<br />
				Deutschland
			</p>
		</section>

		<section>
			<h2>Vertreten durch</h2>
			<p>Gesch&auml;ftsf&uuml;hrerin: &Ouml;zge Sahin</p>
		</section>

		<section>
			<h2>Kontakt</h2>
			<p>
				E-Mail: <a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a><br />
				Telefon: +49 176 27554782
			</p>
		</section>

		<section>
			<h2>Handelsregister</h2>
			<p>
				Amtsgericht Charlottenburg<br />
				HRB 283688 B
			</p>
		</section>

		<section>
			<h2>Umsatzsteuer-ID</h2>
			<p>
				Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27a UStG:<br />
				DE461176400
			</p>
		</section>

		<section>
			<h2>Verantwortlich f&uuml;r den Inhalt nach &sect; 18 Abs. 2 MStV</h2>
			<p>
				&Ouml;zge Sahin<br />
				Richard-Sorge-Stra&szlig;e 24<br />
				10249 Berlin
			</p>
		</section>

		<section>
			<h2>Verbraucherstreitbeilegung</h2>
			<p>
				Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
				Verbraucherschlichtungsstelle teilzunehmen (&sect; 36 VSBG).
			</p>
		</section>

		<section>
			<h2>Haftungsausschluss</h2>

			<h3>Haftung f&uuml;r Inhalte</h3>
			<p>
				Die Inhalte unserer Seiten wurden mit gr&ouml;&szlig;ter Sorgfalt erstellt. F&uuml;r die
				Richtigkeit, Vollst&auml;ndigkeit und Aktualit&auml;t der Inhalte k&ouml;nnen wir jedoch
				keine Gew&auml;hr &uuml;bernehmen.
			</p>

			<h3>Haftung f&uuml;r Links</h3>
			<p>
				Unser Angebot enth&auml;lt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
				Einfluss haben. F&uuml;r die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
				verantwortlich.
			</p>
		</section>

		<section>
			<h2>Social-Media-Profile</h2>
			<p>Dieses Impressum gilt auch f&uuml;r das folgende Social-Media-Profil:</p>
			<p>
				LinkedIn: <a href="https://www.linkedin.com/company/join-dyad/" target="_blank" rel="noopener noreferrer">linkedin.com/company/join-dyad</a>
			</p>
		</section>

		<section>
			<h2>Datenschutz</h2>
			<p>
				Unsere Datenschutzerkl&auml;rung findest du unter
				<a href="/datenschutz">/datenschutz</a>.
			</p>
		</section>
	{:else}
		<h1>Imprint</h1>
		<p class="subtitle">Information pursuant to &sect; 5 DDG &middot; the German version is legally binding</p>

		<section>
			<h2>Provider</h2>
			<p>
				Monad Engineering UG (haftungsbeschr&auml;nkt)<br />
				Richard-Sorge-Stra&szlig;e 24<br />
				10249 Berlin<br />
				Germany
			</p>
		</section>

		<section>
			<h2>Represented by</h2>
			<p>Managing Director: &Ouml;zge Sahin</p>
		</section>

		<section>
			<h2>Contact</h2>
			<p>
				Email: <a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a><br />
				Phone: +49 176 27554782
			</p>
		</section>

		<section>
			<h2>Register entry</h2>
			<p>
				Charlottenburg Local Court (Amtsgericht Charlottenburg)<br />
				HRB 283688 B
			</p>
		</section>

		<section>
			<h2>Sales tax ID</h2>
			<p>
				VAT identification number pursuant to &sect; 27a UStG:<br />
				DE461176400
			</p>
		</section>

		<section>
			<h2>Responsible for content pursuant to &sect; 18 (2) MStV</h2>
			<p>
				&Ouml;zge Sahin<br />
				Richard-Sorge-Stra&szlig;e 24<br />
				10249 Berlin
			</p>
		</section>

		<section>
			<h2>Consumer dispute resolution</h2>
			<p>
				We are neither willing nor obliged to participate in dispute resolution proceedings before a
				consumer arbitration board (&sect; 36 VSBG).
			</p>
		</section>

		<section>
			<h2>Disclaimer</h2>

			<h3>Liability for content</h3>
			<p>
				The contents of our pages were created with the greatest care. However, we cannot guarantee
				the accuracy, completeness and timeliness of the content.
			</p>

			<h3>Liability for links</h3>
			<p>
				Our offer contains links to external third-party websites over whose content we have no
				influence. The respective provider is always responsible for the content of the linked pages.
			</p>
		</section>

		<section>
			<h2>Social media profiles</h2>
			<p>This imprint also applies to the following social media profile:</p>
			<p>
				LinkedIn: <a href="https://www.linkedin.com/company/join-dyad/" target="_blank" rel="noopener noreferrer">linkedin.com/company/join-dyad</a>
			</p>
		</section>

		<section>
			<h2>Data protection</h2>
			<p>
				You can find our Privacy Policy at
				<a href="/datenschutz">/datenschutz</a>.
			</p>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		overflow: auto !important;
	}

	.legal-page {
		max-width: var(--content-narrow);
		margin: 0 auto;
		padding: 80px var(--space-6) 120px;

		font-size: var(--text-lg);
		line-height: var(--leading-relaxed);
		color: var(--text-secondary);
	}

	.back-link {
		display: inline-block;
		margin-bottom: 48px;
		font-size: var(--text-base);
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.lang-toggle {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-10);
	}

	.lang-toggle button {
		font: inherit;
		font-size: var(--text-base);
		padding: var(--space-1) var(--space-3);
		border: 1px solid currentColor;
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.lang-toggle button.active {
		color: var(--text-primary);
		border-color: var(--text-primary);
	}

	h1 {
		font-size: var(--text-3xl);
		font-weight: normal;
		color: var(--text-primary);
		margin: 0 0 var(--space-2);
	}

	.subtitle {
		font-size: var(--text-base);
		color: var(--text-muted);
		margin: 0 0 48px;
	}

	h2 {
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--text-primary);
		margin: var(--space-8) 0 var(--space-2);
	}

	h3 {
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--text-primary);
		margin: var(--space-6) 0 var(--space-1);
	}

	section {
		margin-bottom: var(--space-2);
	}

	p {
		margin: 0 0 var(--space-2);
	}

	a {
		color: var(--text-secondary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	a:hover {
		color: var(--text-primary);
	}
</style>
