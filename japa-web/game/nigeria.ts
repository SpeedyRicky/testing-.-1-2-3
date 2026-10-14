// Where the player lives in Nigeria. Scenes are written with placeholders ({city}, {market}, {bus}...)
// and filled from this table, so the story happens in the player's own state.
//
// Specific neighbourhoods and markets are only given where they are well known; elsewhere the
// wording is built from the state capital so nothing is invented.

export type Region = "SW" | "SE" | "SS" | "NC" | "NE" | "NW";
export type LocalTransport = "danfo" | "keke" | "bus";

export interface NigeriaPlace {
  code: string;
  state: string;
  capital: string;
  region: Region;
  /** The city the story is set in (usually the capital). */
  city?: string;
  area?: string;
  market?: string;
  /** Short sign text for the 2D market stall. */
  marketSign?: string;
  techHub?: string;
  transport?: LocalTransport;
  university: string;
}

export const STATES: NigeriaPlace[] = [
  { code: "AB", state: "Abia", capital: "Umuahia", region: "SE", city: "Aba", area: "Ogbor Hill", market: "Ariaria Market", marketSign: "ARIARIA", university: "Michael Okpara University of Agriculture, Umudike" },
  { code: "AD", state: "Adamawa", capital: "Yola", region: "NE", area: "Jimeta", market: "Jimeta Market", marketSign: "JIMETA MARKET", university: "Modibbo Adama University, Yola" },
  { code: "AK", state: "Akwa Ibom", capital: "Uyo", region: "SS", market: "Akpan Andem Market", marketSign: "AKPAN ANDEM", university: "University of Uyo" },
  { code: "AN", state: "Anambra", capital: "Awka", region: "SE", city: "Onitsha", area: "Fegge", market: "Onitsha Main Market", marketSign: "MAIN MARKET", university: "Nnamdi Azikiwe University, Awka" },
  { code: "BA", state: "Bauchi", capital: "Bauchi", region: "NE", university: "Abubakar Tafawa Balewa University, Bauchi" },
  { code: "BY", state: "Bayelsa", capital: "Yenagoa", region: "SS", university: "Federal University Otuoke" },
  { code: "BE", state: "Benue", capital: "Makurdi", region: "NC", market: "Wurukum Market", marketSign: "WURUKUM", university: "Federal University of Agriculture, Makurdi" },
  { code: "BO", state: "Borno", capital: "Maiduguri", region: "NE", market: "Monday Market", marketSign: "MONDAY MARKET", university: "University of Maiduguri" },
  { code: "CR", state: "Cross River", capital: "Calabar", region: "SS", area: "Marian", market: "Watt Market", marketSign: "WATT MARKET", university: "University of Calabar" },
  { code: "DE", state: "Delta", capital: "Asaba", region: "SS", university: "Federal University of Petroleum Resources, Effurun" },
  { code: "EB", state: "Ebonyi", capital: "Abakaliki", region: "SE", university: "Alex Ekwueme Federal University, Ndufu-Alike" },
  { code: "ED", state: "Edo", capital: "Benin City", region: "SS", area: "Ugbowo", market: "Oba Market", marketSign: "OBA MARKET", university: "University of Benin" },
  { code: "EK", state: "Ekiti", capital: "Ado-Ekiti", region: "SW", university: "Federal University Oye-Ekiti" },
  { code: "EN", state: "Enugu", capital: "Enugu", region: "SE", area: "Independence Layout", market: "Ogbete Main Market", marketSign: "OGBETE", university: "University of Nigeria, Nsukka" },
  { code: "FC", state: "FCT", capital: "Abuja", region: "NC", area: "Gwarinpa", market: "Wuse Market", marketSign: "WUSE MARKET", techHub: "Banex Plaza, Wuse 2", transport: "bus", university: "University of Abuja" },
  { code: "GO", state: "Gombe", capital: "Gombe", region: "NE", university: "Federal University Kashere" },
  { code: "IM", state: "Imo", capital: "Owerri", region: "SE", area: "New Owerri", market: "Eke Ukwu Owerri", marketSign: "EKE UKWU", university: "Federal University of Technology, Owerri" },
  { code: "JI", state: "Jigawa", capital: "Dutse", region: "NW", university: "Federal University Dutse" },
  { code: "KD", state: "Kaduna", capital: "Kaduna", region: "NW", area: "Barnawa", market: "Kaduna Central Market", marketSign: "CENTRAL MARKET", university: "Ahmadu Bello University, Zaria" },
  { code: "KN", state: "Kano", capital: "Kano", region: "NW", area: "Sabon Gari", market: "Kurmi Market", marketSign: "KURMI MARKET", techHub: "Beirut Road phone market", university: "Bayero University Kano" },
  { code: "KT", state: "Katsina", capital: "Katsina", region: "NW", university: "Federal University Dutsin-Ma" },
  { code: "KE", state: "Kebbi", capital: "Birnin Kebbi", region: "NW", university: "Federal University Birnin Kebbi" },
  { code: "KO", state: "Kogi", capital: "Lokoja", region: "NC", university: "Federal University Lokoja" },
  { code: "KW", state: "Kwara", capital: "Ilorin", region: "NC", area: "Tanke", market: "Oja Oba", marketSign: "OJA OBA", university: "University of Ilorin" },
  { code: "LA", state: "Lagos", capital: "Ikeja", region: "SW", city: "Lagos", area: "Yaba", market: "Yaba Market", marketSign: "YABA MARKET", techHub: "Computer Village, Ikeja", transport: "danfo", university: "University of Lagos" },
  { code: "NA", state: "Nasarawa", capital: "Lafia", region: "NC", university: "Federal University of Lafia" },
  { code: "NI", state: "Niger", capital: "Minna", region: "NC", university: "Federal University of Technology, Minna" },
  { code: "OG", state: "Ogun", capital: "Abeokuta", region: "SW", area: "Kuto", university: "Federal University of Agriculture, Abeokuta" },
  { code: "ON", state: "Ondo", capital: "Akure", region: "SW", area: "Alagbaka", university: "Federal University of Technology, Akure" },
  { code: "OS", state: "Osun", capital: "Osogbo", region: "SW", university: "Obafemi Awolowo University, Ile-Ife" },
  { code: "OY", state: "Oyo", capital: "Ibadan", region: "SW", area: "Bodija", market: "Bodija Market", marketSign: "BODIJA MARKET", university: "University of Ibadan" },
  { code: "PL", state: "Plateau", capital: "Jos", region: "NC", area: "Rayfield", market: "Terminus Market", marketSign: "TERMINUS", university: "University of Jos" },
  { code: "RI", state: "Rivers", capital: "Port Harcourt", region: "SS", area: "Rumuokoro", market: "Mile One Market", marketSign: "MILE ONE", university: "University of Port Harcourt" },
  { code: "SO", state: "Sokoto", capital: "Sokoto", region: "NW", university: "Usmanu Danfodiyo University, Sokoto" },
  { code: "TA", state: "Taraba", capital: "Jalingo", region: "NE", university: "Federal University Wukari" },
  { code: "YO", state: "Yobe", capital: "Damaturu", region: "NE", university: "Federal University Gashua" },
  { code: "ZA", state: "Zamfara", capital: "Gusau", region: "NW", university: "Federal University Gusau" },
];

