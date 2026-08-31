/* names.js - Namenspools fuer die Spielergenerierung, nach Nationen getrennt. */
(function (g) {
  'use strict';

  var P = {
    Deutschland: {
      v: ['Leon', 'Finn', 'Luca', 'Jonas', 'Noah', 'Elias', 'Paul', 'Ben', 'Maximilian', 'Felix', 'Tim', 'Nico', 'Julian', 'Marvin', 'Kevin', 'Tobias', 'Lukas', 'Jannik', 'Marcel', 'Dennis', 'Fabian', 'Sebastian', 'Florian', 'Christian', 'Daniel', 'Philipp', 'Moritz', 'Niklas', 'Jan', 'Til', 'Sven', 'Malte', 'Hendrik', 'Robin', 'Justin', 'Pascal', 'Dominik', 'Mats', 'Thilo', 'Emre', 'Deniz', 'Kerem'],
      n: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Herrmann', 'Walter', 'König', 'Sauer', 'Vogel', 'Frank', 'Berger', 'Roth', 'Beck', 'Lorenz', 'Baumann', 'Franke', 'Albrecht', 'Winkler', 'Kraus', 'Stein', 'Jäger', 'Otto', 'Sommer', 'Haas', 'Engel', 'Böhm', 'Voigt']
    },
    Frankreich: {
      v: ['Lucas', 'Hugo', 'Théo', 'Enzo', 'Nathan', 'Mathis', 'Yanis', 'Kylian', 'Ousmane', 'Adrien', 'Clément', 'Antoine', 'Baptiste', 'Rayan', 'Ibrahim', 'Moussa', 'Amine', 'Jules', 'Léo', 'Maxime'],
      n: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Diarra', 'Camara', 'Traoré', 'Coulibaly', 'Diallo']
    },
    Spanien: {
      v: ['Álvaro', 'Sergio', 'Pablo', 'Javier', 'Marco', 'Iker', 'Hugo', 'Diego', 'Adrián', 'Rubén', 'Carlos', 'Mario', 'Aitor', 'Unai', 'Jorge', 'Nico', 'Gerard', 'Pau', 'Álex', 'Rodrigo'],
      n: ['García', 'Rodríguez', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Torres', 'Navarro', 'Ramos', 'Ortega', 'Castillo', 'Vidal', 'Serrano', 'Molina', 'Cabrera', 'Iglesias']
    },
    Italien: {
      v: ['Lorenzo', 'Matteo', 'Alessandro', 'Andrea', 'Marco', 'Davide', 'Federico', 'Simone', 'Giacomo', 'Riccardo', 'Nicolò', 'Gianluca', 'Stefano', 'Luca'],
      n: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Barbieri']
    },
    England: {
      v: ['Harry', 'Jack', 'Jude', 'Callum', 'Mason', 'Reece', 'Declan', 'Phil', 'Bukayo', 'Marcus', 'Kyle', 'Conor', 'Ollie', 'Levi', 'Jarrod', 'Cole', 'Ethan', 'Tyler'],
      n: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Green', 'Hall', 'Wood', 'Harris', 'Clarke', 'Bailey']
    },
    Niederlande: {
      v: ['Daan', 'Sem', 'Bram', 'Lars', 'Thijs', 'Jurriën', 'Cody', 'Ryan', 'Mats', 'Sven', 'Teun', 'Xavi', 'Quinten', 'Micky'],
      n: ['de Jong', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Vries', 'van den Berg', 'Jansen', 'Vermeer', 'Koster', 'Timber', 'van Hooijdonk']
    },
    Brasilien: {
      v: ['Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Thiago', 'Vinícius', 'Bruno', 'Douglas', 'Éder', 'Caio', 'Wesley', 'Danilo', 'Igor', 'Léo', 'Rodrygo'],
      n: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Barbosa', 'Rocha', 'Dias', 'Moreira']
    },
    Argentinien: {
      v: ['Lautaro', 'Nicolás', 'Julián', 'Franco', 'Emiliano', 'Facundo', 'Santiago', 'Agustín', 'Matías', 'Gonzalo', 'Valentín', 'Thiago'],
      n: ['González', 'Fernández', 'Rodríguez', 'Álvarez', 'Romero', 'Sosa', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Cardozo']
    },
    Portugal: {
      v: ['João', 'Rúben', 'Diogo', 'Gonçalo', 'Bruno', 'Tiago', 'Rafael', 'Francisco', 'Nuno', 'Pedro', 'André', 'Vitinha'],
      n: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fonseca', 'Nunes', 'Cardoso', 'Neves']
    },
    Kroatien: { v: ['Luka', 'Ivan', 'Marko', 'Josip', 'Mateo', 'Ante', 'Nikola', 'Domagoj'], n: ['Horvat', 'Kovačević', 'Marić', 'Babić', 'Petrović', 'Novak', 'Vuković', 'Perišić'] },
    Serbien: { v: ['Nemanja', 'Aleksandar', 'Stefan', 'Luka', 'Filip', 'Miloš', 'Dušan'], n: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić'] },
    Polen: { v: ['Jakub', 'Kacper', 'Szymon', 'Piotr', 'Bartosz', 'Michał', 'Krzysztof'], n: ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński'] },
    Türkei: { v: ['Emre', 'Kerem', 'Yusuf', 'Arda', 'Cenk', 'Ozan', 'Kaan', 'Baris'], n: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Öztürk', 'Aydın', 'Arslan'] },
    Österreich: { v: ['David', 'Marcel', 'Konrad', 'Xaver', 'Christoph', 'Stefan'], n: ['Gruber', 'Huber', 'Wimmer', 'Steiner', 'Moser', 'Leitner', 'Pichler'] },
    Schweiz: { v: ['Nico', 'Fabian', 'Silvan', 'Remo', 'Dan', 'Noah'], n: ['Zuber', 'Widmer', 'Frei', 'Steffen', 'Rieder', 'Amdouni'] },
    Dänemark: { v: ['Rasmus', 'Mikkel', 'Jonas', 'Anders', 'Victor', 'Mads'], n: ['Nielsen', 'Jensen', 'Hansen', 'Andersen', 'Pedersen', 'Larsen', 'Christensen'] },
    Norwegen: { v: ['Erling', 'Martin', 'Sander', 'Kristian', 'Ola', 'Jens'], n: ['Hansen', 'Johansen', 'Olsen', 'Berg', 'Haugen', 'Solberg'] },
    Schweden: { v: ['Alexander', 'Viktor', 'Emil', 'Oscar', 'Anton', 'Isak'], n: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson'] },
    Belgien: { v: ['Thibaut', 'Youri', 'Jérémy', 'Charles', 'Arthur', 'Loïs'], n: ['Peeters', 'Janssens', 'Maes', 'Willems', 'Claes', 'Wouters', 'De Smet'] },
    Ghana: { v: ['Kwadwo', 'Kofi', 'Daniel', 'Jordan', 'Ernest', 'Baba'], n: ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Amoah', 'Osei', 'Addo'] },
    Nigeria: { v: ['Victor', 'Samuel', 'Chidera', 'Emmanuel', 'Kelechi', 'Ademola'], n: ['Okafor', 'Adeyemi', 'Eze', 'Nwankwo', 'Obi', 'Bello', 'Chukwu'] },
    Senegal: { v: ['Ibrahima', 'Moussa', 'Cheikh', 'Pape', 'Idrissa', 'Habib'], n: ['Diop', 'Ndiaye', 'Gueye', 'Sarr', 'Fall', 'Ba', 'Cissé'] },
    Marokko: { v: ['Youssef', 'Achraf', 'Amine', 'Hakim', 'Nayef', 'Bilal'], n: ['El Amrani', 'Benali', 'Ouazzani', 'Rahimi', 'Bouhaddouz', 'Chakir'] },
    Japan: { v: ['Takumi', 'Daichi', 'Ritsu', 'Kaoru', 'Wataru', 'Ao'], n: ['Tanaka', 'Suzuki', 'Sato', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Ito'] },
    Südkorea: { v: ['Min-jae', 'Heung-min', 'Woo-yeong', 'Jae-sung', 'Kang-in'], n: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang'] },
    USA: { v: ['Christian', 'Weston', 'Gio', 'Tyler', 'Brenden', 'Malik'], n: ['Miller', 'Johnson', 'Davis', 'Wilson', 'Anderson', 'Moore', 'Reyna'] }
  };

  /* Nationenverteilung je nach Liga-Ebene: unten fast nur deutsche Spieler. */
  var VERTEILUNG = {
    1: [['Deutschland', 48], ['Frankreich', 6], ['Spanien', 4], ['Niederlande', 4], ['Brasilien', 5], ['Österreich', 4], ['Schweiz', 3], ['Kroatien', 3], ['Serbien', 3], ['Polen', 3], ['Türkei', 3], ['Dänemark', 3], ['Portugal', 3], ['Belgien', 2], ['Japan', 3], ['Südkorea', 2], ['Ghana', 2], ['Nigeria', 2], ['Senegal', 2], ['Marokko', 2], ['Norwegen', 2], ['Schweden', 2], ['England', 2], ['Italien', 2], ['Argentinien', 3], ['USA', 2]],
    2: [['Deutschland', 66], ['Österreich', 4], ['Türkei', 4], ['Polen', 3], ['Niederlande', 3], ['Schweiz', 3], ['Kroatien', 2], ['Serbien', 2], ['Dänemark', 2], ['Brasilien', 2], ['Ghana', 2], ['Nigeria', 2], ['Japan', 2], ['Frankreich', 2], ['Marokko', 1]],
    3: [['Deutschland', 80], ['Türkei', 4], ['Österreich', 3], ['Polen', 3], ['Kroatien', 2], ['Serbien', 2], ['Niederlande', 2], ['Ghana', 2], ['Nigeria', 1], ['Japan', 1]],
    4: [['Deutschland', 88], ['Türkei', 4], ['Polen', 2], ['Kroatien', 2], ['Serbien', 1], ['Niederlande', 1], ['Ghana', 1], ['Marokko', 1]]
  };

  /* Nationalitaeten fuer internationale Klubs nach Land des Vereins. */
  var LAND_ZU_NATION = {
    England: 'England', Spanien: 'Spanien', Italien: 'Italien', Frankreich: 'Frankreich',
    Niederlande: 'Niederlande', Belgien: 'Belgien', Portugal: 'Portugal', Schottland: 'England',
    Österreich: 'Österreich', Schweiz: 'Schweiz', Türkei: 'Türkei', Griechenland: 'Serbien',
    Serbien: 'Serbien', Kroatien: 'Kroatien', Tschechien: 'Polen', Polen: 'Polen',
    Dänemark: 'Dänemark', Brasilien: 'Brasilien', Argentinien: 'Argentinien',
    Mexiko: 'Spanien', USA: 'USA', 'Saudi-Arabien': 'Marokko'
  };

  function gewichtetePick(rng, tabelle) {
    var total = 0, i;
    for (i = 0; i < tabelle.length; i++) total += tabelle[i][1];
    var r = rng.next() * total;
    for (i = 0; i < tabelle.length; i++) {
      r -= tabelle[i][1];
      if (r <= 0) return tabelle[i][0];
    }
    return tabelle[0][0];
  }

  var Names = {
    nationFuerLiga: function (rng, stufe) {
      return gewichtetePick(rng, VERTEILUNG[stufe] || VERTEILUNG[4]);
    },
    nationFuerLand: function (rng, land) {
      /* 65 % Einheimische, sonst irgendeine andere Nation. */
      var heim = LAND_ZU_NATION[land] || 'Deutschland';
      if (rng.chance(0.65)) return heim;
      var alle = Object.keys(P);
      return rng.pick(alle);
    },
    name: function (rng, nation) {
      var pool = P[nation] || P.Deutschland;
      return { vorname: rng.pick(pool.v), nachname: rng.pick(pool.n) };
    },
    nationen: Object.keys(P)
  };

  g.Names = Names;
})(typeof window !== 'undefined' ? window : globalThis);
