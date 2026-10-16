// The in-game "Gist" feed: an X/Nairaland-style timeline of japa news, tips, myths and scams. Myths and scams carry a
// Community note with the real rule, so the feed teaches players to spot bad advice. Pure data + selection.
import type { RouteId } from "./types";

export type GistKind = "news" | "tip" | "myth" | "scam";
export interface GistPost { id: string; handle: string; name: string; kind: GistKind; text: string; note?: string; routes?: RouteId[] }

export const GIST: GistPost[] = [
  { id: "hc-draw", handle: "japatoday", name: "Japa Today", kind: "news", routes: ["EXPRESS_ENTRY", "NIGERIA_LIFE"],
    text: "IRCC just held a healthcare category draw. Cutoff in the 470s. Nurses, check your profile! 🩺" },
  { id: "marry", handle: "bigboy_lekki", name: "Lekki Big Boy", kind: "myth",
    text: "If you marry a Canadian you get PR in two weeks. Na so my guy do am.",
    note: "Spousal sponsorship takes many months, and IRCC checks the relationship is genuine. A marriage of convenience is misrepresentation." },
  { id: "lmia-dm", handle: "canada_jobs_247", name: "Canada Jobs 24/7 ✅", kind: "scam", routes: ["TOURIST_GAMBLE", "CAREGIVER_LMIA", "NIGERIA_LIFE"],
    text: "DM for approved LMIA, Calgary warehouse. $25k only. 100% guaranteed. Limited slots!!",
    note: "Workers never pay for an LMIA; the employer applies and pays. Paid 'LMIA jobs' are a known scam pattern." },
  { id: "lookalike", handle: "travel_connect_ng", name: "Travel Connect NG ✈️", kind: "scam", routes: ["NIGERIA_LIFE", "TOURIST_GAMBLE"],
    text: "Lookalike passports available, Canada visa ALREADY INSIDE. Your face resemble am, you go. No queue, no biometrics. DM 📩",
    note: "Travelling on someone else's passport is impostor fraud, and many 'lookalike' passports are stolen from real people. Canada takes fingerprints with most visas and can check them on arrival. If your own passport is stolen, report it to the police and the Nigeria Immigration Service at once." },
  { id: "celpip-myth", handle: "exam_guru_ng", name: "Exam Guru NG", kind: "myth", routes: ["EXPRESS_ENTRY", "ATLANTIC_AIP", "TARGETED_TRADE"],
    text: "Don't write CELPIP o. IELTS 8 gives more CRS points. CELPIP is for people who can't pass IELTS.",
    note: "Not true. Express Entry converts every approved test to CLB levels, and the same CLB earns the same points. CELPIP 9 is CLB 9, the same as IELTS L8, R7, W7, S7. For AIP, PNP and Trades you only need the minimum CLB, so write whichever test suits you." },
  { id: "wes-ref", handle: "wes_survivor", name: "WES Survivor", kind: "tip", routes: ["EXPRESS_ENTRY", "ATLANTIC_AIP", "NIGERIA_LIFE"],
    text: "WES tip: submit your application first to get the reference number, THEN go to your school. The registry can't send anything without it. When WES emails your school to verify, chase the registry the same week." },
  { id: "aip-job", handle: "atlantic_jobs_ng", name: "Atlantic Jobs NG 🌊", kind: "scam", routes: ["ATLANTIC_AIP"],
    text: "AIP job offers available! Halifax, St. John's, Moncton. Pay CAD 3,000 processing + employer fee. DM now!",
    note: "AIP offers come from employers each province has designated, listed on the province's own website. Workers never pay for a job offer or the employer compliance fee." },
  { id: "invite", handle: "aunty_in_calgary", name: "Aunty in Calgary", kind: "tip", routes: ["TOURIST_GAMBLE", "PNP_RURAL", "ATLANTIC_AIP"],
    text: "Invitation letter season! Remember: if you're coming to meet an employer, say so on the visa application. Visitors can attend interviews; they just can't work. Many employers will meet you on video first." },
  { id: "nclex-kenya", handle: "nurse_amaka", name: "Nurse Amaka RN", kind: "tip", routes: ["EXPRESS_ENTRY"],
    text: "NCLEX update: no centre in Nigeria, so it's Nairobi or Johannesburg. Most of us chose Nairobi because Kenya entry is simpler than a South African visa. Wait for your college's authorisation before you book anything!" },
  { id: "police-cert", handle: "ada_in_ottawa", name: "Ada in Ottawa", kind: "tip", routes: ["EXPRESS_ENTRY"],
    text: "Apply for your police character certificate EARLY. The portal goes down for weeks. Don't wait for your ITA." },
  { id: "pof", handle: "fin_sis", name: "Finance Sis", kind: "tip", routes: ["STUDY_PERMIT", "EXPRESS_ENTRY"],
    text: "Proof of funds: six months of statements, no unexplained lump sums. If family helped, gift deed + their statements." },
  { id: "cash-work", handle: "naija_in_brampton", name: "Naija in Brampton", kind: "myth", routes: ["TOURIST_GAMBLE"],
    text: "You fit work cash on visitor visa, nobody go check. I did 3 months.",
    note: "Working without authorization can lead to a removal order and makes future visas harder. One inspection is enough." },
  { id: "fuel", handle: "lagos_gist", name: "Lagos Gist", kind: "news", routes: ["NIGERIA_LIFE", "SPLIT_FAMILY", "TARGETED_TRADE"],
    text: "Fuel price up AGAIN. Generator owners, we are in this together. 😩" },
  { id: "ppr", handle: "chioma_rn", name: "Chioma RN", kind: "tip", routes: ["STUDY_PERMIT", "NIGERIA_LIFE"],
    text: "PPR DON LAND!!! 74 days after biometrics. They only asked for my passport after approval. Don't lose hope 🙏🏾" },
  { id: "winnipeg", handle: "prairie_naija", name: "Prairie Naija", kind: "tip", routes: ["PNP_RURAL", "FIRST_YEAR"],
    text: "My 2-bedroom in Winnipeg costs less than my cousin's basement in Brampton. Just saying. 🌾" },
  { id: "credit", handle: "credit_uncle", name: "Uncle Credit", kind: "tip", routes: ["FIRST_YEAR", "SPLIT_FAMILY"],
    text: "Week one in Canada: get a newcomer or secured credit card. Small spend, pay in FULL every month. Credit history = housing." },
  { id: "811", handle: "dr_tolu_ca", name: "Dr Tolu", kind: "tip", routes: ["FIRST_YEAR"],
    text: "No family doctor yet? Walk-in clinics exist, and 811 is free health advice in many provinces. Use them, don't suffer in silence." },
  { id: "kw-story", handle: "wey_sabi_official", name: "Wey Sabi 🇨🇦", kind: "myth", routes: ["TOURIST_GAMBLE"],
    text: "Kawosoke is easy. Just pick a story at the airport. LGBTQ, village people, anything. Cry small.",
    note: "Fabricated asylum claims are misrepresentation and get refused. Real claims are about real persecution, and need evidence." },
  { id: "tax", handle: "taxclinic_to", name: "Free Tax Clinic", kind: "tip", routes: ["FIRST_YEAR"],
    text: "Newcomers on low income: free volunteer tax clinics run every spring. Don't pay the group-chat 'tax guy' 20% of a fake refund." },
  { id: "pnp-pause", handle: "pnp_watch", name: "PNP Watch", kind: "news", routes: ["PNP_RURAL"],
    text: "Some provincial streams paused intake for 'program review'. Read the province's own page, not WhatsApp screenshots." },
  { id: "trades-assess", handle: "sparky_eddy", name: "Sparky from Ibadan", kind: "tip", routes: ["TARGETED_TRADE"],
    text: "Electricians: provinces run trade assessments and exams. Start collecting experience letters on letterhead NOW, with dates and hours." },
  { id: "red-seal", handle: "certificates_ng", name: "Certificates NG", kind: "scam", routes: ["TARGETED_TRADE"],
    text: "Red Seal certificate available. No exam. Delivery in 7 days. ₦900k.",
    note: "Red Seal is an exam you pass in Canada after qualifying in a province. Nobody can sell you one." },
  { id: "24h", handle: "intl_student_ca", name: "Intl Student CA", kind: "tip", routes: ["STUDY_PERMIT", "SPLIT_FAMILY"],
    text: "Study permit: up to 24 hours a week off-campus during classes, full-time in scheduled breaks. NOT 40. Don't risk your permit." },
  { id: "gre", handle: "phd_or_bust", name: "PhD or Bust", kind: "tip", routes: ["STUDY_PERMIT"],
    text: "Most Canadian master's don't need the GRE. Email professors whose papers you've actually read. Three lines, one question." },
  { id: "sowp", handle: "two_homes_one_heart", name: "Two Homes", kind: "news", routes: ["SPLIT_FAMILY"],
    text: "Spousal open work permit processing times jumped again this month. Couples, hold on. 💔" },
  { id: "calls", handle: "mrs_okafor_mb", name: "Mrs Okafor", kind: "tip", routes: ["SPLIT_FAMILY"],
    text: "Fix ONE call time every day with your spouse. Time zones kill marriages faster than money." },
  { id: "age", handle: "crs_coach", name: "CRS Coach", kind: "tip", routes: ["EXPRESS_ENTRY"],
    text: "Turn 30 and you lose CRS age points every birthday. If you're 28, stop overthinking and book the test." },
  { id: "pte", handle: "pte_naija", name: "PTE Naija", kind: "tip", routes: ["EXPRESS_ENTRY", "NIGERIA_LIFE"],
    text: "PTE Core results in ~2 days. IELTS General works too. IELTS Academic does NOT count for Express Entry." },
  { id: "council", handle: "fast_verify_ng", name: "FastVerify", kind: "scam", routes: ["EXPRESS_ENTRY"],
    text: "Nurses! Pay ₦300k, we fast-track your council verification in 2 weeks. Guaranteed.",
    note: "Verification goes from the nursing council to the Canadian assessor. Nobody sells a shortcut; touts sell receipts." },
  { id: "tourist-convert", handle: "japa_hacks", name: "Japa Hacks 🔥", kind: "myth", routes: ["TOURIST_GAMBLE", "NIGERIA_LIFE"],
    text: "Come as tourist, find job, convert to work permit inside Canada. Easy!",
    note: "Since 28 August 2024 visitors generally can't apply for a work permit from inside Canada. A job offer means applying properly." },
  { id: "suv", handle: "founder_fola", name: "Founder Fola", kind: "news", routes: ["STARTUP_VISA"],
    text: "Start-up Visa is paused for new applications. If anyone offers you a 'Letter of Support' for a fee, run." },
  { id: "blacktax", handle: "money_mama", name: "Money Mama", kind: "tip", routes: ["FIRST_YEAR", "SPLIT_FAMILY"],
    text: "Black tax budget: decide a fixed % BEFORE you land. Send it every month. Explain the plan once. Your sanity will thank you." },
  { id: "agent", handle: "alhaji_travels", name: "Alhaji Travel Consultant", kind: "scam", routes: ["NIGERIA_LIFE", "CAREGIVER_LMIA"],
    text: "Canada caregiver visa in 4 weeks! No IELTS, no experience. ₦4.5M. Office in Ikeja. Slots filling fast!!!",
    note: "Canada's home care worker pilots require a language test and aren't taking new applications. Paid representatives must be CICC-licensed." },
];

const KIND_ORDER: GistKind[] = ["news", "scam", "tip", "myth"];

/** Today's feed for a route: its own posts first, rotated by day so the feed changes daily, topped up with general ones. */
export function gistFor(route: RouteId, day: number, count = 6): GistPost[] {
  const own = GIST.filter((p) => p.routes?.includes(route));
  const general = GIST.filter((p) => !p.routes);
  const rest = GIST.filter((p) => p.routes && !p.routes.includes(route));
  const rotate = <T,>(xs: T[]) => (xs.length ? xs.map((_, i) => xs[(i + day) % xs.length]) : xs);
  const picked = [...rotate(own).slice(0, count - 2), ...rotate(general).slice(0, 1), ...rotate(rest)];
  const seen = new Set<string>();
  return picked.filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, count)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
