/* Zeitvorteil je Routenentscheidung.
   Misst jede Abzweigung gegen denselben sicheren Anlauf: nur EINE Gabel
   wird umgestellt, alles davor und dahinter bleibt sicher. Anders ist der
   Vergleich wertlos - ein Abschnitt, in den man mit Tempo 38 statt 26
   hereinkommt, ist schon deshalb schneller.
   Ausgegeben wird zusaetzlich die Folgesektion: ein Weg, der sein Tempo
   erst hinter dem Tor abliefert, verschenkt seinen Lohn an den naechsten
   Abschnitt - der Spieler sieht ihn dann nicht. */
const { execFileSync } = require('child_process');
const PROF = __dirname + '/abschnitt-profil.js';
/* Die lange Strecke, siehe abschnitt-profil.js */
process.env.MR_SATZ = process.env.MR_SATZ || 'lang';
const NAMEN = ['Auftakt','Sprungkette','Grosse Gabel','Tempostrecke','Wandschlucht','Wasserfall','Ruinen','ZIEL'];
const LBL = { 1: 'FAST', 2: 'RISK' };

function lauf(w) {
  const out = execFileSync('node', [PROF, w], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const kopf = out.split('\n')[0];
  const zeilen = [...out.matchAll(/^   (.{16})bis\s+(\S+) s\s+Abschnitt\s+(\S+) s.*Schnitt\s+(\S+)\s+Spitze\s+(\S+)\s+Luft\s+(\S+)/gm)];
  return {
    tode: (kopf.match(/Stuerze (\d+)/) || [0, '?'])[1],
    ok: /finish/.test(kopf),
    ab: zeilen.map(m => ({ name: m[1].trim(), t: +m[3], schnitt: +m[4], luft: +m[6] })),
    gesamt: zeilen.length ? +zeilen[zeilen.length - 1][2] : NaN
  };
}

const basis = lauf('0000000');
console.log('Gesamtzeit sicher: ' + basis.gesamt.toFixed(2) + ' s   (Stuerze ' + basis.tode + ')\n');
console.log('Gabel                Zweig   SAFE     ALT    Anteil   Luft S/A      Folgeabschnitt   Summe');
console.log('-'.repeat(92));

const ZWEIGE = [[0,[1]],[1,[1]],[2,[1,2]],[4,[1]],[5,[1]],[6,[2]]];
let zeilen = [];
for (const [fork, brs] of ZWEIGE) {
  for (const br of brs) {
    const w = '0000000'.split(''); w[fork] = String(br);
    const r = lauf(w.join(''));
    const a = basis.ab[fork], b = r.ab[fork];
    if (!b) { console.log(NAMEN[fork].padEnd(20) + LBL[br].padEnd(8) + '  NICHT DURCHGEKOMMEN'); continue; }
    const pct = b.t / a.t * 100;
    const nA = basis.ab[fork+1], nB = r.ab[fork+1];
    const paar = nA && nB;
    const paarA = paar ? a.t + nA.t : a.t, paarB = paar ? b.t + nB.t : b.t;
    zeilen.push({ fork, br, pct, paar: paarB/paarA*100 });
    console.log(
      NAMEN[fork].padEnd(20) + LBL[br].padEnd(8) +
      a.t.toFixed(2).padStart(6) + ' ' + b.t.toFixed(2).padStart(7) + '  ' +
      (pct.toFixed(1) + '%').padStart(7) + '   ' +
      (a.luft.toFixed(2) + '/' + b.luft.toFixed(2)).padStart(9) + '   ' +
      (paar ? (nA.t.toFixed(2) + ' -> ' + nB.t.toFixed(2)).padStart(15) : 'abgebrochen'.padStart(15)) + '  ' +
      ((paarB/paarA*100).toFixed(1) + '%').padStart(7) +
      (r.ok ? '' : '   STUERZE ' + r.tode));
  }
}
console.log('-'.repeat(92));
console.log('Sollwerte: FAST 80-85%, IRRE 65-75% (Richtwert des Auftraggebers)');
const daneben = zeilen.filter(z => (z.br === 1 ? (z.pct < 80 || z.pct > 85) : (z.pct < 65 || z.pct > 75)));
console.log(daneben.length ? 'Ausserhalb: ' + daneben.map(z => NAMEN[z.fork] + ' ' + LBL[z.br] + ' ' + z.pct.toFixed(1) + '%').join(', ')
                           : 'Alle Gabeln im Sollbereich.');
