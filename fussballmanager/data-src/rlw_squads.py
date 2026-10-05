#!/usr/bin/env python3
"""Kader der Regionalliga West 2026/27 -> raw/rlw_<id>.md

Quellen: Kaderseiten und Aufstellungen auf sport.de, kicker-Uebersicht der Sommer-Zugaenge
2026/27, Vereinsmeldungen (u. a. SC Paderborn U21, VfL Bochum U21). Stand Saisonbeginn 2026/27.
Wo nur der Kader 2025/26 verfuegbar war, wurde er um die bekannten Zu- und Abgaenge
bereinigt. EA SPORTS FC fuehrt keine Regionalliga - alle Staerkewerte sind geschaetzt.

Zeilenformat:  Name ; Position ; Geburt (JJJJ-MM oder JJJJ oder leer) ; Markierung
  Markierung: ++ Fuehrungsspieler / Ex-Profi, + Stammkraft, - Ergaenzung / Talent
Aufruf: python3 rlw_squads.py  (danach build_data.py)
"""
import hashlib
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Grundniveau einer Stammkraft je Verein (FC-Skala)
BASE = {
    'rwo': 58.5, 'fcg': 58, 'bvb2': 57.5, 's042': 57, 'boh': 57, 'sfs': 57, 'svr': 56.5,
    'sgw': 56, 'sfl': 56, 'bon': 56, 'koe2': 56, 'bmg2': 56, 'scp2': 55.5, 'scw': 55,
    'boc2': 55, 'rhy': 53.5, 'bgl': 53, 'hil': 52.5,
}
RESERVE = {'bvb2', 's042', 'koe2', 'bmg2', 'scp2', 'boc2'}

