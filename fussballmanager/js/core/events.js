/* Ereignisse und Entscheidungen: Pressekonferenzen, Kabine, Vorstand, Fans, Sponsoren – dazu Versprechen
   an Spieler, Zusatzziele des Vorstands, die Halbzeitansprache und die Testspiele der Vorbereitung.
   Ein Ereignis landet als Nachricht mit Auswahl im Posteingang; ohne Antwort entscheidet nach einer Woche der Co-Trainer. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  /* ---------- Hilfen ---------- */
  function uclub(state) { return state.clubs[state.user.club]; }
  function squad(state) { return FM.clubPlayers(state, state.user.club); }
  function mine(state, pid) { var p = state.players[pid]; return p && p.club === state.user.club ? p : null; }
  function mor(list, d) { list.forEach(function (p) { p.mor = FM.clamp(p.mor + d, 5, 100); }); }
  function form(list, d) { list.forEach(function (p) { p.form = FM.clamp(p.form + d, -3, 3); }); }
  function conf(state, d) { state.user.conf = FM.clamp(state.user.conf + d, 0, 100); }
  function unit(state) { return Math.max(10000, FM.niceRound(FM.revenueEstimate(state, uclub(state)).total * 0.004)); }
  function pay(state, amount, key) { FM.book(uclub(state), key || 'other', -amount); }
  function sorted(state) { return squad(state).sort(function (a, b) { return b.ovr - a.ovr; }); }
  function gone() { return 'Die Sache hat sich inzwischen erledigt.'; }
  function last(name) { return name.split(' ').slice(-1)[0]; }
  function bigMatch(state, fx) {
    if (!fx) return false;
    var uc = state.user.club, opp = fx.home === uc ? fx.away : fx.home;
    if (FM.isDerby(state, fx.home, fx.away) || fx.euKo || (fx.comp === 'cup' && fx.round >= 3)) return true;
    var lid = uclub(state).league;
    if (fx.comp !== lid || !FM.ZONES[lid] || FM.playedRounds(state, lid) < 6) return false;
    var t = FM.table(state, lid), po = t.findIndex(function (r) { return r.club === opp; }), pu = t.findIndex(function (r) { return r.club === uc; });
    return po >= 0 && po < 3 || (pu < 4 && po < 6) || (pu >= t.length - 4 && po >= t.length - 5);
  }
  function promise(p, state, days, need) { p.promise = { until: D.add(state.date, days), need: need, got: 0 }; }
  function hurt(state, p, days, type) {
    p.injury = { type: type || 'Muskelverletzung', days: days };
    FM.addNews(state, { type: 'injury', title: p.name + ' verletzt', body: p.name + ' fällt mit ' + p.injury.type + ' voraussichtlich ' + FM.injuryDuration(days) + ' aus.' });
  }

  /* ---------- Ereignisse ----------
     when(state, x) liefert die Daten des Ereignisses oder null. x: { club, m (Monat), day, next (naechstes Spiel), gap (Tage bis dahin) } */
  var E = [];

  E.push({
    id: 'camp', must: true, cool: 300,
    when: function (s, x) { return x.m === 7 && x.day >= 2 && x.day <= 9 ? {} : null; },
    title: function () { return 'Vorbereitung: Wohin geht es ins Trainingslager?'; },
    text: function (s) { return 'Der Co-Trainer legt dir drei Pläne für die Sommervorbereitung vor. Jedes Trainingslager kostet ' + FM.fmtMoney(unit(s) * 2) + '.'; },
    opts: [
      ['Höhentrainingslager', 'Kondition: Spieler erholen sich bis Ende Oktober schneller', function (s) { pay(s, unit(s) * 2); s.user.camp = D.iso(s.season.year, 10, 31); squad(s).forEach(function (p) { p.fit = 100; }); return 'Die Mannschaft schuftet in den Bergen. Bis Ende Oktober regenerieren deine Spieler spürbar schneller.'; }],
      ['Taktikschule', 'Alle Spieler starten mit besserer Form', function (s) { pay(s, unit(s) * 2); form(squad(s), 1); return 'Zwei Wochen Automatismen: Die Abläufe sitzen, alle Spieler gehen mit besserer Form in die Saison.'; }],
      ['Teamgeist am See', 'Moral steigt deutlich', function (s) { pay(s, unit(s) * 2); mor(squad(s), 10); return 'Rafting, Grillabende, kurze Einheiten: Die Kabine ist zusammengewachsen, die Moral steigt deutlich.'; }],
      ['Zu Hause bleiben', 'Kostet nichts', function (s) { mor(squad(s), -1); return 'Ihr bereitet euch auf dem eigenen Gelände vor. Das spart Geld – Begeisterung löst es nicht aus.'; }]
    ], def: 3
  });

  E.push({
    id: 'boardobj', must: true, cool: 300,
    when: function (s, x) {
      if (x.m !== 7 || x.day < 6 || x.day > 24) return null;
      var kinds = ['scorer'];
      if (s.cup && s.cup.alive.indexOf(s.user.club) >= 0) kinds.push('cup');
      if (squad(s).some(function (p) { return p.src === 'y' && p.age <= 20; })) kinds.push('youth');
      var k = R.pick(kinds), lvl = FM.levelOf(s, s.user.club);
      return { k: k, t: k === 'cup' ? (lvl === 1 ? 4 : lvl === 2 ? 3 : 2) : k === 'youth' ? 900 : (lvl === 1 ? 14 : 16) };
    },
    title: function () { return 'Der Vorstand hat einen Wunsch'; },
    text: function (s, pl) {
      var what = pl.k === 'cup' ? 'im DFB-Pokal mindestens das ' + FM.CUP_ROUNDS[pl.t - 1] + ' erreichen' : pl.k === 'youth' ? 'den Eigengewächsen bis 21 Jahre zusammen mindestens ' + pl.t + ' Ligaminuten geben' : 'einen Spieler mit mindestens ' + pl.t + ' Ligatoren stellen';
      return 'Neben dem Saisonziel hätte der Vorstand gern ein Zeichen: Der Verein soll ' + what + '. Sagst du zu und lieferst, gibt es eine Prämie von ' + FM.fmtMoney(unit(s) * 4) + ' und Rückendeckung. Sagst du zu und scheiterst, kostet das Vertrauen.';
    },
    opts: [
      ['Zusagen', 'Prämie bei Erfolg, Vertrauensverlust bei Misserfolg', function (s, pl) { s.user.obj = { k: pl.k, t: pl.t, y: s.season.year }; conf(s, 1); return 'Du gibst dein Wort. Der Vorstand notiert es – am Saisonende wird abgerechnet.'; }],
      ['Nichts versprechen', 'Kein Risiko', function (s) { conf(s, -1); return 'Du bleibst vorsichtig. Der Vorstand hätte sich mehr Mut gewünscht, akzeptiert es aber.'; }]
    ], def: 1
  });

  E.push({
    id: 'captain', must: true, cool: 300,
    when: function (s, x) {
      if (!(x.m === 7 && x.day >= 12) && !(x.m === 8 && x.day <= 6)) return null;
      var list = sorted(s).filter(function (p) { return !p.loan; });
      if (list.length < 11) return null;
      var top = list.slice(0, 11);
      var vet = top.slice().sort(function (a, b) { return b.age - a.age; })[0];
      var loyal = top.filter(function (p) { return p !== vet; }).sort(function (a, b) { return a.joined - b.joined || b.age - a.age; })[0];
      var star = top.filter(function (p) { return p !== vet && p !== loyal; })[0];
      return { c: [vet.id, loyal.id, star.id] };
    },
    title: function () { return 'Wer trägt die Binde?'; },
    text: function () { return 'Vor dem Saisonstart musst du den Kapitän bestimmen. Drei Kandidaten bringen sich in Stellung: der Routinier, die Identifikationsfigur und dein bester Spieler.'; },
    opts: function (s, pl) {
      var tag = ['Der Routinier', 'Die Identifikationsfigur', 'Der Leistungsträger'];
      return pl.c.map(function (id, i) {
        var p = s.players[id];
        return [p ? p.name : '–', tag[i] + (p ? ' · ' + p.age + ' J., Stärke ' + p.ovr : ''), function (st, q) {
          var c = mine(st, q.c[i]);
          if (!c) return gone();
          uclub(st).captain = c.id;
          mor([c], 12);
          q.c.forEach(function (o, j) { var x = mine(st, o); if (x && j !== i) mor([x], j === 0 ? -5 : -2); });
          if (i === 1) FM.fanMood(st, 3);
          if (i === 0) mor(squad(st), 1);
          return c.name + ' führt die Mannschaft als Kapitän aufs Feld. ' + (i === 0 ? 'Die Kabine respektiert die Wahl.' : i === 1 ? 'Die Fans lieben die Entscheidung.' : 'Der Star fühlt sich bestätigt – der Routinier schluckt.');
        }];
      });
    }, def: 0
  });

  E.push({
    id: 'press', cool: 45, timed: true,
    when: function (s, x) { return x.next && x.gap >= 1 && x.gap <= 2 && x.next.comp !== 'fr' && bigMatch(s, x.next) ? { f: x.next.id } : null; },
    title: function (s, pl) { var f = s.fixtures[pl.f], o = s.clubs[f.home === s.user.club ? f.away : f.home]; return 'Pressekonferenz vor dem Spiel gegen ' + o.short; },
    text: function (s, pl) { var f = s.fixtures[pl.f]; return 'Volles Haus im Presseraum: ' + FM.fixtureLabel(f, ', ') + ', ' + s.clubs[f.home].short + ' gegen ' + s.clubs[f.away].short + (FM.isDerby(s, f.home, f.away) ? ' – das Derby' : '') + '. Die Journalisten wollen eine Schlagzeile. Was gibst du ihnen?'; },
    opts: [
      ['„Wir holen uns den Sieg."', 'Kampfansage: zahlt sich nur bei einem Sieg aus', function (s, pl) { s.user.vow = { fid: pl.f }; mor(squad(s), 2); return 'Die Schlagzeile steht. Die Mannschaft ist heiß – jetzt müsst ihr liefern.'; }],
      ['Respekt zeigen', 'Kein Risiko', function (s) { mor(squad(s), 1); return 'Ruhige Töne, kein Zündstoff. Die Mannschaft kann sich in Ruhe vorbereiten.'; }],
      ['Druck auf den Gegner schieben', 'Kann wirken – oder nach hinten losgehen', function (s) { if (R.chance(0.55)) { mor(squad(s), 3); return 'Der Gegner reagiert gereizt, deine Spieler amüsieren sich. Psychospielchen gewonnen.'; } FM.fanMood(s, -2); mor(squad(s), -1); return 'Die Gegenseite kontert souverän, deine Sätze wirken überheblich. Das war nichts.'; }]
    ], def: 1
  });

  E.push({
    id: 'playtime', cool: 18, w: 3,
    when: function (s) {
      var list = sorted(s), bar = list[Math.min(list.length - 1, 15)].ovr;
      var c = list.filter(function (p) { return p.age >= 22 && !p.injury && !p.loan && !p.promise && !FM.isGK(p) && p.ovr >= bar && p.minutesRecent < 30 && p.mor < 62; });
      return c.length && FM.playedRounds(s, uclub(s).league) >= 3 ? { p: R.pick(c).id } : null;
    },
    title: function (s, pl) { return s.players[pl.p].name + ' klopft an deine Tür'; },
    text: function (s, pl) { var p = s.players[pl.p]; return p.name + ' (' + FM.POS_LABEL[p.pos[0]] + ', ' + p.ovr + ') kommt nach dem Training in dein Büro: Er sitzt zu oft draußen und will wissen, woran er ist.'; },
    opts: [
      ['Einsätze versprechen', 'Er muss in den nächsten fünf Wochen mindestens 180 Minuten spielen', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); promise(p, s, 35, 180); mor([p], 8); return p.name + ' geht mit einem Lächeln. Halte Wort: 180 Minuten bis ' + D.fmt(p.promise.until) + '.'; }],
      ['Vertrösten', 'Kostet etwas Moral', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], -4); return p.name + ' nickt, überzeugt ist er nicht.'; }],
      ['Klare Ansage: Leistung zählt', 'Entweder stachelt es ihn an – oder er ist beleidigt', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); if (R.chance(0.5)) { mor([p], 4); form([p], 0.8); return p.name + ' nimmt die Worte an und hängt sich im Training rein.'; } mor([p], -9); return p.name + ' verlässt wortlos das Büro. Die Stimmung ist im Keller.'; }]
    ], def: 1
  });

  E.push({
    id: 'agent', cool: 70, w: 2,
    when: function (s) {
      var y = s.season.year, c = sorted(s).slice(0, 5).filter(function (p) { return p.age <= 30 && !p.loan && !p.pre && p.contract.until >= y + 2 && p.mor >= 40; });
      return c.length ? { p: R.pick(c).id } : null;
    },
    title: function (s, pl) { return 'Der Berater von ' + s.players[pl.p].name + ' ruft an'; },
    text: function (s, pl) { var p = s.players[pl.p]; return '„Mein Klient spielt die Saison seines Lebens und verdient ' + FM.fmtMoney(p.contract.wage) + '. Andere zahlen mehr." Der Berater von ' + p.name + ' fordert eine Anpassung – sonst höre man sich um.'; },
    opts: [
      ['Gehalt anheben und verlängern', '+15 % Gehalt, Vertrag ein Jahr länger', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); p.contract.wage = FM.niceRound(p.contract.wage * 1.15); p.contract.until++; mor([p], 8); p.wants = false; return p.name + ' verlängert bis ' + p.contract.until + ' und verdient jetzt ' + FM.fmtMoney(p.contract.wage) + '.'; }],
      ['Einmalige Prämie', 'Kostet 10 % eines Jahresgehalts', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); pay(s, Math.round(p.contract.wage * 0.1), 'fees'); mor([p], 4); return 'Eine Sonderprämie glättet die Wogen – fürs Erste.'; }],
      ['Auf den Vertrag verweisen', 'Riskant: Er könnte wechseln wollen', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], -6); if (R.chance(0.3)) { p.wants = true; return 'Der Berater legt auf. Am nächsten Tag steht in der Zeitung, ' + p.name + ' wolle den Verein verlassen.'; } return 'Der Berater murrt, ' + p.name + ' trainiert weiter – etwas lustloser als zuvor.'; }]
    ], def: 1
  });

  E.push({
    id: 'discipline', cool: 90, w: 2,
    when: function (s) { var c = sorted(s).slice(0, 14).filter(function (p) { return !p.injury && p.age <= 29; }); return c.length ? { p: R.pick(c).id, w: R.int(0, 2) } : null; },
    title: function (s, pl) { return 'Ärger mit ' + s.players[pl.p].name; },
    text: function (s, pl) { return s.players[pl.p].name + [' ist zum dritten Mal in zwei Wochen zu spät zum Training erschienen.', ' wurde zwei Nächte vor dem Spiel in einem Club fotografiert.', ' hat sich im Training mit dem Athletiktrainer angelegt.'][pl.w] + ' Die Mannschaft schaut genau hin, wie du reagierst.'; },
    opts: [
      ['Geldstrafe', 'Fließt in die Mannschaftskasse', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], -3); mor(squad(s), 1); return p.name + ' zahlt und entschuldigt sich vor der Mannschaft. Thema erledigt.'; }],
      ['Für ein Spiel suspendieren', 'Hartes Signal an alle', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); p.susp = (p.susp || 0) + 1; mor([p], -8); mor(squad(s), 1); conf(s, 1); return p.name + ' fehlt im nächsten Ligaspiel. Der Vorstand lobt deine Konsequenz.'; }],
      ['Schwamm drüber', 'Schont ihn – kann Autorität kosten', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], 2); if (R.chance(0.4)) { mor(squad(s), -2); conf(s, -1); return 'Du lässt es durchgehen. In der Kabine wird getuschelt, ob für alle dieselben Regeln gelten.'; } return 'Ein Gespräch unter vier Augen reicht. ' + p.name + ' verspricht Besserung.'; }]
    ], def: 0
  });

  E.push({
    id: 'youthdebut', cool: 60, w: 2,
    when: function (s) {
      var xi = sorted(s).slice(0, 11), avg = FM.avg(xi, function (p) { return p.ovr; });
      var c = squad(s).filter(function (p) { return p.src === 'y' && p.age <= 19 && !p.loan && !p.promise && p.st.apps === 0 && p.pot >= avg - 3; });
      return c.length ? { p: R.pick(c).id } : null;
    },
    title: function (s, pl) { return 'Akademie: ' + s.players[pl.p].name + ' drängt nach oben'; },
    text: function (s, pl) { var p = s.players[pl.p]; return 'Der Leiter der Akademie schwärmt: ' + p.name + ' (' + p.age + ', ' + FM.POS_LABEL[p.pos[0]] + ', Stärke ' + p.ovr + ', Potenzial ' + p.pot + ') sei reif für die Profis. Der Junge brennt auf sein Debüt.'; },
    opts: [
      ['Debüt versprechen', 'Mindestens 90 Minuten in sechs Wochen – beflügelt ihn', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); promise(p, s, 42, 90); mor([p], 10); p.pot = Math.min(94, p.pot + 1); return p.name + ' trainiert ab sofort mit den Profis und bekommt seine Chance. Halte Wort bis ' + D.fmt(p.promise.until) + '.'; }],
      ['Auf die Leihliste setzen', 'Spielpraxis woanders', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); p.loanList = true; return p.name + ' steht auf der Leihliste. Im nächsten Transferfenster melden sich Interessenten.'; }],
      ['Noch Geduld', 'Kein Risiko – aber Talente wollen spielen', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); if (R.chance(0.3)) { p.pot = Math.max(p.ovr, p.pot - 1); mor([p], -5); return p.name + ' ist enttäuscht. Sein Trainer in der Akademie fürchtet, dass er die Lust verliert.'; } return p.name + ' arbeitet weiter in der Akademie.'; }]
    ], def: 2
  });

  E.push({
    id: 'mediahype', cool: 60, w: 2,
    when: function (s) { var c = squad(s).filter(function (p) { return p.age <= 21 && p.form >= 1.1 && p.st.apps >= 5; }); return c.length ? { p: R.pick(c).id } : null; },
    title: function (s, pl) { return 'Hype um ' + s.players[pl.p].name; },
    text: function (s, pl) { var p = s.players[pl.p]; return 'Titelseiten, Talkshows, Vergleiche mit ganz Großen: Nach den starken Wochen von ' + p.name + ' (' + p.age + ') überschlagen sich die Medien. Wie gehst du damit um?'; },
    opts: [
      ['Aus der Schusslinie nehmen', 'Schützt seine Entwicklung', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); FM.fanMood(s, -1); if (R.chance(0.5)) p.pot = Math.min(94, p.pot + 1); return 'Interviewverbot, volle Konzentration auf den Platz. ' + p.name + ' dankt es dir mit Leistung.'; }],
      ['Rampenlicht zulassen', 'Gut fürs Image – Risiko für den Kopf', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); FM.fanMood(s, 3); if (R.chance(0.5)) { form([p], -1.2); return p.name + ' genießt den Rummel etwas zu sehr. Im Training wirkt er abgelenkt.'; } mor([p], 6); return p.name + ' wächst mit der Aufmerksamkeit – und die Fans haben einen neuen Liebling.'; }]
    ], def: 0
  });

  E.push({
    id: 'clash', cool: 70, w: 2,
    when: function (s) { var c = R.shuffle(sorted(s).slice(0, 16).filter(function (p) { return !p.injury; })); return c.length >= 2 ? { a: c[0].id, b: c[1].id } : null; },
    title: function () { return 'Es kracht im Training'; },
    text: function (s, pl) { return s.players[pl.a].name + ' und ' + s.players[pl.b].name + ' geraten nach einem harten Zweikampf aneinander und müssen getrennt werden. Die Einheit ist gelaufen.'; },
    opts: [
      ['Aussprache unter sechs Augen', 'Meist heilsam', function (s, pl) { var a = mine(s, pl.a), b = mine(s, pl.b); if (!a || !b) return gone(); if (R.chance(0.65)) { mor([a, b], 3); return 'Nach einer halben Stunde geben sich beide die Hand. Reibung gehört dazu.'; } mor([R.chance(0.5) ? a : b], -6); return 'Die Aussprache endet frostig. Einer der beiden fühlt sich ungerecht behandelt.'; }],
      ['Den Auslöser bestrafen', 'Klare Kante', function (s, pl) { var a = mine(s, pl.a), b = mine(s, pl.b); if (!a || !b) return gone(); mor([a], -8); mor([b], 4); mor(squad(s), 1); return a.name + ' läuft Strafrunden. Die Mannschaft registriert: Hier gibt es Grenzen.'; }],
      ['Ignorieren', 'Kann schwelen', function (s, pl) { var a = mine(s, pl.a), b = mine(s, pl.b); if (!a || !b) return gone(); mor([a, b], -4); if (R.chance(0.2)) { hurt(s, b, R.int(6, 12), 'Prellung'); return 'Zwei Tage später knallt es wieder – diesmal bleibt ' + b.name + ' liegen.'; } return 'Du tust, als wäre nichts gewesen. Die beiden gehen sich aus dem Weg.'; }]
    ], def: 0
  });

  E.push({
    id: 'tickets', cool: 120, w: 2,
    when: function (s) { var u = s.user; return !u.tix && (u.fans <= 45 || (u.run && u.run.l >= 3)) && FM.playedRounds(s, uclub(s).league) >= 5 ? {} : null; },
    title: function () { return 'Fanvertreter fordern günstigere Tickets'; },
    text: function () { return 'Die Stimmung auf den Rängen ist gereizt. Der Fanbeirat verlangt ein Zeichen: niedrigere Eintrittspreise für den Rest der Saison.'; },
    opts: [
      ['Preise senken', '−10 % Zuschauereinnahmen bis Saisonende, Fans versöhnt', function (s) { s.user.tix = 0.9; FM.fanMood(s, 9); return 'Die Kurve applaudiert. Bis Saisonende kosten Karten zehn Prozent weniger.'; }],
      ['Familientag ausrichten', 'Einmalige Kosten, kleines Zeichen', function (s) { pay(s, unit(s)); FM.fanMood(s, 4); return 'Ein Familientag mit Autogrammstunde kommt gut an.'; }],
      ['Ablehnen', 'Kostet Sympathien', function (s) { FM.fanMood(s, -6); return 'Du verweist auf die Kosten. Beim nächsten Heimspiel hängen Protestbanner.'; }]
    ], def: 1
  });

  E.push({
    id: 'sponsor', cool: 300, w: 2,
    when: function (s, x) { return (x.m >= 9 || x.m <= 2) && !s.user.bonus && uclub(s).expect && FM.ZONES[uclub(s).league] ? {} : null; },
    title: function () { return 'Der Hauptsponsor will nachlegen'; },
    text: function (s) { return 'Dein Hauptsponsor bietet zwei Modelle an: sofort ' + FM.fmtMoney(unit(s) * 3) + ' – oder ' + FM.fmtMoney(unit(s) * 9) + ', falls ihr das Saisonziel (Platz ' + uclub(s).expect.target + ') erreicht.'; },
    opts: [
      ['Sofortzahlung', 'Sicheres Geld', function (s) { FM.book(uclub(s), 'sponsor', unit(s) * 3); return FM.fmtMoney(unit(s) * 3) + ' sind auf dem Konto.'; }],
      ['Erfolgsprämie', 'Dreimal so viel – wenn das Saisonziel erreicht wird', function (s) { s.user.bonus = { amt: unit(s) * 9, pos: uclub(s).expect.target, y: s.season.year }; return 'Vereinbart: ' + FM.fmtMoney(unit(s) * 9) + ' bei Platz ' + uclub(s).expect.target + ' oder besser.'; }]
    ], def: 0
  });

  E.push({
    id: 'naming', cool: 500, w: 1,
    when: function (s) { var c = uclub(s); return !c.naming && c.league !== 'rl' ? {} : null; },
    title: function () { return 'Ein Unternehmen will den Stadionnamen kaufen'; },
    text: function (s) { var c = uclub(s); return 'Ein Konzern bietet ' + FM.fmtMoney(Math.round(FM.revenueEstimate(s, c).total * 0.03)) + ' für die Namensrechte am ' + c.stadium + '. Der Vorstand ist angetan, die Fanszene ' + ((c.prof.kind || []).indexOf('tradition') >= 0 || (c.prof.kind || []).indexOf('cult') >= 0 ? 'läuft Sturm' : 'ist skeptisch') + '.'; },
    opts: [
      ['Verkaufen', 'Viel Geld – auf Kosten der Fanstimmung', function (s) { var c = uclub(s), k = c.prof.kind || [], amt = Math.round(FM.revenueEstimate(s, c).total * 0.03); FM.book(c, 'sponsor', amt); c.naming = s.season.year; FM.fanMood(s, k.indexOf('tradition') >= 0 || k.indexOf('cult') >= 0 ? -18 : -9); conf(s, 2); return FM.fmtMoney(amt) + ' fließen in die Kasse. In der Kurve hängt am Wochenende ein Banner: „Unser Stadion ist kein Werbeschild".'; }],
      ['Ablehnen', 'Die Fans danken es', function (s) { uclub(s).naming = -1; FM.fanMood(s, 6); return 'Der Name bleibt. Die Fans feiern die Entscheidung, der Vorstand rechnet nach.'; }]
    ], def: 1
  });

  E.push({
    id: 'friendly', cool: 160, w: 1,
    when: function (s, x) { return (x.m === 10 || x.m === 11 || x.m === 3) && x.gap >= 6 ? {} : null; },
    title: function () { return 'Lukratives Testspiel in der Länderspielpause'; },
    text: function (s) { return 'Ein Veranstalter bietet ' + FM.fmtMoney(unit(s) * 4) + ' für ein Einladungsspiel im Ausland. Der Co-Trainer warnt: Reisestress statt Regeneration.'; },
    opts: [
      ['Zusagen', 'Geld gegen Frische', function (s) { FM.book(uclub(s), 'sponsor', unit(s) * 4); squad(s).forEach(function (p) { p.fit = Math.max(40, p.fit - 14); }); return 'Die Kasse klingelt, die Beine sind schwer. Bis zum nächsten Pflichtspiel fehlt etwas Frische.'; }],
      ['Absagen', 'Die Mannschaft erholt sich', function (s) { squad(s).forEach(function (p) { p.fit = Math.min(100, p.fit + 8); }); mor(squad(s), 2); return 'Zwei freie Tage, dann lockeres Training: Die Spieler danken es dir.'; }]
    ], def: 1
  });

  E.push({
    id: 'fanfest', cool: 120, w: 2,
    when: function (s) { var u = s.user; return (u.run && u.run.w >= 4) || u.fans >= 76 ? {} : null; },
    title: function () { return 'Die Kurve plant eine Choreografie'; },
    text: function (s) { return 'Die aktive Fanszene will die Mannschaft mit einer Choreo über die ganze Tribüne feiern und bittet den Verein um einen Zuschuss von ' + FM.fmtMoney(Math.round(unit(s) * 0.5)) + '.'; },
    opts: [
      ['Unterstützen', 'Stärkt die Bindung zur Kurve', function (s) { pay(s, Math.round(unit(s) * 0.5)); FM.fanMood(s, 6); mor(squad(s), 2); return 'Gänsehaut beim Einlaufen: Die Bilder gehen um die Welt, die Mannschaft ist beeindruckt.'; }],
      ['Kein Geld dafür', 'Spart wenig, kostet Sympathie', function (s) { FM.fanMood(s, -2); return 'Die Fans stemmen es allein – und merken sich die Absage.'; }]
    ], def: 0
  });

  E.push({
    id: 'injection', cool: 40, timed: true,
    when: function (s, x) {
      if (!x.next || x.gap > 3 || !bigMatch(s, x.next)) return null;
      var c = sorted(s).slice(0, 8).filter(function (p) { return p.injury && p.injury.days > x.gap && p.injury.days <= x.gap + 6; });
      return c.length ? { p: c[0].id, f: x.next.id } : null;
    },
    title: function (s, pl) { return 'Fit spritzen? ' + s.players[pl.p].name + ' will unbedingt spielen'; },
    text: function (s, pl) { var p = s.players[pl.p]; return p.name + ' fehlt eigentlich noch ' + p.injury.days + ' Tage. Die Ärzte könnten ihn für das Spiel am ' + D.fmt(s.fixtures[pl.f].date) + ' einsatzfähig machen – mit dem Risiko, dass die Verletzung danach schlimmer wird.'; },
    opts: [
      ['Spielen lassen', 'Etwa jedes dritte Mal folgt eine längere Pause', function (s, pl) { var p = mine(s, pl.p); if (!p || !p.injury) return gone(); p.injury = null; p.fit = 82; p.risk = pl.f; return p.name + ' beißt auf die Zähne und steht zur Verfügung.'; }],
      ['Auskurieren lassen', 'Kein Risiko', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], -2); return 'Gesundheit geht vor. ' + p.name + ' schaut von der Tribüne zu.'; }]
    ], def: 1
  });

  E.push({
    id: 'scouttip', cool: 110, w: 2,
    when: function (s, x) { return FM.foreignFor && (x.m === 6 || x.m === 7 || x.m === 8 || x.m === 12 || x.m === 1) ? {} : null; },
    title: function () { return 'Geheimtipp aus dem Ausland'; },
    text: function (s) { return 'Ein alter Bekannter aus der Scoutingszene meldet sich: Er habe ein Talent gesehen, das noch niemand auf dem Zettel hat. Für ' + FM.fmtMoney(Math.round(unit(s) * 0.4)) + ' Honorar verrät er den Namen.'; },
    opts: [
      ['Tipp kaufen', 'Ein Talent landet mit bekanntem Potenzial auf deiner Beobachtungsliste', function (s) {
        pay(s, Math.round(unit(s) * 0.4));
        var lvl = FM.teamStrength(s, s.user.club), ovr = Math.round(FM.clamp(lvl - R.int(5, 9), 50, 82));
        var club = FM.foreignFor(s, ovr, -1, 10);
        if (!club) return 'Der Tipp entpuppt sich als Luftnummer.';
        var p = FM.euMakePlayer(s, club, { pos: R.pick(['ST', 'CAM', 'CM', 'CB', 'LW', 'RW', 'CDM', 'RB', 'LB']), ovr: ovr, age: R.int(17, 20), keep: true, world: R.chance(0.3) }, FM.euTaken(s));
        p.pot = FM.clamp(ovr + R.int(11, 18), ovr, 93);
        p.mkt = s.season.year * 10 + (D.month(s.date) <= 2 ? 2 : 1);
        p.listed = true;
        p.contract.until = s.season.year + 2;
        s.known = s.known || {}; s.known[p.id] = 1;
        if (!FM.onShortlist(s, p.id)) FM.toggleShortlist(s, p.id);
        return 'Der Name: ' + p.name + ', ' + p.age + ' Jahre, ' + FM.POS_NAME[p.pos[0]] + ' bei ' + club.name + '. Stärke ' + p.ovr + ', Potenzial ' + p.pot + '. Er steht jetzt auf deiner Beobachtungsliste (Transfermarkt, Filter „Ausland").';
      }],
      ['Kein Interesse', '', function () { return 'Du lehnst dankend ab.'; }]
    ], def: 1
  });

  E.push({
    id: 'wintercamp', must: true, cool: 300,
    when: function (s, x) { return x.m === 1 && x.day >= 2 && x.day <= 8 ? {} : null; },
    title: function () { return 'Winterpause: Trainingslager oder Heimat?'; },
    text: function (s) { return 'Die Rückrunde wirft ihre Schatten voraus. Ein Trainingslager im Süden kostet ' + FM.fmtMoney(unit(s) * 2) + ', ein Hallenturnier bringt ' + FM.fmtMoney(unit(s)) + ' Antrittsgeld.'; },
    opts: [
      ['Trainingslager im Süden', 'Frische und Form für die Rückrunde', function (s) { pay(s, unit(s) * 2); squad(s).forEach(function (p) { p.fit = 100; }); form(squad(s), 0.7); return 'Sonne, kurze Wege, gute Plätze: Die Mannschaft kommt in Topform zurück.'; }],
      ['Zu Hause trainieren', 'Die Familien danken es', function (s) { mor(squad(s), 3); return 'Training im Schneeregen, abends bei der Familie. Die Stimmung ist gut.'; }],
      ['Hallenturnier spielen', 'Antrittsgeld – mit Verletzungsrisiko', function (s) { FM.book(uclub(s), 'sponsor', unit(s)); FM.fanMood(s, 2); if (R.chance(0.3)) { var c = sorted(s).slice(0, 14).filter(function (p) { return !p.injury; }); if (c.length) { var p = R.pick(c); hurt(s, p, R.int(10, 20), 'Bänderdehnung'); return 'Budenzauber vor vollem Haus – doch ' + p.name + ' knickt auf dem Hallenboden um.'; } } return 'Budenzauber vor vollem Haus, alle bleiben gesund.'; }]
    ], def: 1
  });

  E.push({
    id: 'charity', cool: 150, w: 1,
    when: function () { return {}; },
    title: function () { return 'Anfrage der Kinderklinik'; },
    text: function () { return 'Die Kinderklinik der Stadt lädt die Mannschaft zu einem Besuch ein – ausgerechnet am Tag der intensivsten Trainingseinheit der Woche.'; },
    opts: [
      ['Mit der ganzen Mannschaft hingehen', 'Gut für Fans und Kabine', function (s) { FM.fanMood(s, 3); mor(squad(s), 2); return 'Leuchtende Kinderaugen, nachdenkliche Profis. Der Besuch tut allen gut.'; }],
      ['Training geht vor', 'Eine Abordnung muss reichen', function (s) { form(squad(s), 0.3); return 'Zwei Spieler und der Zeugwart bringen Trikots vorbei, der Rest trainiert.'; }]
    ], def: 0
  });

  E.push({
    id: 'teambonus', cool: 300, w: 4,
    when: function (s) {
      var c = uclub(s), lid = c.league;
      if (!FM.ZONES[lid] || !c.expect) return null;
      var left = (s.leagues[lid].rounds || 34) - FM.playedRounds(s, lid), pos = FM.clubPosition(s, c.id);
      return left >= 3 && left <= 7 && Math.abs(pos - c.expect.target) <= 2 ? {} : null;
    },
    title: function () { return 'Endspurt: Sonderprämie für die Mannschaft?'; },
    text: function (s) { return 'Das Saisonziel steht auf der Kippe. Der Mannschaftsrat fragt, ob der Verein für den Endspurt eine Sonderprämie von ' + FM.fmtMoney(unit(s) * 3) + ' auslobt.'; },
    opts: [
      ['Prämie ausloben', 'Motivationsschub für den Endspurt', function (s) { pay(s, unit(s) * 3, 'fees'); mor(squad(s), 8); form(squad(s), 0.4); return 'Die Kabine johlt. Für die letzten Spiele ist jeder noch ein paar Prozent bissiger.'; }],
      ['An die Ehre appellieren', 'Kostet nichts', function (s) { if (R.chance(0.4)) { mor(squad(s), 3); return 'Deine Ansprache sitzt: Es geht um den Verein, nicht ums Geld.'; } mor(squad(s), -2); return 'Die Spieler nicken höflich. Begeisterung sieht anders aus.'; }]
    ], def: 1
  });

  E.push({
    id: 'farewell', cool: 200, w: 3,
    when: function (s, x) {
      if (x.m < 3 || x.m > 5) return null;
      var c = squad(s).filter(function (p) { return p.age >= 33 && !p.loan && p.contract.until <= s.season.year + 1 && s.season.year - p.joined >= 3; });
      return c.length ? { p: c.sort(function (a, b) { return a.joined - b.joined; })[0].id } : null;
    },
    title: function (s, pl) { return s.players[pl.p].name + ': Abschied oder noch ein Jahr?'; },
    text: function (s, pl) { var p = s.players[pl.p]; return p.name + ' ist ' + p.age + ' und seit ' + p.joined + ' im Verein. Sein Vertrag läuft aus. Die Fans lieben ihn, er selbst würde gern noch ein Jahr dranhängen – zu halbem Gehalt.'; },
    opts: [
      ['Ein Jahr verlängern', 'Halbes Gehalt, die Fans feiern', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); p.contract.until++; p.contract.wage = Math.max(20000, FM.niceRound(p.contract.wage * 0.5)); mor([p], 10); mor(squad(s), 1); FM.fanMood(s, 4); return p.name + ' bleibt bis ' + p.contract.until + '. „Einmal ' + uclub(s).short + ', immer ' + uclub(s).short + '."'; }],
      ['Würdig verabschieden', 'Abschiedsspiel am letzten Heimspieltag', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); FM.fanMood(s, 2); mor([p], 3); return 'Blumen, Ehrenrunde, Tränen: ' + p.name + ' bekommt den Abschied, den er verdient.'; }],
      ['Nüchtern bleiben', 'Der Vertrag läuft einfach aus', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); FM.fanMood(s, -4); mor([p], -8); return 'Kein Wort, keine Geste. In den Fanforen brodelt es.'; }]
    ], def: 1
  });

  /* Nach einem abgelehnten Angebot eines groesseren Vereins */
  E.push({
    id: 'wantaway', cool: 0, w: 0,
    when: function () { return null; },
    title: function (s, pl) { return s.players[pl.p].name + ' ist enttäuscht'; },
    text: function (s, pl) { var p = s.players[pl.p], c = s.clubs[pl.c]; return 'Du hast das Angebot von ' + (c ? c.name : 'einem anderen Verein') + ' über ' + FM.fmtMoney(pl.fee) + ' abgelehnt. ' + p.name + ' hätte den Schritt gern gemacht und bittet um ein Gespräch.'; },
    opts: [
      ['Gehalt aufbessern', '+15 % Gehalt, Thema vom Tisch', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); p.contract.wage = FM.niceRound(p.contract.wage * 1.15); mor([p], 6); p.wants = false; return p.name + ' akzeptiert: mehr Geld, volle Konzentration auf ' + uclub(s).short + '.'; }],
      ['Wechsel im Sommer zusagen', 'Er bleibt ruhig – bis dahin', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); mor([p], 3); p.saleOk = s.season.year + 1; return 'Per Handschlag vereinbart: Kommt im Sommer ein passendes Angebot, legst du ' + p.name + ' keine Steine in den Weg.'; }],
      ['Hart bleiben', 'Er könnte auf einen Wechsel drängen', function (s, pl) { var p = mine(s, pl.p); if (!p) return gone(); if (R.chance(0.6)) { mor([p], -10); p.wants = true; return p.name + ' verlässt wütend dein Büro und fordert öffentlich seine Freigabe.'; } mor([p], -3); return p.name + ' ist verstimmt, fügt sich aber.'; }]
    ], def: 2
  });

  FM.EVENTS = E;
  var BY = {};
  E.forEach(function (e) { BY[e.id] = e; });

  function optsOf(state, n) { var e = BY[n.action.ev]; return typeof e.opts === 'function' ? e.opts(state, n.action.pl) : e.opts; }
  FM.eventOptions = function (state, n) { return optsOf(state, n).map(function (o) { return [o[0], o[1]]; }); };

  FM.fireEvent = function (state, id, pl) {
    var e = BY[id];
    state.ev = state.ev || { cool: {} };
    state.ev.last = state.date;
    if (e.cool) state.ev.cool[id] = D.add(state.date, e.cool);
    return FM.addNews(state, { type: 'event', important: true, title: e.title(state, pl), body: e.text(state, pl), action: { kind: 'event', ev: id, pl: pl, until: D.add(state.date, 7), done: null } });
  };

  FM.resolveEvent = function (state, newsId, idx, auto) {
    var n = state.news.filter(function (x) { return x.id === newsId; })[0];
    if (!n || !n.action || n.action.kind !== 'event' || n.action.done != null) return null;
    var e = BY[n.action.ev];
    if (!e) { n.action.done = -1; return null; }
    var opts = optsOf(state, n), o = opts[idx] || opts[0];
    n.action.done = opts.indexOf(o);
    n.action.label = o[0];
    n.action.res = (auto ? 'Du hast nicht reagiert – dein Co-Trainer hat entschieden. ' : '') + o[2](state, n.action.pl);
    return n.action.res;
  };

  /* Taeglich: liegengebliebene Entscheidungen, Versprechen, neue Ereignisse */
  FM.eventsDaily = function (state) {
    if (state.user.fired) return;
    var uc = state.user.club, club = state.clubs[uc];
    state.ev = state.ev || { cool: {} };
    var open = 0;
    state.news.forEach(function (n) {
      if (!n.action || n.action.kind !== 'event' || n.action.done != null) return;
      if (n.action.until < state.date) FM.resolveEvent(state, n.id, BY[n.action.ev] ? BY[n.action.ev].def || 0 : 0, true);
      else open++;
    });
    // Versprechen
    FM.clubPlayers(state, uc).forEach(function (p) {
      if (!p.promise || p.promise.until > state.date) return;
      var kept = (p.promise.got || 0) >= p.promise.need;
      p.promise = null;
      if (kept) { p.mor = FM.clamp(p.mor + 6, 5, 100); FM.addNews(state, { type: 'board', quiet: true, title: 'Wort gehalten: ' + p.name, body: p.name + ' hat die versprochenen Einsätze bekommen. Das spricht sich in der Kabine herum.' }); }
      else {
        p.mor = FM.clamp(p.mor - 15, 5, 100);
        if (p.age >= 22 && R.chance(0.4)) p.wants = true;
        FM.addNews(state, { type: 'board', important: true, title: 'Versprechen gebrochen: ' + p.name, body: p.name + ' hat die zugesagte Spielzeit nicht bekommen. Er ist tief enttäuscht' + (p.wants ? ' und will den Verein verlassen.' : '.') + ' Auch andere Spieler haben das registriert.' });
        FM.clubPlayers(state, uc).forEach(function (q) { q.mor = FM.clamp(q.mor - 1, 5, 100); });
      }
    });
    if (open >= 2) return;
    var m = D.month(state.date), day = +state.date.slice(8, 10);
    var next = FM.nextUserFixture(state);
    var x = { club: club, m: m, day: day, next: next, gap: next ? D.diff(state.date, next.date) : 99 };
    if (FM.userFixture(state)) return;                         // am Spieltag selbst herrscht Ruhe
    var ready = function (e) { return !(state.ev.cool[e.id] > state.date); };
    // feste Termine im Jahreslauf
    var must = E.filter(function (e) { return e.must && ready(e); });
    for (var i = 0; i < must.length; i++) {
      var pl = must[i].when(state, x);
      if (pl) { FM.fireEvent(state, must[i].id, pl); return; }
    }
    // Anlaesse vor grossen Spielen (Pressekonferenz, angeschlagener Leistungstraeger)
    if (!state.ev.last || D.diff(state.ev.last, state.date) >= 3) {
      var timed = E.filter(function (e) { return e.timed && ready(e); });
      for (var k = 0; k < timed.length; k++) {
        var tp = timed[k].when(state, x);
        if (tp && R.chance(0.4)) { FM.fireEvent(state, timed[k].id, tp); return; }
      }
    }
    var inSeason = FM.ZONES[club.league] && FM.playedRounds(state, club.league) >= 1 && !state.leagueDone[club.league];
    if (!inSeason && !(m === 7 || m === 8 || m === 1)) return;
    if (state.ev.last && D.diff(state.ev.last, state.date) < 10) return;
    if (!R.chance(0.05)) return;
    var cands = [];
    E.forEach(function (e) {
      if (e.must || e.timed || !e.w || !ready(e)) return;
      var p2 = e.when(state, x);
      if (p2) cands.push({ e: e, pl: p2 });
    });
    if (!cands.length) return;
    var c = R.weighted(cands, function (q) { return q.e.w; });
    FM.fireEvent(state, c.e.id, c.pl);
  };

  /* Ein groesserer Verein wurde abgewiesen: Der Spieler ist enttaeuscht */
  FM.onOfferDeclined = function (state, o, p) {
    var me = state.clubs[state.user.club], b = state.clubs[o.from];
    if (!b || o.type === 'loan' || p.club !== me.id) return;
    if (p.saleOk && p.saleOk <= state.season.year) { p.mor = FM.clamp(p.mor - 12, 5, 100); p.wants = true; FM.addNews(state, { type: 'board', important: true, title: p.name + ' pocht auf die Abmachung', body: 'Du hattest ' + p.name + ' zugesagt, ihn bei einem passenden Angebot ziehen zu lassen. Jetzt lehnst du ab – er fordert öffentlich seine Freigabe.' }); return; }
    var bigger = b.rep >= me.rep + 8 || (b.eu && b.str >= FM.teamStrength(state, me.id) + 3);
    if (!bigger || FM.interest(state, p, b.id) < 60 || !R.chance(0.6)) return;
    FM.fireEvent(state, 'wantaway', { p: p.id, c: b.id, fee: o.fee });
  };

  /* Saisonende: Zusatzziel des Vorstands und Erfolgspraemie des Sponsors */
  FM.eventsSeasonEnd = function (state, sm) {
    var u = state.user, uc = sm.user.club, club = state.clubs[uc];
    var o = u.obj;
    if (o && o.y === sm.year) {
      var ok = false, what = '';
      if (o.k === 'cup') {
        var reached = 0;
        state.cup.rounds.forEach(function (r, i) { if (r.fx.some(function (fid) { var f = state.fixtures[fid]; return f.home === uc || f.away === uc; })) reached = i + 1; });
        ok = reached >= o.t || state.cup.winner === uc; what = 'Pokal: ' + FM.CUP_ROUNDS[o.t - 1];
      } else if (o.k === 'youth') {
        var mins = FM.sum(FM.clubPlayers(state, uc), function (p) { return p.src === 'y' && p.age <= 21 ? p.st.mins : 0; });
        ok = mins >= o.t; what = mins + ' von ' + o.t + ' Minuten für Eigengewächse';
      } else {
        var best = Math.max.apply(null, FM.clubPlayers(state, uc).map(function (p) { return p.st.goals; }).concat([0]));
        ok = best >= o.t; what = 'bester Torschütze mit ' + best + ' Ligatoren (Ziel ' + o.t + ')';
      }
      var amt = Math.max(10000, FM.niceRound(FM.revenueEstimate(state, club).total * 0.016));
      if (ok) { FM.book(club, 'prize', amt); u.conf = FM.clamp(u.conf + 6, 0, 100); }
      else u.conf = FM.clamp(u.conf - 4, 0, 100);
      sm.user.obj = { ok: ok, what: what, amt: ok ? amt : 0 };
      FM.addNews(state, { type: 'board', title: ok ? 'Zusatzziel erreicht' : 'Zusatzziel verfehlt', body: (ok ? 'Du hast Wort gehalten (' + what + '). Der Vorstand überweist die Prämie von ' + FM.fmtMoney(amt) + ' und stärkt dir den Rücken.' : 'Zugesagt, nicht geliefert (' + what + '). Der Vorstand ist enttäuscht.') });
    }
    var b = u.bonus;
    if (b && b.y === sm.year) {
      var hit = sm.user.pos && sm.user.pos <= b.pos;
      if (hit) FM.book(club, 'sponsor', b.amt);
      FM.addNews(state, { type: 'board', quiet: true, title: 'Erfolgsprämie des Sponsors', body: hit ? 'Saisonziel erreicht: Der Hauptsponsor zahlt die vereinbarten ' + FM.fmtMoney(b.amt) + '.' : 'Saisonziel verfehlt – die Erfolgsprämie des Hauptsponsors verfällt.' });
    }
    u.obj = null; u.bonus = null; u.tix = null; u.camp = null; u.vow = null;
  };

  /* ---------- Halbzeitansprache ---------- */
  FM.TALKS = [['praise', 'Loben', 'Weiter so!'], ['calm', 'Ruhig bleiben', 'Sachlich korrigieren'], ['rouse', 'Wachrütteln', 'Kabinenpredigt']];
  FM.teamTalk = function (m, si, kind) {
    var side = m.sides[si], gd = m.goals[si] - m.goals[1 - si];
    if (m.agg) gd += si === 0 ? m.agg[0] - m.agg[1] : m.agg[1] - m.agg[0];
    var b = 0, txt;
    if (kind === 'praise') {
      if (gd > 0) { if (R.chance(gd >= 2 ? 0.45 : 0.62)) { b = 0.8; txt = 'Das Lob beflügelt: Die Mannschaft will nachlegen.'; } else { b = -0.7; txt = 'Zu viel Lob – die Spieler wirken nach der Pause zu selbstsicher.'; } }
      else if (gd === 0) { if (R.chance(0.5)) { b = 0.4; txt = 'Die aufmunternden Worte kommen an.'; } else txt = 'Die Mannschaft nimmt das Lob zur Kenntnis.'; }
      else { if (R.chance(0.35)) { b = 0.3; txt = 'Du baust die Spieler auf – sie glauben wieder an sich.'; } else { b = -0.5; txt = 'Lob beim Rückstand? Die Spieler schauen sich ratlos an.'; } }
    } else if (kind === 'calm') {
      b = gd < 0 ? 0.4 : 0.25; txt = 'Zwei, drei klare Korrekturen – die Mannschaft wirkt sortierter.';
    } else {
      if (gd < 0) { if (R.chance(0.58)) { b = 1.3; txt = 'Die Kabinenpredigt wirkt: Deine Mannschaft kommt wie ausgewechselt aus der Pause!'; } else { b = -0.7; txt = 'Die Standpauke verunsichert die Spieler – sie verkrampfen.'; } }
      else if (gd === 0) { if (R.chance(0.6)) { b = 0.9; txt = 'Deutliche Worte, wache Gesichter: Jetzt ist Feuer drin.'; } else { b = -0.4; txt = 'Die Mannschaft versteht den Wutausbruch nicht.'; } }
      else { if (R.chance(0.3)) { b = 0.3; txt = 'Trotz Führung hältst du die Spannung hoch.'; } else { b = -0.8; txt = 'Schelte trotz Führung? Die Stimmung kippt.'; } }
    }
    side.boost = (side.boost || 0) + b;
    m.dirty[si] = true;
    m._ev({ t: 'talk', s: si, txt: txt });
    return { boost: b, text: txt };
  };

  /* ---------- Testspiele in der Vorbereitung ---------- */
  FM.scheduleFriendlies = function (state) {
    var uc = state.user.club, club = state.clubs[uc], y = state.season.year;
    if (club.league === 'rl' || FM.userFixtures(state).some(function (f) { return f.comp === 'fr' && !f.res; })) return 0;
    var first = FM.userFixtures(state).filter(function (f) { return f.comp !== 'fr'; })[0];
    var limit = first ? D.add(first.date, -6) : D.iso(y, 8, 1);
    var dates = [], d = D.iso(y, 7, 8);
    while (D.weekday(d) !== 6) d = D.add(d, 1);
    for (; d <= limit && dates.length < 4; d = D.add(d, 7)) if (d > state.date) dates.push(d);
    if (!dates.length) return 0;
    var str = FM.teamStrength(state, uc), used = {};
    var german = function (lo, hi) {
      var list = Object.keys(state.clubs).map(function (k) { return state.clubs[k]; }).filter(function (c) {
        if (c.guest || c.id === uc || used[c.id] || c.league === club.league || c.squad.length < 16) return false;
        var s = FM.teamStrength(state, c.id);
        return s >= str + lo && s <= str + hi;
      });
      return list.length ? R.pick(list) : null;
    };
    var plan = [function () { return german(-14, -5); }, function () { var c = FM.foreignFor ? FM.foreignFor(state, str, 3, 3) : null; if (c) FM.euSquad(state, c.id); return c; }, function () { return german(-4, 2); }, function () { return german(1, 9) || german(-3, 3); }];
    var made = 0;
    dates.forEach(function (date, i) {
      var opp = plan[i % plan.length]();
      if (!opp) return;
      used[opp.id] = 1;
      var home = i % 2 === 1;
      var fx = FM.newFixture(state, { comp: 'fr', round: i + 1, date: date, home: home ? uc : opp.id, away: home ? opp.id : uc });
      FM.addCalendar(state, date, 'fr', i + 1, [fx.id], 'Testspiel');
      made++;
    });
    if (made) FM.addNews(state, { type: 'info', quiet: true, title: 'Testspiele vereinbart', body: 'In der Vorbereitung stehen ' + made + ' Testspiele an. Sie bringen Spielpraxis ohne Druck – Ergebnisse zählen nicht, Verletzungen leider schon.' });
    return made;
  };
})();
