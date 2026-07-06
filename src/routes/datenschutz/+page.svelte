<script lang="ts">
	// German is the authoritative version (we are based in Germany); English is a
	// convenience translation for accessibility. Default to German.
	let lang = $state<'de' | 'en'>('de');

	// Effective date of this policy — single source for every mention below.
	const STAND_DE = '06.07.2026';
	const STAND_EN = '6 July 2026';
</script>

<svelte:head>
	<title>datenschutz · dyad. cultivating a culture of conversation</title>
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
		<h1>Datenschutzerklärung</h1>
		<p class="subtitle">Stand: {STAND_DE}</p>

		<section>
			<h2>1. Einleitung</h2>
			<p>Diese Website wird betrieben von: Monad Engineering UG (haftungsbeschränkt).</p>
			<p>
				Es ist uns sehr wichtig, mit den Daten unserer Website-Besucher vertrauensvoll umzugehen und
				sie bestmöglich zu schützen. Aus diesem Grund leisten wir alle Anstrengungen, um die
				Anforderungen der DSGVO zu erfüllen.
			</p>
			<p>
				Im Folgenden erläutern wir Dir, wie wir Deine Daten auf unserer Webseite verarbeiten. Dazu
				verwenden wir eine möglichst klare und transparente Sprache, damit Du wirklich verstehst, was
				mit Deinen Daten passiert.
			</p>
		</section>

		<section>
			<h2>2. Allgemeine Informationen</h2>

			<h3>2.1 Verarbeitung von personenbezogenen Daten und andere Begriffe</h3>
			<p>
				Datenschutz gilt bei der Verarbeitung von personenbezogenen Daten. Personenbezogen meint alle
				Daten, mit denen Du persönlich identifiziert werden kannst. Das ist z.B. die IP-Adresse des
				Geräts (PC, Laptop, Smartphone, etc.) vor dem Du gerade sitzt. Verarbeitet werden solche Daten
				dann, wenn „irgendetwas damit passiert“. Hier wird z.B. die IP vom Browser an unseren Provider
				übermittelt und dort automatisch gespeichert. Das ist dann eine Verarbeitung (gemäß Art. 4 Nr.
				2 DSGVO) von personenbezogenen Daten (nach Art. 4 Nr. 1 DSGVO).
			</p>
			<p>Diese und weitere gesetzlichen Definitionen sind in Art. 4 DSGVO zu finden.</p>

			<h3>2.2 Anzuwendende Vorschriften/Gesetze – DSGVO, BDSG und TDDDG</h3>
			<p>
				Der Umfang des Datenschutzes wird durch Gesetze geregelt. Das sind in diesem Fall die DSGVO
				(Datenschutzgrundverordnung) als europäische Verordnung und das BDSG (Bundesdatenschutzgesetz)
				als nationales Gesetz. Außerdem ergänzt das TDDDG die Vorschriften aus der DSGVO, soweit es sich
				um den Einsatz von Cookies handelt.
			</p>

			<h3>2.3 Der Verantwortliche</h3>
			<p>
				Verantwortlich für die Datenverarbeitung auf dieser Website ist der Verantwortliche im Sinne
				der DSGVO. Das ist diejenige natürliche oder juristische Person, die allein oder gemeinsam mit
				anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten entscheidet.
			</p>
			<p>Den Verantwortlichen erreichst Du unter:</p>
			<p>
				Monad Engineering UG (haftungsbeschränkt)<br />
				Richard-Sorge-Straße 24<br />
				10249 Berlin<br />
				<a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a>
			</p>

			<h3>2.4 So werden Daten auf dieser Website grundsätzlich verarbeitet</h3>
			<p>
				Wie wir bereits festgestellt haben, gibt es Daten (z.B. IP-Adresse), die automatisch erhoben
				werden. Diese Daten werden überwiegend für die technische Bereitstellung der Homepage benötigt.
				Soweit wir darüber hinaus personenbezogene Daten verwenden oder andere Daten erheben, klären wir
				Dich darüber auf bzw. fragen nach einer Einwilligung. Andere personenbezogene Daten teilst Du
				uns bewusst mit. Detaillierte Informationen hierzu erhältst Du weiter unten.
			</p>

			<h3>2.5 Deine Rechte</h3>
			<p>
				Die DSGVO stattet Dich mit umfassenden Rechten aus. Diese sind z.B. die unentgeltliche Auskunft
				über Herkunft, Empfänger und Zweck Deiner gespeicherten personenbezogenen Daten. Außerdem kannst
				Du die Berichtigung, Sperrung oder Löschung dieser Daten verlangen oder Dich bei der zuständigen
				Datenschutzaufsichtsbehörde beschweren. Eine erteilte Einwilligung kannst Du jederzeit
				widerrufen. Wie diese Rechte im Detail aussehen, findest Du im letzten Abschnitt dieser
				Datenschutzerklärung.
			</p>

			<h3>2.6 Datenschutz – Unsere Sicht</h3>
			<p>
				Datenschutz ist für uns mehr als nur eine lästige Pflicht! Personenbezogene Daten haben einen
				großen Wert und ein achtsamer Umgang mit diesen Daten sollte in unserer digitalisierten Welt
				selbstverständlich sein. Außerdem sollst Du als Website-Besucher in der Lage sein, selbst zu
				entscheiden, was, wann und durch wen mit Deinen Daten „passiert“. Deswegen verpflichten wir uns,
				alle gesetzlichen Bestimmungen einzuhalten, erheben nur die für uns notwendigen Daten und
				behandeln diese selbstverständlich vertraulich.
			</p>

			<h3>2.7 Weitergabe und Löschung</h3>
			<p>
				Eine Weitergabe der Daten findet nur aufgrund einer Rechtsgrundlage und nur dann statt, wenn
				dies unumgänglich ist. Dies kann insbesondere dann der Fall sein, wenn es sich um einen
				sogenannten Auftragsverarbeiter handelt und ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO
				geschlossen wurde. Wir löschen Deine Daten dann, wenn der Zweck und die Rechtsgrundlage zur
				Verarbeitung weggefallen sind und der Löschung keine anderen gesetzlichen Verpflichtungen
				entgegenstehen (siehe auch Art. 17 DSGVO).
			</p>

			<h3>2.8 Hosting</h3>
			<h4>Cloudflare</h4>
			<p>
				Auf unserer Website wird der Hosting- und Sicherheitsdienst Cloudflare eingesetzt, der von der
				Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA, betrieben wird. Cloudflare
				dient als Content Delivery Network (CDN), schützt die Website durch Sicherheitsfunktionen wie
				DDoS-Abwehr und Web Application Firewall und bietet DNS-Management, SSL/TLS-Verschlüsselung sowie
				Performance-Optimierung. Im Rahmen der Nutzung werden insbesondere IP-Adresse, User Agent,
				HTTP-Request-Metadaten, Referrer-Informationen, Web-Traffic-Daten, DNS-Anfragen sowie
				Performance-Metriken erhoben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
				Interesse an Sicherheit, Verfügbarkeit und Optimierung des Onlineangebots). Cloudflare setzt
				technisch erforderliche Cookies auf Grundlage von § 25 Abs. 2 TDDDG (Zustimmung nicht
				erforderlich). Cloudflare überträgt personenbezogene Daten in die USA; hierbei greifen als
				geeignete Garantie die Standardvertragsklauseln der Europäischen Kommission nach Art. 46 Abs. 2
				lit. c DSGVO. Weitere Informationen:
				<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">cloudflare.com/privacypolicy</a>
			</p>

			<h3>2.9 Rechtsgrundlagen</h3>
			<p>
				Die Verarbeitung von personenbezogenen Daten benötigt immer eine Rechtsgrundlage. Die DSGVO
				sieht in Art. 6 Abs. 1 Satz 1 folgende Möglichkeiten vor:
			</p>
			<ul>
				<li>a) Die betroffene Person hat ihre Einwilligung gegeben;</li>
				<li>b) Die Verarbeitung ist zur Erfüllung eines Vertrags oder für vorvertragliche Maßnahmen erforderlich;</li>
				<li>c) Die Verarbeitung ist zur Erfüllung einer rechtlichen Verpflichtung erforderlich;</li>
				<li>d) Die Verarbeitung ist zum Schutz lebenswichtiger Interessen erforderlich;</li>
				<li>e) Die Verarbeitung ist für eine Aufgabe im öffentlichen Interesse erforderlich;</li>
				<li>f) Die Verarbeitung ist zur Wahrung berechtigter Interessen erforderlich, sofern nicht die Interessen oder Grundrechte der betroffenen Person überwiegen.</li>
			</ul>
			<p>In den folgenden Abschnitten nennen wir Dir die konkrete Rechtsgrundlage.</p>
		</section>

		<section>
			<h2>3. Das passiert auf unserer Webseite</h2>
			<p>
				Durch den Besuch auf unserer Website verarbeiten wir personenbezogene Daten von Dir. Um diese
				bestmöglich zu schützen, benutzen wir eine SSL- bzw. TLS-Verschlüsselung. Diese erkennst Du
				daran, dass in der Adresszeile Deines Browsers ein https:// oder ein Schloss-Symbol abgebildet
				ist.
			</p>

			<h3>3.1 Datenerhebung beim Aufruf der Webseite</h3>
			<p>
				Durch das Aufrufen der Website werden automatisch Informationen erfasst, die Dein Browser
				übermittelt:
			</p>
			<ul>
				<li>Browsertyp und Browserversion</li>
				<li>verwendetes Betriebssystem</li>
				<li>Referrer URL</li>
				<li>Hostname des zugreifenden Rechners</li>
				<li>Uhrzeit der Serveranfrage</li>
				<li>IP-Adresse</li>
			</ul>
			<p>
				Diese Daten werden vorübergehend benötigt, um Dir unsere Website dauerhaft und problemlos
				anzeigen zu können (Systemsicherheit, Systemstabilität, Fehlerbehebung, Verbindungsaufbau und
				Darstellung). Die Datenverarbeitung erfolgt gemäß Art. 6 Abs. 1 lit. f DSGVO aus unserem
				berechtigten Interesse an Funktionalität und Sicherheit der Website. Wir betreiben keinen
				eigenen Webserver und speichern keine eigenen Server-Log-Dateien; die Erfassung erfolgt bei
				unserem Hosting-Dienstleister Cloudflare (siehe Abschnitt 2.8) nach dessen Löschfristen. Eine
				Zusammenführung mit anderen Daten findet durch uns nicht statt.
			</p>

			<h3>3.2 Datenverarbeitung durch Nutzereingabe</h3>
			<h4>3.2.1 Eigene Datenerhebung</h4>
			<p>Wir bieten folgende (Dienst-)Leistung auf unserer Website an: Zugang zur Plattform.</p>
			<p><strong>Warteliste:</strong> Wenn Du Dich über die Warteliste anmeldest, erheben wir:</p>
			<ul>
				<li>Name und E-Mail-Adresse</li>
				<li>
					Deine Antwort auf die Motivationsfrage („Why do you want to join?“). Diese Angabe ist für
					die Anmeldung erforderlich; sie dient der Bearbeitung Deiner Beitrittsanfrage und der
					Kuratierung der Mitgliederbasis.
				</li>
				<li>
					freiwillig: Deine Angabe dazu, wie Du auf uns aufmerksam geworden bist („Where did you spot
					us?“), sowie Dein Wohnort (Stadt)
				</li>
			</ul>
			<p>
				Rechtsgrundlage für Name, E-Mail-Adresse und Motivationsangabe ist Art. 6 Abs. 1 lit. b DSGVO
				(vorvertragliche Maßnahmen). Die freiwilligen Angaben (Zugangskanal, Wohnort) verarbeiten wir
				auf Grundlage Deiner Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.
			</p>
			<p><strong>Registrierung:</strong> Bei der Registrierung erheben wir zusätzlich:</p>
			<ul>
				<li>
					die Empfehlungsbeziehung — wer Dich zur Plattform geführt hat. Kommst Du über einen
					persönlichen Empfehlungslink, lesen wir dazu ein in Deinem Browser gespeichertes Cookie
					(„dyad_ref“) aus. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
				</li>
				<li>
					freiwillig: eine kurze Beitrittsmotivation (Freitext). Sie dient der Kuratierung der
					Mitgliederbasis, wird für die Dauer des Kontos gespeichert und mit dem Konto gelöscht.
				</li>
			</ul>
			<p>
				<strong>Einladungen:</strong> Wenn Du zur Plattform eingeladen wirst, speichern wir Deine
				E-Mail-Adresse bereits vor der Registrierung, um Dir die Einladung zustellen zu können. Dieser
				Eintrag bleibt nach Annahme der Einladung als Nachweis erhalten; eine Löschung erfolgt auf
				Anfrage.
			</p>
			<p>
				Die Daten werden gelöscht, sobald der jeweilige Zweck entfällt und es gemäß den gesetzlichen
				Vorgaben möglich ist.
			</p>

			<h4>3.2.2 Kontaktaufnahme (E-Mail)</h4>
			<p>
				Wenn Du per E-Mail mit uns in Kontakt trittst, verarbeiten wir Deine E-Mail-Adresse und ggf.
				weitere in der Mail enthaltene Daten. Je nach Anliegen ist die Rechtsgrundlage regelmäßig Art. 6
				Abs. 1 lit. f DSGVO oder Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden gelöscht, sobald der Zweck
				entfällt und es gesetzlich möglich ist.
			</p>

			<h3>3.3 Newsletter und E-Mail-Versand</h3>
			<h4>Resend</h4>
			<p>
				Wir nutzen Resend, einen E-Mail-API-Dienst der Plus Five Five, Inc., 2261 Market Street #5039,
				San Francisco, CA 94114, USA (resend.com), für den Versand von (a) transaktionalen System- und
				Benachrichtigungs-E-Mails an registrierte Mitglieder (z.B. Anmeldung, Bestätigungen,
				ereignisbezogene Benachrichtigungen) sowie (b) wöchentlichen Rundmails (Broadcasts) an
				registrierte Nutzerinnen und Nutzer. Verarbeitet werden dabei die E-Mail-Adresse, ggf. der Name
				zur personalisierten Ansprache, technische Metadaten des Versands (Zustellstatus,
				Bounce-Informationen) sowie – sofern aktiviert – Interaktionsdaten (Öffnungs- und Klickraten).
				Die Empfängersegmente (z.B. Warteliste, eingeladen, Mitglied) werden aus unserer
				Supabase-Datenbank zu Resend synchronisiert. Rechtsgrundlage für transaktionale E-Mails ist Art.
				6 Abs. 1 lit. b bzw. lit. f DSGVO; ereignisbezogene Benachrichtigungen versenden wir nur an eine
				Adresse, die Du dafür in Deinen Profileinstellungen hinterlegt hast. Wöchentliche Rundmails an
				die genannten Gruppen versenden wir auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
				Interesse, Dich über den Dienst zu informieren, für den Du Dich angemeldet hast oder eingeladen
				wurdest); Du kannst dem Erhalt jederzeit mit Wirkung für die Zukunft widersprechen — über den
				Abmeldelink in jeder Rundmail oder per E-Mail an
				<a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a>. Die
				Verarbeitung erfolgt im Rahmen eines Auftragsverarbeitungsvertrags (DPA) gemäß Art. 28 DSGVO.
				Resend speichert und verarbeitet Daten nach eigenen Angaben in den USA; als geeignete Garantie
				greifen die Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO.
				Versandprotokolle werden nach Angaben von Resend nach sieben Tagen automatisch gelöscht. Weitere
				Informationen:
				<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">resend.com/legal/privacy-policy</a>
			</p>
			<h4>Substack</h4>
			<p>
				Zusätzlich bieten wir einen separaten Newsletter an, der über Substack (Substack Inc., 548
				Market Street, PMB 72296, San Francisco, CA 94104, USA) gehostet wird. Die Anmeldung und
				Einwilligung erfolgt ausschließlich auf der Plattform von Substack; Substack ist insoweit
				eigenständig Verantwortlicher für die Verarbeitung der Anmeldedaten. Wir selbst speichern in
				diesem Zusammenhang keine personenbezogenen Daten. Rechtsgrundlage ist die auf Substack erteilte
				Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO. Es gilt die Datenschutzerklärung von Substack:
				<a href="https://substack.com/privacy" target="_blank" rel="noopener noreferrer">substack.com/privacy</a>
			</p>

			<h3>3.4 Backend, Datenbank und Authentifizierung</h3>
			<h4>Supabase</h4>
			<p>
				Unsere Plattform wird auf der Backend-Infrastruktur von Supabase (Supabase, Inc., 3500 S Dupont
				Hwy, Dover, DE 19901, USA) betrieben. Supabase stellt Datenbank, Authentifizierung und Speicher
				bereit und dient als zentrale Infrastruktur für den Betrieb des Dienstes – einschließlich der
				Verwaltung von Konten und Kontaktdaten (z.B. Warteliste, Mitgliedschaften) und der Auslösung
				transaktionaler System-E-Mails. Verarbeitet werden dabei insbesondere Name, E-Mail-Adresse,
				Kontoinhalte sowie technische Metadaten wie IP-Adresse und Zeitstempel. Rechtsgrundlage ist Art.
				6 Abs. 1 lit. b DSGVO (Erfüllung (vor-)vertraglicher Pflichten) sowie Art. 6 Abs. 1 lit. f DSGVO
				(berechtigtes Interesse an einem sicheren und effizienten Betrieb). Bei der Nutzung können
				personenbezogene Daten in die USA übermittelt werden; als geeignete Garantie werden die
				EU-Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO herangezogen. Die Daten werden
				gelöscht, sobald der Zweck entfällt oder eine Einwilligung widerrufen wird, sofern keine
				gesetzlichen Aufbewahrungsfristen entgegenstehen. Weitere Informationen:
				<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>
			</p>

			<h3>3.5 Analyse- und Trackingtools</h3>
			<h4>Plausible Analytics</h4>
			<p>
				Wir nutzen den Analysedienst Plausible Analytics, bereitgestellt von Plausible Insights OÜ,
				Västriku tn 2, 50403 Tartu, Estland. Plausible ermöglicht die datenschutzfreundliche Auswertung
				von Besucherströmen ohne individuelle Nachverfolgung. Verarbeitet werden ausschließlich
				aggregierte und anonymisierte Daten (anonymisierte IP-Adressen als Hash, Browser-Typ,
				Betriebssystem, Gerätetyp, besuchte Seiten-URLs, Referral-Quellen sowie grobe
				Geolokalisierungsdaten). Rechtsgrundlage ist das berechtigte Interesse gemäß Art. 6 Abs. 1 lit.
				f DSGVO, da die Analyse ohne Identifizierung einzelner Personen erfolgt. Plausible setzt keine
				Cookies, Pixel oder verwandten Tracking-Technologien ein. Eine Übermittlung personenbezogener
				Daten in Drittländer findet nicht statt, da sämtliche Verarbeitung innerhalb der EU (primär in
				Deutschland und Estland) erfolgt. Weitere Informationen:
				<a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer">plausible.io/privacy</a>
			</p>

			<h3>3.6 Social-Media-Profile</h3>
			<p>
				Neben unserer Website sind wir mit unserem Unternehmen auch auf sozialen Netzwerken präsent, um
				unser Unternehmen zu präsentieren und die Möglichkeit zum Kontakt zu schaffen. Im Folgenden
				informieren wir darüber, welche Daten wir und das jeweilige Netzwerk bei Besuch und Interaktion
				mit unserem Profil verarbeiten.
			</p>
			<h4>LinkedIn</h4>
			<p>
				Wir betreiben ein LinkedIn-Profil
				(<a href="https://www.linkedin.com/company/join-dyad/" target="_blank" rel="noopener noreferrer">linkedin.com/company/join-dyad</a>),
				betrieben von der LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Irland. Bei Besuch
				und Interaktion verarbeiten wir die öffentlich verfügbaren Profildaten sowie die in Posts,
				Kommentaren oder Nachrichten enthaltenen Daten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO;
				bei vertragsbezogenen Anfragen Art. 6 Abs. 1 lit. b DSGVO. Für die statistischen „Page Insights“
				erfolgt die Verarbeitung in gemeinsamer Verantwortlichkeit mit LinkedIn gemäß Art. 26 Abs. 1
				DSGVO
				(<a href="https://legal.linkedin.com/pages-joint-controller-addendum" target="_blank" rel="noopener noreferrer">Vereinbarung</a>).
			</p>

			<h3>3.7 Kartendarstellung und Ortssuche</h3>
			<h4>Leaflet</h4>
			<p>
				Für die Kartendarstellung nutzen wir die quelloffene Bibliothek Leaflet, die wir selbst hosten;
				es wird hierfür kein Skript eines Drittanbieters geladen. Die angezeigten Kartenkacheln werden
				jedoch von den Servern der OpenStreetMap Foundation (St John's Innovation Centre, Cowley Road,
				Cambridge, CB4 0WS, Vereinigtes Königreich) geladen; dabei werden typischerweise Deine IP-Adresse
				und Browserinformationen (User Agent) an diese Server übermittelt. Außerdem nutzt die Ortssuche
				(z.B. das Stadt-Feld bei der Warteliste) den Suchdienst Nominatim der OpenStreetMap Foundation:
				Während Du tippst, werden Deine Eingabe, Deine IP-Adresse und Browserinformationen an
				nominatim.openstreetmap.org übermittelt, um passende Ortsvorschläge anzuzeigen. Rechtsgrundlage ist Art. 6 Abs.
				1 lit. f DSGVO aufgrund des berechtigten Interesses an einer funktionsfähigen Kartendarstellung.
				Sofern personenbezogene Daten in das Vereinigte Königreich übermittelt werden, erfolgt dies auf
				Grundlage des Angemessenheitsbeschlusses der Europäischen Kommission gemäß Art. 45 DSGVO. Weitere
				Informationen:
				<a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">osmfoundation.org/wiki/Privacy_Policy</a>
			</p>

			<h3>3.8 Zahlungsdienste</h3>
			<h4>Stripe</h4>
			<p>
				Für die Abwicklung von Zahlungen (z.B. Mitgliedsbeiträge, Zine-Bestellungen) nutzen wir Stripe.
				Die Zahlung erfolgt über eine vollständige Weiterleitung auf die von Stripe gehostete
				Bezahlseite; auf unseren Seiten wird kein Stripe-Skript geladen und Stripe setzt auf dyad.berlin
				keine Cookies. Verantwortlich für den Dienst in Europa ist die Stripe Payments Europe, Limited,
				3 Dublin Landings, North Wall Quay, Dublin 1, D01 C4E0, Irland. Auf seinen eigenen Seiten
				verarbeitet Stripe personenbezogene Daten wie Name, E-Mail-Adresse, Rechnungsanschrift,
				Zahlungsdaten, IP-Adresse sowie Geräte- und Browserinformationen zum Zweck der
				Zahlungsabwicklung, Vertragsdurchführung und Betrugsprävention.
			</p>
			<p>
				dyad speichert keine Zahlungsdaten — weder Karten- noch Namens- oder Adressdaten. Wir bewahren
				ausschließlich eine pseudonyme, nicht-personenbezogene Referenz sowie den daraus abgeleiteten
				Mitgliedsstatus (aktiv/inaktiv, Laufzeit) auf.
			</p>
			<p>
				Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. vorvertragliche
				Maßnahmen). Es kann eine Übermittlung in Drittländer (insbesondere die USA) stattfinden; Stripe
				nutzt hierfür die Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO. Weitere
				Informationen:
				<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>
			</p>

			<h3>3.9 Versanddienstleister</h3>
			<p>
				Für den Versand der über unsere Website bestellten Waren (z.B. des Zines) arbeiten wir mit
				Versanddienstleistern zusammen. Im Rahmen der notwendigen Lieferung geben wir Deine Daten (Name,
				Lieferadresse und ggf. weitere für den Versand erforderliche Informationen) an den jeweiligen
				Versanddienstleister weiter. Die Datenübermittlung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
				DSGVO zur Erfüllung unseres Vertrags. Deine E-Mail-Adresse oder Telefonnummer übermitteln wir
				nur, wenn Du hierzu im Bestellprozess ausdrücklich eingewilligt hast (z.B. für eine
				Paketankündigung); diese Einwilligung ist jederzeit für die Zukunft widerrufbar.
			</p>

			<h3>3.10 Cookies und lokale Speicherung</h3>
			<p>
				Wir verwenden technisch notwendige Cookies für die Authentifizierung (Login-Sitzung) sowie
				localStorage für Benutzereinstellungen (z.B. Theme-Auswahl). Rechtsgrundlage ist § 25 Abs. 2
				Nr. 2 TDDDG in Verbindung mit Art. 6 Abs. 1 lit. b DSGVO. Es werden keine verhaltensbezogenen
				oder seitenübergreifenden Tracking-Cookies eingesetzt. Zum Empfehlungs-Cookie („dyad_ref“)
				siehe Abschnitt 3.2.1.
			</p>
		</section>

		<section>
			<h2>4. Das ist sonst noch wichtig</h2>

			<h3>4.1 Deine Rechte im Detail</h3>
			<h4>4.1.1 Auskunftsrecht (Art. 15 DSGVO)</h4>
			<p>
				Du kannst Auskunft darüber verlangen, ob personenbezogene Daten von Dir verarbeitet werden, und
				weitere Auskünfte zur Art und Weise der Verarbeitung einfordern (Art. 15 Abs. 1 lit. a bis h
				DSGVO).
			</p>
			<h4>4.1.2 Recht auf Berichtigung (Art. 16 DSGVO)</h4>
			<p>Dieses Recht umfasst die Berichtigung unrichtiger und die Ergänzung unvollständiger Daten.</p>
			<h4>4.1.3 Recht auf Löschung (Art. 17 DSGVO)</h4>
			<p>
				Das „Recht auf Vergessenwerden“ gibt Dir unter bestimmten Voraussetzungen das Recht, die
				Löschung Deiner personenbezogenen Daten zu verlangen (Art. 17 Abs. 1 lit. a bis f DSGVO).
			</p>
			<h4>4.1.4 Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</h4>
			<p>Dieses Recht ist an die Voraussetzungen gemäß Art. 18 Abs. 1 lit. a bis d DSGVO geknüpft.</p>
			<h4>4.1.5 Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</h4>
			<p>
				Du hast das Recht, Deine Daten in einer gängigen Form zu erhalten und an einen anderen
				Verantwortlichen zu übermitteln, soweit dies technisch machbar ist.
			</p>
			<h4>4.1.6 Recht auf Widerspruch (Art. 21 DSGVO)</h4>
			<p>
				Du kannst der Verarbeitung Deiner personenbezogenen Daten widersprechen, insbesondere bei
				Direktwerbung und/oder Profiling.
			</p>
			<h4>4.1.7 Recht auf „Entscheidung im Einzelfall“ (Art. 22 DSGVO)</h4>
			<p>
				Du hast grundsätzlich das Recht, nicht einer ausschließlich auf automatisierter Verarbeitung
				beruhenden Entscheidung unterworfen zu werden (mit den Einschränkungen aus Art. 22 Abs. 2 und 4
				DSGVO).
			</p>
			<h4>4.1.8 Weitere Rechte</h4>
			<p>
				Wir weisen Dich auf Dein Recht zum Widerruf einer erteilten Einwilligung nach Art. 7 Abs. 3
				DSGVO hin; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Ergänzend
				gelten Deine Rechte nach §§ 32 ff. BDSG.
			</p>
			<h4>4.1.9 Beschwerderecht (Art. 77 DSGVO)</h4>
			<p>
				Du hast das Recht, Dich bei einer Datenschutzaufsichtsbehörde zu beschweren, wenn Du der Ansicht
				bist, dass die Verarbeitung Deiner personenbezogenen Daten gegen die DSGVO verstößt.
			</p>
			<p>
				Die für uns zuständige Aufsichtsbehörde ist: Berliner Beauftragte für Datenschutz und
				Informationsfreiheit, Friedrichstr. 219, 10969 Berlin,
				<a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener noreferrer">www.datenschutz-berlin.de</a>.
			</p>
		</section>

		<section>
			<h2>5. Änderungen dieser Datenschutzerklärung</h2>
			<p>
				Der aktuelle Stand dieser Datenschutzerklärung ist {STAND_DE}. Von Zeit zu Zeit ist es
				erforderlich, den Inhalt anzupassen, um auf tatsächliche und rechtliche Veränderungen zu
				reagieren. Wir behalten uns daher vor, diese Datenschutzerklärung jederzeit zu ändern, und
				empfehlen Dir, sie regelmäßig zu lesen.
			</p>
			<p class="fineprint">Erstellt mit freundlicher Unterstützung von Dieter macht den Datenschutz.</p>
		</section>
	{:else}
		<h1>Privacy Policy</h1>
		<p class="subtitle">As of {STAND_EN} &middot; the German version is legally binding</p>

		<section>
			<h2>1. Introduction</h2>
			<p>This website is operated by: Monad Engineering UG (haftungsbeschränkt).</p>
			<p>
				It is very important to us to handle our website visitors' data confidentially and to protect
				it in the best possible way. For this reason, we make every effort to comply with the
				requirements of the GDPR.
			</p>
			<p>
				Below we explain how we process your data on our website. We use language that is as clear and
				transparent as possible so that you really understand what happens to your data.
			</p>
		</section>

		<section>
			<h2>2. General information</h2>

			<h3>2.1 Processing of personal data and other terms</h3>
			<p>
				Data protection applies to the processing of personal data. Personal data means all data with
				which you can be personally identified, for example the IP address of the device you are using.
				Such data is processed when “something happens to it” — e.g. the IP is transmitted from the
				browser to our provider and stored there. This constitutes processing (Art. 4 No. 2 GDPR) of
				personal data (Art. 4 No. 1 GDPR). These and other legal definitions can be found in Art. 4
				GDPR.
			</p>

			<h3>2.2 Applicable regulations — GDPR, BDSG and TDDDG</h3>
			<p>
				The scope of data protection is regulated by law: the GDPR (General Data Protection Regulation)
				as a European regulation and the BDSG (Federal Data Protection Act) as national law. The TDDDG
				additionally supplements the GDPR with regard to the use of cookies.
			</p>

			<h3>2.3 The controller</h3>
			<p>
				The controller responsible for data processing on this website is the natural or legal person
				who alone or jointly with others determines the purposes and means of processing. You can reach
				the controller at:
			</p>
			<p>
				Monad Engineering UG (haftungsbeschränkt)<br />
				Richard-Sorge-Straße 24<br />
				10249 Berlin, Germany<br />
				<a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a>
			</p>

			<h3>2.4 How data is generally processed on this website</h3>
			<p>
				As established, some data (e.g. IP address) is collected automatically and is mainly required
				for the technical provision of the website. Where we use further personal data or collect other
				data, we will inform you or ask for your consent. You consciously provide us with other personal
				data. Detailed information follows below.
			</p>

			<h3>2.5 Your rights</h3>
			<p>
				The GDPR provides you with comprehensive rights, including free information about the origin,
				recipient and purpose of your stored personal data. You can request the rectification, blocking
				or erasure of this data, lodge a complaint with the competent supervisory authority, and revoke
				your consent at any time. Details are set out in the last section of this Privacy Policy.
			</p>

			<h3>2.6 Data protection — our view</h3>
			<p>
				Data protection is more than a chore for us. Personal data has great value, and careful handling
				should be a matter of course. As a visitor you should be able to decide for yourself what
				happens to your data, when and by whom. We therefore commit to complying with all legal
				requirements, only collect the data we need, and treat it confidentially.
			</p>

			<h3>2.7 Forwarding and deletion</h3>
			<p>
				Data is only passed on where there is a legal basis and it is unavoidable — in particular where
				a processor is involved and a data processing agreement pursuant to Art. 28 GDPR has been
				concluded. We delete your data when the purpose and legal basis no longer apply and no other
				legal obligations prevent deletion (see also Art. 17 GDPR).
			</p>

			<h3>2.8 Hosting</h3>
			<h4>Cloudflare</h4>
			<p>
				Our website uses the hosting and security service Cloudflare (Cloudflare, Inc., 101 Townsend
				Street, San Francisco, CA 94107, USA) as a content delivery network, protecting the website with
				security features such as DDoS defense and a web application firewall, and providing DNS
				management, SSL/TLS encryption and performance optimization. In particular, IP address, user
				agent, HTTP request metadata, referrer information, web-traffic data, DNS requests and
				performance metrics are processed. The legal basis is Art. 6(1)(f) GDPR (legitimate interest in
				security, availability and optimization). Cloudflare sets technically necessary cookies on the
				basis of § 25(2) TDDDG (no consent required). Cloudflare transfers personal data to the USA; the
				EU Standard Contractual Clauses pursuant to Art. 46(2)(c) GDPR are used as a suitable guarantee.
				More information:
				<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">cloudflare.com/privacypolicy</a>
			</p>

			<h3>2.9 Legal bases</h3>
			<p>Processing always requires a legal basis. Art. 6(1) GDPR provides:</p>
			<ul>
				<li>a) the data subject has given consent;</li>
				<li>b) processing is necessary for the performance of a contract or pre-contractual steps;</li>
				<li>c) processing is necessary for compliance with a legal obligation;</li>
				<li>d) processing is necessary to protect vital interests;</li>
				<li>e) processing is necessary for a task in the public interest;</li>
				<li>f) processing is necessary for legitimate interests, unless overridden by the data subject's interests or fundamental rights.</li>
			</ul>
		</section>

		<section>
			<h2>3. What happens on our website</h2>
			<p>
				When you visit our website, we process your personal data. We use SSL/TLS encryption to protect
				this data; you can recognise the encrypted connection by the https:// or lock symbol in your
				browser's address bar.
			</p>

			<h3>3.1 Data collection when accessing the website</h3>
			<p>Accessing the website automatically collects information transmitted by your browser:</p>
			<ul>
				<li>Browser type and version</li>
				<li>Operating system used</li>
				<li>Referrer URL</li>
				<li>Host name of the accessing computer</li>
				<li>Time of the server request</li>
				<li>IP address</li>
			</ul>
			<p>
				This data is temporarily required to display our website reliably (system security, stability,
				troubleshooting, connection and presentation). Processing is based on Art. 6(1)(f) GDPR
				(legitimate interest in functionality and security). We do not operate a web server of our own
				and keep no server log files ourselves; this data is collected by our hosting provider
				Cloudflare (see section 2.8) subject to its deletion periods. We do not merge it with other
				data.
			</p>

			<h3>3.2 Data processing through user input</h3>
			<h4>3.2.1 Own data collection</h4>
			<p>We offer the following service on our website: access to the platform.</p>
			<p><strong>Waitlist:</strong> When you sign up via the waitlist, we collect:</p>
			<ul>
				<li>Name and email address</li>
				<li>
					Your answer to the motivation question (“Why do you want to join?”). This answer is
					required to sign up; it is used to process your request to join and to curate the member
					base.
				</li>
				<li>
					optional: your answer as to how you found us (“Where did you spot us?”) and your city
				</li>
			</ul>
			<p>
				The legal basis for processing name, email address and the motivation answer is Art. 6(1)(b)
				GDPR (pre-contractual steps). The optional answers (arrival channel, city) are processed on the
				basis of your consent pursuant to Art. 6(1)(a) GDPR.
			</p>
			<p><strong>Registration:</strong> When you register, we additionally collect:</p>
			<ul>
				<li>
					the referral relationship — who brought you to the platform. If you arrive via a personal
					referral link, we read a cookie stored in your browser (“dyad_ref”) for this. The legal
					basis is Art. 6(1)(b) GDPR.
				</li>
				<li>
					optional: a short joining motivation (free text). It is used to curate the member base, is
					stored for the lifetime of the account and deleted with it.
				</li>
			</ul>
			<p>
				<strong>Invitations:</strong> When you are invited to the platform, we store your email address
				before you register in order to deliver the invitation. The record is retained after acceptance
				as evidence; it is deleted on request.
			</p>
			<p>
				Data is deleted as soon as the respective purpose no longer applies and deletion is legally
				possible.
			</p>

			<h4>3.2.2 Contacting us (email)</h4>
			<p>
				When you contact us by email, we process your email address and any other data contained in the
				message. Depending on the request, the legal basis is regularly Art. 6(1)(f) or Art. 6(1)(b)
				GDPR. Data is deleted once the purpose no longer applies and deletion is legally possible.
			</p>

			<h3>3.3 Newsletter and email delivery</h3>
			<h4>Resend</h4>
			<p>
				We use Resend, an email API service of Plus Five Five, Inc., 2261 Market Street #5039, San
				Francisco, CA 94114, USA (resend.com), to send (a) transactional system and notification emails
				to registered members (e.g. sign-up, confirmations, event-related notifications) and (b) weekly
				broadcast emails to registered users. The data processed includes the email address, the name
				where applicable for personalised addressing, technical delivery metadata (delivery status,
				bounce information) and — where enabled — interaction data (open and click rates). Recipient
				segments (e.g. waitlist, invited, member) are synchronised from our Supabase database to Resend.
				The legal basis for transactional emails is Art. 6(1)(b) or (f) GDPR; event-related
				notifications are only sent to an address you have set for this purpose in your profile
				settings. Weekly broadcast emails to the groups named above are sent on the basis of Art.
				6(1)(f) GDPR (legitimate interest in informing you about the service you signed up for or were
				invited to); you can object at any time with effect for the future — via the unsubscribe link
				in every broadcast or by emailing
				<a href="mailto:legal@dyad.berlin">legal@dyad.berlin</a>.
				Processing takes place under a data processing agreement (DPA) pursuant to Art.
				28 GDPR. According to its own information, Resend stores and processes data in the USA; the EU
				Standard Contractual Clauses pursuant to Art. 46(2)(c) GDPR apply as a suitable guarantee.
				Delivery logs are automatically deleted after seven days. More information:
				<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">resend.com/legal/privacy-policy</a>
			</p>
			<h4>Substack</h4>
			<p>
				In addition, we offer a separate newsletter hosted on Substack (Substack Inc., 548 Market
				Street, PMB 72296, San Francisco, CA 94104, USA). Sign-up and consent take place exclusively on
				Substack's platform; Substack acts as an independent controller for the sign-up data. We do not
				store any personal data in this context. The legal basis for the newsletter is the consent given
				on Substack pursuant to Art. 6(1)(a) GDPR. Substack's privacy policy applies:
				<a href="https://substack.com/privacy" target="_blank" rel="noopener noreferrer">substack.com/privacy</a>
			</p>

			<h3>3.4 Backend, database and authentication</h3>
			<h4>Supabase</h4>
			<p>
				Our platform runs on the backend infrastructure of Supabase (Supabase, Inc., 3500 S Dupont Hwy,
				Dover, DE 19901, USA). Supabase provides database, authentication and storage and thus serves as
				the core infrastructure for operating the service — including the management of accounts and
				contact data (e.g. waitlist, memberships) and the triggering of transactional system emails. The
				data processed includes in particular name, email address, account content and technical
				metadata such as IP address and timestamps. The legal basis is Art. 6(1)(b) GDPR (performance of
				(pre-)contractual obligations) and Art. 6(1)(f) GDPR (legitimate interest in secure and efficient
				operation). Personal data may be transferred to the USA; the EU Standard Contractual Clauses
				pursuant to Art. 46(2)(c) GDPR are used as a suitable guarantee. Data is deleted once the purpose
				no longer applies or consent is revoked, unless statutory retention periods apply. More
				information:
				<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>
			</p>

			<h3>3.5 Analysis and tracking tools</h3>
			<h4>Plausible Analytics</h4>
			<p>
				We use the analytics service Plausible Analytics, provided by Plausible Insights OÜ, Västriku tn
				2, 50403 Tartu, Estonia. Plausible enables privacy-friendly analysis of visitor traffic without
				individual tracking. Only aggregated and anonymised data is processed, including anonymised IP
				addresses (stored as a hash, not in plain text), browser type, operating system, device type,
				visited page URLs, referral sources and rough geolocation (country, region, city). The legal
				basis is legitimate interest pursuant to Art. 6(1)(f) GDPR, as the analysis is conducted without
				identifying individuals. Plausible does not use cookies, pixels or related tracking technologies.
				No personal data is transferred to third countries, as all processing takes place within the EU
				(primarily Germany and Estonia). More information:
				<a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer">plausible.io/privacy</a>
			</p>

			<h3>3.6 Social media profiles</h3>
			<p>
				In addition to our website, we maintain a presence on social networks to present our company and
				enable contact. Below we explain which data we and the respective network process when you visit
				and interact with our profile.
			</p>
			<h4>LinkedIn</h4>
			<p>
				We operate a LinkedIn profile
				(<a href="https://www.linkedin.com/company/join-dyad/" target="_blank" rel="noopener noreferrer">linkedin.com/company/join-dyad</a>),
				operated by LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Ireland. When you visit
				and interact, we process the publicly available profile data and the data contained in posts,
				comments or messages. The legal basis is Art. 6(1)(f) GDPR; for contract-related requests, Art.
				6(1)(b) GDPR. For the statistical “Page Insights”, processing takes place under joint
				controllership with LinkedIn pursuant to Art. 26(1) GDPR
				(<a href="https://legal.linkedin.com/pages-joint-controller-addendum" target="_blank" rel="noopener noreferrer">agreement</a>).
			</p>

			<h3>3.7 Map display and place search</h3>
			<h4>Leaflet</h4>
			<p>
				For map display we use the open-source library Leaflet, which we host ourselves; no third-party
				script is loaded for this. The map tiles shown, however, are loaded from the servers of the
				OpenStreetMap Foundation (St John's Innovation Centre, Cowley Road, Cambridge, CB4 0WS, United
				Kingdom); in doing so, your IP address and browser information (user agent) are typically
				transmitted to those servers. In addition, the place search (e.g. the city field on the
				waitlist) uses the OpenStreetMap Foundation's Nominatim search service: as you type, your
				input, IP address and browser information are transmitted to nominatim.openstreetmap.org to
				show matching suggestions. The legal basis is Art. 6(1)(f) GDPR (legitimate interest in a
				functional map display). Where personal data is transferred to the United Kingdom, this is based
				on the European Commission's adequacy decision pursuant to Art. 45 GDPR. More information:
				<a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">osmfoundation.org/wiki/Privacy_Policy</a>
			</p>

			<h3>3.8 Payment services</h3>
			<h4>Stripe</h4>
			<p>
				We use Stripe to process payments (e.g. membership fees, zine orders). Payment takes place via
				a full-page redirect to Stripe's hosted payment page; no Stripe script is loaded on our pages
				and Stripe sets no cookies on dyad.berlin. The controller in Europe is Stripe Payments Europe,
				Limited, 3 Dublin Landings, North Wall Quay, Dublin 1, D01 C4E0, Ireland. On its own pages,
				Stripe processes personal data such as name, email address, billing address, payment data, IP
				address and device and browser information for the purpose of payment processing, contract
				performance and fraud prevention.
			</p>
			<p>
				dyad stores no payment data — neither card, name nor address data. We keep only a pseudonymous,
				non-personal reference and the membership status derived from it (active/inactive, term).
			</p>
			<p>
				The legal basis is Art. 6(1)(b) GDPR (performance of a contract or pre-contractual steps).
				Personal data may be transferred to third countries (in particular the USA); Stripe uses the
				Standard Contractual Clauses pursuant to Art. 46(2)(c) GDPR. More information:
				<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>
			</p>

			<h3>3.9 Shipping service providers</h3>
			<p>
				To ship goods ordered via our website (e.g. the zine) we work with shipping service providers.
				For the necessary delivery, we pass on your data (name, delivery address and any other
				information required for shipping) to the respective provider. This transfer is based on Art.
				6(1)(b) GDPR to perform our contract. We only transmit your email address or phone number to the
				provider if you have expressly consented during the order process (e.g. for parcel notification);
				this consent can be revoked at any time for the future.
			</p>

			<h3>3.10 Cookies and local storage</h3>
			<p>
				We use technically necessary cookies for authentication (login session) and localStorage for
				user preferences (e.g. theme choice). The legal basis is § 25(2) No. 2 TDDDG in conjunction
				with Art. 6(1)(b) GDPR. No behavioural or cross-site tracking cookies are used. For the
				referral cookie (“dyad_ref”), see section 3.2.1.
			</p>
		</section>

		<section>
			<h2>4. What else is important</h2>

			<h3>4.1 Your rights in detail</h3>
			<h4>4.1.1 Right to information (Art. 15 GDPR)</h4>
			<p>
				You can request confirmation as to whether your personal data is being processed and further
				information on the nature of the processing (Art. 15(1)(a)–(h) GDPR).
			</p>
			<h4>4.1.2 Right to rectification (Art. 16 GDPR)</h4>
			<p>This includes the correction of incorrect data and the completion of incomplete data.</p>
			<h4>4.1.3 Right to erasure (Art. 17 GDPR)</h4>
			<p>
				This “right to be forgotten” gives you the right, under certain conditions, to request the
				erasure of your personal data (Art. 17(1)(a)–(f) GDPR).
			</p>
			<h4>4.1.4 Right to restriction of processing (Art. 18 GDPR)</h4>
			<p>This right is subject to the conditions set out in Art. 18(1)(a)–(d) GDPR.</p>
			<h4>4.1.5 Right to data portability (Art. 20 GDPR)</h4>
			<p>
				You have the right to receive your data in a commonly used form and to transfer it to another
				controller, where technically feasible.
			</p>
			<h4>4.1.6 Right to object (Art. 21 GDPR)</h4>
			<p>
				You can object to the processing of your personal data, in particular where it relates to direct
				marketing and/or profiling.
			</p>
			<h4>4.1.7 Right to “individual decision-making” (Art. 22 GDPR)</h4>
			<p>
				You generally have the right not to be subject to a decision based solely on automated processing
				(subject to the exceptions in Art. 22(2) and (4) GDPR).
			</p>
			<h4>4.1.8 Further rights</h4>
			<p>
				We draw your attention to your right to withdraw a given consent pursuant to Art. 7(3) GDPR; the
				lawfulness of processing carried out until then remains unaffected. Your rights under §§ 32 et
				seq. BDSG apply in addition.
			</p>
			<h4>4.1.9 Right to lodge a complaint (Art. 77 GDPR)</h4>
			<p>
				You have the right to lodge a complaint with a data protection supervisory authority if you
				consider that the processing of your personal data infringes the GDPR.
			</p>
			<p>
				The authority competent for us is: Berliner Beauftragte für Datenschutz und
				Informationsfreiheit (Berlin Commissioner for Data Protection and Freedom of Information),
				Friedrichstr. 219, 10969 Berlin,
				<a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener noreferrer">www.datenschutz-berlin.de</a>.
			</p>
		</section>

		<section>
			<h2>5. Changes to this Privacy Policy</h2>
			<p>
				This Privacy Policy is current as of {STAND_EN}. From time to time it may be necessary to
				update the content to reflect factual and legal changes. We therefore reserve the right to amend
				this Privacy Policy at any time and recommend that you review it regularly.
			</p>
			<p class="fineprint">Created with the kind support of Dieter macht den Datenschutz.</p>
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

	h4 {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
		margin: var(--space-4) 0 var(--space-1);
	}

	section {
		margin-bottom: var(--space-4);
	}

	p {
		margin: 0 0 var(--space-2);
	}

	ul {
		margin: 0 0 var(--space-2);
		padding-left: 1.4em;
	}

	li {
		margin: 0 0 var(--space-1);
	}

	.fineprint {
		font-size: var(--text-base);
		color: var(--text-muted);
		margin-top: var(--space-6);
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