SQUADS = {
    'rwo': """
Nicolas Glaus;GK;2002-05;+
Ryan Valentine;GK;2004-01;
Jannis Knoblauch;GK;2007-01;-
Yassir Atty;RB;2003-04;
Tim Böhmer;CB;2002-01;
Eren Canpolat;CB;1997-04;
Pierre Fassnacht;CB;1996-01;+
Nico Klaß;LB;1997-04;
Simon Ludwig;CB;2003-07;
Michel Niemeyer;RB;1995-11;
Hasan Onur;LB;2007-02;-
Nils Winter;CB;1993-12;
Lucas Halangk;RM;2003-09;
Yannik Möker;CDM;1999-07;+
Alexander Mühling;CM;1992-09;++
Cankoray Mutlu;CM;2006-01;-
Luca Schlax;CAM;2000-04;+
Arda Süne;LM;2005-06;
Sergio Terranova;CM;2007-03;-
Joel Vega Zambrano;CDM;2004-09;
Kerem Yalcin;RM;2004-12;
Travis de Jong;RW;2005-04;
Timur Kesim;ST;2003-09;+
Burinyuy Nyuydine;ST;2000-12;
""",
    'fcg': """
Jarno Peters;GK;1993-06;+
Tim Matuschewsky;GK;2001-08;
Roman Schabbing;GK;2002-02;-
Ben Makhardt;GK;;-
Fynn Arkenberg;CB;;
Samuel Atman;LB;;
Niklas Barthel;CB;;+
Jannik Borgmann;CB;;
Joel Cilgin;RB;;
Kevin Hingerl;CB;;
Justus Henke;RB;;
Erik Lanfer;LB;;
Leo Weichert;CB;;-
Patrik Twardzik;CAM;1993-02;++
Daniel Burger;CM;;
Alexander Volke;CM;;
Hannes John;CM;;
Aleksandar Kandić;CM;;
André Kording;RM;;
Jan-Lukas Liehr;CM;;-
Sandro Reyes;CM;2003-06;
Lennard Rolf;LM;;
Björn Rother;CDM;1996-07;+
Paul-Joel Sauer;CM;;-
Len Wilkesmann;CM;;
Niklas Frese;ST;;
Phil Beckhoff;ST;;
Julius Langfeld;LW;;
Matthias Haeder;ST;;+
Paolo Maiella;RW;;
""",
    'bvb2': """
Yılmaz Aktaş;GK;2003-05;
Aaron Held;GK;2007-09;
Silas Ostrzinski;GK;2003-11;
Elias Benkara;LB;2007-04;
Finn Fuchs;CB;2006-02;
Malik Hodroj;CB;2003-10;
Ismael Mansaray;CB;2003-11;
Mario Pejazić;CB;2005-01;
Nanitonda Quiala;RB;2005-09;
Jesper Verlaat;CB;1996-06;++
Tim Degener;RB;;
Luke Fahrenhorst;CB;;
Ayman Azhil;CDM;2001-04;+
Michael Eberwein;RM;1996-03;+
Mussa Kaba;CM;2008-11;-
Danylo Krevsun;CAM;2005-04;
Beni Ngyombo;CM;2007-01;
Felix Paschke;CM;2003-07;
Fadi Zarqelain;CM;;
Mathis Albert;ST;2009-05;-
Joseph Boyamba;LW;1996-07;++
Ousmane Diallo;RW;2007-06;
Pharell Kegni;ST;2007-05;
Kevin Mutove;LW;2004-10;
Diego Ngambia Dzonga;ST;2007-11;
Daniel Sumbu;RW;2007-05;
Arne Wessels;ST;2005-02;
Bennedikt Wüstenhagen;ST;2005-12;
""",
    's042': """
Johannes Siebeking;GK;;+
Luca Happe;GK;;
Faaris Yusufu;GK;;-
Tomáš Kalas;CB;1993-05;++
Anton Donkor;LB;1997-11;+
Henning Matriciani;CB;2000-04;+
Mertcan Ayhan;CB;;
Vitalie Becker;LB;;
Anas Bouda;CB;;
Tim-Justin Dietrich;RB;;
Max Hauswirth;CB;;
Mika Khadr;RB;;
Magnus Rösner;CB;;
Linus Weik;LB;;-
Finn Porath;RM;1997-02;++
Mauro Zalazar;CM;2006-03;+
Yassin Ben Balla;CAM;;+
Max Grüger;CDM;;
Edion Gashi;CM;;
Aris Bayindir;CM;;
Andri Buzolli;CM;;
Ayman Gülaşı;CM;;
Vincenzo Onofrietti;RM;;
Paul Pöpperl;CM;;
Timothé Rupil;CAM;;
Emil Zeil;CM;;-
Max Weiland;CM;;
Jean-Paul Ndiaye;ST;;+
Jakob Sachse;ST;;+
Gerrit Wegkamp;ST;1993-04;+
Wesley Krattenmacher;ST;1998-02;+
Chukwubuike Adamu;RW;2002-06;
Joel Imasuen;LW;;
Alexander Guiddir;ST;;
Malik Tubić;ST;;-
""",
    'boh': """
Paul Grave;GK;2001-04;+
Haakon Pomorin;GK;2002-05;
Mats Remberg;GK;2006-01;-
Alexander Hahn;CB;1993-01;++
Jonas Carls;LB;1997-03;+
Dominik Lanius;CB;1997-03;
Ozan Hot;RB;2005-05;
Linus Olthoff;CB;2007-12;-
Paul Seidel;CB;2006-04;
Elano Yegen;RB;;
Philipp Hanke;CB;;
Venhar Ismailji;LB;;
Gianluca Swajkowski;CM;2005;
Kilian Zaruba;CM;;
Daniel Gerstmayer;CDM;;
Mika Walther;CM;2007;-
Boran Özbek;CAM;2007;-
Luca Puhe;CM;;
Malek Fakhro;ST;;+
Stipe Batarilo-Cerdic;RW;;
Lennart Garlipp;ST;;
Tim Krohn;ST;;
Marvin Lorch;LW;;
Benjamin Friesen;ST;;
""",
    'sfs': """
Justin Ospelt;GK;1999-09;+
Marcel Johnen;GK;;
Leon Klußmann;GK;;-
Pascal Manitz;GK;;
Florian Mayer;CB;;
Rikuhei Nabesaka;RB;;
Alban Peci;CB;;
Jan-Luca Rumpf;CB;;+
Jubes Ticha;LB;;
Leonhard von Schrötter;CB;;
Bernard Angong;CM;;
Dennis Brock;CDM;;
André Dej;CM;;
Tom Gutsch;CDM;;
Jannik Krämer;CM;;
Georgios Mavroudis;CAM;;
Shaibou Oubeyapwa;RM;;
Leon Pursian;CM;;
Hamza Saghiri;LM;;
Volkan Uluc;CM;;
Avan Barakat;CM;;-
Kevin Goden;ST;1999-02;+
Lucas Cueto;RW;1996-03;+
Serhat-Semih Güler;ST;;+
Arif Güclü;LW;;
Josue Santo;RW;;
Cagatay Kader;ST;;
Elsamed Ramaj;ST;;-
Ömer Tokaç;LW;;
Dustin Willms;ST;;
""",
    'svr': """
Tim Paterok;GK;1997-07;+
Matthis Harsman;GK;;
Alexander Höck;CB;;
Dennis-Adam Gorka;CB;;
Viktor Miftaraj;LB;;
Tim Corsten;RB;;
Maxim Gresler;CB;;
Leon Tia;CB;;
Marius Bauer;LB;;
Simon Breuer;RB;;
Louis Hiepen;CB;;
Jeff Mensah;CB;2001-12;
Lasse Zumdieck;CB;;
Mika Lehnfeld;RB;;
Allan Dantas;CM;;
Mattis Rohlfing;CDM;;
Manuel Reutter;CM;;+
Ben Klefisch;CAM;;
Tim Schleinitz;CM;;
Fabian Rüth;CM;;
Mikail Polat;RM;;
Timon Kramer;CM;;-
Lukas van Ingen;LM;;
Fatlum Elezi;CAM;;+
Abdul Fesenmeyer;LW;;
Eduard Probst;ST;;++
Cedric Euschen;ST;;
Luis Frieling;RW;;
""",
    'sgw': """
Joshua Mroß;GK;;+
Jens Balzukat;GK;;
Elias Yousfi;GK;;-
Agon Arifi;CB;;
Henri Bollmann;CB;;
Joey Gabriel;CB;;
Vincent Gembalies;CB;;+
Emirhan Hacioglu;LB;;
Kaan Kurt;RB;2001-12;
Eduard Renke;LB;;
Nicolai Schulte-Kellinghaus;RB;;
Albin Thaqi;CB;;-
Maximilian Adamski;CM;;
Nico Buckmaier;CDM;;+
Elias Demirarslan;CAM;;
Tidiane Gueye;CM;;
Nicolas Hirschberger;RM;;
Medin Kojic;LM;;
Mike Lewicki;CM;;
Marlon Sadowski;CDM;;
Tom Sindermann;CM;;
Steve Tunga;RM;;
Philip Buczkowski;ST;;+
Robert Nnaji;ST;;
Isaak Nwachukwu;LW;2004-11;
Ilya Polyakov;RW;;
Kevin Schacht;ST;;
Finn Wortmann;LW;;-
""",
    'sfl': """
Tim Fisch;GK;;+
Mika Westerhus;GK;;
Laurenz Beckemeyer;GK;2000-04;
Luis Hillemeier;GK;2001-12;-
Jonas Kehl;CB;2001-02;
Karlo Grgic;CB;;
Justin Faltyn;RB;;
Yegor Konyuchenko;LB;;
Nedzhib Hadzha;CB;;
Dimitrie Deumi-Nappi;CB;;
Dino Bajrić;CM;1995-07;+
Luca Horn;CM;1998-12;
Kamer Krasniqi;CAM;1996-01;+
David Pabón;RM;2003-05;
Max Ritter;CM;2004-05;
Emir Yakisir;CM;2007;-
Fatih Öztürk;CM;;
Mehmet Kaya;CDM;;
Keanu Kerbsties;LM;;
Hassan Mohamad;CM;;
Rohin Shivani;RM;;
Julien Kurowski;CAM;2007;-
Can Akbas;CM;2007;-
Eduard Mahmuti;CM;;
Yunus Akdag;CM;;
Samuel Addai;ST;2002-02;
Leon Demaj;LW;1997-11;
Kevin Holzweiler;ST;1994-10;+
Ayodele Ojo;ST;;
""",
    'bon': """
Kevin Birk;GK;;+
Tobias Pawelczyk;GK;;
Elias Bördner;GK;;
Luca Schmidt;GK;;-
Tobias Knost;CB;;+
Younes Derbali;CB;;
Yannik Dasbach;CB;;
Marcel Damaschek;CB;;
Tarik Dogan;CB;;
Roman Doulashi;RB;;
Massaman Keita;LB;;
Bilal-Badr Ksiouar;CB;;
Petar Lela;CB;;
Adis Omerbašić;LB;;
Julijan Popović;CB;;-
Markus Wipperfürth;RB;;
Leon Augusto;CDM;;
Felix Erken;CM;;
Eray Işık;RM;;
Elias Kratzer;CM;;
Haris Mesić;CM;;
Tobias Peitz;CDM;;+
Maximilian Pommer;CAM;;
Frederic Baum;CM;;
William McIntosh;CM;;
Jonas Berg;ST;;+
Robin Bird;LW;;
Serhat Koruk;ST;;
Marzouk Kotya-Fofana;RW;;
Yannik Schlößer;LW;;
Emmanuel Williams;ST;;
Diamant Berisha;ST;2000-07;
Luca de Meester;ST;;
Aaron Tshimuanga;RW;;
""",
    'koe2': """
Luis Hauer;GK;;
Mikolaj Marutzki;GK;;
Simeon Castano Bader;GK;;-
Marvin Ajani;RB;;
Luc Dabrowski;CB;;
David Fürst;CB;;
Niklas Hoffmann;LB;;
Assad Kotya-Fofana;CB;;
Etienne Borie;CM;;
Luca Dürholtz;CM;;
Ilias Elyazidi;CAM;;
Mikail Özkan;CM;;
Emin Kujovic;LM;;
Safyan Touré;RM;;
Nilas Yacobi;ST;;
Luiz Labenz;ST;;
Jonas Arweiler;ST;;
Sargis Adamyan;ST;1993-05;++
""",
    'bmg2': """
Maximilian Neutgens;GK;;
Aidan Jericho;GK;;
Juri Schüchter;GK;;
Marcello Trippel;GK;;-
Julian Korb;RB;1992-03;++
Dillon Berko;CB;;
Talha Catkaya;CB;;
Michel Lieder;CB;;
Tyler Meiser;LB;;
Lion Schweers;CB;;
Joshua Uwakhonye;RB;;
Simon Walde;CB;;
Thilo Töpken;CB;;
Kemal Çırpan;CM;;
Fritz Fleck;CM;;
Charles Herrmann;CAM;;+
Antonio Jozanović;CM;;
Wael Mohya;CAM;;+
Kilian Sauck;CDM;;
Veit Stange;CM;;
Nico Vidić;LM;;
Kerim Yüksel Karyagdi;CM;;
Karim Affo;CM;;
David Igboanugo;RW;;
Justin Adozi;ST;;
Oguzcan Büyükarslan;RW;;
Flavjo Hoxha;LW;;
Yannick Michaelis;ST;;
Jan Urbich;ST;;
Josiah Uwakhonye;LW;;
""",
    'scp2': """
Luis Flörke;CB;;
Lenny Hennig;CB;;
Maximilian Hippe;CB;;
Jan Peters;RB;;
David Stamm;LB;;
Alan Takoudjou Somolinos;CB;;
Joel Udelhoven;CB;;
Paul Wollenberg;CB;2009;-
Arne Zajaczek;LB;;
Tristan Zobel;RB;;
Cihan Agirayak;CM;;
Julius Bugenhagen;CM;;
Lucas Kiewitt;CDM;;
Jakob Kuntze;CM;;
Neo Lima Stacziwa;CAM;2008;-
Vigo Wernet;RM;;
Bennit Bröger;CM;;
Luca Löwelt;LW;;
Noah Ringbeck;ST;;
Lucas Copado;RW;;
Shkrep Stublla;ST;2004-11;+
""",
    'scw': """
Marcel Hölscher;GK;;+
Nikola Aracic;CB;;
Christian Stabenau;CB;;
Konstantin Gerhardt;RB;;
Niklas Tuppeck;LB;;
Tom Krüger;CB;;
Saban Kaptan;CM;;
Fabio Riedl;CM;;
Marlon Lakämper;CDM;;
Timo Kondziella;CAM;;
Davud Tuma;LM;;
Finn Cramer;RM;;
Marius Zentler;CM;2004-08;
Julius Bochmann;CM;;+
Alessandro Toia;CM;;
Janis Seiler;LM;;
Leon Kayser;RB;;
Simeon Tsanev;RW;;
Sebastian Mai;ST;;+
""",
    'boc2': """
Benjamin Bußmann;GK;;
Finn Kotyrba;GK;;
Noel Intven;GK;;-
Nicolas Abdat;CB;;
Luca Bernsdorf;CB;;
Jaden Kibbe;CB;;
Finn-Ole Lang;RB;;
Leon Sawas;LB;;
Owono-Darnell Keumo;CB;;
Dominic Volkmer;RB;;
Aurel Wagbe;CB;;
Benjamin Dreca;CM;;
Ciwan Günes;CM;;
Lars Holtkamp;CM;;+
Niklas Jahn;CDM;;
Cajetan Lenz;CAM;;
Jean-Philippe Njike Nana;CM;;
Jan Nzeba-Bost;CM;;
Vahidin Turudija;LM;;
Gustav Schjøtt;CM;;-
Ole van Eck;CM;;-
Janek Herzberg;RM;;-
Jonathan Akaegbobi;ST;;
Divine Boafo;RW;;
Luis Hartwig;ST;;
Ben Heuser;LW;;
Lirim Jashari;ST;;
Semin Kojić;ST;;
Tolga Özdemir;RW;;
""",
    'rhy': """
Christopher Balkenhoff;GK;1993-10;+
Simon Schilling;GK;2007-06;-
Emmanuel de Lemos;RB;2005;
Keanu Diskau;LB;2005;
Patrick Franke;CB;1997;
Elias Kourouma;CB;2002;
Mohamed Kourouma;CB;2000;
Linus-Casper Neugebauer;CB;2008;-
Philipp Ratz;RB;2001;
Melih Sayin;CB;2003;
Finn Schubert;LB;2002;
Michael Wiese;CB;1994;+
Julius Woitaschek;CB;2000;
Fabian Brall;CM;2006;
Safwane Errifai;CAM;2008;-
Jaron Emilian Habekost;CM;2007;
Lennart Koerdt;CM;2005;
Rafael Miguel Lopez Zapata;CDM;1997;+
Connor Mc Leod;RM;2002;
Jonah Wagner;LM;2004;
Lars Warschewski;CM;2000;
Latif-Bilal Alassane;RW;2005;
Georges Baya Baya;ST;2001;
Koray Dag;LW;2003;
Henrik Koch;ST;2006;
Elias Opoku Boadi;ST;2003;
Akhim Seber;ST;1994;+
Johannes Thiemann;ST;1999;
""",
    'bgl': """
Robin Schulze;GK;2002-12;+
Luis Altmayer;GK;2004-04;
Anton Hellmich;GK;2006-02;-
Elyas Aydin;LB;2006-07;
Linus Daus;CB;2005-11;
Rexhep Ajdari;CB;2004-04;
Tilman Demmer;RB;2001-11;
Fabian Fricke;CB;2007-10;-
Kalle Geisenhainer;CB;2005-09;
Mathias Hülsenbusch;LB;2003-03;
Daniel Spiegel;CB;;
Maik Marquardt;CM;;+
Jan Bugenhagen;CM;;
Joel Kouekem;CM;;
Soufian Amaadacho;CAM;;
Finn Stromberg;RM;;
Denys Pinchuk;CM;;
Ole Tillmann;CDM;;
Artem Belousov;LM;;
Eliot Albert;ST;;
Ervin Cindrak;ST;;+
""",
    'hil': """
Yannic Lenze;GK;2001-02;+
Jens Born;GK;1996-12;
Leon Feher;GK;2004-05;
Viktor von Winterfeld;GK;2006-11;-
Linus Ansumana;CB;2003-10;
Len Heinson;CB;1995-12;+
Simon Metz;RB;1997-04;
Leon Prokshi;LB;2006-04;-
Nick Sangl;CB;2000-04;
Phil Zimmermann;CB;2003-03;
Maximilian Wagener;CM;1995-01;+
Kevin Hoffmeier;CDM;;
Arton Tolaj;CM;;
Armin Deljkovic;CAM;2005;
Georgios Touloupis;CAM;;+
Egzon Zendeli;LM;;
Etienne Feese;ST;2000-03;
Harumi Goto;RW;2002-04;
Tyler Nkamanyi;LW;2004-04;
Yusuke Okuda;ST;;
""",
}

