export const DISTRICT_NAME_PARTS = {
  prefix: ['Nord', 'Süd', 'Ost', 'West', 'Alt', 'Neu', 'Ober', 'Unter', 'Klein', 'Groß'],
  stem: [
    'stadt', 'feld', 'hausen', 'berg', 'bach', 'brück', 'hafen', 'werk', 'garten',
    'heim', 'au', 'thal', 'ried', 'furt', 'anger',
  ],
} as const;

export const STANDALONE_DISTRICTS = [
  'Lindenviertel', 'Rosenquartier', 'Hafenviertel', 'Bahnhofsviertel', 'Kupfergrund',
  'Eichenhain', 'Sonnenhang', 'Mühlenbruch', 'Silberkamp', 'Birkenfeld',
  'Ahornhöhe', 'Weidental', 'Steinbruch', 'Erlengrund', 'Falkenhorst',
] as const;

export const STREETS = [
  'Hauptstraße', 'Bahnhofstraße', 'Lindenallee', 'Rosenweg', 'Am Markt', 'Mühlenweg',
  'Schulstraße', 'Kirchgasse', 'Industriering', 'Parkstraße', 'Uferweg', 'Bergstraße',
  'Talstraße', 'Eichenweg', 'Birkenallee', 'Gartenstraße', 'Feldweg', 'Ahornstraße',
  'Sonnenplatz', 'Weberstraße', 'Schmiedegasse', 'Kupferweg', 'Silberstraße', 'Fasanenweg',
] as const;

export const COMPANY_STEMS = [
  'Weber', 'Schmidt', 'Berger', 'Nowak', 'Lindner', 'Falk', 'Hartmann', 'Vogel',
  'Kaiser', 'Brandt', 'Reuter', 'Sommer', 'Winter', 'Stein', 'Adler', 'Wolff',
  'Krämer', 'Ziegler', 'Fuchs', 'Kranz', 'Mertens', 'Heller', 'Baumann', 'Ritter',
] as const;

export const COMPANY_SUFFIX_BY_KIND: Record<string, readonly string[]> = {
  office: ['Consulting', 'Systems', 'Digital', 'Solutions', 'Partners', 'Media', 'Analytics', 'Group'],
  factory: ['Werke', 'Industrie', 'Produktion', 'Technik', 'Maschinenbau', 'Metall'],
  workshop: ['Werkstatt', 'Kfz-Service', 'Handwerk', 'Reparatur', 'Montage'],
  shop: ['Boutique', 'Laden', 'Handel', 'Store', 'Warenhaus'],
  supermarket: ['Markt', 'Frischemarkt', 'Supermarkt', 'Lebensmittel'],
  restaurant: ['Trattoria', 'Gasthaus', 'Bistro', 'Küche', 'Speisehaus'],
  bar: ['Bar', 'Taverne', 'Lounge', 'Schankraum', 'Kneipe'],
  cafe: ['Café', 'Kaffeehaus', 'Rösterei', 'Backstube'],
  gym: ['Fitness', 'Gym', 'Sportclub', 'Athletik'],
  bank: ['Bank', 'Sparkasse', 'Finanz', 'Kreditinstitut'],
  mall: ['Galerie', 'Passage', 'Center', 'Arkaden'],
  hospital: ['Klinik', 'Krankenhaus', 'Medizinzentrum'],
  school: ['Schule', 'Gesamtschule', 'Gymnasium'],
  university: ['Universität', 'Hochschule', 'Akademie'],
  library: ['Bibliothek', 'Stadtbücherei'],
  sports: ['Sportzentrum', 'Arena', 'Sportpark'],
  police: ['Polizeiwache'],
  fire: ['Feuerwache'],
  station: ['Bahnhof'],
  townhall: ['Rathaus'],
  park: ['Park', 'Grünanlage', 'Stadtgarten'],
  cemetery: ['Friedhof'],
  house: ['Haus'],
  apartment: ['Wohnhaus'],
};

export const LEGAL_FORMS = ['GmbH', 'AG', 'KG', '& Söhne', 'e.K.', 'GmbH & Co. KG'] as const;

export const CITY_NAMES = [
  'Neuwalden', 'Grünstadt', 'Hafenbruck', 'Stahlberg', 'Lindenfurt', 'Mooshaven',
  'Silberbach', 'Eichenstadt', 'Rosental', 'Kupferfeld',
] as const;
