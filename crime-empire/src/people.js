/* ---------------------------------------------------------------------
   Wiederkehrende Figuren.

   Der Vorwurf an das alte Ereignissystem war berechtigt: es waren
   Textmeldungen. Ein Inspektor kam, nahm Geld, ging - und war beim
   naechsten Mal wieder ein Fremder. Nichts blieb.

   Hier ist es anders. Vier Menschen mit Namen, einem Gedaechtnis
   (trust) und einer Geschichte in Abschnitten (stage). Was man beim
   ersten Treffen entscheidet, steht beim dritten noch im Raum. Manche
   Wege sind danach zu, andere gehen erst auf.

   Jede Figur haengt an einem System, das es schon gibt:
     Kessler  - die Kommission
     Whitlock - Ansehen
     Penn     - Hitze und Bezirke
     Okonkwo  - Geld und Mannschaft

   Aufbau: met (Tag), trust (-100..100), stage (0 = noch nie gesehen),
   done (Geschichte zu Ende), flags (was man ihnen angetan hat).
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  var CAST = [
    { id: 'kessler', name: 'Krim.-Hauptkommissarin Mara Kessler', role: 'Dezernat Organisierte Kriminalität',
      face: 774411, color: '#4bd6e8',
      blurb: 'Zweiundzwanzig Jahre, drei Belobigungen und eine Scheidung, an der sie einen Aktenschrank schuld gibt. ' +
             'Ihre ganze Laufbahn lang baut sie einen Fall gegen jemanden wie dich auf.' },
    { id: 'whitlock', name: 'Dana Whitlock', role: 'Blackhaven Ledger',
      face: 219087, color: '#eaa640',
      blurb: 'Schreibt wöchentlich achthundert Wörter, die im Rathaus niemand gern liest. ' +
             'Sie will kein Geld und lässt sich nicht einschüchtern, und das macht sie teuer.' },
    { id: 'penn', name: 'Stadtrat Arthur Penn', role: 'Stadtrat, 4. Bezirk',
      face: 530912, color: '#8b5cf6',
      blurb: 'Dritte Amtszeit, zweite Hypothek, immer vorn, wenn eine Genehmigung unterschrieben werden muss. ' +
             'Penn ist weniger korrupt als dauerhaft knapp bei Kasse.' },
    { id: 'okonkwo', name: '"Sunday" Okonkwo', role: 'Beschaffer',
      face: 881234, color: '#d4af5a',
      blurb: 'Kennt für alles einen Mann und nimmt einen Punkt vorweg. Sunday wurde nie ' +
             'verhaftet, was in dieser Stadt einer Empfehlung gleichkommt.' }
  ];

  function def(id) { return D.byId(CAST, id); }

  function get(s, id) {
    if (!s.people) s.people = {};
    if (!s.people[id]) s.people[id] = { id: id, met: -1, trust: 0, stage: 0, done: false, flags: {} };
    return s.people[id];
  }

  function met(s, id) { return get(s, id).stage > 0; }
  function trust(s, id) { return get(s, id).trust; }

  function bump(s, id, dTrust, dStage) {
    var p = get(s, id);
    if (p.met < 0) p.met = s.day;
    p.trust = U.clamp(p.trust + (dTrust || 0), -100, 100);
    if (dStage) p.stage += dStage;
    return p;
  }

  function trustLabel(v) {
    if (v >= 60) return 'Eng';
    if (v >= 25) return 'Herzlich';
    if (v > -20) return 'Vorsichtig';
    if (v > -55) return 'Kühl';
    return 'Feindselig';
  }

  /* Alle bekannten Figuren fuer die Anzeige. */
  function known(s) {
    var out = [];
    for (var i = 0; i < CAST.length; i++) {
      var p = get(s, CAST[i].id);
      if (p.stage > 0) out.push({ def: CAST[i], state: p });
    }
    return out;
  }

  /* ------------------------------------------------------ Geschichten

     Jedes Ereignis nennt die Figur und den Abschnitt, in dem es greift.
     Die Auswahl laeuft ueber dieselbe Maschinerie wie alle anderen
     Ereignisse - hier steht nur, wann jemand auftaucht und was dann
     auf dem Tisch liegt.
  */
  function stories(fx, later) {
    return [

      /* ===================================================== KESSLER */
      {
        id: 'kessler_1', w: 2.6, cool: 3, person: 'kessler',
        when: function (s, c) { return get(s, 'kessler').stage === 0 && (s.heat >= 25 || c.d.rank >= 2); },
        build: function (s, c) {
          return {
            title: 'Die Ermittlerin', tone: 'heat', person: 'kessler',
            text: 'Sie wartete vor dem Restaurant, zwei Kaffee in der Hand, und gab dir einen davon. ' +
                  '"Mara Kessler, Organisierte Kriminalität. Ich bin heute nicht hier, um Sie zu verhaften. Ich bin hier, damit Sie ' +
                  'wissen, dass ich es war, wenn ich es tue."',
            options: [
              { label: 'Den Kaffee nehmen und reden', hint: 'Öffnet eine Verbindung für später. Jetzt +2 Hitze.',
                go: function () {
                  bump(s, 'kessler', 12, 1);
                  return 'Ihr habt vierzig Minuten über nichts geredet. Sie hat jedem Wort zugehört. ' +
                         fx(s, { heat: 2 });
                } },
              { label: 'Wortlos gehen', hint: 'Jetzt nichts. Sie bietet es nicht noch einmal an.',
                go: function () {
                  bump(s, 'kessler', -10, 1);
                  return 'Sie hat beide Kaffee getrunken. ' + fx(s, { heat: 1 });
                } },
              { label: 'Ihr Geld anbieten', hint: '+9 Hitze, und sie lässt sich nie wieder auf dich ein',
                go: function () {
                  bump(s, 'kessler', -34, 1);
                  get(s, 'kessler').flags.bribed = true;
                  return 'Sie steckte den Umschlag ein, ging ins Revier und gab ihn als ' +
                         'evidence. ' + fx(s, { heat: 9, rep: -1 });
                } }
            ]
          };
        }
      },
      {
        id: 'kessler_2', w: 2.2, cool: 6, person: 'kessler',
        when: function (s) { return get(s, 'kessler').stage === 1 && s.commission && s.commission.open; },
        build: function (s, c) {
          var k = get(s, 'kessler');
          var warm = k.trust > 0;
          return {
            title: 'Kessler kommt wieder', tone: 'heat', person: 'kessler',
            text: warm
              ? 'Sie rief die Nummer an, die du ihr nie gegeben hast. "Die Bundesleute haben meine Akte. ' +
                'Sie werden es schlecht machen, und Sie werden Leute auf dem Gewissen haben. Mir wäre lieber, ' +
                'ich wäre es."'
              : 'Sie stand diesen Monat vor drei deiner Betriebe, und sie will, dass du das ' +
                'weißt. "Die Bundesleute haben meine Akte. Ich habe ihnen alles gegeben. Schlafen Sie gut."',
            options: [
              { label: 'Sie nah bei dir halten', hint: 'Fall -8 jetzt, und sie warnt dich später',
                disabled: !warm, why: 'Sie würde keinen Anruf von dir annehmen.',
                go: function () {
                  bump(s, 'kessler', 14, 1);
                  k.flags.channel = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 8, 0, 100);
                  return 'Jetzt gibt es eine offene Leitung. Freundschaft würde das keiner von euch nennen. ' +
                         fx(s, { heat: -3 });
                } },
              { label: 'Ihr einen Rivalen liefern', hint: 'Fall -16, dieser Rivale -28 Verhältnis',
                disabled: c.enemies.length === 0 && s.rivals.length === 0, why: 'Niemand, den man liefern könnte.',
                go: function () {
                  var r = c.rng.pick(s.rivals.filter(function (x) { return !x.allied; }).length
                    ? s.rivals.filter(function (x) { return !x.allied; }) : s.rivals);
                  bump(s, 'kessler', 8, 1);
                  k.flags.fed = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 16, 0, 100);
                  return 'Sie nahm es, und sie wusste genau, warum du es ihr gabst. ' +
                         fx(s, { rival: r, relation: -28, rep: -2 });
                } },
              { label: 'Die Tür zumachen', hint: 'Fall +6 und nie wieder eine Warnung',
                go: function () {
                  bump(s, 'kessler', -30, 1);
                  k.flags.closed = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 6, 0, 100);
                  return 'Sie hat es aufgegeben. Das ist schlimmer. ' + fx(s, { heat: 4 });
                } }
            ]
          };
        }
      },
      {
        id: 'kessler_3', w: 2.0, cool: 10, person: 'kessler',
        when: function (s) { return get(s, 'kessler').stage === 2 && !get(s, 'kessler').done; },
        build: function (s, c) {
          var k = get(s, 'kessler');
          var freund = k.trust > 25;
          var kosten = Math.round(Math.max(40000, c.d.grossIncome * 2.2));
          return {
            title: freund ? 'Was Kessler will' : 'Kessler zieht die Schlinge zu', tone: 'heat', person: 'kessler',
            text: freund
              ? 'Zweiundzwanzig Jahre, und ihren Fall bekam eine Sonderkommission mit besseren Anzügen. Sie ' +
                'reicht ihre Papiere ein. "Eine Sache noch, bevor ich gehe. Im 9. Revier sitzt ein Mann, der ' +
                'seit sechs Jahren meine Akten verkauft. Helfen Sie mir, ihn zu begraben, und ich verliere, was ich über Sie habe."'
              : 'Sie hat einen Beschluss, einen Transporter und vier Leute, die ihr etwas schulden. Was sie seit ' +
                'jenem Kaffee aufgebaut hat, ist jetzt fertig.',
            options: freund ? [
              { label: 'Ihn gemeinsam mit ihr begraben', hint: U.moneySigned(-kosten) + ', Fall -30, und sie geht in den Ruhestand',
                disabled: s.cash < kosten, why: 'Nicht genug Bargeld.',
                go: function () {
                  bump(s, 'kessler', 25, 1);
                  k.done = true; k.flags.ally = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 30, 0, 100);
                  return 'Es dauerte neun Tage und kostete sehr viel Geld. Sie ging an einem Freitag in den Ruhestand, und ' +
                         'ihre Akte über dich ging mit ihr. ' + fx(s, { cash: -kosten, heat: -10, rep: 3 });
                } },
              { label: 'Sie still gehen lassen', hint: 'Kleine Erleichterung, sie bleibt neutral',
                go: function () {
                  bump(s, 'kessler', 4, 1); k.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 8, 0, 100);
                  return 'Sie ließ die Akte in einer Schublade. Nicht geschreddert. Nur in einer Schublade.';
                } },
              { label: 'Gegen sie verwenden, was sie dir erzählt hat', hint: 'Sie ist erledigt. Jedes Wohlwollen auch.',
                go: function () {
                  bump(s, 'kessler', -70, 1); k.done = true; k.flags.destroyed = true;
                  return 'Kessler trat unter laufenden Ermittlungen zurück. In diesem Revier nimmt nie wieder jemand ' +
                         'deinen Anruf an. ' + fx(s, { heat: 10, rep: -5 });
                } }
            ] : [
              { label: 'Es juristisch durchfechten', hint: U.moneySigned(-kosten) + ', und du überstehst es',
                disabled: s.cash < kosten, why: 'Nicht genug Bargeld.',
                go: function () {
                  k.done = true;
                  return 'Drei Monate Anträge und ein wohlwollender Richter. Es kostete sie alles, was sie ' +
                         'hatte, und das meiste von dem, was du hattest. ' + fx(s, { cash: -kosten, heat: -6, rep: -2 });
                } },
              { label: 'Ihr etwas Kleineres geben', hint: 'Einen Betrieb verlieren, den Rest behalten',
                disabled: s.businesses.length < 2, why: 'Du hast nichts, was du aufgeben könntest.',
                go: function () {
                  var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
                  var ziel = dreck.length ? dreck[0] : s.businesses[0];
                  var name = ziel.name;
                  CE.empire.sell(s, ziel.id);
                  k.done = true; bump(s, 'kessler', 10, 1);
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 10, 0, 100);
                  return 'Sie nahm ' + name + ' und nannte es einen Erfolg. ' + fx(s, { heat: -12 });
                } },
              { label: 'Es aussitzen', hint: 'Hitze und ein Fall, der nicht aufhört',
                go: function () {
                  k.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 14, 0, 100);
                  return 'Nichts ist hängen geblieben. Diesmal. ' + fx(s, { heat: 14 });
                } }
            ]
          };
        }
      },

      /* ==================================================== WHITLOCK */
      {
        id: 'whitlock_1', w: 2.2, cool: 5, person: 'whitlock',
        when: function (s, c) { return get(s, 'whitlock').stage === 0 && s.rep >= 25; },
        build: function (s, c) {
          return {
            title: 'Eine Reporterin ruft an', tone: 'rival', person: 'whitlock',
            text: 'Dana Whitlock vom Ledger hat Fragen dazu, wie jemand ohne sichtbaren ' +
                  'Werdegang in drei Jahren ' + s.businesses.length + ' Betriebe erwerben konnte. Sie ' +
                  'schreibt den Text so oder so und wollte dir die Höflichkeit einer Stellungnahme erweisen.',
            options: [
              { label: 'Ihr das Interview geben', hint: 'Meist +4 Ansehen, manchmal das Gegenteil',
                go: function () {
                  bump(s, 'whitlock', 16, 1);
                  return c.rng.chance(0.6)
                    ? 'Der Text war fair, also unschmeichelhaft und zutreffend. Das hat man dir angerechnet. ' +
                      fx(s, { rep: 4, heat: 3 })
                    : 'Sie zitierte dich genau, und genau war schlimmer, als du dachtest. ' +
                      fx(s, { rep: -2, heat: 6 });
                } },
              { label: 'Anbieten, die Geschichte zu kaufen', hint: '-4 Ansehen, +8 Hitze. Sie druckt den Versuch.',
                go: function () {
                  bump(s, 'whitlock', -28, 1);
                  get(s, 'whitlock').flags.bribed = true;
                  return 'Der versuchte Bestechungsversuch wurde der dritte Absatz. ' + fx(s, { rep: -4, heat: 8 });
                } },
              { label: 'Kein Kommentar', hint: '+4 Hitze, +1 Ansehen',
                go: function () {
                  bump(s, 'whitlock', -4, 1);
                  return 'Der Text lief auf Seite sechs, mit einem Foto deines Restaurants. ' +
                         fx(s, { heat: 4, rep: 1 });
                } }
            ]
          };
        }
      },
      {
        id: 'whitlock_2', w: 1.8, cool: 9, person: 'whitlock',
        when: function (s, c) { return get(s, 'whitlock').stage === 1 && c.d.rank >= 2; },
        build: function (s, c) {
          var w = get(s, 'whitlock');
          var warm = w.trust > 0;
          return {
            title: 'Whitlock hat einen Namen', tone: 'rival', person: 'whitlock',
            text: warm
              ? 'Diesmal kam sie zuerst zu dir. "Ich habe einen Stadtrat, der Geld nimmt. Ich kann ihn nennen ' +
                'oder die Leute, die ihn bezahlen. Mir wäre er lieber."'
              : 'Sie hat eine Quelle in einem deiner Betriebe. Die Geschichte erscheint in elf Tagen, ' +
                'und dein Name steht in der Überschrift.',
            options: warm ? [
              { label: 'Ihr den Stadtrat geben', hint: 'Sie schuldet dir etwas. Penn nicht.',
                go: function () {
                  bump(s, 'whitlock', 22, 1);
                  if (met(s, 'penn')) bump(s, 'penn', -40, 0);
                  w.flags.gavePenn = true;
                  return 'Die Geschichte erschien, ohne dass dein Name irgendwo vorkam. ' + fx(s, { rep: 3, heat: -4 });
                } },
              { label: 'Sie bitten, sie zurückzuhalten', hint: 'Kostet Vertrauen, kauft Ruhe',
                go: function () {
                  bump(s, 'whitlock', -14, 1);
                  return 'Sie hielt sie einen Monat zurück. Sie hat aber auch verstanden, was du bist. ' + fx(s, { heat: -3 });
                } },
              { label: 'Ihr sagen, sie soll alles drucken', hint: 'Ansehen steigt, Hitze steigt',
                go: function () {
                  bump(s, 'whitlock', 18, 1);
                  return 'Jeder, der in dieser Geschichte vorkam, hat etwas verloren. Du am wenigsten, und ' +
                         'auch das ist aufgefallen. ' + fx(s, { rep: 6, heat: 9 });
                } }
            ] : [
              { label: 'Die Quelle selbst finden', hint: 'Kostet Loyalität in der ganzen Crew',
                go: function () {
                  bump(s, 'whitlock', -6, 1);
                  return 'Du hast sie gefunden. Alle haben zugesehen, wie du sie gefunden hast. ' +
                         fx(s, { loyaltyAll: -9, heat: -4, rep: -1 });
                } },
              { label: 'Ihr eine bessere Geschichte liefern', hint: 'Sie auf einen Rivalen ansetzen',
                disabled: !s.rivals.length, why: 'Niemand, auf den man zeigen könnte.',
                go: function () {
                  var r = c.rng.pick(s.rivals);
                  bump(s, 'whitlock', 10, 1);
                  return 'In der Überschrift stand jemand anderes. ' + fx(s, { rival: r, relation: -18, heat: -5 });
                } },
              { label: 'Laufen lassen', hint: 'Hitze und Ansehen bewegen sich beide',
                go: function () {
                  bump(s, 'whitlock', 2, 1);
                  return 'Es war schlimmer, als du befürchtet hast, und besser, als es hätte sein können. ' +
                         fx(s, { heat: 11, rep: 2 });
                } }
            ]
          };
        }
      },

      /* ======================================================== PENN */
      {
        id: 'penn_1', w: 2.0, cool: 5, person: 'penn',
        when: function (s, c) { return get(s, 'penn').stage === 0 && c.d.districtsOpen >= 2; },
        build: function (s, c) {
          var bitte = Math.round(Math.max(6000, c.d.grossIncome * 0.4));
          return {
            title: 'Ein Stadtrat in Geldnot', tone: 'money', person: 'penn',
            text: 'Arthur Penn vertritt den 4. Bezirk und eine zweite Hypothek. Er braucht ' +
                  U.money(bitte) + ' vor Donnerstag und hat sich äußerst sorgfältig gehütet zu sagen, ' +
                  'was er dafür tun würde.',
            options: [
              { label: 'Zahlen und nichts verlangen', hint: U.moneySigned(-bitte) + ', er merkt es sich',
                disabled: s.cash < bitte, why: 'Nicht genug Bargeld.',
                go: function () {
                  bump(s, 'penn', 26, 1);
                  return 'Er schüttelte deine Hand mit beiden Händen. ' + fx(s, { cash: -bitte });
                } },
              { label: 'Zahlen und einen Preis nennen', hint: 'Einfluss jetzt, weniger Wohlwollen',
                disabled: s.cash < bitte, why: 'Nicht genug Bargeld.',
                go: function () {
                  bump(s, 'penn', 8, 1);
                  var k = c.rng.pick(c.openDistricts);
                  return 'Die Genehmigungen kamen am Montag durch. ' +
                         fx(s, { cash: -bitte, infl: 5, district: k });
                } },
              { label: 'Ablehnen', hint: 'Kostenlos. Er arbeitet ab jetzt für jemand anderen.',
                go: function () {
                  bump(s, 'penn', -16, 1);
                  return 'Jemand anderes hat gezahlt. Ihr werdet euch noch begegnen.';
                } }
            ]
          };
        }
      },
      {
        id: 'penn_2', w: 1.8, cool: 8, person: 'penn',
        when: function (s) { return get(s, 'penn').stage === 1 && get(s, 'penn').trust > 5; },
        build: function (s, c) {
          var p = get(s, 'penn');
          return {
            title: 'Penn liefert', tone: 'money', person: 'penn',
            text: 'Für die ganze Uferzone steht eine Bauleitplanung an. Penn sitzt im Ausschuss ' +
                  'und hat ungefragt wissen lassen, in welche Richtung es deiner Meinung nach gehen sollte.',
            options: [
              { label: 'In deine Richtung', hint: 'Einfluss in zwei Bezirken, Hitze steigt',
                go: function () {
                  bump(s, 'penn', 6, 1);
                  var a = c.openDistricts[0], b = c.openDistricts[1] || a;
                  var r1 = fx(s, { infl: 7, district: a });
                  var r2 = a !== b ? ', ' + fx(s, { infl: 5, district: b }) : '';
                  return 'Die Prüfung fiel zugunsten von allem aus, was dir gehört. ' + r1 + r2 + ' ' +
                         fx(s, { heat: 6 });
                } },
              { label: 'Gegen einen Rivalen', hint: 'Sie verlieren Boden und wissen, von wem',
                disabled: !s.rivals.length, why: 'Niemand, den man treffen könnte.',
                go: function () {
                  var r = c.rng.pick(s.rivals.filter(function (x) { return !x.allied; }).length
                    ? s.rivals.filter(function (x) { return !x.allied; }) : s.rivals);
                  var k = c.rng.pick(Object.keys(r.infl).filter(function (x) { return r.infl[x] > 5; }) || c.openDistricts);
                  if (k) r.infl[k] = Math.max(0, r.infl[k] - 9);
                  bump(s, 'penn', 4, 1);
                  return 'Drei ihrer Grundstücke sind jetzt nicht mehr zulässig bebaut. ' +
                         fx(s, { rival: r, relation: -20, rep: 1 });
                } },
              { label: 'Ihm sagen, er soll nach seinem Gewissen stimmen', hint: 'Er ist ratlos. Ansehen steigt.',
                go: function () {
                  bump(s, 'penn', 18, 1);
                  return 'Damit wusste er nichts anzufangen. ' + fx(s, { rep: 4 });
                } }
            ]
          };
        }
      },
      {
        id: 'penn_3', w: 1.6, cool: 12, person: 'penn',
        when: function (s) { return get(s, 'penn').stage >= 2 && !get(s, 'penn').done; },
        build: function (s, c) {
          var p = get(s, 'penn');
          var rettung = Math.round(Math.max(60000, c.d.netWorth * 0.07));
          return {
            title: 'Penn ist erledigt', tone: 'heat', person: 'penn',
            text: 'Der Ledger hat ihn. Kontoauszüge, ein Boot, das er sich nicht leisten konnte, und elf Jahre ' +
                  'Gefälligkeiten. Er wird unter Eid gefragt werden, wer wofür bezahlt hat.',
            options: [
              { label: 'Die beste Verteidigung bezahlen, die es gibt', hint: U.moneySigned(-rettung) + ', er bleibt loyal',
                disabled: s.cash < rettung, why: 'Nicht genug Bargeld.',
                go: function () {
                  bump(s, 'penn', 30, 1); p.done = true; p.flags.saved = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 12, 0, 100);
                  return 'Er kam davon. Er wird nicht vergessen, wer die Anwälte bezahlt hat. ' +
                         fx(s, { cash: -rettung, heat: -6, rep: 2 });
                } },
              { label: 'Ihn fallen lassen', hint: 'Er wird nach dir gefragt werden',
                go: function () {
                  bump(s, 'penn', -50, 1); p.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 16, 0, 100);
                  return 'Am zweiten Tag nahm er einen Deal an. ' + fx(s, { heat: 13, rep: -2 });
                } },
              { label: 'Dafür sorgen, dass er nicht aussagen kann', hint: 'Wirksam. Teuer in jeder Hinsicht.',
                go: function () {
                  bump(s, 'penn', -100, 1); p.done = true; p.flags.silenced = true;
                CE.fear.add(s, 9, 'einen Stadtrat zum Schweigen gebracht');
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 6, 0, 100);
                  if (met(s, 'whitlock')) bump(s, 'whitlock', -25, 0);
                  return 'Arthur Penn zog sich aus der Öffentlichkeit zurück und verließ den Bundesstaat. ' +
                         'Das glaubt niemand, Whitlock eingeschlossen. ' + fx(s, { heat: 9, rep: -8, loyaltyAll: -4 });
                } }
            ]
          };
        }
      },

      /* ===================================================== OKONKWO */
      {
        id: 'okonkwo_1', w: 2.0, cool: 6, person: 'okonkwo',
        when: function (s, c) { return get(s, 'okonkwo').stage === 0 && s.businesses.length >= 2; },
        build: function (s, c) {
          var preis = Math.round(Math.max(9000, c.d.grossIncome * 0.7));
          return {
            title: 'Sunday findet dich', tone: 'money', person: 'okonkwo',
            text: '"Sunday Okonkwo. Ich höre, Sie kaufen ein." Er hat eine Liste. Alles darauf ist ' +
                  'leicht illegal, überaus nützlich und kostet ' + U.money(preis) + ' for ' +
                  'für den ersten Posten, was immer du daraus machst.',
            options: [
              { label: 'Von der Liste kaufen', hint: U.moneySigned(-preis) + ', dauerhaft +3% auf jede Operation',
                disabled: s.cash < preis, why: 'Nicht genug Bargeld.',
                go: function () {
                  bump(s, 'okonkwo', 20, 1);
                  s.flags.sundayEdge = (s.flags.sundayEdge || 0) + 1;
                  return 'Was immer es war, es wirkt. Operationen laufen ab jetzt etwas besser. ' +
                         fx(s, { cash: -preis });
                } },
              { label: 'Fragen, was er langfristig will', hint: 'Kostenlos. Er merkt sich, dass gefragt wurde.',
                go: function () {
                  bump(s, 'okonkwo', 12, 1);
                  return '"Einen Anteil, irgendwann. Heute nicht." Er ließ seine Nummer da.';
                } },
              { label: 'Ihn wegschicken', hint: 'Er kommt eine Weile nicht wieder',
                go: function () { bump(s, 'okonkwo', -12, 1); return 'Er nahm es gelassen. Das tun sie immer.'; } }
            ]
          };
        }
      },
      {
        id: 'okonkwo_2', w: 1.7, cool: 9, person: 'okonkwo',
        when: function (s, c) { return get(s, 'okonkwo').stage >= 1 && get(s, 'okonkwo').trust > 10 && c.paid.length < c.d.crewCap; },
        build: function (s, c) {
          var r = CE.crew.makeRecruit(s, c.rng, { bonus: 3.5 });
          var gebuehr = Math.round(r.ask * 2.2);
          return {
            title: 'Sunday kennt da jemanden', tone: 'crew', person: 'okonkwo',
            text: '"Sie brauchen einen ' + D.byId(D.ROLES, r.role).name + '. Ich habe einen. ' +
                  r.name + ', Können ' + r.skill + ', und er stellt keine Fragen, weil ich sie ' +
                  'schon beantwortet habe." Sein Finderlohn beträgt ' + U.money(gebuehr) + '.',
            options: [
              { label: 'Ihn einstellen', hint: U.moneySigned(-gebuehr) + ' fee, ' + U.money(r.ask) + '/week',
                disabled: s.cash < gebuehr || c.paid.length >= c.d.crewCap,
                why: s.cash < gebuehr ? 'Nicht genug Bargeld.' : 'Kein Platz in deiner Crew.',
                go: function () {
                  s.cash -= gebuehr; s.stats.spent += gebuehr;
                  s.crew.push({
                    id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                    potential: r.potential, xp: 0, loyalty: Math.min(100, r.loyalty + 12), salary: r.ask,
                    traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                    face: r.face, mood: '', raises: 0
                  });
                  bump(s, 'okonkwo', 10, 1);
                  return r.name + ' hat noch am selben Nachmittag angefangen.';
                } },
              { label: 'Diesmal nicht', hint: '',
                go: function () { bump(s, 'okonkwo', -4, 1); return '"Ein andermal."'; } }
            ]
          };
        }
      },
      {
        id: 'okonkwo_3', w: 1.5, cool: 14, person: 'okonkwo',
        when: function (s, c) { return get(s, 'okonkwo').stage >= 2 && c.d.rank >= 3 && !get(s, 'okonkwo').done; },
        build: function (s, c) {
          var anteil = Math.round(Math.max(90000, c.d.netWorth * 0.10));
          return {
            title: 'Sunday nennt seinen Preis', tone: 'money', person: 'okonkwo',
            text: '"Ich sagte, irgendwann ein Anteil. Es ist irgendwann." Er will ' + U.money(anteil) +
                  ' für eine feste Abmachung: sein ganzes Netz, dauerhaft, für dich.',
            options: [
              { label: 'Das Netz kaufen', hint: U.moneySigned(-anteil) + ', dauerhaft +10% Aussicht, +8% Ertrag, 15% schneller',
                disabled: s.cash < anteil, why: 'Nicht genug Bargeld.',
                go: function () {
                  var o = get(s, 'okonkwo');
                  o.done = true; o.flags.network = true;
                  s.flags.sundayNetwork = true;
                  bump(s, 'okonkwo', 25, 1);
                  return 'Jeder Hehler, Fahrer und Fälscher in Blackhaven nimmt jetzt zuerst deine Anrufe an. ' +
                         fx(s, { cash: -anteil, rep: 3 });
                } },
              { label: 'Die Hälfte bieten', hint: 'Er kann annehmen, er kann auch nicht',
                disabled: s.cash < anteil / 2, why: 'Nicht genug Bargeld.',
                go: function () {
                  if (c.rng.chance(0.45 + trust(s, 'okonkwo') / 250)) {
                    var o = get(s, 'okonkwo'); o.done = true; o.flags.network = true;
                    s.flags.sundayNetwork = true;
                    return 'Er lachte und nahm es. ' + fx(s, { cash: -Math.round(anteil / 2) });
                  }
                  bump(s, 'okonkwo', -20, 1);
                  return '"So funktioniert ein Anteil nicht." Er bot sein Netz anderswo an.';
                } },
              { label: 'Ablehnen', hint: 'Er geht für jemand anderen arbeiten',
                go: function () {
                  var o = get(s, 'okonkwo'); o.done = true;
                  var r = c.rng.pick(s.rivals);
                  r.strength += 12;
                  bump(s, 'okonkwo', -18, 1);
                  return 'Innerhalb eines Monats arbeitete er für ' + D.byId(D.RIVALS, r.id).name + '.';
                } }
            ]
          };
        }
      }
    ];
  }

  CE.people = {
    CAST: CAST, def: def, get: get, met: met, trust: trust, bump: bump,
    trustLabel: trustLabel, known: known, stories: stories
  };
})(typeof window !== 'undefined' ? window : globalThis);
