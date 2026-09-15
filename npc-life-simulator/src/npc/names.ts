export const MALE_NAMES = [
  'Max', 'Lukas', 'Jonas', 'Leon', 'Felix', 'Paul', 'Elias', 'Noah', 'Ben', 'Tim',
  'Julian', 'Moritz', 'Philipp', 'Jan', 'Tobias', 'Simon', 'David', 'Niklas', 'Fabian', 'Marvin',
  'Alexander', 'Christian', 'Daniel', 'Michael', 'Stefan', 'Thomas', 'Andreas', 'Markus', 'Sebastian', 'Florian',
  'Matthias', 'Oliver', 'Patrick', 'Martin', 'Peter', 'Klaus', 'Wolfgang', 'Jürgen', 'Dieter', 'Helmut',
  'Hans', 'Werner', 'Günter', 'Bernd', 'Rolf', 'Uwe', 'Frank', 'Ralf', 'Carsten', 'Holger',
  'Mert', 'Emre', 'Dario', 'Luca', 'Marco', 'Nico', 'Robin', 'Kilian', 'Jannik', 'Til',
] as const;

export const FEMALE_NAMES = [
  'Lisa', 'Anna', 'Sarah', 'Laura', 'Julia', 'Lena', 'Marie', 'Sophie', 'Emma', 'Mia',
  'Hannah', 'Leonie', 'Johanna', 'Clara', 'Nele', 'Amelie', 'Paula', 'Ida', 'Frieda', 'Charlotte',
  'Nicole', 'Sandra', 'Melanie', 'Stefanie', 'Katrin', 'Christina', 'Andrea', 'Claudia', 'Susanne', 'Petra',
  'Monika', 'Brigitte', 'Ursula', 'Renate', 'Helga', 'Ingrid', 'Gisela', 'Karin', 'Elisabeth', 'Gabriele',
  'Jana', 'Tanja', 'Vanessa', 'Jessica', 'Michelle', 'Celine', 'Aylin', 'Elif', 'Marta', 'Nora',
  'Greta', 'Luisa', 'Alina', 'Pia', 'Mara', 'Svenja', 'Theresa', 'Vera', 'Jolina', 'Romy',
] as const;

export const LAST_NAMES = [
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
  'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann',
  'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Schmitz', 'Krause', 'Meier',
  'Lehmann', 'Schmid', 'Schulze', 'Maier', 'Köhler', 'Herrmann', 'König', 'Walter', 'Mayer', 'Huber',
  'Kaiser', 'Fuchs', 'Peters', 'Lang', 'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Schubert',
  'Vogel', 'Friedrich', 'Keller', 'Günther', 'Frank', 'Berger', 'Winkler', 'Roth', 'Beck', 'Lorenz',
  'Baumann', 'Franke', 'Albrecht', 'Schuster', 'Simon', 'Ludwig', 'Böhm', 'Winter', 'Kraus', 'Martin',
  'Nowak', 'Kowalski', 'Yilmaz', 'Demir', 'Kaya', 'Petrov', 'Novak', 'Horvath', 'Rossi', 'Silva',
] as const;

export const HOBBIES = [
  'Fußball', 'Lesen', 'Kochen', 'Gaming', 'Wandern', 'Fotografie', 'Musik', 'Malen',
  'Joggen', 'Gartenarbeit', 'Angeln', 'Schach', 'Tanzen', 'Radfahren', 'Filme', 'Reisen',
  'Klettern', 'Schwimmen', 'Yoga', 'Basteln', 'Programmieren', 'Brettspiele', 'Backen', 'Motorrad',
] as const;

/** Hobby -> the skill it slowly trains. */
export const HOBBY_SKILL: Record<string, string> = {
  'Fußball': 'fitness',
  'Lesen': 'teaching',
  'Kochen': 'cooking',
  'Gaming': 'tech',
  'Wandern': 'fitness',
  'Fotografie': 'art',
  'Musik': 'art',
  'Malen': 'art',
  'Joggen': 'fitness',
  'Gartenarbeit': 'craft',
  'Angeln': 'craft',
  'Schach': 'business',
  'Tanzen': 'social',
  'Radfahren': 'fitness',
  'Filme': 'art',
  'Reisen': 'social',
  'Klettern': 'fitness',
  'Schwimmen': 'fitness',
  'Yoga': 'fitness',
  'Basteln': 'craft',
  'Programmieren': 'tech',
  'Brettspiele': 'social',
  'Backen': 'cooking',
  'Motorrad': 'driving',
};
