// Concert instruments follow Rob's canonical score order in
// BandsofAHS/references/instrument-order.md. Marching assignments follow the
// current Ascend 2026 part order and roster vocabulary.
export const BAND_PERIOD_OPTIONS = [
  "Murray Middle School",
  "1st Period",
  "2nd Period",
  "4th Period",
  "Not enrolled in an AHS band period"
];

export const ENSEMBLE_OPTIONS = ["Concert Band", "Percussion Ensemble", "Wind Ensemble", "Not currently assigned"];

export const CONCERT_INSTRUMENT_OPTIONS = [
  "Flute", "Oboe", "Bassoon", "Clarinet", "Bass Clarinet", "Alto Saxophone",
  "Tenor Saxophone", "Baritone Saxophone", "Trumpet", "Horn", "Trombone",
  "Euphonium", "Tuba", "Percussion"
];

export const MARCHING_ENROLLMENT_OPTIONS = ["Yes", "No"];
export const MARCHING_ROLE_OPTIONS = [
  "Drum Major", "Color Guard Member", "Wind Player", "Drumline Member",
  "Front Ensemble Member", "Support / Aide"
];

export const MARCHING_ASSIGNMENTS = {
  "Drum Major": ["Drum Major / Conductor"],
  "Color Guard Member": ["Flag", "Rifle", "Flag and Rifle", "Sabre", "Dance / Movement"],
  "Wind Player": [
    "Flute", "Clarinet", "Bass Clarinet", "Alto Saxophone", "Tenor Saxophone",
    "Baritone Saxophone", "Trumpet", "Mellophone", "Trombone", "Baritone / Euphonium", "Sousaphone"
  ],
  "Drumline Member": [
    "Snare Drum", "Tenors / Quads", "Cymbals", "Bass Drum 1", "Bass Drum 2",
    "Bass Drum 3", "Bass Drum 4", "Bass Drum 5"
  ],
  "Front Ensemble Member": [
    "Marimba 1", "Marimba 2", "Xylophone", "Bells", "Vibraphone 1", "Vibraphone 2",
    "Synthesizer 1", "Synthesizer 2", "Lead Guitar", "Rhythm Guitar", "Bass Guitar",
    "Timpani", "Drumset", "Rack 1", "Rack 2", "Auxiliary Percussion", "Trigger / Electronics"
  ],
  "Support / Aide": ["Band Aide", "Metronome Operator", "Equipment / Logistics"]
};

export function optionsWithCurrent(options, current) {
  const value = String(current || "").trim();
  return value && !options.includes(value) ? [value, ...options] : options;
}