MARK = {'++': 5, '+': 2.5, '': 0, '-': -3}


def h(*parts):
    return int(hashlib.md5('|'.join(map(str, parts)).encode()).hexdigest()[:8], 16)


def age_from(birth, name, cid):
    """Alter zu Saisonbeginn (1. Juli 2026)."""
    if birth:
        parts = birth.split('-')
        y = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 1
        return 2026 - y - (1 if m > 6 else 0), True
    r = h(name, 'age')
    if cid in RESERVE:
        return 19 + r % 4, False
    return 21 + r % 10, False


def age_adj(age):
    if age <= 17:
        return -6
    if age == 18:
        return -4
    if age == 19:
        return -2.5
    if age == 20:
        return -1.5
    if age == 21:
        return -0.5
    if age >= 34:
        return -1.5
    return 0


def rating(cid, name, pos, age, mark):
    base = BASE[cid]
    v = base + MARK[mark] + age_adj(age) + ((h(name, 'ovr') % 5) - 2)
    if pos == 'GK' and mark == '':
        v -= 1  # Ersatztorhueter
    return int(round(max(44, min(65, v))))


def main():
    out_dir = os.path.join(HERE, 'raw')
    for cid, block in SQUADS.items():
        lines = ['#src est', '# Regionalliga West 2026/27 - Werte geschaetzt (nicht in EA SPORTS FC enthalten)', '#est']
        for raw in block.strip().splitlines():
            name, pos, birth, mark = [x.strip() for x in raw.split(';')]
            age, known = age_from(birth, name, cid)
            ovr = rating(cid, name, pos, age, mark)
            lines.append(f"{name} | {pos} | {ovr} | {age if known else ''}")
        with open(os.path.join(out_dir, f'rlw_{cid}.md'), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines) + '\n')
        print(cid, len(lines) - 3)


if __name__ == '__main__':
    main()