export function placeFor(code: string): NigeriaPlace {
  return STATES.find((s) => s.code === code) ?? STATES.find((s) => s.code === "LA")!;
}

/** Canada's visa application centres in Nigeria are in Lagos and Abuja. */
export function vacCityFor(p: NigeriaPlace): "Lagos" | "Abuja" {
  return p.region === "SW" || p.region === "SS" ? "Lagos" : "Abuja";
}

const BUS_WORD: Record<LocalTransport, string> = { danfo: "danfo", keke: "keke", bus: "bus" };

/** Every placeholder a scene can use, filled for one place. */
export function placeVars(p: NigeriaPlace): Record<string, string> {
  const city = p.city ?? p.capital;
  const transport = p.transport ?? "keke";
  const vac = vacCityFor(p);
  const bus = BUS_WORD[transport];
  return {
    state: p.state,
    city,
    area: p.area ?? city,
    market: p.market ?? `${city} main market`,
    marketSign: p.marketSign ?? "MAIN MARKET",
    techHub: p.techHub ?? `the phone and laptop market in ${city}`,
    gigArea: p.code === "LA" ? "Surulere" : `the other side of ${city}`,
    bus,
    Bus: bus.charAt(0).toUpperCase() + bus.slice(1),
    vacCity: vac,
    airport: vac === "Lagos" ? "Murtala Muhammed International Airport, Lagos" : "Nnamdi Azikiwe International Airport, Abuja",
    airportCode: vac === "Lagos" ? "MMIA" : "NAIA",
    university: p.university,
    // Getting to the visa centre is a trip of its own unless you already live there.
    vacTrip: city === vac ? `across ${vac}` : `the overnight bus to ${vac}`,
  };
}

export function transportFor(p: NigeriaPlace): LocalTransport {
  return p.transport ?? "keke";
}

/** Naira per Canadian dollar used for the "≈ ₦" equivalents in the game (illustrative; the real rate moves daily). */
export const NGN_PER_CAD = 1150;

/** Canadian prices that make the exchange rate hurt. */
export const PRICE_SHOCKS: { item: string; cad: number }[] = [
  { item: "A Tim Hortons combo", cad: 12 },
  { item: "A monthly transit pass", cad: 156 },
  { item: "A basement room, one month", cad: 950 },
  { item: "A proper winter parka", cad: 350 },
];

/** "₦4.6M", "₦13,800": short naira for UI chips. */
export function shortNaira(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `₦${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
