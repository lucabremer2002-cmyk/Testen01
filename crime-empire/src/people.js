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
    { id: 'kessler', name: 'Det. Sgt. Mara Kessler', role: 'Organised Crime Unit',
      face: 774411, color: '#4bd6e8',
      blurb: 'Twenty-two years, three commendations and a divorce she blames on a filing cabinet. ' +
             'She has been building a case on somebody like you her entire career.' },
    { id: 'whitlock', name: 'Dana Whitlock', role: 'Blackhaven Ledger',
      face: 219087, color: '#eaa640',
      blurb: 'Writes eight hundred words a week that nobody in city hall enjoys reading. ' +
             'She does not want money and she does not scare, which makes her expensive.' },
    { id: 'penn', name: 'Councilman Arthur Penn', role: 'City Council, 4th Ward',
      face: 530912, color: '#8b5cf6',
      blurb: 'Third term, second mortgage, first in line whenever a permit needs signing. ' +
             'Penn is not corrupt so much as permanently short.' },
    { id: 'okonkwo', name: '"Sunday" Okonkwo', role: 'Fixer',
      face: 881234, color: '#d4af5a',
      blurb: 'Knows a man for everything and takes a point off the top. Sunday has never ' +
             'been arrested, which in this city is a kind of resume.' }
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
    if (v >= 60) return 'Close';
    if (v >= 25) return 'Warm';
    if (v > -20) return 'Wary';
    if (v > -55) return 'Cold';
    return 'Hostile';
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
            title: 'The Detective', tone: 'heat', person: 'kessler',
            text: 'She was waiting outside the restaurant, holding two coffees, and handed you one. ' +
                  '"Mara Kessler, Organised Crime. I am not here to arrest you today. I am here so ' +
                  'that when I do, you will know it was me."',
            options: [
              { label: 'Take the coffee and talk', hint: 'Opens a line you can use later. +2 heat now.',
                go: function () {
                  bump(s, 'kessler', 12, 1);
                  return 'You talked for forty minutes about nothing. She paid attention to all of it. ' +
                         fx(s, { heat: 2 });
                } },
              { label: 'Walk away without a word', hint: 'Nothing now. She stops offering.',
                go: function () {
                  bump(s, 'kessler', -10, 1);
                  return 'She drank both coffees. ' + fx(s, { heat: 1 });
                } },
              { label: 'Offer her money', hint: '+9 heat, and she never deals with you again',
                go: function () {
                  bump(s, 'kessler', -34, 1);
                  get(s, 'kessler').flags.bribed = true;
                  return 'She put the envelope in her pocket, walked to the precinct and logged it as ' +
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
            title: 'Kessler Comes Back', tone: 'heat', person: 'kessler',
            text: warm
              ? 'She called the number you never gave her. "The federal people took my case file. ' +
                'They are going to do it badly and you are going to get people killed. I would ' +
                'rather it was me."'
              : 'She has been outside three of your businesses this month, and she wants you to ' +
                'know it. "The federal people took my file. I gave them everything. Sleep well."',
            options: [
              { label: 'Keep her close', hint: 'Case -8 now, and she warns you later',
                disabled: !warm, why: 'She would not take a call from you.',
                go: function () {
                  bump(s, 'kessler', 14, 1);
                  k.flags.channel = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 8, 0, 100);
                  return 'There is a line open now. Neither of you would call it a friendship. ' +
                         fx(s, { heat: -3 });
                } },
              { label: 'Feed her a rival', hint: 'Case -16, that rival -28 relations',
                disabled: c.enemies.length === 0 && s.rivals.length === 0, why: 'Nobody to give.',
                go: function () {
                  var r = c.rng.pick(s.rivals.filter(function (x) { return !x.allied; }).length
                    ? s.rivals.filter(function (x) { return !x.allied; }) : s.rivals);
                  bump(s, 'kessler', 8, 1);
                  k.flags.fed = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 16, 0, 100);
                  return 'She took it, and she knew exactly why you were giving it to her. ' +
                         fx(s, { rival: r, relation: -28, rep: -2 });
                } },
              { label: 'Shut the door', hint: 'Case +6 and no more warnings, ever',
                go: function () {
                  bump(s, 'kessler', -30, 1);
                  k.flags.closed = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 6, 0, 100);
                  return 'She has stopped trying. That is worse. ' + fx(s, { heat: 4 });
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
            title: freund ? 'What Kessler Wants' : 'Kessler Closes In', tone: 'heat', person: 'kessler',
            text: freund
              ? 'Twenty-two years and they gave her case to a task force with better suits. She is ' +
                'putting in her papers. "One thing, before I go. There is a man in the 9th who has ' +
                'been selling my files for six years. Help me bury him and I will lose what I have on you."'
              : 'She has a warrant, a van and four people who owe her favours. Whatever she has been ' +
                'building since that coffee, it is finished now.',
            options: freund ? [
              { label: 'Bury him with her', hint: U.moneySigned(-kosten) + ', case -30 and she retires',
                disabled: s.cash < kosten, why: 'Not enough cash.',
                go: function () {
                  bump(s, 'kessler', 25, 1);
                  k.done = true; k.flags.ally = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 30, 0, 100);
                  return 'It took nine days and a great deal of money. She retired on a Friday and ' +
                         'her file on you retired with her. ' + fx(s, { cash: -kosten, heat: -10, rep: 3 });
                } },
              { label: 'Let her retire quietly', hint: 'Small relief, she stays neutral',
                go: function () {
                  bump(s, 'kessler', 4, 1); k.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 8, 0, 100);
                  return 'She left the file in a drawer. Not shredded. Just a drawer.';
                } },
              { label: 'Use what she told you against her', hint: 'She is finished. So is any goodwill.',
                go: function () {
                  bump(s, 'kessler', -70, 1); k.done = true; k.flags.destroyed = true;
                  return 'Kessler resigned under investigation. Nobody in that precinct will ever take ' +
                         'your call again. ' + fx(s, { heat: 10, rep: -5 });
                } }
            ] : [
              { label: 'Lawyer it out', hint: U.moneySigned(-kosten) + ', survive it',
                disabled: s.cash < kosten, why: 'Not enough cash.',
                go: function () {
                  k.done = true;
                  return 'Three months of motions and one sympathetic judge. It cost everything she ' +
                         'had and most of what you had. ' + fx(s, { cash: -kosten, heat: -6, rep: -2 });
                } },
              { label: 'Give her something smaller', hint: 'Lose a business, keep the rest',
                disabled: s.businesses.length < 2, why: 'You have nothing to give up.',
                go: function () {
                  var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
                  var ziel = dreck.length ? dreck[0] : s.businesses[0];
                  var name = ziel.name;
                  CE.empire.sell(s, ziel.id);
                  k.done = true; bump(s, 'kessler', 10, 1);
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 10, 0, 100);
                  return 'She took ' + name + ' and called it a win. ' + fx(s, { heat: -12 });
                } },
              { label: 'Ride it out', hint: 'Heat and a case that will not stop',
                go: function () {
                  k.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 14, 0, 100);
                  return 'Nothing stuck. This time. ' + fx(s, { heat: 14 });
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
            title: 'A Reporter Calls', tone: 'rival', person: 'whitlock',
            text: 'Dana Whitlock of the Ledger has questions about how a person with no visible ' +
                  'career came to own ' + s.businesses.length + ' businesses in three years. She is ' +
                  'writing it either way and wanted to offer you the courtesy of a comment.',
            options: [
              { label: 'Give her the interview', hint: 'Usually +4 reputation, sometimes the opposite',
                go: function () {
                  bump(s, 'whitlock', 16, 1);
                  return c.rng.chance(0.6)
                    ? 'The piece was fair, which is to say unflattering and accurate. People respected it. ' +
                      fx(s, { rep: 4, heat: 3 })
                    : 'She quoted you precisely, and precisely was worse than you thought. ' +
                      fx(s, { rep: -2, heat: 6 });
                } },
              { label: 'Offer to buy the story', hint: '-4 reputation, +8 heat. She prints the attempt.',
                go: function () {
                  bump(s, 'whitlock', -28, 1);
                  get(s, 'whitlock').flags.bribed = true;
                  return 'The attempted bribe became the third paragraph. ' + fx(s, { rep: -4, heat: 8 });
                } },
              { label: 'No comment', hint: '+4 heat, +1 reputation',
                go: function () {
                  bump(s, 'whitlock', -4, 1);
                  return 'The piece ran on page six with a photograph of your restaurant. ' +
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
            title: 'Whitlock Has A Name', tone: 'rival', person: 'whitlock',
            text: warm
              ? 'She came to you first this time. "I have a councilman taking money. I can name him ' +
                'or I can name the people paying him. I would rather it was him."'
              : 'She has a source inside one of your operations. The story will run in eleven days ' +
                'and it will have your name in the headline.',
            options: warm ? [
              { label: 'Give her the councilman', hint: 'She owes you. Penn does not.',
                go: function () {
                  bump(s, 'whitlock', 22, 1);
                  if (met(s, 'penn')) bump(s, 'penn', -40, 0);
                  w.flags.gavePenn = true;
                  return 'The story ran without your name anywhere in it. ' + fx(s, { rep: 3, heat: -4 });
                } },
              { label: 'Ask her to hold it', hint: 'Costs trust, buys quiet',
                go: function () {
                  bump(s, 'whitlock', -14, 1);
                  return 'She held it for a month. She also understood what you are. ' + fx(s, { heat: -3 });
                } },
              { label: 'Tell her to print all of it', hint: 'Reputation up, heat up',
                go: function () {
                  bump(s, 'whitlock', 18, 1);
                  return 'Everyone named in that story lost something. You lost the least, and ' +
                         'people noticed that too. ' + fx(s, { rep: 6, heat: 9 });
                } }
            ] : [
              { label: 'Find the source yourself', hint: 'Costs loyalty across the crew',
                go: function () {
                  bump(s, 'whitlock', -6, 1);
                  return 'You found them. Everybody watched you find them. ' +
                         fx(s, { loyaltyAll: -9, heat: -4, rep: -1 });
                } },
              { label: 'Feed her a better story', hint: 'Point her at a rival',
                disabled: !s.rivals.length, why: 'Nobody to point at.',
                go: function () {
                  var r = c.rng.pick(s.rivals);
                  bump(s, 'whitlock', 10, 1);
                  return 'The headline had somebody else in it. ' + fx(s, { rival: r, relation: -18, heat: -5 });
                } },
              { label: 'Let it run', hint: 'Heat and reputation both move',
                go: function () {
                  bump(s, 'whitlock', 2, 1);
                  return 'It was worse than you feared and better than it could have been. ' +
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
            title: 'A Councilman Short', tone: 'money', person: 'penn',
            text: 'Arthur Penn represents the 4th Ward and a second mortgage. He needs ' +
                  U.money(bitte) + ' before Thursday and has been extremely careful not to say ' +
                  'what he would do in return.',
            options: [
              { label: 'Pay it and ask nothing', hint: U.moneySigned(-bitte) + ', he remembers',
                disabled: s.cash < bitte, why: 'Not enough cash.',
                go: function () {
                  bump(s, 'penn', 26, 1);
                  return 'He shook your hand with both of his. ' + fx(s, { cash: -bitte });
                } },
              { label: 'Pay it and name a price', hint: 'Influence now, less goodwill',
                disabled: s.cash < bitte, why: 'Not enough cash.',
                go: function () {
                  bump(s, 'penn', 8, 1);
                  var k = c.rng.pick(c.openDistricts);
                  return 'The permits came through on Monday. ' +
                         fx(s, { cash: -bitte, infl: 5, district: k });
                } },
              { label: 'Refuse', hint: 'Free. He works for somebody else from now on.',
                go: function () {
                  bump(s, 'penn', -16, 1);
                  return 'Somebody else paid. You will meet them eventually.';
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
            title: 'Penn Delivers', tone: 'money', person: 'penn',
            text: 'A zoning review is coming for the whole waterfront. Penn sits on the committee ' +
                  'and has, unprompted, asked which way you would like it to go.',
            options: [
              { label: 'Have it go your way', hint: 'Influence in two districts, heat up',
                go: function () {
                  bump(s, 'penn', 6, 1);
                  var a = c.openDistricts[0], b = c.openDistricts[1] || a;
                  var r1 = fx(s, { infl: 7, district: a });
                  var r2 = a !== b ? ', ' + fx(s, { infl: 5, district: b }) : '';
                  return 'The review found in favour of everything you own. ' + r1 + r2 + ' ' +
                         fx(s, { heat: 6 });
                } },
              { label: 'Have it go against a rival', hint: 'They lose ground and know who did it',
                disabled: !s.rivals.length, why: 'Nobody to target.',
                go: function () {
                  var r = c.rng.pick(s.rivals.filter(function (x) { return !x.allied; }).length
                    ? s.rivals.filter(function (x) { return !x.allied; }) : s.rivals);
                  var k = c.rng.pick(Object.keys(r.infl).filter(function (x) { return r.infl[x] > 5; }) || c.openDistricts);
                  if (k) r.infl[k] = Math.max(0, r.infl[k] - 9);
                  bump(s, 'penn', 4, 1);
                  return 'Three of their properties are now non-conforming. ' +
                         fx(s, { rival: r, relation: -20, rep: 1 });
                } },
              { label: 'Tell him to vote his conscience', hint: 'He is baffled. Reputation up.',
                go: function () {
                  bump(s, 'penn', 18, 1);
                  return 'He did not know what to do with that. ' + fx(s, { rep: 4 });
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
            title: 'Penn Is Finished', tone: 'heat', person: 'penn',
            text: 'The Ledger has him. Bank records, a boat he could not afford, and eleven years ' +
                  'of favours. He is going to be asked, under oath, who paid for what.',
            options: [
              { label: 'Pay for the best defence money buys', hint: U.moneySigned(-rettung) + ', he stays loyal',
                disabled: s.cash < rettung, why: 'Not enough cash.',
                go: function () {
                  bump(s, 'penn', 30, 1); p.done = true; p.flags.saved = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 12, 0, 100);
                  return 'He walked. He will not forget who paid for the lawyers. ' +
                         fx(s, { cash: -rettung, heat: -6, rep: 2 });
                } },
              { label: 'Let him fall', hint: 'He will be asked about you',
                go: function () {
                  bump(s, 'penn', -50, 1); p.done = true;
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength + 16, 0, 100);
                  return 'He took a deal on the second day. ' + fx(s, { heat: 13, rep: -2 });
                } },
              { label: 'Make sure he cannot testify', hint: 'Effective. Expensive in every way.',
                go: function () {
                  bump(s, 'penn', -100, 1); p.done = true; p.flags.silenced = true;
                CE.fear.add(s, 9, 'silenced a councilman');
                  if (s.commission) s.commission.strength = U.clamp(s.commission.strength - 6, 0, 100);
                  if (met(s, 'whitlock')) bump(s, 'whitlock', -25, 0);
                  return 'Arthur Penn withdrew from public life and moved to another state. ' +
                         'Nobody believes that, including Whitlock. ' + fx(s, { heat: 9, rep: -8, loyaltyAll: -4 });
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
            title: 'Sunday Finds You', tone: 'money', person: 'okonkwo',
            text: '"Sunday Okonkwo. I hear you are buying." He has a list. Everything on it is ' +
                  'slightly illegal, extremely useful, and priced at ' + U.money(preis) + ' for ' +
                  'the first item, whatever you choose it to be.',
            options: [
              { label: 'Buy from the list', hint: U.moneySigned(-preis) + ', permanent +3% on every operation',
                disabled: s.cash < preis, why: 'Not enough cash.',
                go: function () {
                  bump(s, 'okonkwo', 20, 1);
                  s.flags.sundayEdge = (s.flags.sundayEdge || 0) + 1;
                  return 'Whatever it was, it works. Operations run a little better from now on. ' +
                         fx(s, { cash: -preis });
                } },
              { label: 'Ask what he wants long term', hint: 'Free. He remembers being asked.',
                go: function () {
                  bump(s, 'okonkwo', 12, 1);
                  return '"A percentage, eventually. Not today." He left his number.';
                } },
              { label: 'Send him away', hint: 'He does not come back for a while',
                go: function () { bump(s, 'okonkwo', -12, 1); return 'He took it well. They always do.'; } }
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
            title: 'Sunday Knows Someone', tone: 'crew', person: 'okonkwo',
            text: '"You need a ' + D.byId(D.ROLES, r.role).name.toLowerCase() + '. I have one. ' +
                  r.name + ', skill ' + r.skill + ', and they do not ask questions because I already ' +
                  'answered them." His finder’s fee is ' + U.money(gebuehr) + '.',
            options: [
              { label: 'Take them on', hint: U.moneySigned(-gebuehr) + ' fee, ' + U.money(r.ask) + '/week',
                disabled: s.cash < gebuehr || c.paid.length >= c.d.crewCap,
                why: s.cash < gebuehr ? 'Not enough cash.' : 'No room in your crew.',
                go: function () {
                  s.cash -= gebuehr; s.stats.spent += gebuehr;
                  s.crew.push({
                    id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                    potential: r.potential, xp: 0, loyalty: Math.min(100, r.loyalty + 12), salary: r.ask,
                    traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                    face: r.face, mood: '', raises: 0
                  });
                  bump(s, 'okonkwo', 10, 1);
                  return r.name + ' started the same afternoon.';
                } },
              { label: 'Not this time', hint: '',
                go: function () { bump(s, 'okonkwo', -4, 1); return '"Another time."'; } }
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
            title: 'Sunday Names His Price', tone: 'money', person: 'okonkwo',
            text: '"I said a percentage eventually. It is eventually." He wants ' + U.money(anteil) +
                  ' for a standing arrangement: his whole network, permanently, working for you.',
            options: [
              { label: 'Buy the network', hint: U.moneySigned(-anteil) + ', permanent +10% odds, +8% pay, 15% faster',
                disabled: s.cash < anteil, why: 'Not enough cash.',
                go: function () {
                  var o = get(s, 'okonkwo');
                  o.done = true; o.flags.network = true;
                  s.flags.sundayNetwork = true;
                  bump(s, 'okonkwo', 25, 1);
                  return 'Every fence, driver and forger in Blackhaven now takes your calls first. ' +
                         fx(s, { cash: -anteil, rep: 3 });
                } },
              { label: 'Counter with half', hint: 'He may take it, he may not',
                disabled: s.cash < anteil / 2, why: 'Not enough cash.',
                go: function () {
                  if (c.rng.chance(0.45 + trust(s, 'okonkwo') / 250)) {
                    var o = get(s, 'okonkwo'); o.done = true; o.flags.network = true;
                    s.flags.sundayNetwork = true;
                    return 'He laughed and took it. ' + fx(s, { cash: -Math.round(anteil / 2) });
                  }
                  bump(s, 'okonkwo', -20, 1);
                  return '"That is not what a percentage means." He took the offer elsewhere.';
                } },
              { label: 'Decline', hint: 'He goes to work for somebody else',
                go: function () {
                  var o = get(s, 'okonkwo'); o.done = true;
                  var r = c.rng.pick(s.rivals);
                  r.strength += 12;
                  bump(s, 'okonkwo', -18, 1);
                  return 'Within a month he was working for ' + D.byId(D.RIVALS, r.id).name + '.';
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
