// Which cities get a map, where they are, and which hotspots each one shows. Data only (no imports), so the map
// build script can read it with Node's type stripping. Coordinates are city centres; the box is drawn around them.

export type SpotId =
  | "home" | "market" | "passport" | "vac" | "church" | "mosque" | "buspark" | "airport" | "cafe" | "agent" | "office"
  | "testcentre" | "bank" | "university" | "servicecanada" | "coffee" | "work" | "settlement" | "downtown" | "legal"
  | "tribunal" | "shelter";

export interface CityDef {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Half the box, in km. */
  halfW: number;
  halfH: number;
  country: "NG" | "CA";
}

const ng = (code: string, name: string, lat: number, lon: number, half = 6): CityDef =>
  ({ id: `ng-${code}`, name, lat, lon, halfW: half, halfH: half * 0.8, country: "NG" });
const ca = (id: string, name: string, lat: number, lon: number, halfW: number, halfH: number): CityDef =>
  ({ id: `ca-${id}`, name, lat, lon, halfW, halfH, country: "CA" });

/** One map per state: the city the story is set in (see game/nigeria.ts). */
export const NIGERIA_CITIES: CityDef[] = [
  ng("AB", "Aba", 5.1066, 7.3667), ng("AD", "Jimeta-Yola", 9.2795, 12.4583), ng("AK", "Uyo", 5.0377, 7.9128),
  ng("AN", "Onitsha", 6.1529, 6.7856), ng("BA", "Bauchi", 10.3158, 9.8442), ng("BY", "Yenagoa", 4.9267, 6.2676),
  ng("BE", "Makurdi", 7.7322, 8.5391), ng("BO", "Maiduguri", 11.8333, 13.15), ng("CR", "Calabar", 4.9757, 8.3417),
  ng("DE", "Asaba", 6.198, 6.7319), ng("EB", "Abakaliki", 6.3249, 8.1137), ng("ED", "Benin City", 6.335, 5.6037, 7),
  ng("EK", "Ado-Ekiti", 7.6211, 5.2214), ng("EN", "Enugu", 6.4584, 7.5464), ng("FC", "Abuja", 9.0579, 7.4951, 9),
  ng("GO", "Gombe", 10.2897, 11.1673), ng("IM", "Owerri", 5.4836, 7.0333), ng("JI", "Dutse", 11.7562, 9.3389),
  ng("KD", "Kaduna", 10.5105, 7.4165, 7), ng("KN", "Kano", 12.0022, 8.592, 7), ng("KT", "Katsina", 12.9908, 7.6018),
  ng("KE", "Birnin Kebbi", 12.4539, 4.1975), ng("KO", "Lokoja", 7.8023, 6.7333), ng("KW", "Ilorin", 8.4966, 4.5421),
  ng("LA", "Lagos", 6.53, 3.37, 10), ng("NA", "Lafia", 8.4939, 8.5153), ng("NI", "Minna", 9.6139, 6.5569),
  ng("OG", "Abeokuta", 7.1475, 3.3619), ng("ON", "Akure", 7.2571, 5.2058), ng("OS", "Osogbo", 7.7827, 4.5418),
  ng("OY", "Ibadan", 7.3775, 3.947, 8), ng("PL", "Jos", 9.8965, 8.8583), ng("RI", "Port Harcourt", 4.8156, 7.0498, 8),
  ng("SO", "Sokoto", 13.0059, 5.2476), ng("TA", "Jalingo", 8.8833, 11.3667), ng("YO", "Damaturu", 11.747, 11.9608),
  ng("ZA", "Gusau", 12.1704, 6.6641),
];

export const CANADA_CITIES: CityDef[] = [
  ca("gta", "Toronto & Brampton", 43.69, -79.58, 18, 9),
  ca("halifax", "Halifax", 44.6488, -63.5752, 8, 6),
  ca("stjohns", "St. John's", 47.5615, -52.7126, 7, 5.5),
  ca("moncton", "Moncton", 46.0878, -64.7782, 7, 5.5),
  ca("charlottetown", "Charlottetown", 46.2382, -63.1311, 6, 4.8),
  ca("winnipeg", "Winnipeg", 49.8951, -97.1384, 10, 8),
  ca("saskatoon", "Saskatoon", 52.1332, -106.67, 8, 6.4),
  ca("edmonton", "Edmonton", 53.5461, -113.4938, 10, 8),
];

export const CITIES: CityDef[] = [...NIGERIA_CITIES, ...CANADA_CITIES];

export const NIGERIA_SPOTS: SpotId[] = ["home", "market", "passport", "vac", "church", "mosque", "buspark", "airport", "cafe",
  "agent", "office", "testcentre", "bank", "university"];
export const CANADA_SPOTS: SpotId[] = ["home", "airport", "servicecanada", "bank", "coffee", "work", "church", "mosque",
  "settlement", "downtown", "university", "legal", "tribunal", "shelter"];

/** Made-up names for places the story invents (the agent's office, your room). Real public places keep real names. */
export const FICTIONAL: Partial<Record<SpotId, string>> = {
  home: "Your place", cafe: "Bright Star Cyber Café", agent: "Glory Gate Travels (fictional)", office: "Your office",
  testcentre: "Test centre", work: "Your workplace", settlement: "Newcomer centre", legal: "Community legal clinic",
  shelter: "Newcomer shelter", downtown: "Downtown", coffee: "Coffee shop",
};

/** Where the Canada visa application centres and the two international airports are, for off-map arrows. */
export const FAR_PLACES = {
  vacLagos: { lat: 6.43, lon: 3.42, label: "Visa centre, Lagos" },
  vacAbuja: { lat: 9.06, lon: 7.49, label: "Visa centre, Abuja" },
  airportLagos: { lat: 6.5774, lon: 3.3212, label: "Murtala Muhammed Airport, Lagos" },
  airportAbuja: { lat: 9.0068, lon: 7.2632, label: "Nnamdi Azikiwe Airport, Abuja" },
};

/** Map file for a Nigerian state code. */
export const cityForState = (code: string) => `ng-${code}`;
