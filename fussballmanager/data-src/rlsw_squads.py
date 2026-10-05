#!/usr/bin/env python3
"""Kader der Regionalliga Suedwest 2026/27 -> raw/rlsw_<id>.md

Quellen: Kaderseiten auf sport.de (Offenbach, Ulm, Stuttgarter Kickers, Sandhausen), weltfussball.de
und kicker.de (Steinbach Haiger, FSV Frankfurt, Heilbronn-Freiberg, Reserveteams), kicker-Uebersicht
der Sommer-Zugaenge 2026/27, fussballnationalmannschaft.net (Fulda-Lehnerz, Lautern II) und
Vereinsmeldungen. Stand Saisonbeginn 2026/27. Wo nur der Kader 2025/26 verfuegbar war (Kassel,
Homburg, Trier, Aalen), wurde er um die bekannten Zu- und Abgaenge bereinigt. Spieler, die schon
bei einem anderen Verein im Datensatz stehen, bleiben dort - ausser bei belegten Sommer-Transfers
(Lohkemper Waldhof -> Sandhausen, Gaudino Aachen -> Aalen, Corsten Roedinghausen -> Trier).
EA SPORTS FC fuehrt keine Regionalliga - alle Staerkewerte sind geschaetzt.

Zeilenformat wie rlw_squads.py:  Name ; Position ; Geburt (JJJJ-MM oder JJJJ oder leer) ; Markierung
Aufruf: python3 rlsw_squads.py  (danach build_data.py)
"""
import os

from rlw_squads import MARK, age_adj, h

HERE = os.path.dirname(os.path.abspath(__file__))

# Grundniveau einer Stammkraft je Verein (FC-Skala). Der Suedwesten ist die staerkste Staffel.
BASE = {
    'off': 59.5, 'ulm': 59, 'svs': 59, 'skk': 58, 'kas': 58, 'hom': 58, 'tri': 57.5,
    'hfb': 57.5, 'fsvf': 57.5, 'tss': 57.5, 'scf2': 57, 'm052': 56.5, 'aal': 56.5,
    'wdf': 56.5, 'sge2': 55.5, 'fck2': 55, 'fld': 55, 'vfrm': 55,
}
RESERVE = {'scf2', 'm052', 'sge2', 'fck2'}

