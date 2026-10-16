"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Check, GraduationCap, Phone, Plane, Shuffle, Sparkles } from "lucide-react";
import { DB, computeCrs } from "@/game/engine";
import { STATES, placeFor, placeVars, transportFor } from "@/game/nigeria";
import {
  BODY_SIZES, CGPAS, COURSES, DEFAULT_AVATAR, HAIRSTYLES, HAIR_COLORS, HEADWEAR, LEVELS, OCCUPATIONS, OUTFITS,
  OUTFIT_COLORS, QUALIFICATIONS, SALARY_BANDS, SKIN_TONES, deriveGameProfile, familyFor, profileProblem, usernameProblem,
  MARITAL, SAVINGS_BANDS, TRADE_JOBS, situationOf,
  type Avatar, type PlayerProfile, type Situation, type StudentDetails, type WorkerDetails,
} from "@/game/profile";
import {
  HERITAGES, RELATIONS, detectHeritage, isSibling, makeRelative, provinceFor, relativeVars,
  type Heritage, type Relation, type Relative,
} from "@/game/family";
import { pickFrom, random } from "@/game/rng";
import type { RouteId } from "@/game/types";
import { LagosStage } from "./LagosStage";
import { Person } from "./Person";
import { PlayerProvider } from "./Player";
import { PathwayList, PLAYABLE_COUNT, openCount } from "./Pathways";
import { eligibility } from "@/game/eligibility";

const STEPS = ["Sign in", "Avatar", "Who you are", "Your situation", "Your state", "Your profile"];

const DEFAULT_STUDENT: StudentDetails = { institution: "university", course: "Computer Science", level: "300", cgpa: "2-1" };
const DEFAULT_WORKER: WorkerDetails = { occupation: "software", years: 3, qualification: "bachelors", salary: "150k-400k" };

const naira = (v: number) => `₦${Math.round(v).toLocaleString("en-NG")}`;
const EDU_LABEL = ["None", "Secondary school", "One-year diploma", "Two-year diploma", "Bachelor's degree",
  "Two or more credentials", "Master's degree", "PhD"];

// --- small form pieces ---------------------------------------------------------------

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">{children}</span>
      {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, name }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            value === o.id ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/15 bg-white/5 text-zinc-200 hover:border-white/30"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ colors, value, onChange, name }: { colors: string[]; value: string; onChange: (c: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={`${name} ${c}`} onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-full border-2 transition ${value === c ? "scale-110 border-amber-300" : "border-white/20 hover:border-white/50"}`}
          style={{ background: c }} />
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="min-w-0"><Label hint={hint}>{label}</Label>{children}</div>;
}

const inputCls = "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30";

/** The avatar on a little stage, for previews. */
function AvatarStage({ avatar, name, pose = "wave" }: { avatar: Avatar; name: string; pose?: "wave" | "idle" | "cheer" }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(#7dd3fc,#fde68a_55%,#65a30d_55%,#365314)] sm:h-64">
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#1c1917]" />
      <Person who="you" avatar={avatar} pose={pose} x={50} scale={2.4} caption={name || "You"} />
    </div>
  );
}

// --- the flow ---------------------------------------------------------------------

