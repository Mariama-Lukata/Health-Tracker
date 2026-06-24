import { useState, useEffect } from "react";

// ─── TDEE & MACRO CALCULATION (live, weight-driven) ─────────────────────────
// Mifflin-St Jeor female: BMR = 10×kg + 6.25×cm − 5×age − 161
// Stats: 25F · 5'8" (172.72 cm) · activity multiplier 1.375 (light-moderate)
// Target deficit: ~600 kcal/day avg → ~1.2 lbs/week
// Protein: 0.75g/lb body weight (muscle-preserving floor)
// Carbs & fat absorb the calorie cuts as weight drops

function calcTargets(weightLbs) {
  const kg  = weightLbs * 0.453592;
  const cm  = 172.72; // 5'8"
  const age = 25;
  const bmr  = Math.round(10 * kg + 6.25 * cm - 5 * age - 161);
  const tdee = Math.round(bmr * 1.375);
  const targetAvg = Math.max(1200, Math.round(tdee - 600)); // 600 cal deficit, never below 1200

  // Day-type splits: LOW = −22%, MED = base, HIGH = +21% relative to targetAvg
  // Weighted avg of pattern (2 LOW + 2 MED + 3 HIGH) must equal targetAvg
  // Solve: (2L + 2M + 3H) / 7 = targetAvg  where L=M−0.22M, H=M+0.21M
  // → M ≈ targetAvg / 0.994 (≈ targetAvg), then round to nearest 50
  const medBase  = Math.round(targetAvg / 50) * 50;
  const lowBase  = Math.round(medBase * 0.82 / 50) * 50;   // ~18% below med
  const highBase = Math.round(medBase * 1.21 / 50) * 50;   // ~21% above med

  // Protein: 0.75g/lb (preserves muscle during cut), min 120g
  const protein = Math.max(120, Math.round(weightLbs * 0.75 / 5) * 5);
  // Fat: ~30% of calories on LOW, ~28% on MED/HIGH (in grams, fat=9 cal/g)
  const fatLow  = Math.round((lowBase  * 0.30) / 9 / 5) * 5;
  const fatMed  = Math.round((medBase  * 0.28) / 9 / 5) * 5;
  const fatHigh = Math.round((highBase * 0.28) / 9 / 5) * 5;
  // Carbs: fill remaining calories (carbs = 4 cal/g)
  const carbsLow  = Math.max(50,  Math.round((lowBase  - protein * 4 - fatLow  * 9) / 4 / 5) * 5);
  const carbsMed  = Math.max(100, Math.round((medBase  - protein * 4 - fatMed  * 9) / 4 / 5) * 5);
  const carbsHigh = Math.max(150, Math.round((highBase - protein * 4 - fatHigh * 9) / 4 / 5) * 5);

  return {
    bmr, tdee, targetAvg,
    base: { LOW: lowBase, MED: medBase, HIGH: highBase },
    macros: {
      LOW:  { protein, carbs: carbsLow,  fat: fatLow  },
      MED:  { protein, carbs: carbsMed,  fat: fatMed  },
      HIGH: { protein, carbs: carbsHigh, fat: fatHigh },
    },
  };
}

// Weekly pattern indexed by JS day-of-week (0=Sun … 6=Sat)
const WEEK_PATTERN = ["LOW", "HIGH", "MED", "HIGH", "MED", "HIGH", "LOW"];
const DAY_NAMES    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const CFG = {
  LOW:  { label: "Low",    color: "#b06a4e", bg: "#fdf1ec", pill: "#fce4d8", desc: "Rest & recover — deep fat burn" },
  MED:  { label: "Medium", color: "#6b8c52", bg: "#f1f5eb", pill: "#deebd0", desc: "Light activity — steady burn" },
  HIGH: { label: "High",   color: "#4a7a9b", bg: "#eaf3f8", pill: "#cde5f2", desc: "Workout day — fuel your lift" },
};

