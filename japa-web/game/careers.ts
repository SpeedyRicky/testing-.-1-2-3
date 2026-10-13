// The player's line of work, as words for scenes: a nurse hunts on a ward, an electrician wires a duplex,
// a developer debugs a POS network. Pure, so every track is unit-tested.

export type Track = "default" | "tech" | "health" | "teach" | "eng" | "trades" | "business";

const BY_OCCUPATION: Record<string, Track> = {
  software: "tech", data: "tech", nurse: "health", doctor: "health", pharmacist: "health", teacher: "teach",
  engineer: "eng", electrician: "trades", accountant: "business", banker: "business", logistics: "business",
  marketing: "business", "civil-servant": "business", entrepreneur: "business", other: "business",
};

const BY_COURSE: Record<string, Track> = {
  "Computer Science": "tech", "Software Engineering": "tech", Nursing: "health", "Medicine & Surgery": "health",
  Pharmacy: "health", Microbiology: "health", Biochemistry: "health", Education: "teach",
  "Mechanical Engineering": "eng", "Electrical Engineering": "eng", "Civil Engineering": "eng",
  "Chemical Engineering": "eng", Architecture: "eng",
};

export function trackFor(role: "student" | "worker" | undefined, occupation?: string, course?: string): Track {
  if (role === "worker" && occupation) return BY_OCCUPATION[occupation] ?? "business";
  if (role === "student" && course) return BY_COURSE[course] ?? "business";
  return "default";
}

type Words = Record<
  "jobPlace" | "jobHunt" | "jobListing" | "interviewStory" | "interviewHook" | "offerCatch" | "gigWork" |
  "mastersProgram" | "diplomaProgram" | "canadaJob",
  string
>;

const WORDS: Record<Track, Words> = {
  default: {
    jobPlace: "{techHub}", jobHunt: "remote jobs",
    jobListing: "A Toronto listing wants three years of React and right to work in Canada. You have a bootcamp PDF, stubborn data",
    interviewStory: "a race condition you actually fixed", interviewHook: "the race-condition story",
    offerCatch: "If we offer, we'd start the LMIA. That takes months.",
    gigWork: "You fix a POS network, then two Bolt trips in the rain",
    mastersProgram: "Master's in Engineering Management", diplomaProgram: "Two-year Supply Chain diploma", canadaJob: "in supply chain",
  },
  tech: {
    jobPlace: "{techHub}", jobHunt: "remote jobs",
    jobListing: "A Toronto listing wants three years of React and right to work in Canada. You have a GitHub, stubborn data",
    interviewStory: "a race condition you actually fixed", interviewHook: "the race-condition story",
    offerCatch: "If we offer, we'd start the LMIA. That takes months.",
    gigWork: "You fix a POS network, then two Bolt trips in the rain",
    mastersProgram: "Master's in Computer Science", diplomaProgram: "Two-year Computer Programming diploma", canadaJob: "as a junior developer",
  },
  health: {
    jobPlace: "the hospital staff room", jobHunt: "Canadian nursing jobs",
    jobListing: "A Toronto hospital wants 'RNs, Ontario registration required'. You have a Nigerian licence, night-shift eyes",
    interviewStory: "the night you ran a ward of thirty with one other nurse", interviewHook: "the thirty-patient night",
    offerCatch: "We'd love you, but you'd need your provincial nursing registration first, then a work permit. That takes months.",
    gigWork: "You do a private home-care shift for an old Oga in {gigArea}",
    mastersProgram: "Master of Public Health", diplomaProgram: "Two-year Practical Nursing diploma",
    canadaJob: "as a personal support worker while the nursing college processes your licence",
  },
  teach: {
    jobPlace: "the staff room after school", jobHunt: "teaching jobs abroad",
    jobListing: "An Ontario school board wants an Ontario College of Teachers certificate. You have twelve years of chalk dust",
    interviewStory: "the class of sixty you kept learning through a strike", interviewHook: "the class of sixty",
    offerCatch: "If we offer, you'd still need Ontario teacher certification before you're in a classroom. That takes months.",
    gigWork: "You run lesson classes for three SS3 students in {gigArea}",
    mastersProgram: "Master of Education", diplomaProgram: "Two-year Early Childhood Education diploma",
    canadaJob: "as an early childhood educator",
  },
  eng: {
    jobPlace: "the site office", jobHunt: "engineering jobs abroad",
    jobListing: "A Calgary firm wants an engineer-in-training on the provincial register. You have COREN, site boots",
    interviewStory: "the design error you caught on a bridge deck before the pour", interviewHook: "the bridge-deck story",
    offerCatch: "If we offer, we'd start the LMIA, and you'd work toward a P.Eng. licence here. That takes months.",
    gigWork: "You supervise a weekend concrete pour for a contractor in {gigArea}",
    mastersProgram: "Master's in Engineering Management", diplomaProgram: "Two-year Civil Engineering Technology diploma",
    canadaJob: "as an engineering technologist",
  },
  trades: {
    jobPlace: "the electrical market", jobHunt: "trade jobs abroad",
    jobListing: "An Edmonton contractor wants a journeyperson electrician. You have twelve years of wiring Lagos estates and no Canadian ticket",
    interviewStory: "the estate you rewired after the transformer blew", interviewHook: "the transformer story",
    offerCatch: "If we offer, we'd start the LMIA, and you'd need a provincial trade certificate. That takes months.",
    gigWork: "You wire a duplex in {gigArea} for cash",
    mastersProgram: "Master's in Engineering Management", diplomaProgram: "Two-year Electrical Techniques diploma",
    canadaJob: "as an electrical apprentice logging hours",
  },
  business: {
    jobPlace: "the cyber cafe near your office", jobHunt: "remote jobs",
    jobListing: "A Toronto listing wants 'Canadian experience' and advanced Excel. You have a CV with your state of origin on it, stubborn data",
    interviewStory: "the month you cut delivery costs by 18%", interviewHook: "the 18% story",
    offerCatch: "If we offer, we'd start the LMIA. That takes months.",
    gigWork: "You do weekend bookkeeping for a supermarket in {gigArea}",
    mastersProgram: "Master's in Engineering Management", diplomaProgram: "Two-year Supply Chain diploma", canadaJob: "in supply chain",
  },
};

export const careerVars = (t: Track): Record<string, string> => ({ ...WORDS[t], track: t });
