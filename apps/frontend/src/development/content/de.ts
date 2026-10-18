import type { DevelopmentContent, DevelopmentEntry } from './types';

/*
 * German development calendar.
 *
 * Written for this app, not copied: every statement is grounded in the sources
 * listed per entry (BIÖG/kindergesundheit-info.de, the G-BA check-up schedule,
 * the STIKO calendar, Netzwerk Gesund ins Leben, the 2022 CDC/AAP milestone
 * checklists, the WHO Motor Development Study), but phrased as spans and
 * orientation, never as deadlines. Schedules that change over time (vaccines in
 * particular) are only named in general terms and linked, not reproduced.
 *
 * A week's entry may focus on care or everyday topics rather than a new skill:
 * development rarely changes week to week, and pretending otherwise would be
 * false precision.
 */

const weeks: readonly DevelopmentEntry[] = [
  // Lebenswoche 1
  {
    title: 'Willkommen auf der Welt',
    teaser:
      'Dein Baby kommt mit angeborenen Reflexen zur Welt: Es greift fest zu, sucht die Brust und saugt kräftig.',
    body: [
      'In den ersten Lebenstagen steuern vor allem angeborene Reflexe das Verhalten: Legst du einen Finger in die Handfläche, greift dein Baby fest zu (Greifreflex). Berührst du seine Wange, dreht es den Kopf und sucht (Suchreflex). Bei einem plötzlichen Geräusch reißt es die Arme auseinander (Moro-Reflex). Diese Reflexe treten in den nächsten Monaten nach und nach zurück, wenn gezielte Bewegungen sie ablösen.',
      'Am schärfsten sieht dein Baby jetzt auf etwa 20 bis 30 Zentimeter Entfernung – ungefähr der Abstand zu deinem Gesicht beim Stillen oder Füttern. Stimmen, Geruch und Hautkontakt der Eltern sind ihm aus dem Mutterleib schon vertraut.',
      'Zwischen dem 3. und 10. Lebenstag steht die U2 an. In den ersten Tagen werden außerdem das Neugeborenen-Screening (ein kleiner Bluttest) und das Hörscreening angeboten. Je nach Geburtsmonat empfiehlt die STIKO zudem eine einmalige RSV-Prophylaxe – sprich die Kinderarztpraxis darauf an.',
    ],
    tips: [
      'Viel Haut-an-Haut-Kontakt beruhigt und hilft deinem Baby, sich an die neue Welt zu gewöhnen.',
      'Kläre früh, welche Kinderarztpraxis euch betreut, und vereinbare den Termin für die U3.',
      'Das gelbe Kinderuntersuchungsheft gut aufheben – es begleitet euch bis ins Schulalter.',
    ],
    sources: ['kgiFirstYear', 'kgiCheckups', 'rkiVaccinationSchedule'],
  },
  // Lebenswoche 2
  {
    title: 'Sicher schlafen von Anfang an',
    teaser:
      'Neugeborene schlafen viel, aber in kurzen Etappen über Tag und Nacht verteilt. Ein sicherer Schlafplatz ist jetzt besonders wichtig.',
    body: [
      'Ein Tag-Nacht-Rhythmus existiert noch nicht: Dein Baby schläft insgesamt viele Stunden, wacht aber alle paar Stunden auf, weil es Hunger hat. Das ist normal und gesund.',
      'Zum Schutz vor dem plötzlichen Kindstod empfehlen Fachleute: Schlafen in Rückenlage, im eigenen Bettchen im Schlafzimmer der Eltern, im Babyschlafsack statt unter Decken, ohne Kissen, Nestchen oder Kuscheltiere im Bett, in einer rauchfreien Umgebung und nicht zu warm (etwa 16 bis 18 °C Raumtemperatur).',
      'Ab etwa der zweiten Lebenswoche empfehlen Kinderärztinnen und -ärzte in Deutschland üblicherweise Vitamin D (oft kombiniert mit Fluorid) zur Vorbeugung von Rachitis. Wie und wie lange, besprichst du am besten in der Praxis.',
    ],
    tips: [
      'Rückenlage, Schlafsack, eigenes Bett im Elternschlafzimmer – und sonst nichts im Bett.',
      'Schlaf, wenn dein Baby schläft: Die ersten Wochen sind auch für Eltern anstrengend.',
    ],
    sources: ['kgiBabySleep', 'kgiFirstYear'],
  },
  // Lebenswoche 3
  {
    title: 'Warum Babys weinen',
    teaser:
      'Viele Babys weinen in diesen Wochen mehr als zuvor. Das gehört zur normalen Entwicklung – und ist trotzdem anstrengend.',
    body: [
      'Weinen ist die wichtigste Sprache deines Babys: Es meldet Hunger, Müdigkeit, eine volle Windel, Unwohlsein oder einfach das Bedürfnis nach Nähe. Bei fast allen Säuglingen nimmt das Weinen ab etwa der zweiten Lebenswoche zu und erreicht um die sechste Woche herum einen Höhepunkt. Danach wird es meist allmählich weniger.',
      'Nicht jedes Weinen lässt sich sofort stillen. Wichtig ist, dass dein Baby spürt: Jemand ist da. Ruhe, Körperkontakt, gedämpftes Licht und gleichmäßige Geräusche oder Bewegungen helfen oft.',
      'Wenn dir alles zu viel wird: Leg dein Baby sicher in sein Bettchen, geh kurz aus dem Zimmer und atme durch. Schüttle ein Baby niemals – das kann lebensgefährliche Hirnverletzungen verursachen.',
    ],
    tips: [
      'Grundbedürfnisse prüfen: Hunger, Windel, zu warm oder zu kalt, müde?',
      'Tragen, sanftes Wiegen, leises Summen oder ein gleichmäßiges Rauschen ausprobieren.',
      'Hilfe annehmen: Hebamme, Kinderarztpraxis und Angebote der Frühen Hilfen sind für euch da.',
    ],
    sources: ['kgiCrying', 'elternsein'],
  },
  // Lebenswoche 4
  {
    title: 'Bauchlage im Wachzustand',
    teaser:
      'In Bauchlage versucht dein Baby schon, den Kopf kurz anzuheben. Kleine Übungseinheiten im Wachzustand stärken Nacken und Schultern.',
    body: [
      'Schlafen soll dein Baby in Rückenlage. Wenn es wach ist und du dabei bist, ist die Bauchlage aber eine wertvolle Übung: Dein Baby versucht, den Kopf anzuheben und zu drehen, und kräftigt dabei Nacken-, Schulter- und Rückenmuskulatur.',
      'Anfangs reicht schon eine Minute auf deiner Brust oder quer über deinem Schoß. Viele Babys finden die Bauchlage zunächst anstrengend – das wird mit der Zeit besser. Abwechselnde Lagen beugen außerdem einer einseitigen Abflachung des Hinterkopfs vor.',
    ],
    tips: [
      'Mehrmals täglich kurz auf den Bauch legen – nur wach und unter Aufsicht.',
      'Leg dich auf Augenhöhe dazu: Dein Gesicht ist das spannendste „Spielzeug“.',
    ],
    sources: ['kgiFirstYear', 'nhsBabyMoves'],
  },
  // Lebenswoche 5
  {
    title: 'Zeit für die U3',
    teaser:
      'Zwischen der 4. und 5. Lebenswoche steht die U3 an – inklusive Ultraschall der Hüftgelenke.',
    body: [
      'Bei der U3 schaut die Kinderärztin oder der Kinderarzt, ob dein Baby gut trinkt und zunimmt, wie es sich bewegt und reagiert. Standardmäßig gehört eine Ultraschalluntersuchung der Hüfte dazu, um eine Hüftreifungsstörung früh zu erkennen.',
      'Die U3 ist auch ein guter Moment für deine Fragen: zu Schlaf, Weinen, Verdauung, Vitamin-D-Gabe oder den anstehenden Impfungen. Schreib dir Fragen am besten vorher auf – im Praxistermin vergisst man schnell etwas.',
    ],
    tips: [
      'Untersuchungsheft und Versichertenkarte mitnehmen.',
      'Den Termin für die U4 (3. bis 4. Lebensmonat) am besten gleich mit vereinbaren.',
    ],
    sources: ['kgiCheckups', 'bmgCheckups'],
  },
  // Lebenswoche 6
  {
    title: 'Das erste Lächeln',
    teaser:
      'Um diese Zeit herum zeigen viele Babys ihr erstes „soziales“ Lächeln – ein Lächeln, das dir gilt.',
    body: [
      'Schon Neugeborene verziehen im Schlaf manchmal die Mundwinkel. Etwa ab der sechsten bis achten Woche lächeln viele Babys aber gezielt, wenn sie ein vertrautes Gesicht sehen oder eine Stimme hören. Dieses soziale Lächeln ist ein wichtiger Schritt: Dein Baby beginnt, mit dir in Kontakt zu treten.',
      'Manche Babys lächeln früher, andere etwas später. Wenn du zurücklächelst und mit ihm sprichst, lernt dein Baby: Mein Ausdruck bewirkt etwas.',
    ],
    tips: [
      'Mit deinem Baby von Angesicht zu Angesicht sprechen – mit Pausen, in denen es „antworten“ kann.',
      'Das erste Lächeln eignet sich wunderbar als Meilenstein mit Foto.',
    ],
    sources: ['kgiDevelopmentTasks', 'cdc2Months'],
  },
  // Lebenswoche 7
  {
    title: 'Wenn das Weinen am meisten ist',
    teaser:
      'Bei vielen Babys erreicht das Weinen zwischen der 6. und 8. Woche seinen Höhepunkt. Danach wird es meist nach und nach weniger.',
    body: [
      'Gerade am späten Nachmittag und Abend weinen viele Babys jetzt besonders viel, oft ohne erkennbaren Grund. Das liegt meist nicht an Bauchschmerzen, sondern daran, dass das Baby noch lernt, Reize zu verarbeiten und zur Ruhe zu kommen. Übermüdung und zu viele Eindrücke verstärken das Weinen häufig.',
      'Weint dein Baby über Wochen hinweg sehr viel (mehr als drei Stunden am Tag an mehr als drei Tagen pro Woche) oder hast du das Gefühl, es nicht mehr beruhigen zu können, sprich mit der Kinderarztpraxis. Viele Regionen haben Schreiambulanzen, die Familien unterstützen.',
    ],
    tips: [
      'Reize reduzieren: abgedunkelter Raum, wenig Besuch, feste Abläufe.',
      'Euch abwechseln – und auch mal jemand Vertrautem das Baby für eine Stunde anvertrauen.',
      'Niemals schütteln. Wenn nichts mehr geht: Baby sicher ablegen und kurz durchatmen.',
    ],
    sources: ['kgiCryingProblems', 'elternsein'],
  },
  // Lebenswoche 8
  {
    title: 'Erste Laute und Gespräche',
    teaser:
      'Neben dem Weinen hört man jetzt öfter weiche Laute wie „ääh“ oder „ghh“ – dein Baby beginnt zu „plaudern“.',
    body: [
      'Etwa ab dem zweiten Lebensmonat entdecken viele Babys ihre Stimme: Sie gurren, glucksen und machen vokalähnliche Laute. Wenn du die Laute aufgreifst und antwortest, entsteht ein erstes kleines Wechselgespräch – die Grundlage für die spätere Sprachentwicklung.',
      'Rund um die achte Woche beginnen laut STIKO-Impfkalender auch die ersten Standardimpfungen (die Rotavirus-Schluckimpfung ist schon ab sechs Wochen möglich). Welche Impfungen wann anstehen, erklärt dir die Kinderarztpraxis.',
    ],
    tips: [
      'Laute nachmachen und Pausen lassen – so lernt dein Baby das Abwechseln im Gespräch.',
      'Alltag kommentieren: „Jetzt ziehen wir die Socke an.“ Inhalt ist egal, Zuwendung zählt.',
    ],
    sources: ['kgiFirstYear', 'rkiVaccinationSchedule', 'cdc2Months'],
  },
  // Lebenswoche 9
  {
    title: 'Hände entdecken',
    teaser:
      'Die Fäustchen öffnen sich häufiger. Dein Baby betrachtet seine Hände und führt sie zum Mund.',
    body: [
      'In den ersten Wochen sind die Hände meist zu Fäusten geballt. Jetzt öffnen sie sich immer öfter, und viele Babys beginnen, ihre Hände zu betrachten, sie zusammenzuführen und daran zu nuckeln. Das ist kein Hungerzeichen, sondern Selbstentdeckung – und eine Art, sich selbst zu beruhigen.',
      'Die Verbindung von Sehen und Bewegen ist eine Vorstufe des späteren gezielten Greifens.',
    ],
    tips: [
      'Kleine, leichte Rasseln in die Hand legen – dein Baby hält sie schon kurz fest.',
      'Freie Hände statt Fäustlingen, wenn es nicht kalt ist: So kann dein Baby sie erkunden.',
    ],
    sources: ['kgiFirstYear', 'cdc2Months'],
  },
  // Lebenswoche 10
  {
    title: 'Mit den Augen folgen',
    teaser:
      'Dein Baby verfolgt Gesichter und Gegenstände immer sicherer mit den Augen und schaut sie länger an.',
    body: [
      'Das Sehen entwickelt sich in den ersten Monaten rasant. Viele Babys können jetzt einem langsam bewegten Gesicht oder Spielzeug mit den Augen folgen und betrachten Dinge länger und konzentrierter. Kräftige Kontraste und Gesichter sind besonders interessant.',
      'In den kommenden Wochen steht die U4 an (im 3. bis 4. Lebensmonat). Dabei werden unter anderem Beweglichkeit, Hören und Sehen geprüft, und es geht meist auch um Impfungen.',
    ],
    tips: [
      'Ein Spielzeug langsam von einer Seite zur anderen bewegen und schauen, ob dein Baby folgt.',
      'Rechtzeitig einen Termin für die U4 vereinbaren.',
    ],
    sources: ['kgiCheckups', 'cdc2Months'],
  },
  // Lebenswoche 11
  {
    title: 'Der Kopf wird stabiler',
    teaser:
      'Die Nackenmuskulatur wird kräftiger: In Bauchlage stützt sich dein Baby zunehmend auf die Unterarme und hebt den Kopf.',
    body: [
      'Beim Hochnehmen braucht der Kopf zwar weiterhin Unterstützung, aber er wackelt weniger. In Bauchlage hebt dein Baby den Kopf höher und länger und beginnt, sich auf die Unterarme zu stützen. Bis zum vierten Lebensmonat können die meisten Babys den Kopf aufrecht halten, wenn man sie hält.',
      'Wie schnell das geht, ist unterschiedlich. Regelmäßige, kurze Bauchlage-Zeiten im Wachzustand helfen.',
    ],
    tips: [
      'Auf dem Boden spielen: eine feste Decke, ein Spiegel oder ein buntes Tuch vor dem Gesicht.',
      'Beim Tragen den Kopf weiterhin locker stützen.',
    ],
    sources: ['nhsBabyMoves', 'cdc4Months'],
  },
  // Lebenswoche 12
  {
    title: 'Ein Rhythmus entsteht',
    teaser:
      'Viele Babys finden jetzt allmählich einen Tag-Nacht-Rhythmus und schlafen nachts längere Etappen.',
    body: [
      'Um den dritten Lebensmonat herum entwickeln die meisten Babys einen eigenen Tag-Nacht-Rhythmus. Nachts werden die Schlafphasen oft etwas länger, tagsüber gibt es mehrere Nickerchen. Durchschlafen im Sinne von Erwachsenen ist aber noch lange nicht zu erwarten – nächtliches Aufwachen ist im ganzen ersten Lebensjahr normal.',
      'Du kannst den Rhythmus unterstützen: tagsüber Licht, Geräusche und Aktivität, nachts gedämpftes Licht, wenig Ansprache und kurze, ruhige Mahlzeiten.',
    ],
    tips: [
      'Wiederkehrende Abläufe vor dem Schlafen einführen, z. B. Wickeln, Schlafsack, Lied.',
      'Müdigkeitszeichen beachten: Gähnen, Augenreiben, starrer Blick – dann ab ins Bett.',
    ],
    sources: ['kgiDevelopmentTasks', 'kgiBabySleep'],
  },
  // Lebenswoche 13
  {
    title: 'Das erste Vierteljahr ist geschafft',
    teaser:
      'Drei Monate! Bei vielen Babys wird das Weinen jetzt weniger, und sie sind wacher und neugieriger als zuvor.',
    body: [
      'Viele Eltern erleben das Ende des dritten Monats als Wendepunkt: Das Baby weint seltener, ist länger zufrieden wach und sucht aktiv Kontakt – mit Blicken, Lächeln und Lauten. Es hat in kurzer Zeit enorm viel gelernt.',
      'Hält das viele Weinen über den dritten Monat hinaus an, lohnt sich ein Gespräch mit der Kinderarztpraxis oder einer Beratungsstelle.',
    ],
    tips: [
      'Ein kurzer Rückblick: Was hat sich seit der Geburt verändert? Ein Foto pro Monat ist eine schöne Tradition.',
      'Auch für Eltern gilt: eigene Erholung einplanen.',
    ],
    sources: ['kgiCrying', 'kgiFirstYear'],
  },
  // Lebenswoche 14
  {
    title: 'Stimmen erkennen',
    teaser:
      'Hört dein Baby eine vertraute Stimme, dreht es den Kopf in ihre Richtung und sucht nach dir.',
    body: [
      'Das Hören war schon bei der Geburt gut entwickelt. Jetzt kann dein Baby Geräusche immer besser orten: Es wendet den Kopf zu einer Stimme oder einem Geräusch und erkennt vertraute Stimmen. Musik, Singen und Sprechen machen ihm großen Spaß.',
      'Reagiert dein Baby kaum auf Geräusche oder Stimmen, sprich das bei der nächsten Untersuchung an – auch wenn das Hörscreening nach der Geburt unauffällig war.',
    ],
    tips: [
      'Von der Seite ansprechen und beobachten, ob dein Baby den Kopf dreht.',
      'Lieder und Fingerspiele mit Melodie und Rhythmus sind ideal.',
    ],
    sources: ['kgiFirstYear', 'cdc4Months'],
  },
  // Lebenswoche 15
  {
    title: 'Nach Dingen ausholen',
    teaser:
      'Dein Baby schlägt nach Spielzeug, das über ihm hängt, und hält eine Rassel fest, wenn du sie ihm in die Hand gibst.',
    body: [
      'Das Greifen entwickelt sich in Etappen: Zuerst schlägt dein Baby mit den Armen nach interessanten Dingen, dann trifft es immer besser, und irgendwann zwischen dem dritten und sechsten Monat greift es gezielt zu. Jetzt sind viele Babys mitten in diesem Prozess.',
      'Ein Spielbogen oder ein in Reichweite gehaltenes Spielzeug lädt zum Ausprobieren ein – und jeder „Treffer“ ist ein kleines Erfolgserlebnis.',
    ],
    tips: [
      'Spielzeug in Greifweite anbieten, mal links, mal rechts.',
      'Leichte, gut zu fassende Dinge: Stoffringe, Beißringe, kleine Rasseln.',
    ],
    sources: ['cdc4Months', 'kgiFirstYear'],
  },
  // Lebenswoche 16
  {
    title: 'Glucksen und Lachen',
    teaser:
      'Viele Babys glucksen und lachen um diese Zeit zum ersten Mal laut – zum Beispiel bei Kitzelspielen.',
    body: [
      'Etwa im vierten Lebensmonat beginnen viele Babys, hörbar zu lachen oder zu glucksen, wenn man mit ihnen spielt. Sie lächeln von sich aus, um Aufmerksamkeit zu bekommen, und reagieren deutlich auf Mimik und Stimme.',
      'Lachen ist ein gemeinsames Erlebnis: Dein Baby lernt, dass es Freude teilen kann.',
    ],
    tips: [
      'Sanfte Kitzel-, Puste- und Guck-guck-Spiele ausprobieren.',
      'Wenn dein Baby wegschaut, braucht es eine Pause – das ist in Ordnung.',
    ],
    sources: ['cdc4Months', 'kgiDevelopmentTasks'],
  },
  // Lebenswoche 17
  {
    title: 'Alles kommt in den Mund',
    teaser:
      'Der Mund ist jetzt das wichtigste Werkzeug zum Erforschen: Was dein Baby zu fassen bekommt, wird gründlich „untersucht“.',
    body: [
      'Lippen und Zunge sind sehr empfindlich, deshalb erkunden Babys Gegenstände zuerst mit dem Mund. Das ist ein normaler und wichtiger Teil der Entwicklung – und der Grund, warum ab jetzt besonders auf Kleinteile geachtet werden muss.',
      'Vermehrtes Sabbern ist in diesem Alter häufig und muss nicht bedeuten, dass schon ein Zahn kommt.',
    ],
    tips: [
      'Alles, was durch eine Klopapierrolle passt, ist für Babys zu klein und gehört außer Reichweite.',
      'Spielzeug ohne abnehmbare Kleinteile wählen und regelmäßig waschen.',
    ],
    sources: ['kgiFirstYear', 'cdc4Months'],
  },
  // Lebenswoche 18
  {
    title: 'Vom Bauch auf den Rücken',
    teaser:
      'Manche Babys drehen sich jetzt zum ersten Mal vom Bauch auf den Rücken – oft ganz überraschend.',
    body: [
      'Zwischen dem vierten und siebten Monat lernen die meisten Babys, sich zu drehen – häufig zuerst vom Bauch auf den Rücken, später auch umgekehrt. In Bauchlage stützen sich viele schon auf die Hände und heben die Brust.',
      'Weil das Drehen meist plötzlich klappt, gilt ab sofort: Auf dem Wickeltisch oder Sofa dein Baby keinen Moment unbeaufsichtigt lassen.',
    ],
    tips: [
      'Auf dem Boden viel Platz zum Ausprobieren geben.',
      'Immer eine Hand am Baby, wenn es erhöht liegt.',
    ],
    sources: ['nhsBabyMoves', 'cdc6Months'],
  },
  // Lebenswoche 19
  {
    title: 'Bereit für Brei?',
    teaser:
      'Ab dem Beginn des 5. Monats ist Beikost möglich. Ob dein Baby schon so weit ist, zeigt es dir selbst.',
    body: [
      'Fachleute in Deutschland empfehlen, mit Beikost frühestens zu Beginn des 5. und spätestens zu Beginn des 7. Lebensmonats zu starten. Es gibt also kein „Muss“ für genau jetzt – das Zeitfenster ist bewusst breit.',
      'Anzeichen für die Beikostreife sind zum Beispiel: Dein Baby kann mit etwas Unterstützung aufrecht sitzen und den Kopf halten, zeigt Interesse am Essen der anderen und öffnet den Mund, wenn ihm ein Löffel angeboten wird. Stillen oder Fläschchen laufen parallel weiter.',
    ],
    tips: [
      'Mit einem einfachen Gemüsebrei starten und kleine Mengen anbieten.',
      'Honig ist im ersten Lebensjahr tabu.',
    ],
    sources: ['gesundInsLeben', 'kgiFirstYear'],
  },
  // Lebenswoche 20
  {
    title: 'Quietschen, Prusten, Plappern',
    teaser:
      'Dein Baby probiert seine Stimme aus: Es quietscht, prustet, brummt und „antwortet“ auf deine Laute.',
    body: [
      'Viele Babys experimentieren jetzt begeistert mit Lauten: hohe und tiefe Töne, Prusten mit den Lippen, lautes Juchzen. Sie merken, dass sie mit ihrer Stimme etwas bewirken, und wechseln sich mit dir im „Gespräch“ ab.',
      'Für die Sprachentwicklung ist es viel wichtiger, dass du mit deinem Baby sprichst, als dass du ihm etwas vorspielst. Echte Gespräche schlagen jedes Audio.',
    ],
    tips: [
      'Prust- und Brummlaute nachmachen und abwarten, ob dein Baby antwortet.',
      'Beim Wickeln und Baden singen – Wiederholung macht Lieder vertraut.',
    ],
    sources: ['cdc6Months', 'kgiFirstYear'],
  },
  // Lebenswoche 21
  {
    title: 'Mit beiden Händen',
    teaser:
      'Dein Baby greift immer gezielter zu, nimmt Dinge mit beiden Händen und beginnt, sie von einer Hand in die andere zu geben.',
    body: [
      'Das Greifen wird präziser: Dein Baby streckt sich nach Spielzeug aus, fasst es mit der ganzen Hand und betrachtet es von allen Seiten. Bald beginnt es, Dinge von einer Hand in die andere zu wechseln – eine Fähigkeit, die die meisten Kinder bis zum neunten Monat beherrschen.',
      'Viele Familien starten in diesen Wochen auch mit der Beikost. Der erste Löffel Brei ist ein schöner Meilenstein – egal, wie viel davon tatsächlich im Mund landet.',
    ],
    tips: [
      'Zwei Spielzeuge nacheinander anbieten und beobachten, wie dein Baby sie verteilt.',
      'Beikost in Ruhe und ohne Druck anbieten – Ablehnen gehört dazu.',
    ],
    sources: ['cdc6Months', 'gesundInsLeben'],
  },
  // Lebenswoche 22
  {
    title: 'Vertraute Gesichter',
    teaser:
      'Dein Baby unterscheidet immer deutlicher zwischen vertrauten und fremden Menschen und schaut sich gern im Spiegel an.',
    body: [
      'Etwa mit sechs Monaten erkennen die meisten Babys ihre Bezugspersonen sicher und freuen sich sichtbar, wenn sie sie sehen. Auf Fremde reagieren manche schon zurückhaltender. Das Spiegelbild finden viele faszinierend – auch wenn sie sich selbst darin noch nicht erkennen.',
      'Feste Bezugspersonen geben Sicherheit. Dazu gehören neben den Eltern auch andere Menschen, die regelmäßig da sind.',
    ],
    tips: [
      'Spiegelspiele: gemeinsam Grimassen ziehen und benennen, was zu sehen ist.',
      'Fotobücher mit Familiengesichtern anschauen.',
    ],
    sources: ['cdc6Months', 'kgiDevelopmentTasks'],
  },
  // Lebenswoche 23
  {
    title: 'Stark in Bauchlage',
    teaser:
      'In Bauchlage stützt sich dein Baby jetzt oft auf gestreckte Arme und dreht sich um die eigene Achse.',
    body: [
      'Viele Babys drücken sich in Bauchlage mit gestreckten Armen hoch, heben die Brust deutlich vom Boden und schauen sich um. Manche drehen sich im Kreis oder schieben sich ein Stück rückwärts – erste Versuche, sich fortzubewegen.',
      'Freie Bewegung auf dem Boden ist dafür das beste Training – besondere Hilfsmittel braucht es nicht.',
    ],
    tips: [
      'Spielzeug knapp außer Reichweite legen – ein Anreiz, sich zu strecken.',
      'Wippe und Babyschale nur kurz nutzen; Boden ist der beste Spielplatz.',
    ],
    sources: ['nhsBabyMoves', 'cdc6Months'],
  },
  // Lebenswoche 24
  {
    title: 'Sitzen mit Unterstützung',
    teaser:
      'Mit Unterstützung sitzt dein Baby immer stabiler. Ganz allein sitzen lernen Kinder irgendwann zwischen etwa 4 und 9 Monaten.',
    body: [
      'Viele Babys sitzen jetzt gern auf dem Schoß und halten sich dabei schon recht gut aufrecht. Manche stützen sich mit den Händen vorne ab, wenn man sie hinsetzt. Laut der WHO-Studie zur motorischen Entwicklung lernen fast alle gesunden Kinder das freie Sitzen irgendwann zwischen etwa 4 und 9 Monaten – eine große Spannbreite.',
      'Dein Baby braucht dafür kein Training: Es lernt das Sitzen am besten über Drehen, Stützen und Bewegen auf dem Boden. Langes Hinsetzen, bevor es das selbst kann, ist nicht nötig.',
    ],
    tips: [
      'Auf dem Schoß gemeinsam ein Buch anschauen – so übt es nebenbei die Haltung.',
      'Viel freie Bodenzeit statt langer Sitzphasen im Sitzsack oder Hochstuhl.',
    ],
    sources: ['whoMotorMilestones', 'cdc6Months'],
  },
  // Lebenswoche 25
  {
    title: 'Der erste Zahn?',
    teaser:
      'Bei vielen Babys kommt um den sechsten Monat herum der erste Zahn – bei manchen deutlich früher, bei anderen erst nach dem ersten Geburtstag.',
    body: [
      'Meist erscheinen zuerst die unteren mittleren Schneidezähne. Viele Babys sabbern dann mehr, kauen auf allem herum und sind etwas unruhiger. Hohes Fieber oder Durchfall sind dagegen keine typischen Zahnungszeichen und sollten ärztlich abgeklärt werden.',
      'Ab dem ersten Zahn wird geputzt: zweimal täglich mit einer reiskorngroßen Menge Kinderzahnpasta mit Fluorid. Seit einigen Jahren gibt es zudem zahnärztliche Früherkennungsuntersuchungen ab dem 6. Lebensmonat.',
    ],
    tips: [
      'Gekühlte (nicht gefrorene) Beißringe können beim Zahnen helfen.',
      'Zähneputzen spielerisch einführen: erst die Bürste erkunden lassen, dann nachputzen.',
    ],
    sources: ['kgiFirstYear', 'kgiHome'],
  },
  // Lebenswoche 26
  {
    title: 'Ein halbes Jahr',
    teaser:
      'Sechs Monate! Zeit für die U5 – und für einen Blick darauf, wie viel dein Baby schon kann.',
    body: [
      'Zwischen dem 6. und 7. Lebensmonat findet die U5 statt. Dabei geht es unter anderem um Bewegung, Sehen, Hören, die Ernährung und die Impfungen. Spätestens zu Beginn des 7. Monats sollte auch die Beikost begonnen haben.',
      'Im ersten halben Jahr hat dein Baby gelernt, Kontakt aufzunehmen, zu lachen, zu greifen, sich zu drehen und seine Stimme einzusetzen. Wie schnell welche Fähigkeit kommt, ist sehr individuell – entscheidend ist, dass sich dein Kind insgesamt weiterentwickelt.',
    ],
    tips: [
      'Termin für die U5 vereinbaren und das Untersuchungsheft mitnehmen.',
      'Im Haushalt nach Gefahrenquellen schauen – bald wird dein Baby mobil.',
    ],
    sources: ['kgiCheckups', 'gesundInsLeben', 'cdc6Months'],
  },
  // Lebenswoche 27
  {
    title: 'Ba-ba-ba: Silbenketten',
    teaser:
      'Viele Babys beginnen jetzt, Silben aneinanderzureihen: „ba-ba-ba“, „da-da-da“ oder „ma-ma-ma“.',
    body: [
      'Dieses sogenannte Silbenplappern (Lallen) beginnt meist zwischen dem sechsten und zehnten Monat. Die Silben haben noch keine Bedeutung – auch wenn „ma-ma“ oder „pa-pa“ verlockend klingen. Trotzdem ist das Plappern ein riesiger Schritt: Dein Baby übt die Laute seiner Muttersprache.',
      'Babys, die mehrsprachig aufwachsen, plappern genauso – Mehrsprachigkeit ist für die Sprachentwicklung kein Nachteil.',
    ],
    tips: [
      'Silben aufgreifen und variieren: „ba-ba – ja, Ball!“',
      'Bilderbücher mit einfachen, großen Bildern gemeinsam anschauen und benennen.',
    ],
    sources: ['cdc9Months', 'kgiFirstYear'],
  },
  // Lebenswoche 28
  {
    title: 'Guck-guck – da bist du ja!',
    teaser:
      'Dein Baby beginnt zu verstehen, dass Dinge und Menschen weiter existieren, auch wenn es sie gerade nicht sieht.',
    body: [
      'Fällt ein Spielzeug herunter, schaut dein Baby ihm jetzt nach oder sucht es. Fachleute nennen das Objektpermanenz. Deshalb werden Versteckspiele wie „Guck-guck“ jetzt besonders lustig – und deshalb fällt manchen Babys das Abschiednehmen schwerer, weil sie merken, dass jemand weg ist.',
      'Viele Babys lassen nun auch absichtlich Dinge fallen, um zu sehen, was passiert. Das ist Forschergeist, kein Ärgern.',
    ],
    tips: [
      'Spielzeug unter einem Tuch verstecken und gemeinsam wiederfinden.',
      'Guck-guck-Spiele mit Händen oder einem Tuch vor dem Gesicht.',
    ],
    sources: ['cdc9Months', 'kgiDevelopmentTasks'],
  },
  // Lebenswoche 29
  {
    title: 'Auf dem Weg zur Fortbewegung',
    teaser:
      'Rollen, Robben, im Kreis drehen: Viele Babys finden jetzt ihren ganz eigenen Weg, von A nach B zu kommen.',
    body: [
      'Bevor Babys krabbeln, probieren viele andere Arten der Fortbewegung aus: Sie rollen sich durchs Zimmer, ziehen sich auf dem Bauch mit den Armen vorwärts (Robben) oder schieben sich rückwärts. Manche Kinder lassen das Krabbeln ganz aus und rutschen später auf dem Po – auch das ist normal.',
      'Spätestens jetzt ist der richtige Zeitpunkt, die Wohnung kindersicher zu machen: Steckdosen, Kabel, Treppen, Putzmittel, Medikamente und kippelige Möbel.',
    ],
    tips: [
      'Einmal auf Babyhöhe durch die Wohnung krabbeln – so sieht man Gefahren am besten.',
      'Treppenschutzgitter oben und unten anbringen.',
    ],
    sources: ['nhsBabyMoves', 'whoMotorMilestones'],
  },
  // Lebenswoche 30
  {
    title: 'Allein sitzen',
    teaser:
      'Viele Babys sitzen jetzt eine Weile ohne Stütze und haben dabei die Hände frei zum Spielen.',
    body: [
      'Freies Sitzen eröffnet eine neue Perspektive: Dein Baby hat beide Hände frei, kann sich umschauen und mit Dingen hantieren. Bis zum neunten Monat sitzen die meisten Kinder sicher ohne Unterstützung, viele kommen auch selbstständig in den Sitz.',
      'Wenn dein Baby noch nicht allein sitzt, ist das in diesem Alter kein Grund zur Sorge. Die WHO-Daten zeigen eine Spannbreite bis etwa neun Monate.',
    ],
    tips: [
      'Anfangs Kissen rundherum legen, falls es zur Seite kippt.',
      'Spielzeug zum Ausräumen anbieten: eine Kiste mit Löffeln, Bechern, Tüchern.',
    ],
    sources: ['whoMotorMilestones', 'cdc9Months'],
  },
  // Lebenswoche 31
  {
    title: 'Mitessen am Familientisch',
    teaser:
      'Dein Baby interessiert sich sehr für das, was die anderen essen, und möchte selbst zugreifen.',
    body: [
      'Neben dem Brei können weiche, gut greifbare Stücke angeboten werden, z. B. gedünstetes Gemüse oder weiches Obst. Viele Babys essen gern selbst mit den Fingern und lernen dabei, zu kauen und Stückchen im Mund zu bewegen. Aus einem offenen Becher kann es mit deiner Hilfe erste Schlucke Wasser trinken.',
      'Würgen gehört beim Essenlernen dazu und ist ein Schutzreflex. Kleine, harte Lebensmittel wie ganze Nüsse oder rohe Karottenstücke sind wegen Verschluckungsgefahr aber tabu.',
    ],
    tips: [
      'Immer aufrecht sitzend und unter Aufsicht essen lassen.',
      'Gemeinsame Mahlzeiten: Dein Baby lernt viel durch Zuschauen.',
    ],
    sources: ['gesundInsLeben', 'cdc9Months'],
  },
  // Lebenswoche 32
  {
    title: 'Fremdeln',
    teaser:
      'Plötzlich weint dein Baby bei Menschen, die es eigentlich kennt? Fremdeln ist um diese Zeit typisch – und ein gutes Zeichen.',
    body: [
      'Viele Babys werden zwischen dem sechsten und neunten Monat schüchtern oder ängstlich gegenüber Fremden. Das zeigt, dass dein Baby inzwischen genau zwischen vertrauten und unbekannten Menschen unterscheiden kann und eine enge Bindung zu seinen Bezugspersonen aufgebaut hat.',
      'Wie stark Kinder fremdeln, ist sehr unterschiedlich. Druck hilft nicht – Zeit und eine sichere Basis schon.',
    ],
    tips: [
      'Besuch erst aus sicherer Entfernung (auf deinem Arm) kennenlernen lassen.',
      'Verwandte bitten, sich langsam zu nähern statt das Baby direkt zu nehmen.',
    ],
    sources: ['cdc9Months', 'kgiDevelopmentTasks'],
  },
  // Lebenswoche 33
  {
    title: 'Abschiede üben',
    teaser:
      'Dein Baby merkt, wenn du gehst, und protestiert. Kurze, verlässliche Abschiede helfen ihm, Vertrauen zu fassen.',
    body: [
      'Weil dein Baby jetzt versteht, dass du auch existierst, wenn es dich nicht sieht, fällt ihm das Getrenntsein oft schwer. Die Trennungsangst ist in diesem Alter normal und zeigt eine sichere Bindung.',
      'Heimliches Verschwinden verunsichert eher. Besser ist ein kurzes, liebevolles Abschiedsritual – und dann auch wirklich gehen. Die Erfahrung „Mama/Papa kommt wieder“ ist der beste Schutz gegen Trennungsangst.',
    ],
    tips: [
      'Immer Bescheid sagen, wenn du gehst – auch wenn es nur in die Küche ist.',
      'Ein vertrautes Kuscheltuch kann beim Übergang helfen (im Bett erst ab dem 1. Geburtstag).',
    ],
    sources: ['cdc9Months', 'elternsein'],
  },
  // Lebenswoche 34
  {
    title: 'Krabbeln',
    teaser:
      'Auf Händen und Knien geht es los: Viele Babys krabbeln jetzt – andere robben, rutschen oder überspringen das Krabbeln ganz.',
    body: [
      'Laut der WHO-Studie lernen die meisten Kinder das Krabbeln auf Händen und Knien zwischen etwa 5 und 13,5 Monaten. Ein kleiner Teil der Kinder krabbelt gar nicht und kommt auf anderen Wegen zum Laufen. Wichtig ist, dass sich dein Baby überhaupt immer besser fortbewegt.',
      'Mit dem Krabbeln wächst der Radius – und damit die Neugier auf Schubladen, Schränke und alles, was am Boden liegt.',
    ],
    tips: [
      'Hindernisparcours aus Kissen und Decken bauen.',
      'Untere Schubladen mit sicheren Dingen füllen, gefährliche Dinge nach oben räumen.',
    ],
    sources: ['whoMotorMilestones', 'nhsBabyMoves'],
  },
  // Lebenswoche 35
  {
    title: 'Schlaf im Wandel',
    teaser:
      'Viele Babys wachen nachts wieder öfter auf, obwohl es schon besser lief. Neue Fähigkeiten und Trennungsangst können dahinterstecken.',
    body: [
      'Rund um den achten bis zehnten Monat berichten viele Eltern von unruhigeren Nächten. Babys üben im Schlaf manchmal ihre neuen Fähigkeiten, wachen auf und wollen sich vergewissern, dass jemand da ist. Meist sind solche Phasen vorübergehend.',
      'Ein vorhersehbarer Abend mit festen Ritualen und ein ähnlicher Schlafzeitpunkt geben Orientierung. Tagsüber schlafen die meisten Babys jetzt noch zweimal.',
    ],
    tips: [
      'Abendroutine kurz und gleich halten: z. B. Essen, Waschen, Schlafsack, Lied.',
      'Nächtliches Aufwachen ruhig und unaufgeregt begleiten.',
    ],
    sources: ['kgiSleepProblems', 'kgiBabySleep'],
  },
  // Lebenswoche 36
  {
    title: 'Hochziehen zum Stehen',
    teaser:
      'Dein Baby zieht sich an Möbeln oder an deinen Beinen hoch und steht – noch mit festem Halt.',
    body: [
      'Viele Babys ziehen sich jetzt an allem hoch, was Halt bietet: Sofa, Gitterstäbe, Couchtisch. Anfangs wissen sie oft noch nicht, wie sie wieder herunterkommen – und rufen um Hilfe. Bis zum ersten Geburtstag ziehen sich die meisten Kinder zum Stehen hoch.',
      'Kippelige Möbel und Regale sollten jetzt an der Wand befestigt sein, Tischdecken sind eine unterschätzte Gefahr.',
    ],
    tips: [
      'Hinsetzen üben: Dein Baby beim Herunterkommen sanft in die Knie führen.',
      'Regale und Kommoden an der Wand sichern.',
    ],
    sources: ['whoMotorMilestones', 'cdc1Year'],
  },
  // Lebenswoche 37
  {
    title: 'Der Pinzettengriff',
    teaser:
      'Kleine Krümel werden jetzt mit Daumen und Zeigefinger aufgepickt – der feine Pinzettengriff entwickelt sich.',
    body: [
      'Bisher hat dein Baby mit der ganzen Hand zugegriffen oder mit den Fingern „gerecht“. Nun werden die Bewegungen feiner: Daumen und Zeigefinger arbeiten zusammen. Bis zum ersten Geburtstag können die meisten Kinder kleine Dinge mit diesem Griff aufheben.',
      'Das macht Fingerfood besonders spannend – und Kleinteile auf dem Boden besonders gefährlich.',
    ],
    tips: [
      'Weiche Erbsen, Haferflocken oder kleine Stücke Banane zum Üben anbieten.',
      'Boden regelmäßig nach Münzen, Knopfbatterien und Kleinteilen absuchen.',
    ],
    sources: ['cdc1Year', 'kgiFirstYear'],
  },
  // Lebenswoche 38
  {
    title: 'Gesten sagen viel',
    teaser:
      'Arme hoch heißt „Nimm mich hoch!“: Dein Baby nutzt immer mehr Gesten, um sich mitzuteilen.',
    body: [
      'Lange bevor die ersten Wörter kommen, verständigen sich Babys mit dem Körper: Sie strecken die Arme aus, um hochgenommen zu werden, schieben Dinge weg, die sie nicht wollen, und beginnen, auf Dinge zu zeigen. Gesten sind ein wichtiger Vorläufer der Sprache.',
      'Wenn du die Geste in Worte übersetzt („Du willst hoch? Komm her!“), hilft das deinem Baby, Gesten und Wörter zu verknüpfen.',
    ],
    tips: [
      'Gesten aufgreifen und mit Worten begleiten.',
      'Einfache Gesten vormachen: Winken, Nicken, Kopfschütteln.',
    ],
    sources: ['cdc9Months', 'kgiFirstYear'],
  },
  // Lebenswoche 39
  {
    title: 'Den eigenen Namen kennen',
    teaser:
      'Dein Baby schaut auf, wenn du seinen Namen sagst, und versteht immer mehr, was du sagst.',
    body: [
      'Das Sprachverständnis läuft dem Sprechen weit voraus. Die meisten Babys reagieren um den neunten Monat auf ihren Namen, verstehen bekannte Wörter wie „Flasche“ oder „Papa“ und bald auch ein „Nein“ – auch wenn sie sich noch nicht daran halten.',
      'Viel Sprache im Alltag, Benennen und Bilderbücher sind jetzt das beste Futter für die Sprachentwicklung.',
    ],
    tips: [
      'Gegenstände beim Namen nennen, während dein Baby sie anschaut.',
      'Kurze, klare Sätze verwenden und viel wiederholen.',
    ],
    sources: ['cdc9Months', 'cdc1Year'],
  },
  // Lebenswoche 40
  {
    title: 'An Möbeln entlang',
    teaser:
      'Am Sofa entlang seitwärts: Viele Babys gehen jetzt ihre ersten Schritte mit Festhalten.',
    body: [
      'Das Gehen mit Festhalten („Küstenschifffahrt“) ist für viele Kinder die letzte Etappe vor dem freien Laufen. Laut WHO-Daten beginnen Kinder damit irgendwann zwischen etwa 6 und 14 Monaten. Dein Baby übt dabei Gleichgewicht, Gewichtsverlagerung und Mut.',
      'Barfuß oder mit rutschfesten Socken spürt dein Baby den Boden am besten. Lauflernhilfen mit Rädern sind wegen Unfallgefahr nicht zu empfehlen.',
    ],
    tips: [
      'Möbel so stellen, dass dein Baby von einem zum nächsten „hangeln“ kann.',
      'Drinnen barfuß – Schuhe braucht es erst draußen.',
    ],
    sources: ['whoMotorMilestones', 'cdc1Year'],
  },
  // Lebenswoche 41
  {
    title: 'Winken und Klatschen',
    teaser:
      'Dein Baby macht nach, was es sieht: Winke-winke, In-die-Hände-Klatschen und andere kleine Gesten.',
    body: [
      'Nachahmung ist eine der wichtigsten Lernstrategien von Kleinkindern. Viele Babys winken jetzt zum Abschied, klatschen in die Hände oder spielen „Backe, backe Kuchen“ mit. Sie genießen es, wenn ein Spiel immer gleich abläuft und sie wissen, was als Nächstes kommt.',
      'Bis zum ersten Geburtstag winken die meisten Kinder zum Abschied.',
    ],
    tips: [
      'Klatsch- und Fingerspiele immer wieder gleich spielen.',
      'Beim Abschied gemeinsam winken – auch dem Bus oder dem Mond.',
    ],
    sources: ['cdc1Year', 'kgiFirstYear'],
  },
  // Lebenswoche 42
  {
    title: 'Einräumen, ausräumen, klopfen',
    teaser:
      'Dein Baby schlägt zwei Klötze aneinander, räumt Dosen aus und wieder ein – und entdeckt Ursache und Wirkung.',
    body: [
      'Was passiert, wenn ich das hier fallen lasse, dagegenschlage oder hineinlege? Babys in diesem Alter sind kleine Forscher. Sie schlagen Gegenstände zusammen, legen Dinge in Behälter und holen sie wieder heraus. Dabei lernen sie viel über Größen, Geräusche und Abläufe.',
      'Für dieses Spiel braucht es kein teures Spielzeug: Töpfe, Holzlöffel und Plastikdosen sind ideal.',
    ],
    tips: [
      'Eine „Schatzkiste“ mit sicheren Alltagsgegenständen zusammenstellen.',
      'Einen Karton mit Loch für Bälle oder Bauklötze basteln.',
    ],
    sources: ['cdc9Months', 'cdc1Year'],
  },
  // Lebenswoche 43
  {
    title: 'Bald steht die U6 an',
    teaser:
      'Zwischen dem 10. und 12. Lebensmonat findet die U6 statt. Jetzt ist ein guter Zeitpunkt, den Termin zu vereinbaren.',
    body: [
      'Bei der U6 schaut die Kinderarztpraxis unter anderem, wie sich dein Kind bewegt, ob es sitzt, krabbelt oder sich hochzieht, wie es greift, sieht, hört und mit anderen in Kontakt tritt. Auch Ernährung, Zähne, Unfallverhütung und der Impfstatus sind Thema.',
      'Im Umfeld des ersten Geburtstags stehen laut STIKO-Impfkalender auch wieder Impfungen an. Die Praxis sagt dir, welche das sind.',
    ],
    tips: [
      'Termin rechtzeitig vereinbaren – viele Praxen sind Wochen im Voraus ausgebucht.',
      'Notieren, was dir in letzter Zeit aufgefallen ist, auch Kleinigkeiten.',
    ],
    sources: ['kgiCheckups', 'rkiVaccinationSchedule'],
  },
  // Lebenswoche 44
  {
    title: 'Das erste Wort?',
    teaser:
      'Manche Kinder sagen jetzt ihr erstes Wort – oft „Mama“, „Papa“ oder ein eigener Name für etwas Wichtiges.',
    body: [
      'Ein „erstes Wort“ ist ein Laut, den dein Kind gezielt für eine bestimmte Person oder Sache verwendet – auch wenn es anders klingt als in der Erwachsenensprache („Wauwau“ für Hund). Viele Kinder sagen ihr erstes Wort um den ersten Geburtstag herum, die Spannbreite reicht aber von etwa zehn bis über fünfzehn Monate.',
      'Wie viel dein Kind versteht, ist in diesem Alter aussagekräftiger als die Zahl der Wörter.',
    ],
    tips: [
      'Wörter deines Kindes aufgreifen und korrekt wiederholen, ohne zu verbessern: „Wauwau – ja, ein Hund!“',
      'Das erste Wort als Meilenstein festhalten – inklusive der Bedeutung.',
    ],
    sources: ['cdc1Year', 'kgiFirstYear'],
  },
  // Lebenswoche 45
  {
    title: 'Auf dem Weg zum Familienessen',
    teaser:
      'Gegen Ende des ersten Jahres kann dein Kind nach und nach am Familienessen teilnehmen.',
    body: [
      'Im Laufe des 10. bis 12. Monats gehen viele Kinder vom Brei zu fein zerkleinertem Familienessen über. Gewürzt wird dabei sparsam, Salz und Zucker sind für Kleinkinder nur in kleinen Mengen geeignet. Getrunken wird am besten Wasser aus dem Becher oder Glas.',
      'Selbst essen mit den Fingern und erste Versuche mit dem Löffel sind wichtig für die Entwicklung – auch wenn es dabei kleckert.',
    ],
    tips: [
      'Für dein Kind einen Teil vor dem Würzen abnehmen.',
      'Becher statt Flasche für Wasser anbieten.',
    ],
    sources: ['gesundInsLeben', 'cdc1Year'],
  },
  // Lebenswoche 46
  {
    title: 'Kurz frei stehen',
    teaser:
      'Für einen Augenblick lässt dein Kind los und steht ganz allein – oft unbemerkt, weil es gerade mit etwas anderem beschäftigt ist.',
    body: [
      'Freies Stehen erfordert viel Gleichgewicht. Viele Kinder stehen erst für Sekunden allein, bevor sie sich wieder festhalten oder auf den Po plumpsen. Die WHO-Daten zeigen dafür eine große Spannbreite von etwa 7 bis 17 Monaten.',
      'Hinfallen gehört dazu: Ein Plumps auf den gepolsterten Po ist meist harmlos und Teil des Lernens.',
    ],
    tips: [
      'Ermutigen statt an den Händen „lauffertig“ ziehen.',
      'Eine sichere Umgebung mit weichen Kanten schaffen.',
    ],
    sources: ['whoMotorMilestones', 'nhsBabyMoves'],
  },
  // Lebenswoche 47
  {
    title: 'Gemeinsam schauen',
    teaser:
      'Dein Kind folgt deinem Blick und deinem Zeigefinger – und zeigt dir bald selbst, was es spannend findet.',
    body: [
      'Gemeinsame Aufmerksamkeit – wenn ihr beide auf dasselbe schaut und euch darüber austauscht – ist ein Grundstein für Sprache und soziales Lernen. Viele Kinder folgen jetzt deinem Zeigen und schauen zwischen dir und dem Gegenstand hin und her.',
      'Bilderbücher sind dafür ideal: Gemeinsam auf Bilder zeigen, benennen, Geräusche machen.',
    ],
    tips: [
      'Täglich eine kleine Bilderbuchzeit einplanen.',
      'Auf Dinge zeigen und benennen: „Schau, ein Vogel!“',
    ],
    sources: ['cdc1Year', 'cdc15Months'],
  },
  // Lebenswoche 48
  {
    title: 'Ein eigener Wille',
    teaser:
      'Dein Kind weiß immer genauer, was es will – und was nicht. Frust und Protest gehören jetzt dazu.',
    body: [
      'Je mehr dein Kind kann und versteht, desto klarer werden seine Wünsche. Wenn etwas nicht klappt oder verboten wird, reagieren viele mit lautem Protest. Kleinkinder können ihre Gefühle noch nicht selbst regulieren – dafür brauchen sie dich.',
      'Gefühle zu benennen („Du bist wütend, weil du den Löffel willst“) hilft deinem Kind, sie mit der Zeit zu verstehen.',
    ],
    tips: [
      'Gefahren wegräumen statt ständig „Nein“ sagen zu müssen.',
      'Ablenkung und Alternativen anbieten: „Den Löffel nicht, aber diesen Becher.“',
    ],
    sources: ['elternsein', 'cdc1Year'],
  },
  // Lebenswoche 49
  {
    title: 'Die ersten freien Schritte',
    teaser:
      'Manche Kinder machen jetzt ihre ersten freien Schritte. Andere lassen sich damit noch viele Monate Zeit – beides ist normal.',
    body: [
      'Das freie Laufen hat die größte Spannbreite aller motorischen Meilensteine: Laut WHO-Studie lernen gesunde Kinder es irgendwann zwischen etwa 8 und 18 Monaten. Ob dein Kind früh oder spät läuft, sagt nichts über seine spätere Geschicklichkeit oder Intelligenz aus.',
      'Die ersten Schritte sind breitbeinig, mit erhobenen Armen und vielen Stürzen. Das Gleichgewicht verbessert sich mit jedem Versuch.',
    ],
    tips: [
      'Barfuß üben lassen – das stärkt die Fußmuskulatur.',
      'Wenn es so weit ist: die ersten Schritte als Meilenstein (gern mit Video) festhalten.',
    ],
    sources: ['whoMotorMilestones', 'cdc15Months'],
  },
  // Lebenswoche 50
  {
    title: 'So wird das gemacht',
    teaser:
      'Dein Kind benutzt Alltagsgegenstände „richtig“: Es hält das Telefon ans Ohr, kämmt sich oder rührt im Topf.',
    body: [
      'Kinder beobachten genau, was die Großen mit Dingen machen, und ahmen es nach. Zum ersten Geburtstag hin probieren viele aus, wie Löffel, Becher, Bürste oder Telefon benutzt werden. Das ist der Anfang des Symbolspiels, das im zweiten Lebensjahr aufblüht.',
      'Auch im Haushalt möchte dein Kind jetzt „mithelfen“ – eine gute Gelegenheit für gemeinsame Zeit.',
    ],
    tips: [
      'Spielzeug-Alltagsgegenstände oder echte, sichere Dinge (Holzlöffel, Topf) anbieten.',
      'Beim Aufräumen oder Wäsche sortieren mitmachen lassen.',
    ],
    sources: ['cdc15Months', 'cdc1Year'],
  },
  // Lebenswoche 51
  {
    title: 'Rituale geben Halt',
    teaser:
      'Feste Abläufe beim Essen, Schlafen und Verabschieden geben deinem Kind Sicherheit in einer Welt voller neuer Eindrücke.',
    body: [
      'Kleinkinder lieben Wiederholung. Wenn Dinge in gewohnter Reihenfolge passieren, können sie sich darauf einstellen – das macht Übergänge wie das Zubettgehen oder einen Abschied leichter.',
      'Viele Kinder schlafen um den ersten Geburtstag noch zweimal am Tag, manche stellen im Laufe des zweiten Lebensjahres auf einen Mittagsschlaf um. Der Schlafbedarf ist individuell.',
    ],
    tips: [
      'Ein festes Zubettgeh-Ritual mit gleichen Schritten in gleicher Reihenfolge.',
      'Abschiede kurz, liebevoll und immer gleich gestalten.',
    ],
    sources: ['kgiBabySleep', 'elternsein'],
  },
  // Lebenswoche 52
  {
    title: 'Ein ganzes Jahr',
    teaser:
      'Bald ist der erste Geburtstag! Aus dem Neugeborenen ist ein kleiner Mensch mit eigenem Kopf geworden.',
    body: [
      'Im ersten Jahr hat dein Kind gelernt, Kontakt aufzunehmen, zu lachen, zu greifen, sich zu drehen, zu sitzen und sich fortzubewegen, Gesten zu nutzen und vieles zu verstehen. Manche Kinder laufen schon, andere krabbeln noch begeistert – beides passt in diesem Alter.',
      'Ab dem ersten Geburtstag wechselt dieser Entwicklungskalender von Wochen zu Monaten: Die Entwicklung verläuft jetzt in größeren Schritten, und monatsgenaue Beschreibungen sind aussagekräftiger. Falls noch nicht geschehen, steht in diesen Wochen die U6 an.',
    ],
    tips: [
      'Ein Jahresrückblick mit Fotos – die Meilensteine-Zeitleiste in der App hilft dabei.',
      'Das Untersuchungsheft prüfen: Ist die U6 schon erledigt?',
    ],
    sources: ['kgiFirstYear', 'kgiCheckups', 'cdc1Year'],
  },
];