SQUADS = {
    'off': """
Johannes Brinkies;GK;1993;++
Angelo Tramontana;GK;2001;
Nikolas Tatomirović;GK;2007;-
Henrik Krüger;GK;2009;-
Jayson Breitenbach;RB;1998;+
Kristjan Česen;LB;1997;+
Dominik Črljenec;CB;1999;
Nathan Doğanay;RB;2006;-
Faris El Ouali;LB;2007;-
Bastian Frölich;CB;2000;
Noah Lehmann;CB;2007;-
Ronny Marcos;LB;1993;++
Jan-Hendrik Marx;RB;1995;+
Maximilian Rossmann;CB;1995;+
Alexander Sorge;CB;1993;++
Mohamadaziz Abdelhadi;CM;2006;-
Daniel Dejanović;CAM;2001;
Luka Garić;CM;2000;
Anastasios Kagiouzis;CM;2007;-
Robin Krauße;CDM;1994;++
Adam Loune;CM;2006;-
Alessandro Pistritto;CAM;2007;-
Tom Reuter;CM;2008;-
Maximilian Wolfram;CM;1997;+
Jan Becker;ST;2007;-
Ayman Boumaftan;RW;2006;-
Jelle Goselink;ST;1999;+
Maximilian Schmid;LW;2003;
Keanu Staude;RW;1997;+
Harris Uhumwangho;ST;2007;-
Benedikt von Hagen;LW;2003;
""",
    'ulm': """
Radomir Novaković;GK;2000-01;+
Robin Mantel;GK;2000-11;
Kim Bayer;GK;2007-01;-
Alexandre Azevedo;CB;2005-03;
Marco Gölz;LB;2001-07;+
Mattis Hoppe;CB;2003-07;
Daniel Hülsenbusch;CB;;
Karl Kempf;RB;2007-01;-
Alexander Kopf;CB;2001-01;
Johannes Reichert;CB;1991-07;++
Tim Schmidt;RB;2002-07;
Marcel Seegert;CB;1994-04;++
Felix Vater;LB;2007-11;-
Benedikt Ehe;CDM;2007-01;-
Per Lockl;CM;2001-03;+
Mateo Mrden;CM;2008-05;-
Emanuel Taffertshofer;CDM;1995-02;++
Oliver Wähling;CAM;1999-09;+
Simun Birkic;ST;2006-10;-
Dennis Chessa;RW;1992-10;++
Halim Eroğlu;LW;2004-08;
Benjamin Goller;RW;1999-01;+
Achitpol Keereerom;LW;2001-10;
Christopher Negele;ST;2005-04;-
Lucas Röser;ST;1993-12;++
Tibet-Erkan Sevik;ST;2009-12;-
Masaaki Takahara;ST;1995-08;
""",
    'svs': """
Arthur Lyska;GK;;+
Luis Idjaković;GK;;
Noah Loos;GK;;-
Lukas Schneller;GK;;-
Teoman Akmestanli;CB;;
Gaoussou Dabo;CB;;
Ken Gipson;RB;1996;++
Lukas Mazagg;CB;;+
Yannick Osée;LB;;+
Kwabe Schulz;CB;;+
Seyhan Yiğit;LB;;
Pablo Zahnen Martínez;CB;;
Batu Akgöz;CM;;-
Leon Ampadu;CM;;
Eren Ceylan;CDM;;
Max Christiansen;CDM;1996-09;++
Imad Jaadar;CM;;-
Marco Kehl-Gómez;CDM;1992-03;+
Tim Korzuschek;CM;;
Yanis Outman;RM;;
Denis Pfaffenrot;CM;;
Tom Stadler;CM;;-
Niklas Tarnat;CDM;1998-05;++
Mert Tasdelen;LM;;
Phil Halbauer;RW;;
Tasos Leonidis;ST;;-
Felix Lohkemper;ST;1995-01;++
Stefan Maderer;RW;;
David Mamutović;LW;;
Nico Nollenberger;ST;;
Luka Vukoja;ST;;
Maximilian Wagner;ST;;+
""",
    'skk': """
Felix Dornebusch;GK;1994;++
Thomas Bromma;GK;;+
David Mitrovic;GK;;-
Leon Neaime;GK;;-
Mario Borac;CB;;
Jacob Danquah;CB;;
Nico Fundel;LB;;
Ardi Mulaj;RB;;
Milan Petrović;CB;;+
Vincent Schwab;LB;;
David Udogu;CB;;+
Nico Blank;CM;;+
Melkamu Frauendorf;CAM;;+
Lukas Kiefer;CM;;
David Tomić;CDM;;+
Maximilian Zaiser;CM;;
Lirjon Abdullahu;LW;;
Flamur Berisha;LW;;
David Braig;ST;;+
Marlon Faß;RW;;+
Abdoulie M'Boob;ST;;
Christian Mauersberger;RW;;
Nevio Schembri;ST;;-
Meris Skenderović;ST;;++
David Stojak;RW;;+
Samuel Unsöld;LW;;
""",
    'kas': """
Jonas Nickisch;GK;;+
Nicolas Gröteke;GK;2001-04;
Tobias Boche;CB;;
Tyron Duah;RB;;
Joshua Kopf;CB;;
Aaron Liesche Prieto;LB;;
Nael Najjar;CB;;+
Luis Podolski;RB;;
Maurice Springfeld;CB;;++
Finn Bindbeutel;CB;;-
Adrian Bravo-Sanchez;CM;;+
Frederic Brill;CM;;
David Emmanuel;CDM;;
Sercan Sararer;LM;1989-11;+
Felix Schlüsselburg;CM;;
Yannick Stark;CDM;1990-10;++
Emre Böyükata;RW;;
Cornelius Bräunling;LW;;
Benjamin Girth;ST;1992-01;++
Silas Hagemann;ST;;-
Joyce Luyeye-Nkula;ST;;
""",
    'hom': """
Jonas Weyand;GK;2000-12;+
Michael Gelt;GK;;
Elias Cervenka;GK;;-
Lukas Hoffmann;GK;;-
Miguel Fernandes;RB;;
Michael Heilig;CB;;
Manuel Kober;CB;;
Steffen Nkansah;CB;;++
Nils Röseler;CB;;+
Frederik Schumann;LB;;
Phillipp Steinhart;LB;1992-07;+
Tim Steinmetz;RB;;
Jan-Erik Eichhorn;CB;;
Yohann Torres;RB;;
Aaron Manu;RB;;
Simon Joachims;CM;;
Nicolas Jörg;CDM;;
Justin Petermann;CAM;;
Armend Qenaj;CAM;;+
Nico Andermatt;CM;;
Michael Guthörl;CM;;
Julian Günther-Schmidt;CAM;1994-06;++
Hilal El Helwe;ST;1994-11;+
Oliver Kovacic;ST;;
Ken Mata;RW;;-
Markus Mendler;LW;1993-01;++
Jacob Roden;ST;;
Birkan Çelik;LW;2002-04;
Marc Ehrhart;RW;;
Emir Kuhinja;ST;;
""",
    'tri': """
Leon-Oumar Wechsel;GK;;+
Matthias Fettes;GK;;
Connor Karas;GK;;-
Ben Schmit;GK;;-
Tim Corsten;CB;;+
Gianluca Pelzer;RB;;
Kevin Heinz;CB;;+
Jannis Held;CB;;
Lucas Laux;LB;;
Ho-joon Lee;RB;;
Fabio Lohei;CB;;
Dimitrios Mitakidis;CB;;
Frederik Rahn;LB;;
Noah Awassi;RB;;-
Elia Dittrich;CM;2007;-
Jan-Lucas Dorow;CM;1993;++
Chris Filipe;CAM;;
Robin Garnier;RM;;
Noah Herber;CM;;
Dominik Kinscher;CDM;;
Sven König;CM;;+
Mirko Schuster;LM;;
Christopher Spang;CDM;;+
Maurice Wrusch;CM;;
Ömer Yavuz;CAM;;
Shawn Blum;ST;;
Tom Gaida;ST;;-
Mateo Biondic;ST;;+
Noah Lorenz;LW;;
Damjan Marčeta;RW;;
Tim Sausen;ST;;
Hokon Sossah;RW;;
""",
    'hfb': """
Srdjan Groznica;GK;;+
Benedikt Grawe;GK;;
Ante Eljuga;GK;;-
Abou Ballo;CB;;
Tino Bradara;CB;;
Marshall Faleu;RB;;
Adam Krstanovic;LB;;
Tim Niklas Pietzsch;CB;;
Paul Polauke;CB;;+
Scott Kennedy;CB;1997-03;++
Ryan Adigo;CM;;
Melvin Cerkez;CDM;;
Minos Gouras;RW;1998-07;++
Marius Köhl;CM;;
Julian Kudala;CM;;
Tim Latteier;CAM;;
Lukas Laupheimer;CDM;;+
Gwang-in Lee;CAM;;
Michael Martin;CM;;
Leon Petö;LM;;
Matt Zié;RM;;
Gal Grobelnik;ST;;
Meghon Valpoort;ST;;+
Justin Steinkötter;ST;1999-08;+
""",
    'fsvf': """
Lucas Becker;GK;2002-05;+
Louis Held;GK;2006-07;-
Jonas Iwan;GK;2006-01;-
Lars Schön;GK;2006-06;-
Christoph Ehlich;CB;1999-02;+
Lukas Gottwalt;CB;1997-09;+
Phil Kemper;RB;2002-03;
Corvin Bock;LB;1999-01;
David Deger;CB;2000-02;
Nick Doktorczyk;LB;2005-10;-
Dwayn Meene;RB;;
Uche Obiogumu;CB;;
Giorgio del Vecchio;CM;1999-02;+
Elias Breir;CM;2005-04;
Amin Farouk;CAM;2003-07;
George Iorga;CM;2004-01;
Joep Munsters;CDM;2002-03;+
Junis Romdhane;CM;2006-06;-
Leandro Simunic;LM;2006-10;-
Ismail Harnafi;LW;2002-02;
Emmanuel Godwin McDonald;RW;1999-11;+
Hassan Mourad;ST;1999-11;+
Cas Peters;ST;1993-05;++
Filip Pandza;ST;;
Amar Suljić;RW;;+
""",
    'tss': """
Mike Dreier;GK;;+
Kevin Ibrahim;GK;;
Chris Schubert;GK;;-
Tyler Doğan;GK;;-
Nick Galle;CB;;
Tim Kircher;CB;;+
Paul Donner;LB;;
Tjark Hildebrandt;RB;;
Max Lippert;CB;;
Levi Mentzel;CB;;
Serkan Firat;CAM;1994;++
Jahn Herrmann;CM;;
Ole Käuper;CM;;+
Bleron Krasniqi;CM;;
Levin Müller;CDM;;
Luca Spangenberger;CM;;
Leon Wirtz;RM;;
Dildar Atmaca;ST;;
Deniz Bindemann;LW;;
Kevin Luca Gleissner;ST;;
Ertan Hajdaraj;RW;;
Till Hausotter;ST;;
Marvin Mika;RW;;
Jakob Pfahl;LW;;
Maximilian Pronichev;ST;;+
""",
    'aal': """
Maximilian Otto;GK;;+
Hannes Sauter;GK;;
Andreas Wick;GK;;-
Ünal Akinci;CB;;
Thomas Geyer;CB;;+
Noel Guerriero;RB;;
Reece Hannam;LB;2000-05;
Paul König;CB;;
Ali Odabas;CB;;
Michael Schaupp;RB;;
Tom Barth;CB;;
Lasse Jürgensen;LB;;
Luigi Campagna;CM;;+
Jascha Döringer;CM;;
Loris Groß;CDM;;
Emre Kahriman;CAM;;
Vico Meien;CAM;;+
Stefan Wächter;CDM;;
Gianluca Gaudino;CM;1996-11;++
Niklas Antlitz;ST;;
Ben Cahani;RW;;
Benjamin Kindsvater;ST;;+
Saša Maksimović;LW;;
Dean Melo;RW;;
Michael Kleinschrodt;ST;;
Sean Seitz;LW;;
""",
    'wdf': """
Mario Schragl;GK;;+
Jack Hillenbrand;GK;;
Michel Witte;GK;;-
Maik Goß;CB;;+
Lennart Grimmer;RB;;
Roman Hauk;CB;;+
Marvin Mutz;LB;;
Bennet Schieber;CB;;
Yannick Thermann;RB;;
Luis Baumert;CM;;
Arion Erbe;CM;;-
Tim Fahrenholz;CDM;;+
Kenny Freßle;CM;;
Tom Gebauer;CM;;
Gabriele Giannetta;CAM;;
Baton Hajrizaj;LM;;
Emilian Lässig;CM;;-
Iosif Maroudis;CAM;;
Matej Mijic;CDM;;
Theodoros Politakis;RM;;
Konrad Riehle;CM;;
Benjamin Thurnher;CM;;
Maximilian Philipp Waack;CM;;
Marcel Carl;ST;;+
Tino Kaufmann;ST;;
Felix Kendel;LW;;
Karlo Kuranyi;ST;;-
Samuel Wetter;RW;;
""",
    'scf2': """
Jaaso Jantunen;GK;;+
Kilian Katz;GK;;
Luka Nujić;GK;;-
Théodore Pizarro;GK;;-
Junior Atemkeng;CB;;
Kimberly Ezekwem;LB;2001-06;+
Marc Hornschuh;CB;1991-03;++
Ashley Ketterer;RB;;
Marius Klein;CB;;
Leon Koß;CB;;
David Schopper;RB;;
Karl Steinmann;CB;;
Daniel Williams;LB;;
Kevin Founes;CM;;
Patrick Lienhard;LM;1992-08;+
Luca Marino;CM;;
Billal Mohamed;CAM;;
Mika Reifsteck;CM;;
Fabian Rüdlin;RM;;+
Rouven Tarnutzer;CDM;;
Louis Tober;CM;;
Noah Wagner;CM;;
Oscar Wiklöf;CM;;
Mateo Zelic;CAM;;
Bismark Adomah;RW;;
David Amegnaglo;ST;;+
Leon Catak;ST;;
Mathias Fetsch;ST;1988-09;+
Jack James;LW;;
Krish Raweri;ST;;-
Luca Schulten;ST;;
""",
    'm052': """
Louis Babatz;GK;;+
Luke Gauer;GK;;
Pit Zuther;GK;;-
Korbinian Burger;CB;;+
Justus Götze;CB;;
Luke Rahmann;LB;;
Philipp Schulz;CB;;
Jusuf Ugljanin;RB;;
Dominik Horlbeck;CB;;
Fynn Hillbrunner;LB;;
Emanuel Marincau;CB;;
Nick Cherny;CM;;
Raul König;CM;;
Yunus Mallı;CAM;1992-02;++
Taiyu Yamasaki;CM;;
Alynho Haïdara;CM;;-
Julian Derstroff;ST;;+
Andre Gitau;RW;;
Smail Kadrijaj;ST;;
Fabio Moreno Fell;ST;;
Jayson Videira;LW;;
Rael Nakuzola;ST;;-
""",
    'sge2': """
Sissis Efthymiou;GK;2007;
Benjamin Speight;GK;2006;
Davis Bautista;CB;2005;
Philipp Eisele;RB;2007;
Pedro Guimaraes;LB;2008;-
Benjamin Kirchhoff;CB;1995;++
Nico Ochojski;RB;1999;+
Maurice Spahn;CB;2007;
Jonas Bauer;CM;2003;+
Marvin Dills;CM;2007;
Rinto Hanashiro;CAM;2006;
Ebu Bekir Is;CAM;2009;-
Jeremiaha Maluze;CM;2005;
Clement Nana-Sarhene;CDM;2007;
Collin Owusu Etse;RM;2005;
Henrik Peter;CM;2007;
Davyd Ramaki;LM;2007;
Lawrence Setordjie;CM;2008;-
Metehan Yildirim;CAM;2005;
Sadiki Chemwor;ST;2008;-
Cherif Cissé;RW;2007;
George Didoss;ST;2005;
Alessandro Gaul Souza;LW;2007;
Keito Kumashiro;RW;2008;-
Lukas Sonnenwald;ST;2003;+
Tobias Weigel;ST;2007;
Paul Wünsch;LW;2005;
""",
    'fck2': """
Fabian Heck;GK;2005-04;
Luca Tauer;GK;2006-02;-
Raphael Adiele;CB;2005;
Neal Gibs;RB;2002;+
Leonardo Kraft;CB;2009;-
Denis Linsmayer;CDM;1992;++
Ivan Smiljanic;CB;2004;
Melvin-Joe Wiesnet;LB;2006;
Luke Dunne;CM;2005;
Lucas Leibrock;CM;2005;
Ben Reinheimer;CAM;2004;
Jean Zimmer;RB;1994;++
Chinedu Chukwukelu;ST;2007;
Sean Wallace;ST;2008;-
""",
    'fld': """
Jannik Horz;GK;2003-04;+
Maximilian Weisbäcker;GK;2001-04;
Pietro Besso;CB;2004;
Aaron Frey;RB;1998;+
Marius Grösch;CB;1995;+
Milian Habermehl;LB;2004;
Kevin Hillmann;CB;1994;++
Arlind Iljazi;RB;2006;-
Keanu Kraft;CB;2004;
Sebastian Schmitt;LB;1997;
Nicola Arcanjo-Köhler;CM;2000;
Nick Berger;CAM;2003;
Tobias Göbel;CDM;1999;+
Roko Ivankovic;CM;2001;+
Leon Pomnitz;CM;1996;+
Hans Nunoo Sarpei;CDM;1999;++
David Siebert;RM;2002;
Ali Hüseyin Gün;CAM;2005;
Felix Hahn;CM;;
Axel Furkert;CM;;
Andreas Ardal;RW;2004;
Moritz Dittmann;LW;2003;
Marvin Pourié;ST;1991;++
Moritz Reinhard;ST;1996;+
Max Stadler;ST;;
""",
    'vfrm': """
Marcus Retter;GK;;+
David Nreca-Bisinger;GK;;
Tarik Karaman;GK;;-
Malwin Zok;GK;;-
Robin Becker;CB;;
Hans-Juraj Hartmann;RB;;
Mehdi Hetemaj;CB;;+
Christian Kuhn;CB;;
Alexander Mißbach;LB;;
Vincent Moreno Giesel;RB;;
Jonas Weik;CB;2000;+
Tilman Sieverling;LB;;
Tim Grünewald;CM;;
Kevin Krüger;CM;;
Jannik Marx;CAM;;
Alexandru Paraschiv;CAM;;+
Melvin Ramusovic;CM;;
Mart Ristl;CDM;1996-07;++
Lukas Rupp;CM;1991-01;++
Tyrese Zeigler;RM;;
Umut Sentürk;CM;;
Anas Alaoui;RW;2006;
Nolhan Assafoua;ST;;
Alexander Esswein;LW;1990-03;++
Marvin Kadner;ST;;+
Pasqual Pander;ST;;
Lennart Thum;ST;;
""",
}


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


def rating(cid, name, pos, age, mark):
    v = BASE[cid] + MARK[mark] + age_adj(age) + ((h(name, 'ovr') % 5) - 2)
    if pos == 'GK' and mark == '':
        v -= 1  # Ersatztorhueter
    return int(round(max(44, min(66, v))))


def main():
    out_dir = os.path.join(HERE, 'raw')
    seen = {}
    for cid, block in SQUADS.items():
        lines = ['#src est', '# Regionalliga Suedwest 2026/27 - Werte geschaetzt (nicht in EA SPORTS FC enthalten)', '#est']
        for raw in block.strip().splitlines():
            name, pos, birth, mark = [x.strip() for x in raw.split(';')]
            if name in seen:
                raise SystemExit(f'{name} doppelt: {seen[name]} und {cid}')
            seen[name] = cid
            age, known = age_from(birth, name, cid)
            ovr = rating(cid, name, pos, age, mark)
            lines.append(f"{name} | {pos} | {ovr} | {age if known else ''}")
        with open(os.path.join(out_dir, f'rlsw_{cid}.md'), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines) + '\n')
        print(cid, len(lines) - 3)


if __name__ == '__main__':
    main()