// ─── WORKOUT PLAN ────────────────────────────────────────────────────────────
const WORKOUTS = {
  MON: {
    type: "Strength – Lower Body",
    tag: "HIGH",
    emoji: "🏋️",
    focus: "Glutes, quads, hamstrings",
    warmup: "5 min walk/march + hip circles",
    exercises: [
      { name: "Barbell / Goblet Squat",    sets: "4", reps: "10–12", rest: "90s", note: "Drive through heels" },
      { name: "Romanian Deadlift",          sets: "4", reps: "10",    rest: "90s", note: "Hinge, not squat — feel the hamstrings" },
      { name: "Walking Lunges",             sets: "3", reps: "12 ea", rest: "60s", note: "Add dumbbells when comfortable" },
      { name: "Glute Bridge / Hip Thrust",  sets: "3", reps: "15",    rest: "60s", note: "Squeeze at the top for 1s" },
      { name: "Leg Press",                  sets: "3", reps: "12",    rest: "60s", note: "Feet hip-width" },
      { name: "Calf Raises",               sets: "3", reps: "20",    rest: "45s", note: "Slow & controlled" },
    ],
    cardio: "None — save energy for lifting",
    calories: "~300–400 cal burned",
    yogaCooldown: [
      { name: "Pigeon Pose", reps: "60s each side", note: "Essential after heavy lower body — deep glute release" },
      { name: "Seated Forward Fold", reps: "60s", note: "Hamstring recovery after RDLs" },
      { name: "Supine Twist", reps: "45s each side", note: "Decompress the lower back" },
    ],
  },
  TUE: {
    type: "Cardio – Zone 2",
    tag: "MED",
    emoji: "🚶‍♀️",
    focus: "Fat oxidation, aerobic base",
    warmup: "Already included in session",
    exercises: [
      { name: "Brisk Walk / Incline Treadmill", sets: "1", reps: "35–45 min", rest: "—", note: "Heart rate 120–140 bpm (can hold conversation)" },
      { name: "Optional: Stationary Bike",      sets: "1", reps: "20 min",    rest: "—", note: "Moderate resistance, steady pace" },
    ],
    cardio: "This IS the session",
    calories: "~250–350 cal burned",
  },
  WED: {
    type: "Strength – Upper Body",
    tag: "HIGH",
    emoji: "💪",
    focus: "Back, shoulders, arms, core",
    warmup: "5 min light row + arm circles",
    exercises: [
      { name: "Dumbbell Row (each side)",  sets: "4", reps: "10–12", rest: "75s", note: "Elbow drives back, not up" },
      { name: "Dumbbell Shoulder Press",   sets: "3", reps: "10–12", rest: "75s", note: "Seated for stability" },
      { name: "Lat Pulldown / Assisted PU",sets: "3", reps: "10",    rest: "75s", note: "Squeeze at the bottom" },
      { name: "Dumbbell Bicep Curl",       sets: "3", reps: "12",    rest: "60s", note: "Full range, no swinging" },
      { name: "Tricep Overhead Extension", sets: "3", reps: "12",    rest: "60s", note: "Keep elbows close" },
      { name: "Plank",                     sets: "3", reps: "30–45s",rest: "45s", note: "Straight line head to heel" },
    ],
    cardio: "10 min light elliptical cooldown",
    calories: "~250–350 cal burned",
    yogaCooldown: [
      { name: "Thread the Needle", reps: "45s each side", note: "Releases upper back & shoulders" },
      { name: "Child's Pose", reps: "60s", note: "Decompress the spine after pressing" },
      { name: "Eagle Arms Stretch", reps: "30s each side", note: "Opens rear deltoids and rhomboids" },
    ],
  },
  THU: {
    type: "Yoga & Recovery",
    tag: "MED",
    emoji: "🧘‍♀️",
    focus: "Flexibility, mobility, stress relief, active recovery",
    warmup: "3 min of slow deep breathing — inhale 4 counts, exhale 6 counts",
    exercises: [
      { name: "Cat-Cow (Marjaryasana)",        sets: "1", reps: "10 slow cycles", rest: "—",  note: "Synced with breath — warms the spine" },
      { name: "Child's Pose (Balasana)",        sets: "1", reps: "90s hold",       rest: "—",  note: "Hips back, arms extended or beside you" },
      { name: "Downward Dog (Adho Mukha)",      sets: "3", reps: "30s hold",       rest: "10s",note: "Pedal the heels — hamstrings & calves" },
      { name: "Low Lunge (Anjaneyasana)",       sets: "1", reps: "45s each side",  rest: "—",  note: "Opens hip flexors tight from squats" },
      { name: "Warrior I (Virabhadrasana I)",   sets: "1", reps: "30s each side",  rest: "—",  note: "Square hips forward, reach arms up" },
      { name: "Warrior II (Virabhadrasana II)", sets: "1", reps: "30s each side",  rest: "—",  note: "Gaze over front fingers, sink the hips" },
      { name: "Triangle Pose (Trikonasana)",    sets: "1", reps: "30s each side",  rest: "—",  note: "Side body stretch + hamstring opener" },
      { name: "Seated Forward Fold (Paschimottanasana)", sets: "1", reps: "60s hold", rest: "—", note: "Don't force it — breathe into the stretch" },
      { name: "Supine Twist (Supta Matsyendrasana)", sets: "1", reps: "45s each side", rest: "—", note: "Both shoulders stay on the mat" },
      { name: "Pigeon Pose (Eka Pada Rajakapotasana)", sets: "1", reps: "90s each side", rest: "—", note: "Deep glute/hip opener — breathe through the discomfort" },
      { name: "Legs Up the Wall (Viparita Karani)", sets: "1", reps: "3–5 min",    rest: "—",  note: "Reduces soreness, promotes circulation" },
      { name: "Savasana (Corpse Pose)",         sets: "1", reps: "5 min",          rest: "—",  note: "Non-negotiable — your nervous system needs this" },
    ],
    cardio: "—",
    calories: "~120–180 cal burned",
    yogaNote: "Full session ~45–55 min. Recommended channel: Yoga with Adriene on YouTube — her 'Yoga for Strength Training Recovery' videos are perfect for this day.",
  },
  FRI: {
    type: "Strength – Full Body HIIT",
    tag: "HIGH",
    emoji: "🔥",
    focus: "Total body, metabolic conditioning",
    warmup: "5 min dynamic stretch + jumping jacks",
    exercises: [
      { name: "Dumbbell Squat to Press",  sets: "4", reps: "10",    rest: "60s", note: "Fluid motion, moderate weight" },
      { name: "Renegade Row",             sets: "3", reps: "8 ea",  rest: "60s", note: "Core tight, hips level" },
      { name: "Step-Ups (bench/box)",     sets: "3", reps: "12 ea", rest: "60s", note: "Drive through the top leg" },
      { name: "Push-Up (any variation)",  sets: "3", reps: "10–15", rest: "45s", note: "Incline if needed — full range" },
      { name: "Mountain Climbers",        sets: "3", reps: "30s",   rest: "30s", note: "Controlled pace, core braced" },
      { name: "Kettlebell / DB Swing",    sets: "3", reps: "15",    rest: "45s", note: "Hip hinge power — not a squat" },
    ],
    cardio: "Included in HIIT structure",
    calories: "~350–450 cal burned",
  },
  SAT: {
    type: "Rest Day",
    tag: "LOW",
    emoji: "😴",
    focus: "Recovery & fat burn",
    warmup: "—",
    exercises: [
      { name: "Leisure walk",       sets: "1", reps: "20–30 min", rest: "—", note: "Gentle movement aids recovery" },
      { name: "Light stretching",   sets: "1", reps: "10 min",    rest: "—", note: "Focus on anything sore" },
    ],
    cardio: "—",
    calories: "~100–150 cal burned",
    yogaCooldown: [
      { name: "Full Body Gentle Flow", reps: "15–20 min", note: "YouTube: search 'gentle yoga rest day' — move intuitively" },
      { name: "Foam Rolling", reps: "10 min", note: "Head to toe — wherever feels tight from the week" },
    ],
  },
  SUN: {
    type: "Rest Day",
    tag: "LOW",
    emoji: "🌿",
    focus: "Full rest, mental reset",
    warmup: "—",
    exercises: [
      { name: "Gentle walk / nature time", sets: "1", reps: "Optional", rest: "—", note: "No pressure — rest is part of the plan" },
    ],
    cardio: "—",
    calories: "~80–120 cal burned",
  },
};