const months: readonly DevelopmentEntry[] = [
  // Lebensmonat 13
  {
    title: 'Laufen lernen im eigenen Tempo',
    teaser:
      'Ob dein Kind schon läuft oder noch krabbelt: Im zweiten Lebensjahr wird es immer mobiler – jedes Kind in seinem Tempo.',
    body: [
      'Viele Kinder machen rund um den ersten Geburtstag ihre ersten freien Schritte, viele aber auch erst einige Monate später. Laut WHO liegt die Spannbreite für das freie Laufen bei etwa 8 bis 18 Monaten. Läuft dein Kind mit 18 Monaten noch nicht frei, sprich mit der Kinderarztpraxis.',
      'Für das Laufenlernen draußen braucht dein Kind leichte, flexible Schuhe mit genug Platz für die Zehen. Drinnen ist barfuß am besten.',
    ],
    tips: [
      'Draußen unebenes Gelände wie Wiese oder Waldboden zum Üben nutzen.',
      'Schuhgröße regelmäßig kontrollieren – Kinderfüße wachsen schnell.',
    ],
    sources: ['whoMotorMilestones', 'cdc15Months'],
  },
  // Lebensmonat 14
  {
    title: 'Verstehen kommt vor dem Sprechen',
    teaser:
      'Dein Kind versteht viel mehr, als es sagen kann. Es schaut auf bekannte Dinge, wenn du sie benennst.',
    body: [
      'Mit etwa 15 Monaten sagen die meisten Kinder ein oder zwei Wörter neben „Mama“ und „Papa“. Sie verstehen aber schon viel mehr: Bekannte Gegenstände suchen sie mit dem Blick, wenn du sie benennst, und einfache Aufforderungen mit Geste („Gib mir den Ball“) setzen sie um.',
      'Die Zahl der gesprochenen Wörter ist in diesem Alter noch sehr unterschiedlich.',
    ],
    tips: [
      'Spiel: „Wo ist der Ball?“ – und gemeinsam suchen.',
      'Einfache Aufforderungen mit einer Geste unterstützen.',
    ],
    sources: ['cdc15Months', 'kgiHome'],
  },
  // Lebensmonat 15
  {
    title: 'Zeigen, um etwas zu bekommen',
    teaser:
      'Dein Kind zeigt mit dem Finger auf das, was es haben möchte – und zeigt dir stolz, was es gefunden hat.',
    body: [
      'Um 15 Monate herum zeigen die meisten Kinder auf Dinge, die sie haben wollen, bringen dir Gegenstände, um sie dir zu zeigen, klatschen vor Freude und stapeln zwei kleine Dinge aufeinander. Viele machen auch schon ein paar Schritte allein.',
      'Laut STIKO-Impfkalender stehen im zweiten Lebensjahr weitere Impftermine an. Ein Blick in den Impfpass lohnt sich.',
    ],
    tips: [
      'Auf das Zeigen reagieren und in Worte fassen: „Du möchtest die Banane.“',
      'Bauklötze zum Stapeln und Umwerfen anbieten.',
    ],
    sources: ['cdc15Months', 'rkiVaccinationSchedule'],
  },
  // Lebensmonat 16
  {
    title: 'Nachmachen und So-tun-als-ob',
    teaser:
      'Dein Kind ahmt dich bei alltäglichen Tätigkeiten nach: fegen, telefonieren, kochen. Das Symbolspiel beginnt.',
    body: [
      'Kinder lernen im zweiten Lebensjahr enorm viel durch Nachahmung. Sie wollen mit dem Besen fegen, der Puppe zu trinken geben oder mit dem Holzlöffel im Topf rühren. Dieses „So-tun-als-ob“ ist ein wichtiger Schritt für Denken, Sprache und Fantasie.',
      'Einfache Spielsachen, die dem echten Leben ähneln, sind jetzt oft beliebter als blinkende Elektronik.',
    ],
    tips: [
      'Puppe, Teddy, Spielküche oder einfach echte, sichere Haushaltsgegenstände anbieten.',
      'Beim Spielen mitmachen: „Hat der Teddy Hunger?“',
    ],
    sources: ['cdc18Months', 'kgiHome'],
  },
  // Lebensmonat 17
  {
    title: 'Selbst essen und trinken',
    teaser:
      'Dein Kind möchte selbst mit dem Löffel essen und aus dem offenen Becher trinken – Kleckern inklusive.',
    body: [
      'Bis etwa 18 Monate essen die meisten Kinder selbstständig mit den Fingern, versuchen es mit dem Löffel und trinken aus einem Becher ohne Deckel – auch wenn noch einiges danebengeht. Selbstständigkeit beim Essen stärkt die Feinmotorik und das Selbstvertrauen.',
      'Kleinkinder sollen selbst bestimmen dürfen, wie viel sie essen. Die Eltern bestimmen, was und wann angeboten wird.',
    ],
    tips: [
      'Lätzchen, abwaschbare Unterlage – und Gelassenheit.',
      'Wasser im offenen Becher statt Saft in der Flasche anbieten.',
    ],
    sources: ['cdc18Months', 'gesundInsLeben'],
  },
  // Lebensmonat 18
  {
    title: 'Anderthalb Jahre',
    teaser:
      'Dein Kind läuft, kritzelt, klettert aufs Sofa und folgt einfachen Bitten – auch ganz ohne Gesten.',
    body: [
      'Mit etwa 18 Monaten laufen die meisten Kinder frei, klettern auf Stühle und Sofas und wieder herunter, kritzeln mit Stiften und sagen mindestens drei Wörter neben „Mama“ und „Papa“. Sie folgen einfachen Aufforderungen wie „Gib mir das“ und zeigen dir, was sie interessant finden.',
      'Wenn dein Kind mit 18 Monaten noch nicht frei läuft, kaum Wörter benutzt oder nicht auf Dinge zeigt, sprich das in der Kinderarztpraxis an – meist gibt es eine harmlose Erklärung, aber früh hinzuschauen lohnt sich.',
    ],
    tips: [
      'Dicke Wachsmalstifte und großes Papier zum Kritzeln anbieten.',
      'Kletterpartien absichern statt verbieten: Polster, Hilfe beim Runterkommen.',
    ],
    sources: ['cdc18Months', 'whoMotorMilestones'],
  },
  // Lebensmonat 19
  {
    title: 'Hoch hinaus: Treppen',
    teaser:
      'Treppen sind jetzt besonders spannend. Mit Hilfe oder am Geländer schafft dein Kind schon einige Stufen.',
    body: [
      'Viele Kinder krabbeln Treppen hinauf, bevor sie aufrecht gehen können. Im Laufe des zweiten Lebensjahres gehen die meisten einige Stufen aufrecht hinauf, mit Hilfe oder am Geländer. Herunter ist schwieriger – am sichersten rückwärts krabbelnd.',
      'Treppenschutzgitter bleiben wichtig, solange dein Kind Treppen nicht sicher beherrscht.',
    ],
    tips: [
      'Rückwärts-Runterkrabbeln gemeinsam üben.',
      'Treppen nur unter Aufsicht – Gitter weiter nutzen.',
    ],
    sources: ['cdc2Years', 'kgiHome'],
  },
  // Lebensmonat 20
  {
    title: 'Ich will selbst! Die Autonomiephase',
    teaser:
      'Dein Kind entdeckt seinen eigenen Willen – und starke Gefühle. Wutanfälle sind jetzt häufig und völlig normal.',
    body: [
      'Ab etwa der Mitte des zweiten Lebensjahres beginnt bei vielen Kindern eine Phase, die oft „Trotzphase“ genannt wird – Fachleute sprechen lieber von Autonomiephase. Dein Kind will Dinge selbst tun, kann aber noch vieles nicht, und es kann starke Gefühle noch nicht regulieren. Das führt zu Wut, Tränen und Sich-auf-den-Boden-Werfen.',
      'Wutanfälle sind kein Zeichen schlechter Erziehung. Dein Kind braucht jetzt eine ruhige Begleitung, klare Grenzen und das Gefühl, trotzdem geliebt zu werden.',
    ],
    tips: [
      'Ruhig bleiben, da sein und den Sturm abwarten – Erklärungen helfen erst danach.',
      'Kleine Wahlmöglichkeiten geben: „Rote oder blaue Jacke?“',
      'Wenn es dir zu viel wird: Unterstützung bei Elternberatung oder Frühen Hilfen suchen.',
    ],
    sources: ['elternsein', 'kgiHome'],
  },
  // Lebensmonat 21
  {
    title: 'Zeit für die U7',
    teaser:
      'Zwischen dem 21. und 24. Lebensmonat steht die U7 an – mit besonderem Blick auf Bewegung und Sprache.',
    body: [
      'Bei der U7 schaut die Kinderarztpraxis unter anderem, wie dein Kind läuft und klettert, wie es mit den Händen umgeht, wie es spricht und versteht und wie es mit anderen Menschen in Kontakt tritt. Auch Zähne, Ernährung, Schlaf und Unfallschutz sind Themen.',
      'Viele Eltern beschäftigt jetzt die Sprachentwicklung. Die U7 ist der richtige Ort, um Fragen dazu zu stellen.',
    ],
    tips: [
      'Termin für die U7 rechtzeitig vereinbaren.',
      'Vorher notieren, welche Wörter dein Kind schon sagt – das hilft im Gespräch.',
    ],
    sources: ['kgiCheckups', 'bmgCheckups'],
  },
  // Lebensmonat 22
  {
    title: 'Der Wortschatz wächst',
    teaser:
      'Viele Kinder lernen jetzt fast täglich neue Wörter und zeigen auf Körperteile, wenn du danach fragst.',
    body: [
      'Zwischen anderthalb und zwei Jahren erleben viele Kinder einen „Wortschatzspurt“: Neue Wörter kommen plötzlich sehr schnell dazu. Auf Nachfrage zeigen die meisten auf mindestens zwei Körperteile und auf Dinge in einem Bilderbuch.',
      'Kinder lernen Sprache am besten im echten Gespräch – beim Spielen, Essen, Anziehen und Vorlesen. Bildschirmmedien können das nicht ersetzen.',
    ],
    tips: [
      'Körperteile-Spiele: „Wo ist deine Nase?“',
      'Täglich vorlesen und über die Bilder sprechen.',
    ],
    sources: ['cdc2Years', 'kgiHome'],
  },
  // Lebensmonat 23
  {
    title: 'Rennen und Kicken',
    teaser:
      'Dein Kind wird immer sicherer auf den Beinen: Es rennt, kickt gegen einen Ball und trägt dabei Dinge herum.',
    body: [
      'Bis zum zweiten Geburtstag rennen die meisten Kinder, kicken einen Ball und gehen ein paar Stufen hinauf. Sie können etwas in einer Hand halten, während die andere etwas anderes tut, und probieren Schalter, Knöpfe und Drehknäufe aus.',
      'Kleinkinder brauchen viel Bewegung: Die WHO empfiehlt für Ein- bis Zweijährige mindestens drei Stunden Bewegung jeder Art, über den Tag verteilt.',
    ],
    tips: [
      'Jeden Tag draußen toben – Spielplatz, Wiese, Wald.',
      'Bälle in verschiedenen Größen zum Kicken und Werfen anbieten.',
    ],
    sources: ['cdc2Years', 'kgiHome'],
  },
  // Lebensmonat 24
  {
    title: 'Zwei Jahre: Die ersten kleinen Sätze',
    teaser:
      'Viele Kinder verbinden jetzt zwei Wörter zu kleinen Sätzen wie „mehr Milch“ oder „Papa weg“.',
    body: [
      'Um den zweiten Geburtstag sagen die meisten Kinder mindestens zwei Wörter zusammen und benutzen eine Vielzahl von Wörtern. Sie nutzen auch mehr Gesten als nur Winken und Zeigen, zum Beispiel Nicken oder Kusshand.',
      'Spricht dein Kind mit zwei Jahren weniger als etwa 50 Wörter oder bildet noch keine Zwei-Wort-Verbindungen, sprich die Kinderarztpraxis darauf an. Viele dieser „Late Talker“ holen auf, aber eine frühe Einschätzung hilft, die anderen gezielt zu unterstützen.',
    ],
    tips: [
      'Zwei-Wort-Sätze aufgreifen und erweitern: „Mehr Milch? Du möchtest noch mehr Milch.“',
      'Den ersten kleinen Satz als Meilenstein notieren.',
    ],
    sources: ['cdc2Years', 'kgiCheckups'],
  },
  // Lebensmonat 25
  {
    title: 'Nebeneinander spielen',
    teaser:
      'Andere Kinder werden spannend. Meist spielen Zweijährige aber noch nebeneinander statt miteinander.',
    body: [
      'Kinder in diesem Alter beobachten andere Kinder genau und spielen gern in ihrer Nähe – oft mit ähnlichen Sachen, aber jeder für sich. Fachleute nennen das Parallelspiel. Nach und nach entstehen daraus kurze gemeinsame Spielmomente.',
      'Teilen fällt noch schwer, weil Kleinkinder sich noch kaum in andere hineinversetzen können. Das kommt mit der Zeit.',
    ],
    tips: [
      'Spielverabredungen mit anderen Kindern – genug Spielzeug für alle mitnehmen.',
      'Streit um Spielzeug ruhig begleiten statt Teilen zu erzwingen.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Lebensmonat 26
  {
    title: 'Geschickte Hände',
    teaser:
      'Deckel aufdrehen, Seiten einzeln umblättern, Türme bauen: Die Feinmotorik macht große Fortschritte.',
    body: [
      'Die Hände werden immer geschickter: Viele Kinder drehen jetzt Deckel und Türklinken, blättern Buchseiten einzeln um und bauen höhere Türme. Bis 30 Monate können die meisten Kinder mit den Händen drehen und schrauben.',
      'Malen, Kneten, Steckspiele und Puzzles mit großen Teilen fördern diese Fähigkeiten spielerisch.',
    ],
    tips: [
      'Dosen mit Schraubdeckel (mit etwas Spannendem darin) zum Öffnen anbieten.',
      'Gemeinsam Bücher mit festen Seiten anschauen und dein Kind umblättern lassen.',
    ],
    sources: ['cdc30Months', 'cdc2Years'],
  },
  // Lebensmonat 27
  {
    title: 'Windeln ade? Ohne Druck',
    teaser:
      'Manche Kinder zeigen jetzt Interesse an Töpfchen und Toilette. Der richtige Zeitpunkt ist sehr individuell.',
    body: [
      'Sauber werden ist ein Reifungsprozess: Das Kind muss Blase und Darm spüren und kontrollieren können. Die meisten Kinder werden tagsüber irgendwann zwischen zwei und vier Jahren trocken, nachts oft später. Training vor der Reife bringt wenig, Druck schadet eher.',
      'Anzeichen der Bereitschaft können sein: Dein Kind merkt, dass es in die Windel macht, sagt Bescheid, interessiert sich für die Toilette oder bleibt längere Zeit trocken.',
    ],
    tips: [
      'Ein Töpfchen bereitstellen und dein Kind entscheiden lassen, ob es sich draufsetzen möchte.',
      'Unfälle gelassen nehmen – sie gehören zum Lernen.',
    ],
    sources: ['kgiHome', 'cdc30Months'],
  },
  // Lebensmonat 28
  {
    title: 'Fantasie und „Ich“',
    teaser:
      'Ein Bauklotz wird zum Telefon, ein Karton zum Auto – und dein Kind spricht von sich als „ich“.',
    body: [
      'Das Symbolspiel wird fantasievoller: Gegenstände stehen für etwas anderes, und kleine Szenen werden nachgespielt. Viele Kinder beginnen, Wörter wie „ich“, „mich“ und „wir“ zu benutzen – ein Zeichen, dass sie sich als eigene Person begreifen.',
      'Kinder zeigen jetzt auch einfache Problemlösungen, zum Beispiel auf einen Hocker steigen, um an etwas heranzukommen.',
    ],
    tips: [
      'Offene Spielsachen anbieten: Kartons, Tücher, Bauklötze.',
      'Rollenspiele mitspielen und deinem Kind die Führung überlassen.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Lebensmonat 29
  {
    title: 'Springen mit beiden Beinen',
    teaser:
      'Viele Kinder springen jetzt mit beiden Füßen gleichzeitig vom Boden ab – und lieben es.',
    body: [
      'Bis 30 Monate springen die meisten Kinder mit beiden Füßen ab. Bewegung ist für die Entwicklung von Kleinkindern zentral: Laufen, Klettern, Springen und Balancieren fördern nicht nur die Motorik, sondern auch Konzentration und Selbstvertrauen.',
      'Fachleute in Deutschland empfehlen, Kinder unter drei Jahren möglichst von Bildschirmmedien fernzuhalten. Für Bewegung, Sprache und Schlaf ist echtes Spielen viel wertvoller.',
    ],
    tips: [
      'Hüpfspiele: Pfützen, Kissen auf dem Boden, Kreidekreise.',
      'Bildschirmfreie Zeiten, z. B. beim Essen und vor dem Schlafen, für die ganze Familie.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Lebensmonat 30
  {
    title: 'Zweieinhalb Jahre',
    teaser:
      'Dein Kind spricht in kleinen Sätzen, folgt zweiteiligen Aufforderungen und kennt vielleicht schon eine Farbe.',
    body: [
      'Mit etwa 30 Monaten sprechen die meisten Kinder rund 50 Wörter oder mehr und verbinden Wörter mit Tätigkeiten („Hund rennt“). Sie folgen Aufforderungen mit zwei Schritten („Hol die Schuhe und setz dich hin“) und benennen Dinge in einem Bilderbuch.',
      'Mit zweieinhalb bis drei Jahren ist das Milchgebiss meist vollständig. Ab dem zweiten Geburtstag wird mit einer erbsengroßen Menge fluoridhaltiger Kinderzahnpasta geputzt – Eltern putzen weiterhin nach.',
    ],
    tips: [
      'Zweiteilige Aufgaben spielerisch stellen: „Nimm den Teddy und bring ihn ins Bett.“',
      'Farben im Alltag benennen, ohne abzufragen.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Lebensmonat 31
  {
    title: 'Was ist das? Warum?',
    teaser:
      'Die Fragezeit beginnt: Dein Kind will wissen, wie Dinge heißen – und bald auch, warum sie so sind.',
    body: [
      'Kinder stellen gegen Ende des dritten Lebensjahres immer mehr Fragen: „Was ist das?“, „Wo ist Oma?“ und schließlich das berühmte „Warum?“. Fragen sind ein Zeichen von Neugier und wachsendem Denkvermögen.',
      'Es müssen nicht immer perfekte Antworten sein. Wichtig ist, dass dein Kind merkt: Meine Fragen sind willkommen.',
    ],
    tips: ['Zurückfragen: „Was glaubst du denn?“', 'Gemeinsam Antworten in Büchern suchen.'],
    sources: ['cdc3Years', 'kgiHome'],
  },
  // Lebensmonat 32
  {
    title: 'Selbst anziehen',
    teaser:
      'Mütze ab, Socken aus, Jacke an: Dein Kind möchte sich immer öfter selbst an- und ausziehen.',
    body: [
      'Ausziehen klappt meist früher als Anziehen. Bis 30 Monate ziehen viele Kinder einzelne Kleidungsstücke selbst aus, bis drei Jahre ziehen die meisten lockere Sachen wie Hosen mit Gummizug oder eine Jacke selbst an.',
      'Selbstständigkeit braucht Zeit – plane morgens ein paar Minuten mehr ein.',
    ],
    tips: [
      'Kleidung mit großen Knöpfen, Klett und Gummibund erleichtert das Üben.',
      'Kleidung in Reihenfolge bereitlegen.',
    ],
    sources: ['cdc30Months', 'cdc3Years'],
  },
  // Lebensmonat 33
  {
    title: 'Erste Freundschaften',
    teaser:
      'Dein Kind spielt jetzt öfter mit anderen Kindern statt nur neben ihnen – erste Freundschaften entstehen.',
    body: [
      'Gegen Ende des dritten Lebensjahres gehen die meisten Kinder auf andere Kinder zu und spielen mit ihnen. Gemeinsame Rollenspiele, Fangen und Bauen werden möglich. Konflikte gehören dazu – und sind ein Übungsfeld für Rücksicht und Kompromisse.',
      'Für viele Kinder beginnt um diese Zeit auch die Kita oder ein Wechsel in eine neue Gruppe. Eine behutsame Eingewöhnung mit einer vertrauten Person hilft.',
    ],
    tips: [
      'Regelmäßige Treffen mit denselben Kindern ermöglichen.',
      'Bei Streit Gefühle benennen und gemeinsam Lösungen suchen.',
    ],
    sources: ['cdc3Years', 'kgiHome'],
  },
  // Lebensmonat 34
  {
    title: 'Zeit für die U7a',
    teaser:
      'Zwischen dem 34. und 36. Lebensmonat steht die U7a an – unter anderem mit Sehtest und Blick auf die Sprache.',
    body: [
      'Bei der U7a schaut die Kinderarztpraxis besonders auf das Sehen (um Fehlsichtigkeiten wie ein „schwaches Auge“ früh zu erkennen), auf die Sprachentwicklung, das Verhalten und die Zähne. Auch die Impfungen werden überprüft.',
      'Parallel gibt es zahnärztliche Früherkennungsuntersuchungen, die ebenfalls von den Krankenkassen übernommen werden.',
    ],
    tips: [
      'Termin für die U7a vereinbaren und den Impfpass mitnehmen.',
      'Fragen zu Sprache, Schlaf oder Verhalten vorher notieren.',
    ],
    sources: ['kgiCheckups', 'bmgCheckups'],
  },
  // Lebensmonat 35
  {
    title: 'Kreise, Perlen, Gabel',
    teaser: 'Dein Kind malt einen Kreis nach, fädelt große Perlen auf und isst mit der Gabel.',
    body: [
      'Mit etwa drei Jahren können die meisten Kinder einen Kreis nachmalen, wenn man es ihnen zeigt, große Perlen auf eine Schnur fädeln und mit der Gabel essen. Sie verstehen auch Warnungen wie „Vorsicht, heiß!“ und halten sich daran.',
      'Feinmotorische Fähigkeiten entwickeln sich sehr unterschiedlich – viele Gelegenheiten zum Malen, Basteln und Bauen sind die beste Förderung.',
    ],
    tips: [
      'Große Holzperlen und eine feste Schnur zum Auffädeln anbieten.',
      'Gemeinsam Kreise, Sonnen und Gesichter malen.',
    ],
    sources: ['cdc3Years', 'kgiHome'],
  },
  // Lebensmonat 36
  {
    title: 'Fast drei: Richtige Gespräche',
    teaser:
      'Dein Kind führt kleine Gespräche, nennt seinen Vornamen und wird meist auch von Fremden verstanden.',
    body: [
      'Mit drei Jahren führen die meisten Kinder Gespräche mit mehreren Wechseln hin und her, stellen W-Fragen, nennen ihren Vornamen und beschreiben, was auf einem Bild passiert. Meist sprechen sie so deutlich, dass auch Menschen außerhalb der Familie sie größtenteils verstehen.',
      'Damit endet dieser Entwicklungskalender. Die nächsten Vorsorgeuntersuchungen sind die U8 (mit knapp vier Jahren) und die U9 (mit knapp fünf Jahren). Weiterführende Informationen für die Kita- und Vorschulzeit findest du auf kindergesundheit-info.de.',
    ],
    tips: [
      'Beim Erzählen Zeit lassen und Interesse zeigen – auch bei langen Geschichten.',
      'Ein Rückblick auf drei Jahre: Die Meilensteine-Zeitleiste zeigt, wie viel passiert ist.',
    ],
    sources: ['cdc3Years', 'kgiHome', 'kgiCheckups'],
  },
];

export const developmentContent: DevelopmentContent = { weeks, months };
