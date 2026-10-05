/* Namenslisten fuer Nachwuchsspieler aus den Vereinsakademien (fiktiv). */
(function () {
  'use strict';
  var FM = window.FM;

  FM.NAMES = {
    first: [
      'Lukas', 'Leon', 'Finn', 'Jonas', 'Elias', 'Noah', 'Paul', 'Ben', 'Luis', 'Felix', 'Maximilian', 'Henry',
      'Emil', 'Jakob', 'Moritz', 'Anton', 'Theo', 'Niklas', 'Tim', 'Jan', 'Julian', 'David', 'Simon', 'Tom',
      'Philipp', 'Fabian', 'Nico', 'Lennard', 'Erik', 'Hannes', 'Mats', 'Ole', 'Linus', 'Malte', 'Till',
      'Jannik', 'Marlon', 'Kilian', 'Bastian', 'Vincent', 'Johannes', 'Robin', 'Leo', 'Mika', 'Levin', 'Joel',
      'Samuel', 'Aaron', 'Nils', 'Lasse', 'Carlo', 'Mattis', 'Bennet', 'Karl', 'Oskar', 'Arne', 'Lars',
      'Yusuf', 'Emre', 'Can', 'Deniz', 'Arda', 'Kerem', 'Luca', 'Matteo', 'Enzo', 'Rafael', 'Mateo', 'Adrian',
      'Ilias', 'Amin', 'Karim', 'Youssef', 'Ibrahim', 'Moussa', 'Kofi', 'Kwame', 'Jamal', 'Nathan', 'Noel',
      'Dario', 'Luka', 'Marko', 'Ivan', 'Milan', 'Petar', 'Filip', 'Mateusz', 'Kacper', 'Oliver', 'Liam',
      'Kevin', 'Dennis', 'Marvin', 'Pascal', 'Sven', 'Malik', 'Yannick', 'Mert', 'Berat', 'Tobias'
    ],
    last: [
      'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
      'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Krüger',
      'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Krause', 'Meier', 'Lehmann', 'Schmid', 'Schulze',
      'Maier', 'Köhler', 'Herrmann', 'König', 'Walter', 'Mayer', 'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Lang',
      'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Schubert', 'Vogel', 'Friedrich', 'Keller', 'Günther', 'Frank',
      'Berger', 'Winkler', 'Roth', 'Beck', 'Lorenz', 'Baumann', 'Franke', 'Albrecht', 'Schuster', 'Simon',
      'Ludwig', 'Böhm', 'Winter', 'Kraus', 'Martin', 'Schumacher', 'Krämer', 'Vogt', 'Stein', 'Jäger', 'Otto',
      'Sommer', 'Groß', 'Seidel', 'Heinrich', 'Brandt', 'Haas', 'Schreiber', 'Graf', 'Dietrich', 'Ziegler',
      'Kuhn', 'Kühn', 'Pohl', 'Engel', 'Horn', 'Busch', 'Bergmann', 'Thomas', 'Voigt', 'Sauer', 'Arnold',
      'Wolff', 'Pfeiffer', 'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Öztürk', 'Aydın', 'Kovačević',
      'Petrović', 'Jovanović', 'Nowak', 'Kowalski', 'Mensah', 'Owusu', 'Diallo', 'Traoré', 'Haddad',
      'Rossi', 'Ferreira', 'Santos', 'Berisha', 'Krasniqi', 'Hoxha', 'Nielsen', 'Jansen', 'de Vries'
    ]
  };

  FM.randomName = function (taken) {
    for (var i = 0; i < 50; i++) {
      var n = FM.rng.pick(FM.NAMES.first) + ' ' + FM.rng.pick(FM.NAMES.last);
      if (!taken || !taken[n]) return n;
    }
    return FM.rng.pick(FM.NAMES.first) + ' ' + FM.rng.pick(FM.NAMES.last) + ' ' + FM.rng.int(2, 9);
  };
})();