const WORKOUT_ORDER = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_TO_WORKOUT = { 0:"SUN",1:"MON",2:"TUE",3:"WED",4:"THU",5:"FRI",6:"SAT" };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTodayIdx() { return new Date().getDay(); }

// Given yesterday's logged vs target, compute a carry-over delta capped at ±300 cal
function getCarryOver(yesterdayLogged, yesterdayTarget) {
  if (yesterdayLogged == null) return 0;
  const diff = yesterdayLogged - yesterdayTarget; // positive = over-ate
  return Math.max(-300, Math.min(300, -diff)); // over-ate → lower tomorrow; under → raise tomorrow
}

function getNextDayIdx(todayIdx) { return (todayIdx + 1) % 7; }

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Tag({ type }) {
  const cfg = CFG[type];
  return (
    <span style={{
      background: cfg.pill, color: cfg.color,
      borderRadius: 20, padding: "2px 10px",
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4
    }}>{cfg.label} Day</span>
  );
}

function ProgressBar({ current, start, goal }) {
  const pct = Math.min(100, Math.max(0, ((start - current) / (start - goal)) * 100));
  const lbs  = (current - goal).toFixed(1);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#999", marginBottom:6 }}>
        <span>{start} lbs</span>
        <span style={{ fontWeight:700, color:"#b06a4e" }}>{pct.toFixed(0)}% to goal</span>
        <span>{goal} lbs</span>
      </div>
      <div style={{ background:"#ede8e4", borderRadius:99, height:10, overflow:"hidden" }}>
        <div style={{
          width:`${pct}%`, height:"100%",
          background:"linear-gradient(90deg,#b06a4e,#d4956e)",
          borderRadius:99, transition:"width 0.5s ease"
        }}/>
      </div>
      <div style={{ textAlign:"center", marginTop:8, fontSize:13, color:"#777" }}>
        Current: <strong style={{ color:"#b06a4e" }}>{current} lbs</strong>
        {lbs > 0 && <span> — {lbs} lbs to go</span>}
        {lbs <= 0 && <span style={{ color:"#6b8c52" }}> — Goal reached! 🎉</span>}
      </div>
    </div>
  );
}