export function Onboarding({ initial, unlocked = [], onDone, onCancel }: {
  initial: PlayerProfile | null;
  /** Routes the player already earned in play (they stay open whatever the profile says). */
  unlocked?: RouteId[];
  onDone: (p: PlayerProfile) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar ?? DEFAULT_AVATAR);
  const [role, setRole] = useState<"student" | "worker">(initial?.role ?? "student");
  const [age, setAge] = useState<number>(initial?.age ?? 22);
  const [student, setStudent] = useState<StudentDetails>(initial?.student ?? DEFAULT_STUDENT);
  const [worker, setWorker] = useState<WorkerDetails>(initial?.worker ?? DEFAULT_WORKER);
  const [stateCode, setStateCode] = useState(initial?.stateCode ?? "LA");
  const [touched, setTouched] = useState(false);
  const [situation, setSituation] = useState<Situation>(() => situationOf(initial ?? { role: "student" }));
  const setSit = <K extends keyof Situation>(k: K, v: Situation[K]) => setSituation((x) => ({ ...x, [k]: v }));
  // null = follow the username and state; set once the player picks or shuffles.
  const [family, setFamily] = useState<Relative | null>(initial?.family ?? null);
  const relative = family ?? familyFor({ username: username.trim() || "Tolu", stateCode });

  const draft: PlayerProfile = useMemo(() => ({
    version: 1, username: username.trim(), avatar, role, age, stateCode, family: relative, situation,
    ...(role === "student" ? { student } : { worker }),
  }), [username, avatar, role, age, stateCode, student, worker, relative, situation]);

  const nameError = usernameProblem(username);
  const ageError = !age || age < 16 || age > 60 ? "Enter an age between 16 and 60." : null;
  const stepError = step === 0 ? nameError : step === 2 ? ageError : step === 5 ? profileProblem(draft) : null;
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => setAvatar((a) => ({ ...a, [k]: v }));

  function next() {
    setTouched(true);
    if (stepError) return;
    setTouched(false);
    if (step < STEPS.length - 1) setStep(step + 1);
    else onDone(draft);
  }

  function surprise() {
    setAvatar({
      skin: pickFrom(SKIN_TONES), body: pickFrom(BODY_SIZES).id, hair: pickFrom(HAIRSTYLES).id,
      hairColor: pickFrom(HAIR_COLORS), outfit: pickFrom(OUTFITS).id, outfitColor: pickFrom(OUTFIT_COLORS),
      headwear: pickFrom(HEADWEAR).id, headwearColor: pickFrom(OUTFIT_COLORS), glasses: pickFrom([true, false]),
    });
  }

  /** New name (and with a shuffle, a new province) for the relative; keeps the choices the player made. */
  function reroll(change: { heritage?: Heritage; relation?: Relation; move?: boolean }) {
    const next = makeRelative(change.heritage ?? relative.heritage, random, change.relation ?? relative.relation, username);
    setFamily(change.move ? next : { ...next, provinceCode: relative.provinceCode, city: relative.city });
  }

  const game = deriveGameProfile(draft);
  const rv = relativeVars(relative);
  const guessed = detectHeritage(username, placeFor(stateCode).region);
  const place = placeVars(placeFor(stateCode));
  const sibling = isSibling(relative) ? 1 : 0;
  const startCrs = DB.crs ? computeCrs(DB.crs, {
    ageYears: age, educationLevel: game.educationLevel, foreignWorkYears: game.foreignWorkYears, siblingInCanada: sibling,
  }).total : 0;
  const potentialCrs = DB.crs ? computeCrs(DB.crs, {
    ageYears: age, educationLevel: game.educationLevel, ecaComplete: 1, clbFirst: 9, foreignWorkYears: game.foreignWorkYears,
    siblingInCanada: sibling,
  }).total : 0;
  const access = eligibility(draft, unlocked);
  // The best fit among the routes this profile opens.
  const fit = (["TARGETED_TRADE", "EXPRESS_ENTRY", "STUDY_PERMIT", "NIGERIA_LIFE"] as RouteId[]).find((r) => access[r].ok) ?? "NIGERIA_LIFE";
  const suggested = DB.routes[fit].title;

  return (
    <PlayerProvider profile={draft}>
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">
            <Sparkles className="h-3 w-3" /> Japa: The Great Escape
          </p>
          <h1 className="title-shimmer mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            {initial ? "Edit your profile" : "Your japa starts here."}
          </h1>
        </div>

        {/* Stepper */}
        <ol className="mb-6 grid grid-cols-6 gap-1.5" aria-label="Sign-up steps">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-amber-300" : "bg-white/10"}`} />
              <p className={`mt-1.5 truncate text-[10px] font-semibold uppercase tracking-wider sm:text-[11px] ${i === step ? "text-amber-200" : "text-zinc-500"}`}>{s}</p>
            </li>
          ))}
        </ol>

        <div key={step} className="animate-scene-in rounded-[2rem] border border-white/10 bg-zinc-950 p-5 sm:p-7">
          {step === 0 && (
            <div className="grid items-center gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-2xl font-black text-white">Sign in</h2>
                <p className="text-sm leading-6 text-zinc-400">
                  Choose a username. It becomes your character&apos;s name in every scene. Your profile is saved on this device.
                </p>
                <Field label="Username">
                  <input id="username" autoFocus className={inputCls} value={username} maxLength={16} placeholder="e.g. Tolu"
                    onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && next()} />
                </Field>
                {touched && nameError ? <p role="alert" className="text-sm text-rose-300">{nameError}</p> : null}
              </div>
              <AvatarStage avatar={avatar} name={username.trim()} />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
                <AvatarStage avatar={avatar} name={username.trim()} pose="idle" />
                <button type="button" onClick={surprise}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-amber-300/60">
                  <Shuffle className="h-4 w-4" /> Surprise me
                </button>
              </div>
              <div className="space-y-5">
                <Field label="Skin tone"><Swatches name="Skin tone" colors={SKIN_TONES} value={avatar.skin} onChange={(c) => set("skin", c)} /></Field>
                <Field label="Body size"><Chips name="Body size" options={BODY_SIZES} value={avatar.body} onChange={(v) => set("body", v)} /></Field>
                <Field label="Hair"><Chips name="Hair" options={HAIRSTYLES} value={avatar.hair} onChange={(v) => set("hair", v)} /></Field>
                {avatar.hair !== "bald" && (
                  <Field label="Hair colour"><Swatches name="Hair colour" colors={HAIR_COLORS} value={avatar.hairColor} onChange={(c) => set("hairColor", c)} /></Field>
                )}
                <Field label="Outfit"><Chips name="Outfit" options={OUTFITS} value={avatar.outfit} onChange={(v) => set("outfit", v)} /></Field>
                <Field label="Outfit colour"><Swatches name="Outfit colour" colors={OUTFIT_COLORS} value={avatar.outfitColor} onChange={(c) => set("outfitColor", c)} /></Field>
                <Field label="Headwear"><Chips name="Headwear" options={HEADWEAR} value={avatar.headwear} onChange={(v) => set("headwear", v)} /></Field>
                {avatar.headwear !== "none" && (
                  <Field label="Headwear colour"><Swatches name="Headwear colour" colors={OUTFIT_COLORS} value={avatar.headwearColor} onChange={(c) => set("headwearColor", c)} /></Field>
                )}
                <Field label="Glasses">
                  <Chips name="Glasses" options={[{ id: "no", label: "No glasses" }, { id: "yes", label: "Glasses" }]}
                    value={avatar.glasses ? "yes" : "no"} onChange={(v) => set("glasses", v === "yes")} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {([["student", GraduationCap, "Student", "In school or recently graduated"], ["worker", Briefcase, "Worker", "Working a job or running a business"]] as const).map(([id, Icon, title, sub]) => (
                  <button key={id} type="button" onClick={() => { setRole(id); if (id === "worker" && age < 21) setAge(26); }}
                    aria-pressed={role === id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${role === id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${role === id ? "bg-amber-300 text-zinc-950" : "bg-white/10 text-zinc-300"}`}><Icon className="h-5 w-5" /></span>
                    <span><span className="block text-lg font-black text-white">{title}</span><span className="text-sm text-zinc-400">{sub}</span></span>
                    {role === id ? <Check className="ml-auto h-5 w-5 text-amber-300" /> : null}
                  </button>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Age">
                  <input id="age" type="number" min={16} max={60} className={inputCls} value={Number.isFinite(age) ? age : ""}
                    onChange={(e) => setAge(parseInt(e.target.value, 10))} />
                  {touched && ageError ? <p role="alert" className="mt-1 text-sm text-rose-300">{ageError}</p> : null}
                </Field>
                {role === "student" ? (
                  <>
                    <Field label="Course of study">
                      <select id="course" className={inputCls} value={student.course} onChange={(e) => setStudent({ ...student, course: e.target.value })}>
                        {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="School">
                      <Chips name="School" value={student.institution} onChange={(v) => setStudent({ ...student, institution: v })}
                        options={[{ id: "university", label: "University" }, { id: "polytechnic", label: "Polytechnic" }, { id: "college-of-education", label: "College of Education" }]} />
                    </Field>
                    <Field label="Year in school"><Chips name="Year in school" options={LEVELS} value={student.level} onChange={(v) => setStudent({ ...student, level: v })} /></Field>
                    <Field label="Grade so far"><Chips name="Grade" options={CGPAS} value={student.cgpa} onChange={(v) => setStudent({ ...student, cgpa: v })} /></Field>
                  </>
                ) : (
                  <>
                    <Field label="Job">
                      <select id="job" className={inputCls} value={worker.occupation} onChange={(e) => setWorker({ ...worker, occupation: e.target.value })}>
                        {OCCUPATIONS.map((o) => <option key={o.id} value={o.id}>{o.label.charAt(0).toUpperCase() + o.label.slice(1)}</option>)}
                      </select>
                    </Field>
                    <Field label="Years of experience" hint={`${worker.years} year${worker.years === 1 ? "" : "s"}`}>
                      <input id="years" type="range" min={0} max={20} value={worker.years} className="w-full accent-amber-300"
                        onChange={(e) => setWorker({ ...worker, years: parseInt(e.target.value, 10) })} />
                    </Field>
                    <Field label="Highest qualification"><Chips name="Qualification" options={QUALIFICATIONS} value={worker.qualification} onChange={(v) => setWorker({ ...worker, qualification: v })} /></Field>
                    <Field label="Monthly income"><Chips name="Monthly income" options={SALARY_BANDS} value={worker.salary} onChange={(v) => setWorker({ ...worker, salary: v })} /></Field>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white">Your situation</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  These answers decide which pathways you can play. Each real route is built for a certain kind of person:
                  the game only opens the ones your profile could actually use.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Marital status" hint="Opens Pilot & Passenger">
                  <Chips name="Marital status" options={MARITAL} value={situation.marital} onChange={(v) => setSit("marital", v)} />
                </Field>
                {situation.marital !== "single" ? (
                  <Field label="Is your spouse a Canadian citizen or PR?" hint="Opens spousal sponsorship">
                    <Chips name="Spouse in Canada" value={situation.spouseInCanada ? "yes" : "no"} onChange={(v) => setSit("spouseInCanada", v === "yes")}
                      options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes, citizen or PR" }]} />
                  </Field>
                ) : null}
                <Field label="Money you could show" hint="Savings + documented family support">
                  <Chips name="Money you could show" options={SAVINGS_BANDS} value={situation.savings} onChange={(v) => setSit("savings", v)} />
                </Field>
                <Field label="Are you building a startup?" hint="Opens the Startup pitch">
                  <Chips name="Startup" value={situation.startup ? "yes" : "no"} onChange={(v) => setSit("startup", v === "yes")}
                    options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes, an innovative business with co-founders" }]} />
                </Field>
                {role === "worker" ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-300">
                    Job: <b className="text-white">{OCCUPATIONS.find((o) => o.id === worker.occupation)?.label}</b>, {worker.years} yr{worker.years === 1 ? "" : "s"}.
                    {TRADE_JOBS.has(worker.occupation) ? " Skilled trade: Targeted Trade opens at 2 years." : " Electricians, plumbers, welders, carpenters and mechanics also get the Trades route."}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-300">
                    Students start with Nigeria and the Student route. Graduate in Canada to unlock Express Entry.
                  </div>
                )}
              </div>
              <section aria-labelledby="open-title" className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                <h3 id="open-title" className="text-sm font-black text-white">
                  {openCount(access)} of {PLAYABLE_COUNT} pathways open for you
                </h3>
                <div className="mt-3"><PathwayList access={access} compact /></div>
              </section>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <Field label="Which state are you playing from?">
                <select id="state" className={inputCls} value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                  {STATES.map((s) => <option key={s.code} value={s.code}>{s.state}{s.state === "FCT" ? " (Abuja)" : ""}</option>)}
                </select>
              </Field>
              <div className="relative"><LagosStage scene="yaba-street" /></div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Home", `${place.area}, ${place.city}`],
                  ["Getting around", transportFor(placeFor(stateCode)) === "danfo" ? "Danfo" : transportFor(placeFor(stateCode)) === "bus" ? "City bus" : "Keke"],
                  ["Market", place.market],
                  ["Nearest Canada visa centre", `${place.vacCity} (${place.vacTrip})`],
                  ["Flights leave from", place.airport],
                  ["Nearby university", place.university],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{k}</dt>
                    <dd className="mt-0.5 font-semibold text-zinc-100">{v}</dd>
                  </div>
                ))}
              </dl>
              <section aria-labelledby="family-title" className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id="family-title" className="flex items-center gap-2 text-sm font-black text-white">
                      <Phone className="h-4 w-4 text-sky-300" /> Family in Canada
                    </h3>
                    <p className="mt-1 text-sm text-zinc-300">
                      <b className="text-white">{rv.RelWho}</b> lives in <b className="text-white">{rv.relPlace}</b>, {rv.relGap} you.
                      {isSibling(relative) ? " A sibling who is a permanent resident or citizen adds 15 CRS points in Express Entry." : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => reroll({ move: true })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-white/30">
                    <Shuffle className="h-3.5 w-3.5" /> New name &amp; province
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Family background" hint={relative.heritage === guessed ? "Matched to your name" : undefined}>
                    <Chips name="Family background" options={HERITAGES} value={relative.heritage} onChange={(h) => reroll({ heritage: h })} />
                  </Field>
                  <Field label="Who you call">
                    <Chips name="Who you call" options={RELATIONS} value={relative.relation} onChange={(r) => reroll({ relation: r })} />
                  </Field>
                </div>
                <div className="relative mt-3"><LagosStage scene="call-sister" /></div>
              </section>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <AvatarStage avatar={avatar} name={username.trim()} pose="cheer" />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black text-white">{username.trim()}</p>
                  <p className="text-sm capitalize text-zinc-400">{game.roleLine} · {place.city}, {placeFor(stateCode).state}</p>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-xl font-black text-white">Your game profile</h2>
                <dl className="grid grid-cols-2 gap-2.5 text-sm">
                  {[
                    ["Age", `${age}`],
                    ["Education (ECA equivalent)", EDU_LABEL[game.educationLevel]],
                    ["Work experience", game.foreignWorkYears ? `${game.foreignWorkYears} yr${game.foreignWorkYears === 1 ? "" : "s"}` : "None yet"],
                    ["Savings", `${naira(game.savingsNgn)} ≈ CAD $${game.savingsCad.toLocaleString("en-CA")}`],
                    ["CRS today", `${startCrs}`],
                    ["CRS with IELTS CLB 9 + ECA", `${potentialCrs}`],
                    ["Family in Canada", `${rv.RelName}, ${relative.city} (${provinceFor(relative.provinceCode).code})`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{k}</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-zinc-100">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="rounded-xl border border-emerald-300/25 bg-emerald-300/5 px-3 py-2.5 text-sm text-emerald-100/90">
                  <b>{openCount(access)} of {PLAYABLE_COUNT} pathways</b> open for this profile. Locked ones show what&apos;s missing;
                  some open when you win another route.
                </p>
                <p className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-3 py-2.5 text-sm text-amber-100/90">
                  Suggested first route: <b>{suggested}</b>. Every route uses this profile: your age, education, work years and savings.
                </p>
                <p className="text-xs leading-5 text-zinc-500">
                  Game estimates, not advice. Real ECA results vary (an HND is often assessed as a diploma), and savings here are rough.
                </p>
                {touched && stepError ? <p role="alert" className="text-sm text-rose-300">{stepError}</p> : null}
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:border-white/30">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : onCancel ? (
              <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
            ) : <span />}
            <button type="button" onClick={next}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-amber-200 active:scale-95">
              {step === STEPS.length - 1 ? (<><Plane className="h-4 w-4" /> Start playing</>) : (<>Continue <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </PlayerProvider>
  );
}
