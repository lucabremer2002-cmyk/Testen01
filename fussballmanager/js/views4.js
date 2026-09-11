/*
 * views4.js - Dialoge: Gespräche, Verträge, Angebote, Leihen, Vorstand,
 * Ticketpreise, Scouting, Baumaßnahmen, Spielbericht und Vereinswechsel.
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util, D = FM.data, P = FM.players, T = FM.tactics;
  var C = FM.competitions, F = FM.finance, UI = FM.ui, V = FM.views;
  var esc = UI.esc;

  // ============================================================ Spielergespräch

  V.gespraechsDialog = function (spielerId) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    if (!p) return;
    var themen = Object.keys(FM.media.GESPRAECHSTHEMEN).filter(function (k) {
      var t = FM.media.GESPRAECHSTHEMEN[k];
      return !t.pruefen || t.pruefen(world, p);
    });

    var html = '<h4>Gespräch unter vier Augen</h4><h2>' + esc(p.vorname + ' ' + p.nachname) + '</h2>' +
      '<div class="tiles mb">' +
      '<div class="tile"><span>Moral</span><b>' + Math.round(p.moral) + ' %</b></div>' +
      '<div class="tile"><span>Form</span><b>' + Math.round(p.form) + '</b></div>' +
      '<div class="tile"><span>Ø Note</span><b>' + (P.schnitt(p.stats) ? U.note(P.schnitt(p.stats)) : '–') + '</b></div>' +
      '<div class="tile"><span>Wechselwunsch</span><b>' + Math.round(p.wechselwunsch) + ' %</b></div>' +
      '</div>' +
      '<p class="klein muted">Ob ein Gespräch wirkt, hängt von der Persönlichkeit des Spielers, seiner Leistung ' +
      'und Ihrer Menschenführung ab. Unpassendes Lob oder ungerechte Kritik schaden.</p>' +
      '<div class="optionen">' + themen.map(function (k) {
        return '<button class="option" data-t="' + k + '"><b>' + esc(FM.media.GESPRAECHSTHEMEN[k].name) + '</b></button>';
      }).join('') + '</div>';

    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-t]'), function (b) {
          b.onclick = function () {
            var r = FM.media.gespraechFuehren(world, spielerId, b.dataset.t);
            if (r.fehler) { UI.toast(r.fehler, 'fehler'); return; }
            UI.modal('<h2>' + esc(p.nachname) + '</h2><p>' + esc(r.text) + '</p>' +
              '<div class="flex mt"><button class="btn btn--primary" data-zu="1">Verstanden</button></div>', {
              nachher: function (b2) { b2.querySelector('[data-zu]').onclick = function () { UI.modalZu(); UI.zeichne(); }; }
            });
          };
        });
      }
    });
  };

  // ============================================================ Individualtraining

  V.fokusDialog = function (spielerId) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    if (!p) return;
    var html = '<h2>Individuelles Training</h2><p class="muted">' + esc(p.nachname) +
      ' arbeitet zusätzlich an einem Schwerpunkt.</p><div class="optionen">' +
      Object.keys(D.INDIVIDUALTRAINING).filter(function (k) {
        return !(k === 'torwart' && p.pos !== 'TW');
      }).map(function (k) {
        var t = D.INDIVIDUALTRAINING[k];
        return '<button class="option' + (p.trainingsfokus === k ? '' : '') + '" data-f="' + k + '"><b>' +
          esc(t.name) + '</b>' + (p.trainingsfokus === k ? ' <span class="chip chip--gruen">aktiv</span>' : '') +
          (t.gruppen.length ? '<br><span class="klein muted">' +
            t.gruppen.map(function (g) { return esc(D.ATTR_NAME[g]); }).join(', ') + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-f]'), function (b) {
          b.onclick = function () {
            p.trainingsfokus = b.dataset.f;
            UI.modalZu(); UI.toast('Schwerpunkt gesetzt: ' + D.INDIVIDUALTRAINING[b.dataset.f].name); UI.zeichne();
          };
        });
      }
    });
  };

  // ============================================================ Vertragsverhandlung

  V.vertragsDialog = function (spielerId, neuerSpieler) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    if (!p) return;
    var club = world.nutzerVerein();
    var f = world.finanzen[club.id];
    var vorschlag = P.gehaltsforderung(p, club, world);
    var jahre = p.alter <= 24 ? 4 : p.alter <= 30 ? 3 : 2;

    function formular(gehalt, jahreW, handgeld, rolle, klausel, meldung) {
      return '<h4>' + (neuerSpieler ? 'Vertragsangebot' : 'Vertragsverlängerung') + '</h4>' +
        '<h2>' + esc(p.vorname + ' ' + p.nachname) + '</h2>' +
        '<div class="tiles mb">' +
        '<div class="tile"><span>Stärke</span><b>' + Math.round(P.gesamt(p)) + '</b></div>' +
        '<div class="tile"><span>Alter</span><b>' + p.alter + '</b></div>' +
        '<div class="tile"><span>Marktwert</span><b style="font-size:15px">' + U.money(p.marktwert) + '</b></div>' +
        '<div class="tile"><span>Aktuelles Gehalt</span><b style="font-size:15px">' +
        (p.vertrag ? U.money(p.vertrag.gehalt) : '–') + '</b></div>' +
        '<div class="tile"><span>Gehaltsbudget frei</span><b style="font-size:15px">' +
        U.money(Math.max(0, f.gehaltsbudget - F.wochenLohnsumme(world, club.id))) + '</b></div>' +
        '</div>' +
        (meldung ? '<div class="card card--flat mb">' + meldung + '</div>' : '') +
        '<div class="grid grid--3">' +
        '<div><label>Wochengehalt</label><input type="number" data-v="gehalt" value="' + gehalt + '" step="500" min="500"></div>' +
        '<div><label>Laufzeit (Jahre)</label><input type="number" data-v="jahre" value="' + jahreW + '" min="1" max="6"></div>' +
        '<div><label>Handgeld</label><input type="number" data-v="handgeld" value="' + handgeld + '" step="10000" min="0"></div>' +
        '<div><label>Rolle im Kader</label><select data-v="rolle">' +
        Object.keys(FM.transfers.ROLLENVERSPRECHEN).map(function (k) {
          return '<option value="' + k + '"' + (rolle === k ? ' selected' : '') + '>' +
            esc(FM.transfers.ROLLENVERSPRECHEN[k].name) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Ausstiegsklausel (0 = keine)</label><input type="number" data-v="klausel" value="' + klausel + '" step="500000" min="0"></div>' +
        '</div>' +
        '<div class="flex mt"><button class="btn btn--primary" data-a="anbieten">Angebot unterbreiten</button>' +
        '<button class="btn" data-a="abbruch">Abbrechen</button></div>' +
        '<p class="klein muted mt">Jahresbelastung: <b>' + U.money(gehalt * 52) + '</b>' +
        (handgeld ? ' zuzüglich ' + U.money(handgeld) + ' Handgeld' : '') + '</p>';
    }

    function zeige(gehalt, jahreW, handgeld, rolle, klausel, meldung) {
      UI.modal(formular(gehalt, jahreW, handgeld, rolle, klausel, meldung), {
        nachher: function (body) {
          function v(k) { return body.querySelector('[data-v="' + k + '"]'); }
          body.querySelector('[data-a="abbruch"]').onclick = UI.modalZu;
          body.querySelector('[data-a="anbieten"]').onclick = function () {
            var angebot = {
              gehalt: Math.max(500, parseInt(v('gehalt').value, 10) || 0),
              jahre: U.clamp(parseInt(v('jahre').value, 10) || 1, 1, 6),
              handgeld: Math.max(0, parseInt(v('handgeld').value, 10) || 0),
              rolle: v('rolle').value,
              ausstiegsklausel: Math.max(0, parseInt(v('klausel').value, 10) || 0)
            };
            var lohnDanach = F.wochenLohnsumme(world, club.id) - (p.clubId === club.id && p.vertrag ? p.vertrag.gehalt : 0) + angebot.gehalt;
            if (lohnDanach > f.gehaltsbudget * 1.02) {
              zeige(angebot.gehalt, angebot.jahre, angebot.handgeld, angebot.rolle, angebot.ausstiegsklausel,
                '<b class="w-schlecht">Das Gehaltsbudget reicht nicht.</b> Erforderlich wären ' +
                U.money(lohnDanach) + ' pro Woche, freigegeben sind ' + U.money(f.gehaltsbudget) + '.');
              return;
            }
            if (angebot.handgeld > f.kontostand) {
              zeige(angebot.gehalt, angebot.jahre, angebot.handgeld, angebot.rolle, angebot.ausstiegsklausel,
                '<b class="w-schlecht">Das Handgeld übersteigt den Kontostand.</b>');
              return;
            }

            var r = neuerSpieler
              ? FM.transfers.ablösefreiVerpflichten(world, spielerId, angebot)
              : FM.transfers.verlaengerungAnbieten(world, spielerId, angebot);

            if (r.status === 'angenommen') {
              UI.modalZu();
              UI.toast(p.nachname + ' hat unterschrieben.', 'gut');
              UI.zeichne();
            } else if (r.status === 'gegenforderung') {
              zeige(Math.round(r.gefordert / 500) * 500, angebot.jahre, angebot.handgeld, angebot.rolle, angebot.ausstiegsklausel,
                '<b class="w-mittel">Gegenforderung:</b> ' + esc(r.text) +
                ' Der Vorschlag wurde entsprechend angepasst.');
            } else {
              zeige(angebot.gehalt, angebot.jahre, angebot.handgeld, angebot.rolle, angebot.ausstiegsklausel,
                '<b class="w-schlecht">Abgelehnt:</b> ' + esc(r.text || r.fehler || 'Die Gespräche sind gescheitert.'));
            }
          };
        }
      });
    }

    zeige(Math.round(vorschlag * 1.05 / 500) * 500, jahre, 0, 'stamm', 0, null);
  };

  // ============================================================ Transferangebot

  V.angebotsDialog = function (spielerId) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    if (!p) return;
    var club = world.nutzerVerein();
    var f = world.finanzen[club.id];

    if (!p.clubId) { V.vertragsDialog(spielerId, true); return; }
    if (!world.transferfenster.offen) {
      UI.toast('Das Transferfenster ist geschlossen. Nur vertragslose Spieler sind möglich.', 'fehler');
      return;
    }
    if (p.clubId === club.id) return;

    var abgeber = world.vereine[p.clubId];
    var bereit = FM.transfers.verkaufsbereitschaft(world, p);
    var schaetzung = P.forderung(p, world, abgeber);

    function formular(gebot, sofortAnteil, raten, boni, weiterverkauf, meldung) {
      return '<h4>Transferangebot</h4><h2>' + esc(p.vorname + ' ' + p.nachname) + '</h2>' +
        '<div class="tiles mb">' +
        '<div class="tile"><span>Verein</span><b style="font-size:14px">' + esc(abgeber.name) + '</b></div>' +
        '<div class="tile"><span>Marktwert</span><b style="font-size:15px">' + U.money(p.marktwert) + '</b></div>' +
        '<div class="tile"><span>Verkaufsbereitschaft</span><b>' + Math.round(bereit * 100) + ' %</b></div>' +
        '<div class="tile"><span>Transferbudget</span><b style="font-size:15px">' + U.money(f.transferbudget) + '</b></div>' +
        (p.vertrag && p.vertrag.ausstiegsklausel
          ? '<div class="tile"><span>Ausstiegsklausel</span><b style="font-size:15px">' + U.money(p.vertrag.ausstiegsklausel) + '</b></div>' : '') +
        '</div>' +
        (meldung ? '<div class="card card--flat mb">' + meldung + '</div>' : '') +
        '<div class="grid grid--3">' +
        '<div><label>Ablöse gesamt</label><input type="number" data-v="gebot" value="' + gebot + '" step="100000" min="0"></div>' +
        '<div><label>Sofort zahlbar (%)</label><input type="number" data-v="sofort" value="' + sofortAnteil + '" min="20" max="100" step="10"></div>' +
        '<div><label>Restraten (Jahre)</label><input type="number" data-v="raten" value="' + raten + '" min="1" max="4"></div>' +
        '<div><label>Erfolgsboni</label><input type="number" data-v="boni" value="' + boni + '" step="100000" min="0"></div>' +
        '<div><label>Weiterverkaufsbeteiligung (%)</label><input type="number" data-v="wv" value="' + weiterverkauf + '" min="0" max="40"></div>' +
        '</div>' +
        '<div class="flex mt"><button class="btn btn--primary" data-a="bieten">Angebot abgeben</button>' +
        '<button class="btn" data-a="leihe">Stattdessen ausleihen</button>' +
        '<button class="btn" data-a="abbruch">Abbrechen</button></div>';
    }

    function zeige(gebot, sofortAnteil, raten, boni, wv, meldung) {
      UI.modal(formular(gebot, sofortAnteil, raten, boni, wv, meldung), {
        nachher: function (body) {
          function v(k) { return body.querySelector('[data-v="' + k + '"]'); }
          body.querySelector('[data-a="abbruch"]').onclick = UI.modalZu;
          body.querySelector('[data-a="leihe"]').onclick = function () { V.leiheDialog(spielerId); };
          body.querySelector('[data-a="bieten"]').onclick = function () {
            var gesamt = Math.max(0, parseInt(v('gebot').value, 10) || 0);
            var anteil = U.clamp(parseInt(v('sofort').value, 10) || 100, 20, 100);
            var sofort = Math.round(gesamt * anteil / 100);
            var angebot = {
              gesamt: gesamt, sofort: sofort,
              raten: U.clamp(parseInt(v('raten').value, 10) || 1, 1, 4),
              boni: Math.max(0, parseInt(v('boni').value, 10) || 0),
              weiterverkauf: U.clamp(parseInt(v('wv').value, 10) || 0, 0, 40)
            };
            if (sofort > f.kontostand) {
              zeige(gesamt, anteil, angebot.raten, angebot.boni, angebot.weiterverkauf,
                '<b class="w-schlecht">Die Sofortzahlung übersteigt den Kontostand (' + U.money(f.kontostand) + ').</b>');
              return;
            }
            if (gesamt > f.transferbudget) {
              zeige(gesamt, anteil, angebot.raten, angebot.boni, angebot.weiterverkauf,
                '<b class="w-schlecht">Das Transferbudget von ' + U.money(f.transferbudget) + ' reicht nicht aus.</b>');
              return;
            }

            var antwort = FM.transfers.pruefeAngebot(world, p, angebot, club.id);
            if (antwort.status === 'angenommen') {
              UI.modalZu();
              vertragNachTransfer(p, angebot);
            } else if (antwort.status === 'gegenangebot') {
              zeige(antwort.gegenangebot, anteil, angebot.raten, angebot.boni, angebot.weiterverkauf,
                '<b class="w-mittel">' + esc(abgeber.name) + ':</b> ' + esc(antwort.text));
            } else {
              zeige(gesamt, anteil, angebot.raten, angebot.boni, angebot.weiterverkauf,
                '<b class="w-schlecht">' + esc(abgeber.name) + ':</b> ' + esc(antwort.text));
            }
          };
        }
      });
    }

    zeige(Math.round(schaetzung / 100000) * 100000, 100, 2, 0, 0,
      '<span class="klein muted">Die Scoutingabteilung schätzt die Forderung auf etwa ' +
      U.money(schaetzung) + '.</span>');
  };

  /** Nach der Einigung mit dem Verein folgt die Einigung mit dem Spieler. */
  function vertragNachTransfer(p, ablösePaket) {
    var world = UI.world;
    var club = world.nutzerVerein();
    var f = world.finanzen[club.id];
    var basis = P.gehaltsforderung(p, club, world);
    var jahre = p.alter <= 24 ? 4 : p.alter <= 30 ? 3 : 2;

    function zeige(gehalt, jahreW, handgeld, rolle, meldung) {
      var html = '<h4>Die Vereine sind sich einig</h4><h2>Vertrag mit ' + esc(p.nachname) + '</h2>' +
        '<p class="muted">Ablöse: <b>' + U.money(ablösePaket.gesamt) + '</b>' +
        (ablösePaket.sofort < ablösePaket.gesamt ? ' (davon ' + U.money(ablösePaket.sofort) + ' sofort)' : '') + '</p>' +
        (meldung ? '<div class="card card--flat mb">' + meldung + '</div>' : '') +
        '<div class="grid grid--3">' +
        '<div><label>Wochengehalt</label><input type="number" data-v="gehalt" value="' + gehalt + '" step="500" min="500"></div>' +
        '<div><label>Laufzeit (Jahre)</label><input type="number" data-v="jahre" value="' + jahreW + '" min="1" max="6"></div>' +
        '<div><label>Handgeld</label><input type="number" data-v="handgeld" value="' + handgeld + '" step="10000" min="0"></div>' +
        '<div><label>Rolle im Kader</label><select data-v="rolle">' +
        Object.keys(FM.transfers.ROLLENVERSPRECHEN).map(function (k) {
          return '<option value="' + k + '"' + (rolle === k ? ' selected' : '') + '>' +
            esc(FM.transfers.ROLLENVERSPRECHEN[k].name) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="flex mt"><button class="btn btn--primary" data-a="ok">Vertrag anbieten</button>' +
        '<button class="btn" data-a="ab">Transfer abbrechen</button></div>';

      UI.modal(html, {
        nachher: function (body) {
          function v(k) { return body.querySelector('[data-v="' + k + '"]'); }
          body.querySelector('[data-a="ab"]').onclick = function () { UI.modalZu(); UI.toast('Transfer abgebrochen.'); };
          body.querySelector('[data-a="ok"]').onclick = function () {
            var angebot = {
              gehalt: Math.max(500, parseInt(v('gehalt').value, 10) || 0),
              jahre: U.clamp(parseInt(v('jahre').value, 10) || 1, 1, 6),
              handgeld: Math.max(0, parseInt(v('handgeld').value, 10) || 0),
              rolle: v('rolle').value
            };
            if (F.wochenLohnsumme(world, club.id) + angebot.gehalt > f.gehaltsbudget * 1.02) {
              zeige(angebot.gehalt, angebot.jahre, angebot.handgeld, angebot.rolle,
                '<b class="w-schlecht">Das Gehaltsbudget reicht nicht aus.</b>');
              return;
            }
            var r = FM.transfers.pruefeVertragsangebot(world, p, angebot, club.id);
            if (r.status === 'angenommen') {
              FM.transfers.fuehreTransferDurch(world, p, club.id, {
                ablöse: ablösePaket.gesamt, sofort: ablösePaket.sofort, raten: ablösePaket.raten,
                handgeld: angebot.handgeld, weiterverkauf: ablösePaket.weiterverkauf,
                rolle: angebot.rolle,
                vertrag: {
                  bis: world.tag + angebot.jahre * 365, unterschrieben: world.tag,
                  gehalt: angebot.gehalt, handgeld: angebot.handgeld, ausstiegsklausel: 0,
                  praemien: {
                    einsatz: Math.round(angebot.gehalt * 0.10 / 100) * 100,
                    tor: Math.round(angebot.gehalt * 0.12 / 100) * 100,
                    sieg: Math.round(angebot.gehalt * 0.09 / 100) * 100,
                    zuNull: p.pos === 'TW' || D.POS_GRUPPE[p.pos] === 'ABW' ? Math.round(angebot.gehalt * 0.08 / 100) * 100 : 0
                  },
                  weiterverkauf: ablösePaket.weiterverkauf || 0
                }
              });
              UI.modalZu();
              UI.toast(p.vorname + ' ' + p.nachname + ' ist verpflichtet!', 'gut');
              UI.zeichne();
            } else if (r.status === 'gegenforderung') {
              zeige(Math.round(r.gefordert / 500) * 500, angebot.jahre, angebot.handgeld, angebot.rolle,
                '<b class="w-mittel">Gegenforderung:</b> ' + esc(r.text));
            } else {
              zeige(angebot.gehalt, angebot.jahre, angebot.handgeld, angebot.rolle,
                '<b class="w-schlecht">Abgelehnt:</b> ' + esc(r.text));
            }
          };
        }
      });
    }
    zeige(Math.round(basis * 1.08 / 500) * 500, jahre, Math.round(ablösePaket.gesamt * 0.03 / 10000) * 10000, 'stamm', null);
  }

  // ============================================================ Leihe

  V.leiheDialog = function (spielerId) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    var club = world.nutzerVerein();
    if (!p || !p.clubId || p.clubId === club.id) return;
    var abgeber = world.vereine[p.clubId];
    var gebuehrVorschlag = Math.round(p.marktwert * 0.06 / 50000) * 50000;

    var html = '<h4>Leihgeschäft</h4><h2>' + esc(p.vorname + ' ' + p.nachname) + '</h2>' +
      '<p class="muted">Eine Leihe kostet weniger, bindet den Spieler aber nur für eine Saison. ' +
      'Je höher der übernommene Gehaltsanteil, desto eher stimmt ' + esc(abgeber.name) + ' zu.</p>' +
      '<div class="grid grid--3">' +
      '<div><label>Leihgebühr</label><input type="number" data-v="gebuehr" value="' + gebuehrVorschlag + '" step="50000" min="0"></div>' +
      '<div><label>Übernommener Gehaltsanteil (%)</label><input type="number" data-v="anteil" value="70" min="0" max="100" step="5"></div>' +
      '<div><label>Kaufoption</label><input type="number" data-v="option" value="0" step="500000" min="0"></div>' +
      '</div>' +
      '<div class="flex mt"><button class="btn btn--primary" data-a="ok">Leihe anfragen</button>' +
      '<button class="btn" data-a="ab">Abbrechen</button></div>';

    UI.modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="ab"]').onclick = UI.modalZu;
        body.querySelector('[data-a="ok"]').onclick = function () {
          function v(k) { return parseInt(body.querySelector('[data-v="' + k + '"]').value, 10) || 0; }
          var gebuehr = v('gebuehr'), anteil = U.clamp(v('anteil'), 0, 100), option = v('option');
          var f = world.finanzen[club.id];
          if (gebuehr > f.kontostand) { UI.toast('Die Leihgebühr übersteigt den Kontostand.', 'fehler'); return; }

          // Der abgebende Verein bewertet Gebühr, Gehaltsanteil und Spielzeit.
          var bereit = FM.transfers.verkaufsbereitschaft(world, p);
          var wert = gebuehr / Math.max(1, p.marktwert * 0.05) * 0.4 + (anteil / 100) * 0.6 + bereit * 0.5;
          var rang = P.kaderRang(p, world.kaderVon(p.clubId));
          if (rang <= 11) wert -= 0.6;
          if (p.alter <= 21) wert += 0.35;

          if (wert < 0.85) {
            UI.toast(abgeber.name + ' lehnt die Leihe ab.', 'fehler');
            return;
          }
          var gehalt = P.gehaltsforderung(p, club, world) * (anteil / 100);
          if (F.wochenLohnsumme(world, club.id) + gehalt > f.gehaltsbudget * 1.02) {
            UI.toast('Das Gehaltsbudget lässt die Leihe nicht zu.', 'fehler');
            return;
          }
          FM.transfers.fuehreLeiheDurch(world, p, club.id, {
            bis: world.tag + 330, gehaltsanteil: anteil / 100,
            gebuehr: gebuehr, kaufoption: option, kaufpflicht: false
          });
          UI.modalZu();
          UI.toast(p.nachname + ' kommt auf Leihbasis.', 'gut');
          UI.zeichne();
        };
      }
    });
  };

  // ============================================================ Vorstand

  V.vorstandsDialog = function () {
    var world = UI.world;
    var m = world.manager;
    var f = world.finanzen[world.nutzerClubId];
    var abgleich = FM.media.zielabgleich(world);

    var html = '<h4>Gespräch mit dem Vorstand</h4><h2>Anliegen vorbringen</h2>' +
      '<div class="tiles mb">' +
      '<div class="tile"><span>Vertrauen</span><b>' + Math.round(m.vorstandsvertrauen) + ' %</b></div>' +
      '<div class="tile"><span>Saisonziel</span><b style="font-size:14px">' + esc(m.saisonziel ? m.saisonziel.text : '–') + '</b></div>' +
      '<div class="tile"><span>Aktueller Stand</span><b>' + (abgleich ? abgleich.platz + '.' : '–') + '</b>' +
      (abgleich ? '<small>' + (abgleich.abstand <= 0 ? 'im Plan' : abgleich.abstand + ' Plätze dahinter') + '</small>' : '') + '</div>' +
      '<div class="tile"><span>Kontostand</span><b style="font-size:15px">' + U.money(f.kontostand) + '</b></div>' +
      '</div>' +
      '<div class="grid grid--2">' +
      Object.keys(FM.media.VORSTANDSANFRAGEN).map(function (k) {
        var a = FM.media.VORSTANDSANFRAGEN[k];
        return '<div class="card card--flat"><h4>' + esc(a.name) + '</h4>' +
          '<div class="flex"><input type="number" data-b="' + k + '" value="1000000" step="500000" min="0">' +
          '<button class="btn btn--sm btn--primary" data-a="' + k + '">Anfragen</button></div></div>';
      }).join('') + '</div>';

    UI.modal(html, {
      nachher: function (body) {
        Object.keys(FM.media.VORSTANDSANFRAGEN).forEach(function (k) {
          var b = body.querySelector('[data-a="' + k + '"]');
          if (!b) return;
          b.onclick = function () {
            var betrag = Math.max(0, parseInt(body.querySelector('[data-b="' + k + '"]').value, 10) || 0);
            var r = FM.media.VORSTANDSANFRAGEN[k].stellen(world, betrag);
            UI.toast(r.text, r.ok ? 'gut' : 'fehler');
            if (r.ok) { UI.modalZu(); UI.zeichne(); }
          };
        });
      }
    });
  };

  V.bauDialog = function () {
    var world = UI.world;
    var club = world.nutzerVerein();
    var html = '<h2>Baumaßnahme beantragen</h2>' +
      (club.bauprojekt ? '<div class="card card--flat mb"><b>Laufend:</b> ' + esc(club.bauprojekt.name) +
        ' – fertig am ' + U.fmtDate(club.bauprojekt.fertig) + '</div>' : '') +
      '<div class="optionen">' + Object.keys(F.AUSBAU_PROJEKTE).map(function (k) {
        var pr = F.AUSBAU_PROJEKTE[k];
        return '<button class="option" data-p="' + k + '"><b>' + esc(pr.name) + '</b><br>' +
          '<span class="klein muted">' + esc(pr.beschreibung) + ' · Kosten ' + U.money(pr.kosten(club)) +
          ' · Bauzeit ' + Math.round(pr.dauer / 30) + ' Monate</span></button>';
      }).join('') + '</div>';
    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-p]'), function (b) {
          b.onclick = function () {
            var r = FM.media.bauprojektBeantragen(world, b.dataset.p);
            UI.toast(r.text, r.ok ? 'gut' : 'fehler');
            if (r.ok) { UI.modalZu(); UI.zeichne(); }
          };
        });
      }
    });
  };

  V.ticketDialog = function () {
    var world = UI.world;
    var club = world.nutzerVerein();
    var f = world.finanzen[club.id];
    var normal = club.liga === 1 ? Math.round(28 + club.ruf * 0.32) : Math.round(17 + club.ruf * 0.20);

    var html = '<h2>Ticketpreise</h2><p class="muted">Höhere Preise bringen mehr Einnahmen pro Zuschauer, ' +
      'schrecken aber Besucher ab und drücken die Stimmung. Üblich für einen Verein dieser Größe: ' +
      U.money(normal) + '.</p>' +
      '<div class="grid grid--2">' +
      '<div><label>Preis pro Ticket</label><input type="number" data-v="preis" value="' + f.ticketpreis + '" min="5" max="150"></div>' +
      '<div><label>Dauerkarten</label><input type="number" data-v="dk" value="' + f.dauerkarten + '" min="0" max="' + club.kapazitaet + '" step="500"></div>' +
      '</div>' +
      '<div class="flex mt"><button class="btn btn--primary" data-a="ok">Übernehmen</button>' +
      '<button class="btn" data-a="ab">Abbrechen</button></div>';

    UI.modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="ab"]').onclick = UI.modalZu;
        body.querySelector('[data-a="ok"]').onclick = function () {
          var preis = U.clamp(parseInt(body.querySelector('[data-v="preis"]').value, 10) || normal, 5, 150);
          var dk = U.clamp(parseInt(body.querySelector('[data-v="dk"]').value, 10) || 0, 0, club.kapazitaet);
          if (preis > f.ticketpreis * 1.3) {
            club.fanstimmung = U.clamp(club.fanstimmung - 6, 0, 100);
            UI.toast('Die Fans sind über die Preiserhöhung verärgert.', 'fehler');
          } else if (preis < f.ticketpreis * 0.85) {
            club.fanstimmung = U.clamp(club.fanstimmung + 4, 0, 100);
            UI.toast('Die Preissenkung kommt bei den Fans gut an.', 'gut');
          } else UI.toast('Preise übernommen.');
          f.ticketpreis = preis;
          f.dauerkarten = dk;
          UI.modalZu(); UI.zeichne();
        };
      }
    });
  };

  V.scoutingDialog = function () {
    var world = UI.world;
    var html = '<h2>Scoutingreise</h2><p class="muted">Die Scouts beobachten eine Region und liefern Berichte über ' +
      'Spieler, die zum Profil passen.</p>' +
      '<div class="grid grid--3 mb">' +
      '<div><label>Position</label><select data-v="pos"><option value="">alle</option>' +
      D.POSITIONEN.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Alter bis</label><input type="number" data-v="maxAlter" value="24" min="16" max="40"></div>' +
      '<div><label>Mindeststärke</label><input type="number" data-v="minStaerke" value="55" min="1" max="99"></div>' +
      '</div>' +
      '<div class="optionen">' + FM.transfers.SCOUT_REGIONEN.map(function (r) {
        return '<button class="option" data-r="' + r.id + '"><b>' + esc(r.name) + '</b> ' +
          '<span class="chip">' + U.money(r.kosten) + '</span><br><span class="klein muted">Dauer: ' +
          r.dauer + ' Tage</span></button>';
      }).join('') + '</div>';
    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-r]'), function (b) {
          b.onclick = function () {
            var r = FM.transfers.scoutAuftragAnlegen(world, world.nutzerClubId, {
              regionId: b.dataset.r,
              position: body.querySelector('[data-v="pos"]').value || null,
              maxAlter: parseInt(body.querySelector('[data-v="maxAlter"]').value, 10) || 40,
              minStaerke: parseInt(body.querySelector('[data-v="minStaerke"]').value, 10) || 0
            });
            if (r.fehler) UI.toast(r.fehler, 'fehler');
            else { UI.modalZu(); UI.toast('Scouts unterwegs. Bericht folgt.', 'gut'); UI.zeichne(); }
          };
        });
      }
    });
  };

  // ============================================================ Spielbericht

  V.spielbericht = function (spielIdOderObjekt) {
    var world = UI.world;
    var spiel = typeof spielIdOderObjekt === 'string' ? world.spielIndex[spielIdOderObjekt] : spielIdOderObjekt;
    if (!spiel || !spiel.bericht) return;
    var b = spiel.bericht;
    var heim = world.vereine[spiel.heimId], gast = world.vereine[spiel.gastId];

    var html = '<h4>' + esc(UI.wettbewerbName(world, spiel)) +
      (spiel.rundeName ? ' · ' + esc(spiel.rundeName) : '') + ' · ' + U.fmtDate(spiel.tag, 'lang') + '</h4>' +
      '<div class="mv__kopf" style="margin-bottom:14px">' +
      '<div class="mv__team">' + UI.wappen(heim) + '<b>' + esc(heim.name) + '</b></div>' +
      '<div class="mv__stand"><b>' + spiel.ergebnis.heimTore + ' : ' + spiel.ergebnis.gastTore + '</b>' +
      (spiel.ergebnis.elfmeterschiessen ? '<small>' + spiel.ergebnis.elfmeterschiessen.heim + ':' +
        spiel.ergebnis.elfmeterschiessen.gast + ' nach Elfmeterschießen</small>' : '') + '</div>' +
      '<div class="mv__team mv__team--gast"><b>' + esc(gast.name) + '</b>' + UI.wappen(gast) + '</div>' +
      '</div>';

    html += '<div class="klein muted mb">' + U.num(b.zuschauer) + ' Zuschauer · ' + esc(b.wetter) +
      ' · Schiedsrichter: ' + esc(b.schiedsrichter) +
      (b.spielerDesSpiels && world.spieler[b.spielerDesSpiels.spielerId]
        ? ' · Spieler des Spiels: <b>' + esc(world.spieler[b.spielerDesSpiels.spielerId].nachname) +
          '</b> (Note ' + U.note(b.spielerDesSpiels.note) + ')' : '') + '</div>';

    // Statistikvergleich
    var st = b.statistik;
    html += '<div class="card card--flat mb">' + [
      ['Ballbesitz', Math.round(st.heim.ballbesitz / Math.max(1, st.heim.ballbesitz + st.gast.ballbesitz) * 100),
        Math.round(st.gast.ballbesitz / Math.max(1, st.heim.ballbesitz + st.gast.ballbesitz) * 100), '%'],
      ['Torschüsse', st.heim.schuesse, st.gast.schuesse, ''],
      ['Schüsse aufs Tor', st.heim.aufsTor, st.gast.aufsTor, ''],
      ['Erwartete Tore (xG)', U.num(st.heim.xg, 2), U.num(st.gast.xg, 2), ''],
      ['Großchancen', st.heim.grosschancen, st.gast.grosschancen, ''],
      ['Ecken', st.heim.ecken, st.gast.ecken, ''],
      ['Fouls', st.heim.fouls, st.gast.fouls, ''],
      ['Gelbe Karten', st.heim.gelb, st.gast.gelb, ''],
      ['Abseits', st.heim.abseits, st.gast.abseits, ''],
      ['Passquote', Math.round(st.heim.paesseAn / Math.max(1, st.heim.paesse) * 100),
        Math.round(st.gast.paesseAn / Math.max(1, st.gast.paesse) * 100), '%'],
      ['Zweikämpfe gewonnen', Math.round(st.heim.zweikaempfeGew / Math.max(1, st.heim.zweikaempfe) * 100),
        Math.round(st.gast.zweikaempfeGew / Math.max(1, st.gast.zweikaempfe) * 100), '%']
    ].map(function (r) {
      var a = parseFloat(r[1]) || 0, c = parseFloat(r[2]) || 0;
      var summe = a + c || 1;
      return '<div class="statbar"><div class="statbar__kopf"><b>' + r[1] + r[3] + '</b>' +
        '<span class="muted">' + esc(r[0]) + '</span><b>' + r[2] + r[3] + '</b></div>' +
        '<div class="statbar__spur"><i style="width:' + (a / summe * 100) + '%"></i>' +
        '<i style="width:' + (c / summe * 100) + '%"></i></div></div>';
    }).join('') + '</div>';

    // Ticker
    var wichtig = b.ereignisse.filter(function (e) {
      return ['tor', 'gelb', 'rot', 'gelbrot', 'wechsel', 'verletzung', 'elfmeterVerschossen',
        'elfmeterGehalten', 'halbzeit', 'abpfiff', 'abpfiff90', 'abpfiff120', 'elfmeterschiessen'].indexOf(e.typ) >= 0;
    });
    html += '<div class="grid grid--2">';
    html += '<div class="card card--flat"><h4>Spielverlauf</h4><div class="ticker">' +
      wichtig.map(function (e) {
        return '<div class="tick tick--' + esc(e.typ) + '"><span class="tick__min">' +
          (e.minute ? e.minute + "'" : '') + '</span><span>' + esc(e.text) + '</span></div>';
      }).join('') + '</div></div>';

    // Einzelkritik
    html += '<div class="card card--flat"><h4>Einzelkritik</h4>';
    [[heim, b.heimDaten], [gast, b.gastDaten]].forEach(function (paar) {
      var daten = paar[1];
      var liste = Object.keys(daten).map(function (id) {
        var d = daten[id];
        var p = world.spieler[id];
        return p && d.minuten > 0 ? { p: p, d: d } : null;
      }).filter(Boolean);
      liste = U.sortBy(liste, function (x) { return x.d.note || 9; });
      html += '<div class="mb"><b>' + esc(paar[0].kurz) + '</b>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (x) { return esc(x.p.nachname); } },
        { key: 'm', label: 'Min', klasse: 'num', html: function (x) { return x.d.minuten; } },
        { key: 't', label: 'T', klasse: 'num', html: function (x) { return x.d.tore || ''; } },
        { key: 'v', label: 'V', klasse: 'num', html: function (x) { return x.d.vorlagen || ''; } },
        { key: 'no', label: 'Note', klasse: 'num', html: function (x) { return UI.noteZelle(x.d.note); } }
      ], liste, {}) + '</div>';
    });
    html += '</div></div>';

    UI.modal(html, { breit: true });
  };

  // ============================================================ Kaderbericht

  V.kaderbericht = function () {
    var world = UI.world;
    var club = world.nutzerVerein();
    var kader = world.kaderVon(club.id);
    var nachPos = U.groupBy(kader, function (p) { return p.pos; });

    var html = '<h2>Kaderbericht ' + esc(club.name) + '</h2>' +
      '<p class="muted">Stand ' + U.fmtDate(world.tag, 'lang') + '</p>';

    D.POSITIONEN.forEach(function (pos) {
      var liste = nachPos[pos];
      if (!liste || !liste.length) return;
      html += '<h4>' + esc(D.POS_NAME[pos]) + '</h4>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (p) { return '<b>' + esc(p.nachname) + '</b> ' + esc(p.vorname); } },
        { key: 'a', label: 'Alter', klasse: 'num', html: function (p) { return p.alter; } },
        { key: 's', label: 'Stärke', klasse: 'num', html: function (p) { return UI.wert(P.gesamt(p)); } },
        { key: 'p', label: 'Pot', klasse: 'num', html: function (p) { return UI.wert(p.potenzial); } },
        { key: 'v', label: 'Vertrag', klasse: 'num', html: function (p) { return p.vertrag ? U.fmtDate(p.vertrag.bis) : '–'; } },
        { key: 'g', label: 'Gehalt', klasse: 'num', html: function (p) { return p.vertrag ? U.money(p.vertrag.gehalt) : '–'; } },
        { key: 'w', label: 'Marktwert', klasse: 'num', html: function (p) { return U.money(p.marktwert); } },
        { key: 'st', label: '', html: function (p) { return UI.spielerStatus(world, p); } }
      ], U.sortBy(liste, function (p) { return -P.gesamt(p); }), {});
    });
    UI.modal(html, { breit: true });
  };

  // ============================================================ Vereinssuche nach Entlassung

  V.vereinSuche = function () {
    var world = UI.world;
    var m = world.manager;
    var kandidaten = world.ligen.bl1.teams.concat(world.ligen.bl2.teams).filter(function (id) {
      var c = world.vereine[id];
      return c.ruf <= m.ruf + 25;
    });
    kandidaten = U.sortBy(kandidaten, function (id) { return -world.vereine[id].ruf; }).slice(0, 10);

    var html = '<h2>Angebote anderer Vereine</h2>' +
      '<p class="muted">Ihr Trainerruf liegt bei ' + Math.round(m.ruf) + '. Diese Vereine könnten sich Sie vorstellen:</p>' +
      '<div class="optionen">' + kandidaten.map(function (id) {
        var c = world.vereine[id];
        return '<button class="option" data-c="' + esc(id) + '">' + UI.wappen(c, true) + ' <b>' + esc(c.name) + '</b> ' +
          '<span class="chip">' + (c.liga === 1 ? 'Bundesliga' : '2. Bundesliga') + '</span><br>' +
          '<span class="klein muted">Ruf ' + c.ruf + ' · Ziel: ' + esc(FM.world.saisonziel(c, c.liga).text) + '</span></button>';
      }).join('') + '</div>';

    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-c]'), function (b) {
          b.onclick = function () {
            FM.world.vereinUebernehmen(world, b.dataset.c, m.name);
            m.warnungen = 0;
            UI.modalZu();
            UI.zeige('uebersicht');
            UI.toast('Sie übernehmen ' + world.vereine[b.dataset.c].name + '.', 'gut');
          };
        });
      }
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