function CalorieModal({ dayIdx, baseTarget, adjustment, onSave, onClose }) {
  const type   = WEEK_PATTERN[dayIdx];
  const cfg    = CFG[type];
  const adjTarget = baseTarget + adjustment;
  const [val, setVal] = useState("");

  const save = () => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) { onSave(n); }
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:200
    }} onClick={onClose}>
      <div style={{
        background:"#fff", borderRadius:20, padding:"28px 24px", width:310,
        boxShadow:"0 12px 50px rgba(0,0,0,0.2)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#222" }}>Log {DAY_FULL[dayIdx]}</div>
            <div style={{ marginTop:4 }}><Tag type={type}/></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#bbb" }}>×</button>
        </div>

        <div style={{ background:cfg.bg, borderRadius:12, padding:"12px 14px", marginBottom:18 }}>
          <div style={{ fontSize:11, color:cfg.color, fontWeight:700, marginBottom:2 }}>Today's Target</div>
          <div style={{ fontSize:26, fontWeight:900, color:cfg.color }}>{adjTarget.toLocaleString()} <span style={{ fontSize:13, fontWeight:500 }}>kcal</span></div>
          {adjustment !== 0 && (
            <div style={{ fontSize:11, color:"#999", marginTop:4 }}>
              Base {baseTarget.toLocaleString()} {adjustment > 0 ? `+ ${adjustment} carry-over bonus` : `− ${Math.abs(adjustment)} carry-over reduction`}
            </div>
          )}
        </div>

        <input
          type="number" placeholder="Calories you actually ate"
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          autoFocus
          style={{
            width:"100%", padding:"12px 14px", fontSize:16,
            borderRadius:10, border:"1.5px solid #ddd", outline:"none",
            boxSizing:"border-box", marginBottom:14
          }}
        />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, padding:"11px", borderRadius:10, border:"1.5px solid #eee",
            background:"#fff", cursor:"pointer", fontSize:14, fontWeight:600, color:"#888"
          }}>Cancel</button>
          <button onClick={save} style={{
            flex:1, padding:"11px", borderRadius:10, border:"none",
            background:cfg.color, color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700
          }}>Save Log</button>
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({ dayKey }) {
  const w = WORKOUTS[dayKey];
  const cfg = CFG[w.tag];
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:"#fff", borderRadius:16, marginBottom:12, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 16px", cursor:"pointer"
        }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:24 }}>{w.emoji}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"#222" }}>{dayKey} · {w.type}</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{w.focus}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Tag type={w.tag}/>
          <span style={{ color:"#ccc", fontSize:18, fontWeight:300 }}>{open ? "−" : "+"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop:"1px solid #f0f0f0", padding:"14px 16px" }}>
          {w.warmup !== "—" && (
            <div style={{ background:"#fffbf5", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:12, color:"#b06a4e" }}>
              🔆 <strong>Warm-up:</strong> {w.warmup}
            </div>
          )}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ color:"#bbb", textAlign:"left" }}>
                  {["Exercise","Sets","Reps","Rest","Note"].map(h => (
                    <th key={h} style={{ padding:"4px 8px 8px", fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {w.exercises.map((ex, i) => (
                  <tr key={i} style={{ borderTop:"1px solid #f5f5f5" }}>
                    <td style={{ padding:"8px", fontWeight:700, color:"#333", minWidth:140 }}>{ex.name}</td>
                    <td style={{ padding:"8px", color:"#555", textAlign:"center" }}>{ex.sets}</td>
                    <td style={{ padding:"8px", color:"#555", textAlign:"center", whiteSpace:"nowrap" }}>{ex.reps}</td>
                    <td style={{ padding:"8px", color:"#555", textAlign:"center" }}>{ex.rest}</td>
                    <td style={{ padding:"8px", color:"#999", fontSize:11, minWidth:140 }}>{ex.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:12 }}>
            {w.cardio !== "—" && w.cardio !== "This IS the session" && w.cardio !== "Included in HIIT structure" && (
              <div style={{ flex:1, background:cfg.bg, borderRadius:10, padding:"8px 12px", fontSize:11, color:cfg.color }}>
                🏃 <strong>Cardio:</strong> {w.cardio}
              </div>
            )}
            <div style={{ flex:1, background:"#f7f7f7", borderRadius:10, padding:"8px 12px", fontSize:11, color:"#777" }}>
              🔥 <strong>Est. burn:</strong> {w.calories}
            </div>
          </div>
          {w.yogaCooldown && (
            <div style={{ marginTop:12, background:"#f5f0fb", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#7c5cbf", marginBottom:8 }}>🧘‍♀️ Yoga Cooldown (10–12 min)</div>
              {w.yogaCooldown.map((y, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: i < w.yogaCooldown.length-1 ? 8 : 0, paddingBottom: i < w.yogaCooldown.length-1 ? 8 : 0, borderBottom: i < w.yogaCooldown.length-1 ? "1px solid #ebe3f8" : "none" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#4a3a6b" }}>{y.name}</div>
                    <div style={{ fontSize:11, color:"#999", marginTop:2 }}>{y.note}</div>
                  </div>
                  <div style={{ fontSize:11, color:"#7c5cbf", fontWeight:600, whiteSpace:"nowrap", marginLeft:10 }}>{y.reps}</div>
                </div>
              ))}
            </div>
          )}
          {w.yogaNote && (
            <div style={{ marginTop:10, background:"#f5f0fb", borderRadius:10, padding:"10px 12px", fontSize:11, color:"#7c5cbf", lineHeight:1.5 }}>
              💜 {w.yogaNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const todayIdx    = getTodayIdx();
  const tomorrowIdx = getNextDayIdx(todayIdx);

  // log: { [dayOfWeek]: caloriesEaten }
  const [log, setLog]         = useState({});
  const [currentWeight, setCW] = useState(196);
  const [editWeight, setEW]   = useState(false);
  const [wInput, setWInput]   = useState("196");
  const [tab, setTab]         = useState("today");
  const [loggingDay, setLD]   = useState(null);
  const [toast, setToast]     = useState(null);

  // ── Live targets — recalculate whenever weight changes ──
  const targets = calcTargets(currentWeight);
  const { bmr, tdee, targetAvg, base: BASE, macros: MACROS } = targets;

  // Persist log + weight to localStorage via storage API (in-memory fallback)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cc_log");
      if (saved) setLog(JSON.parse(saved));
      const savedW = localStorage.getItem("cc_weight");
      if (savedW) setCW(parseFloat(savedW));
    } catch {}
  }, []);

  const saveLog = (newLog) => {
    setLog(newLog);
    try { localStorage.setItem("cc_log", JSON.stringify(newLog)); } catch {}
  };

  const saveWeight = (w) => {
    const newTargets = calcTargets(w);
    setCW(w);
    try { localStorage.setItem("cc_weight", String(w)); } catch {}
    showToast(`Plan updated for ${w} lbs · New target: ${newTargets.targetAvg.toLocaleString()} kcal/day`);
  };

  // ── Compute today's adjusted target ──
  const yesterdayIdx    = (todayIdx + 6) % 7;
  const yesterdayLogged = log[yesterdayIdx];
  const yesterdayBase   = BASE[WEEK_PATTERN[yesterdayIdx]];
  const todayCarryOver  = getCarryOver(yesterdayLogged, yesterdayBase);
  const todayBase       = BASE[WEEK_PATTERN[todayIdx]];
  const todayTarget     = Math.max(1200, todayBase + todayCarryOver);

  // ── Compute tomorrow's adjusted target (based on today's log if available) ──
  const todayLogged       = log[todayIdx];
  const tomorrowCarryOver = getCarryOver(todayLogged, todayBase);
  const tomorrowBase      = BASE[WEEK_PATTERN[tomorrowIdx]];
  const tomorrowTarget    = Math.max(1200, tomorrowBase + tomorrowCarryOver);

  const todayType  = WEEK_PATTERN[todayIdx];
  const todayCfg   = CFG[todayType];
  const todayMac   = MACROS[todayType];
  const todayWorkout = WORKOUTS[DAY_TO_WORKOUT[todayIdx]];

  // Weekly stats
  const loggedDays = Object.keys(log).length;
  const totalCals  = Object.values(log).reduce((s,v)=>s+v,0);
  const avgCals    = loggedDays ? Math.round(totalCals / loggedDays) : targetAvg;
  const weeklyDeficit = (tdee - avgCals) * 7;
  const projLbs    = (weeklyDeficit / 3500).toFixed(1);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveCalories = (cal) => {
    const newLog = { ...log, [loggingDay]: cal };
    saveLog(newLog);
    setLD(null);
    const target = loggingDay === todayIdx ? todayTarget : BASE[WEEK_PATTERN[loggingDay]];
    const diff   = cal - target;
    if (Math.abs(diff) > 20) {
      const nextIdx = getNextDayIdx(loggingDay);
      const adj     = Math.max(-300, Math.min(300, -diff));
      const sign    = adj > 0 ? "+" : "";
      showToast(`Tomorrow's target adjusted by ${sign}${adj} kcal to compensate`);
    } else {
      showToast("Logged! Great job staying on target ✓");
    }
  };

  // Tabs
  const tabs = [["today","Today"],["week","Week"],["workout","Workout"],["plan","Plan"]];

  return (
    <div style={{
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      background:"#f8f6f3", minHeight:"100vh",
      maxWidth:500, margin:"0 auto", padding:"20px 16px 50px",
      position:"relative"
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:16, left:"50%", transform:"translateX(-50%)",
          background:"#222", color:"#fff", borderRadius:12, padding:"10px 18px",
          fontSize:13, fontWeight:600, zIndex:999, whiteSpace:"nowrap",
          boxShadow:"0 4px 20px rgba(0,0,0,0.25)", animation:"fadeIn 0.2s"
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, letterSpacing:2, color:"#b06a4e", fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>
          Female Fat Loss · 4 months
        </div>
        <div style={{ fontSize:26, fontWeight:900, color:"#1a1a1a", lineHeight:1.1 }}>Calorie Cycling</div>
        <div style={{ fontSize:12, color:"#aaa", marginTop:3 }}>
          TDEE {tdee.toLocaleString()} kcal · Target avg {targetAvg.toLocaleString()} kcal/day
        </div>
      </div>

      {/* Weight card */}
      <div style={{ background:"#fff", borderRadius:18, padding:18, marginBottom:14, boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#222" }}>Weight Progress</div>
          {editWeight ? (
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="number" value={wInput} onChange={e=>setWInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"){ const n=parseFloat(wInput); if(!isNaN(n)&&n>100&&n<400){saveWeight(n);setEW(false);}}}}
                style={{ width:72, padding:"5px 8px", borderRadius:8, border:"1.5px solid #b06a4e", fontSize:14, outline:"none" }} autoFocus/>
              <button onClick={()=>{const n=parseFloat(wInput);if(!isNaN(n)&&n>100&&n<400){saveWeight(n);setEW(false);}}}
                style={{ background:"#b06a4e",color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:13 }}>✓</button>
              <button onClick={()=>setEW(false)}
                style={{ background:"#f0f0f0",color:"#888",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:13 }}>✕</button>
            </div>
          ) : (
            <button onClick={()=>{setEW(true);setWInput(String(currentWeight));}}
              style={{ background:"#fdf1ec",color:"#b06a4e",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700 }}>
              Update Weight
            </button>
          )}
        </div>
        <ProgressBar current={currentWeight} start={196} goal={167}/>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"#edeae6", borderRadius:14, padding:4, marginBottom:16 }}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1, padding:"8px 0", borderRadius:10, border:"none",
            background:tab===id?"#fff":"transparent",
            color:tab===id?"#222":"#aaa",
            fontWeight:tab===id?800:500,
            fontSize:12, cursor:"pointer",
            boxShadow:tab===id?"0 1px 6px rgba(0,0,0,0.09)":"none",
            transition:"all 0.15s"
          }}>{label}</button>
        ))}
      </div>

      {/* ── TODAY TAB ── */}
      {tab==="today" && (
        <div>
          {/* Hero cal card */}
          <div style={{
            background:todayCfg.color, borderRadius:20, padding:"22px 20px", marginBottom:14, color:"#fff"
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, opacity:0.75, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>
                  {DAY_FULL[todayIdx]} · {todayCfg.label} Day
                </div>
                <div style={{ fontSize:52, fontWeight:900, lineHeight:1, letterSpacing:-1 }}>
                  {todayTarget.toLocaleString()}
                </div>
                <div style={{ fontSize:14, opacity:0.8, marginTop:2 }}>calories today</div>
                <div style={{ fontSize:12, opacity:0.65, marginTop:6 }}>{todayCfg.desc}</div>
              </div>
              <div style={{ fontSize:40, opacity:0.25 }}>{todayWorkout.emoji}</div>
            </div>

            {todayCarryOver !== 0 && (
              <div style={{ marginTop:14, background:"rgba(255,255,255,0.18)", borderRadius:10, padding:"8px 12px", fontSize:12 }}>
                {todayCarryOver > 0
                  ? `⬆ +${todayCarryOver} kcal bonus — you were under yesterday`
                  : `⬇ ${todayCarryOver} kcal reduction — you were over yesterday`}
              </div>
            )}

            {todayLogged != null && (
              <div style={{ marginTop:10, background:"rgba(255,255,255,0.18)", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600 }}>
                ✓ Logged: {todayLogged.toLocaleString()} kcal
                {todayLogged <= todayTarget
                  ? <span style={{ fontWeight:400, opacity:0.85 }}> · {(todayTarget-todayLogged).toLocaleString()} remaining</span>
                  : <span style={{ fontWeight:400, opacity:0.85 }}> · {(todayLogged-todayTarget).toLocaleString()} over</span>}
              </div>
            )}
          </div>

          {/* Tomorrow preview */}
          <div style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, color:"#aaa", fontWeight:600, marginBottom:2 }}>
                  Tomorrow · {DAY_FULL[tomorrowIdx]}
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:"#222" }}>
                  {tomorrowTarget.toLocaleString()} kcal
                  <span style={{ fontSize:11, fontWeight:400, color:"#aaa", marginLeft:6 }}>
                    ({CFG[WEEK_PATTERN[tomorrowIdx]].label} Day)
                  </span>
                </div>
                {todayLogged != null && tomorrowCarryOver !== 0 && (
                  <div style={{ fontSize:11, color: tomorrowCarryOver > 0 ? "#6b8c52" : "#b06a4e", marginTop:3 }}>
                    {tomorrowCarryOver > 0
                      ? `+${tomorrowCarryOver} kcal from today's deficit`
                      : `${tomorrowCarryOver} kcal from today's overage`}
                  </div>
                )}
                {todayLogged == null && (
                  <div style={{ fontSize:11, color:"#bbb", marginTop:3 }}>Log today to see adjusted target</div>
                )}
              </div>
              <div style={{ fontSize:28, opacity:0.3 }}>{WORKOUTS[DAY_TO_WORKOUT[tomorrowIdx]].emoji}</div>
            </div>
          </div>

          {/* Macros */}
          <div style={{ background:"#fff", borderRadius:16, padding:"16px", marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:12 }}>Target Macros</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"Protein", val:todayMac.protein, cal: todayMac.protein*4, color:"#b06a4e" },
                { label:"Carbs",   val:todayMac.carbs,   cal: todayMac.carbs*4,   color:"#6b8c52" },
                { label:"Fat",     val:todayMac.fat,     cal: todayMac.fat*9,     color:"#4a7a9b" },
              ].map(m=>(
                <div key={m.label} style={{ background:"#f8f6f3", borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:900, color:m.color }}>{m.val}</div>
                  <div style={{ fontSize:10, color:"#aaa", fontWeight:600 }}>g {m.label}</div>
                  <div style={{ fontSize:10, color:"#ccc", marginTop:2 }}>{m.cal} kcal</div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's workout teaser */}
          <div style={{ background:"#fff", borderRadius:16, padding:"16px", marginBottom:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#222" }}>Today's Workout</div>
              <button onClick={()=>setTab("workout")} style={{
                background:"none", border:"none", color:"#b06a4e", fontSize:12, fontWeight:700, cursor:"pointer"
              }}>View full →</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:28 }}>{todayWorkout.emoji}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#333" }}>{todayWorkout.type}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>{todayWorkout.focus} · {todayWorkout.calories}</div>
              </div>
            </div>
          </div>

          <button onClick={()=>setLD(todayIdx)} style={{
            width:"100%", padding:"14px", borderRadius:14, border:"none",
            background:"#1a1a1a", color:"#fff", fontSize:15, fontWeight:800,
            cursor:"pointer", letterSpacing:0.3
          }}>
            {todayLogged!=null ? "✏ Update Today's Log" : "+ Log Today's Calories"}
          </button>
        </div>
      )}

      {/* ── WEEK TAB ── */}
      {tab==="week" && (
        <div>
          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:14 }}>This Week</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
              {DAY_NAMES.map((name,i)=>{
                const type  = WEEK_PATTERN[i];
                const cfg   = CFG[type];
                const isToday = i===todayIdx;
                const logged  = log[i];
                // compute this day's adjusted target
                const prevIdx  = (i+6)%7;
                const prevLog  = log[prevIdx];
                const prevBase = BASE[WEEK_PATTERN[prevIdx]];
                const adj      = getCarryOver(prevLog, prevBase);
                const target   = Math.max(1200, BASE[type] + adj);
                const over     = logged != null && logged > target;
                return (
                  <div key={i} onClick={()=>setLD(i)}
                    style={{
                      background: isToday ? cfg.color : cfg.bg,
                      color: isToday ? "#fff" : "#333",
                      borderRadius:12, padding:"10px 4px",
                      textAlign:"center", cursor:"pointer",
                      border:`2px solid ${isToday ? cfg.color : "transparent"}`,
                      transition:"all 0.15s", position:"relative"
                    }}>
                    <div style={{ fontSize:10, fontWeight:700, opacity:0.8, letterSpacing:0.3 }}>{name}</div>
                    <div style={{ fontSize:11, fontWeight:800, margin:"4px 0 2px" }}>{cfg.label}</div>
                    <div style={{ fontSize:11, fontWeight:700 }}>{target.toLocaleString()}</div>
                    {logged!=null && (
                      <div style={{
                        position:"absolute", top:3, right:4,
                        width:12, height:12, borderRadius:"50%",
                        background: over?"#e07060":"#5a9e70",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:8, color:"#fff", fontWeight:800
                      }}>{over?"!":"✓"}</div>
                    )}
                    {logged!=null && (
                      <div style={{ fontSize:10, opacity:0.75, marginTop:2 }}>{logged.toLocaleString()}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:"#bbb", textAlign:"center", marginTop:10 }}>
              Green ✓ = on target · Red ! = over · Tap to log
            </div>
          </div>

          {loggedDays>0 && (
            <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:12 }}>Week Stats</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { label:"Days Logged",      val:`${loggedDays}/7`,        sub:"" },
                  { label:"Total This Week",   val:`${totalCals.toLocaleString()}`, sub:"kcal" },
                  { label:"Daily Average",     val:`${avgCals.toLocaleString()}`,   sub:"kcal/day" },
                  { label:"Proj. Weekly Loss", val:`~${projLbs}`,  sub:"lbs/wk" },
                ].map(s=>(
                  <div key={s.label} style={{ background:"#f8f6f3", borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:11, color:"#aaa", fontWeight:600, marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:"#222" }}>
                      {s.val} <span style={{ fontSize:11, fontWeight:400, color:"#bbb" }}>{s.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WORKOUT TAB ── */}
      {tab==="workout" && (
        <div>
          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:4 }}>4-Month Workout Plan</div>
            <div style={{ fontSize:12, color:"#aaa", marginBottom:12 }}>
              3 strength days · 1 HIIT · 1 Zone 2 cardio · 1 yoga & recovery · 1 full rest
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:4 }}>
              {[["💪","Strength","3×/wk"],["🔥","HIIT","1×/wk"],["🚶‍♀️","Cardio","1×/wk"],["🧘‍♀️","Yoga","2×/wk"]].map(([e,l,s])=>(
                <div key={l} style={{ background:"#f8f6f3", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:18 }}>{e}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#333", marginTop:4 }}>{l}</div>
                  <div style={{ fontSize:10, color:"#aaa" }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
          {WORKOUT_ORDER.map(day => <WorkoutCard key={day} dayKey={day}/>)}
          <div style={{ background:"#fdf1ec", borderRadius:14, padding:"14px 16px", marginTop:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#b06a4e", marginBottom:8 }}>📈 Progressive Overload</div>
            <div style={{ fontSize:12, color:"#888", lineHeight:1.6 }}>
              Every 2 weeks, try to add 2.5–5 lbs to your main lifts, or add 1 extra rep per set. 
              This keeps your muscles challenged and prevents plateaus. Track your weights!
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {tab==="plan" && (
        <div>
          {/* Auto-adjust banner */}
          <div style={{ background:"linear-gradient(135deg,#4a7a9b,#6b8c52)", borderRadius:16, padding:"14px 16px", marginBottom:14, color:"#fff" }}>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:4 }}>⚡ Auto-Adjusting Plan</div>
            <div style={{ fontSize:12, opacity:0.9, lineHeight:1.6 }}>
              Every time you update your weight, your TDEE, calorie targets, and macros recalculate automatically using the Mifflin-St Jeor formula. No manual math needed — just keep logging.
            </div>
          </div>

          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:4 }}>Your Numbers</div>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:14 }}>25F · 5'8" · {currentWeight} lbs · Mifflin-St Jeor · updates with weight</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                {label:"BMR",    val: bmr.toLocaleString(),        sub:"kcal (at rest)"},
                {label:"TDEE",   val: tdee.toLocaleString(),       sub:"kcal (with activity)"},
                {label:"Target", val: targetAvg.toLocaleString(),  sub:"kcal avg/day"},
                {label:"Deficit",val:`~${(tdee - targetAvg).toLocaleString()}`, sub:"kcal/day avg"},
              ].map(s=>(
                <div key={s.label} style={{ background:"#f8f6f3", borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:"#bbb", fontWeight:600, marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:"#222" }}>{s.val}</div>
                  <div style={{ fontSize:10, color:"#aaa" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:12 }}>Weekly Cycling Pattern</div>
            {Object.entries(CFG).map(([type, cfg])=>{
              const days = WEEK_PATTERN.map((d,i)=>d===type?DAY_NAMES[i]:null).filter(Boolean);
              const mac  = MACROS[type];
              return (
                <div key={type} style={{
                  background:cfg.bg, borderRadius:12, padding:"14px 16px",
                  marginBottom:10
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:cfg.color, marginBottom:2 }}>{cfg.label} Day</div>
                      <div style={{ fontSize:11, color:"#888" }}>{cfg.desc}</div>
                      <div style={{ fontSize:11, color:"#bbb", marginTop:2 }}>{days.join(", ")}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:cfg.color }}>{BASE[type].toLocaleString()}</div>
                      <div style={{ fontSize:10, color:"#aaa" }}>kcal</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginTop:10 }}>
                    {[
                      {l:"Protein", v:mac.protein, c:"#b06a4e"},
                      {l:"Carbs",   v:mac.carbs,   c:"#6b8c52"},
                      {l:"Fat",     v:mac.fat,      c:"#4a7a9b"},
                    ].map(m=>(
                      <div key={m.l} style={{ background:"rgba(255,255,255,0.6)", borderRadius:8, padding:"6px", textAlign:"center" }}>
                        <div style={{ fontSize:14, fontWeight:800, color:m.c }}>{m.v}g</div>
                        <div style={{ fontSize:10, color:"#aaa" }}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ background:"#f8f6f3", borderRadius:10, padding:"10px 14px", marginTop:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                <span style={{ color:"#777" }}>Weekly average</span>
                <strong style={{ color:"#222" }}>
                  {Math.round(WEEK_PATTERN.reduce((s,t)=>s+BASE[t],0)/7).toLocaleString()} kcal/day
                </strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                <span style={{ color:"#777" }}>Projected weekly loss</span>
                <strong style={{ color:"#6b8c52" }}>~1.2 lbs/week</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:"#777" }}>4-month projection</span>
                <strong style={{ color:"#b06a4e" }}>~19–24 lbs lost</strong>
              </div>
            </div>
          </div>

          {/* Next-day adjustment explanation */}
          <div style={{ background:"#eaf3f8", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#4a7a9b", marginBottom:8 }}>🔄 How Next-Day Adjustment Works</div>
            <div style={{ fontSize:12, color:"#555", lineHeight:1.7 }}>
              When you log your calories, the app looks at how far above or below your target you were, 
              and shifts the next day's calorie goal by the opposite amount — capped at ±300 kcal. 
              For example: eat 200 under → tomorrow gets +200. Eat 300 over → tomorrow gets −300. 
              This keeps your weekly average on track automatically.
            </div>
          </div>

          {/* Tips */}
          <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#222", marginBottom:14 }}>Key Rules</div>
            {[
              ["🥩","Hit protein daily","Aim for 145–155g every day regardless of day type. This protects muscle as you lose fat."],
              ["💧","Hydrate","80–100 oz of water daily. Drink a full glass before each meal."],
              ["📅","Weigh every Tuesday","Same time, same conditions. Expect fluctuation — the trend is what matters."],
              ["🏋️","Lift on HIGH days","Strength train Mon/Wed/Fri to make the most of your high-calorie refeed."],
              ["😴","Sleep 7–9 hours","Sleep deprivation raises cortisol and ghrelin (hunger hormone) — both stall fat loss."],
              ["📉","Expected pace","~1–1.5 lbs/week with the workout plan factored in. You'll likely hit goal in 4–5 months."],
            ].map(([icon,title,body])=>(
              <div key={title} style={{ display:"flex", gap:12, marginBottom:14 }}>
                <div style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#222" }}>{title}</div>
                  <div style={{ fontSize:12, color:"#999", marginTop:2, lineHeight:1.5 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log modal */}
      {loggingDay!==null && (
        <CalorieModal
          dayIdx={loggingDay}
          baseTarget={loggingDay===todayIdx ? todayBase : BASE[WEEK_PATTERN[loggingDay]]}
          adjustment={loggingDay===todayIdx ? todayCarryOver : 0}
          onSave={handleSaveCalories}
          onClose={()=>setLD(null)}
        />
      )}
    </div>
  );
}
