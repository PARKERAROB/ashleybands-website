/*
 * Marching Band Tycoon - game engine (pure logic, no DOM).
 * Loads in the browser as a global `MBT` and in Node via module.exports,
 * so the same code powers the UI and the headless playtest harness.
 *
 * Design notes:
 *  - One in-game YEAR = one marching season of SEASON_WEEKS weeks, then an offseason.
 *  - Each week the director takes ONE action (which advances the week) plus any
 *    number of instant purchases (buy instruments / hire staff) that do not.
 *  - Money has two buckets you cannot freely mix, mirroring a real program:
 *      operating  = student-tied dollars (fees, fundraising, gate money) -> running costs.
 *      capital    = program dollars (sponsors, grants, donations) -> instruments & staff.
 *  - Win by building a Program of Distinction (reputation hits 100).
 *  - Lose by going broke, losing every student, or a morale mutiny.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MBT = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---- Tunables -----------------------------------------------------------
  const CONFIG = {
    SEASON_WEEKS: 16,
    FOOTBALL_WEEKS: [3, 5, 7, 9, 11],
    PARADE_WEEK: 8,
    MPA_WEEK: 13, // Music Performance Adjudication (scored)
    FINALS_WEEK: 16, // season climax (scored, higher stakes)
    EVENT_CHANCE: 0.45, // chance a random event fires on an open week
    ACTION_ENERGY: 20,
    REST_ENERGY: 40,
    WEEKLY_ENERGY_RECOVERY: 8,
    UPKEEP_PER_STUDENT: 5, // operating $/week to run the program
    STAFF_SALARY: 100, // operating $/week per assistant
    INSTRUMENT_PRICE: 420, // capital $ per new instrument
    STAFF_HIRE_COST: 1500, // capital $ to hire an assistant
    WIN_REPUTATION: 100,
    LOSE_OPERATING: -1500,
    LOSE_MORALE: 0,
    LOSE_ROSTER: 0,
    LOG_LIMIT: 60,
  };

  // ---- Small RNG / math helpers ------------------------------------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const chance = (p) => Math.random() < p;
  const round = (v) => Math.round(v);

  function fmtMoney(n) {
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(round(n)).toLocaleString("en-US");
  }

  // ---- New game -----------------------------------------------------------
  function newGame() {
    return {
      version: 1,
      year: 1,
      week: 1,
      status: "playing", // playing | won | lost
      ending: null, // text when status != playing
      money: { operating: 1500, capital: 800 },
      roster: 28,
      instruments: 32, // capacity ceiling for roster
      condition: 70, // avg instrument condition 0..100
      skill: 38, // 0..100 musicianship
      morale: 62, // 0..100
      reputation: 18, // 0..100 (the Distinction track)
      energy: 100, // 0..100 director energy
      staff: 0,
      bestRating: null,
      pendingEvent: null, // serializable card awaiting a choice
      log: [],
      stats: { competitions: [], yearsCompleted: 0, weeksPlayed: 0 },
    };
  }

  // ---- Logging ------------------------------------------------------------
  function log(s, text, type) {
    s.log.unshift({ year: s.year, week: s.week, text, type: type || "info" });
    if (s.log.length > CONFIG.LOG_LIMIT) s.log.length = CONFIG.LOG_LIMIT;
  }

  // ---- Clamp every bounded stat after any mutation ------------------------
  function normalize(s) {
    s.skill = clamp(s.skill, 0, 100);
    s.morale = clamp(s.morale, 0, 100);
    s.reputation = clamp(s.reputation, 0, 100);
    s.energy = clamp(s.energy, 0, 100);
    s.condition = clamp(s.condition, 0, 100);
    s.roster = Math.max(0, round(s.roster));
    s.instruments = Math.max(0, round(s.instruments));
    s.staff = Math.max(0, round(s.staff));
  }

  // Effectiveness penalty when the director is running on empty.
  const effFactor = (s) => (s.energy < 20 ? 0.5 : 1);

  // ---- Weekly actions (each advances the week) ----------------------------
  // Each returns a short message describing what happened.
  const ACTIONS = {
    rehearse(s) {
      const gain = (randInt(2, 5) + (s.staff > 0 ? 1 : 0)) * effFactor(s);
      s.skill += gain;
      s.morale -= 3;
      s.energy -= CONFIG.ACTION_ENERGY;
      return `Sectionals and full-band run. Musicianship +${round(gain)}.`;
    },
    recruit(s) {
      const capacity = s.instruments - s.roster;
      if (capacity <= 0) {
        s.energy -= CONFIG.ACTION_ENERGY;
        return "Recruiting push, but you are out of instruments. Nobody could join.";
      }
      let added = randInt(2, 5) + Math.floor(s.reputation / 25);
      added = Math.min(added, capacity);
      added = round(added * effFactor(s));
      s.roster += added;
      s.money.operating -= added * 40;
      s.morale -= 1;
      s.energy -= CONFIG.ACTION_ENERGY;
      return added > 0
        ? `Recruiting drive lands ${added} new members.`
        : "Recruiting drive fizzles, nobody signs up.";
    },
    fundraise(s) {
      const take = round((randInt(150, 400) + s.roster * 4) * effFactor(s));
      s.money.operating += take;
      s.morale -= 2;
      s.energy -= CONFIG.ACTION_ENERGY;
      return `Fundraiser brings in ${fmtMoney(take)} (operating).`;
    },
    sponsor(s) {
      s.energy -= CONFIG.ACTION_ENERGY;
      const p = 0.35 + s.reputation / 200;
      if (chance(p)) {
        const take = round(randInt(500, 2000) + s.reputation * 10);
        s.money.capital += take;
        return `Landed a sponsor: ${fmtMoney(take)} (capital).`;
      }
      const small = randInt(0, 200);
      s.money.capital += small;
      return small > 0
        ? `No big sponsor, but small gifts add ${fmtMoney(small)} (capital).`
        : "No sponsor bit this week.";
    },
    community(s) {
      const m = randInt(4, 8);
      s.morale += m;
      s.reputation += 1;
      s.money.operating -= 100;
      s.energy -= 15;
      return `Community / team-building event. Morale +${m}, reputation +1.`;
    },
    rest(s) {
      const m = randInt(4, 8);
      s.morale += m;
      s.energy += CONFIG.REST_ENERGY;
      return `You take a breath and reset the room. Morale +${m}, energy restored.`;
    },
  };

  // ---- Instant purchases (do NOT advance the week) ------------------------
  function buyInstruments(s, n) {
    n = Math.max(1, round(n || 1));
    const cost = n * CONFIG.INSTRUMENT_PRICE;
    if (s.money.capital < cost)
      return { ok: false, msg: `Need ${fmtMoney(cost)} in capital for ${n} instrument(s).` };
    s.money.capital -= cost;
    s.instruments += n;
    // New horns pull the fleet's average condition upward.
    s.condition = (s.condition * (s.instruments - n) + 95 * n) / s.instruments;
    normalize(s);
    log(s, `Bought ${n} instrument(s) for ${fmtMoney(cost)}.`, "good");
    return { ok: true, msg: `Bought ${n} instrument(s).` };
  }

  function hireStaff(s) {
    if (s.money.capital < CONFIG.STAFF_HIRE_COST)
      return { ok: false, msg: `Hiring an assistant costs ${fmtMoney(CONFIG.STAFF_HIRE_COST)} in capital.` };
    s.money.capital -= CONFIG.STAFF_HIRE_COST;
    s.staff += 1;
    log(s, `Hired an assistant director. Rehearsals hit harder; payroll grows.`, "good");
    return { ok: true, msg: "Hired an assistant." };
  }

  // ---- Scheduled season beats --------------------------------------------
  function applyScheduled(s) {
    const w = s.week;
    if (CONFIG.FOOTBALL_WEEKS.includes(w)) {
      const gate = randInt(100, 300);
      s.money.operating += gate;
      s.morale += 2;
      s.reputation += 1;
      log(s, `Friday night lights. Halftime goes well. +${fmtMoney(gate)}, morale +2.`, "event");
    } else if (w === CONFIG.PARADE_WEEK) {
      const r = randInt(2, 4);
      s.reputation += r;
      s.morale += 2;
      s.energy -= 10;
      log(s, `Holiday parade. Long day, great exposure. Reputation +${r}.`, "event");
    } else if (w === CONFIG.MPA_WEEK) {
      runCompetition(s, "MPA", 1);
    } else if (w === CONFIG.FINALS_WEEK) {
      runCompetition(s, "State Finals", 1.5);
    }
  }

  function ratingFor(score) {
    if (score >= 88) return { roman: "I", name: "Superior" };
    if (score >= 74) return { roman: "II", name: "Excellent" };
    if (score >= 60) return { roman: "III", name: "Good" };
    if (score >= 45) return { roman: "IV", name: "Fair" };
    return { roman: "V", name: "Poor" };
  }

  function runCompetition(s, name, stakes) {
    const score =
      s.skill * 0.5 + s.morale * 0.18 + s.condition * 0.17 + s.reputation * 0.1 + rand(0, 8);
    const rating = ratingFor(score);
    const rewards = {
      I: { rep: 8, morale: 6, op: 600, cap: 400 },
      II: { rep: 4, morale: 3, op: 300, cap: 0 },
      III: { rep: 1, morale: 0, op: 150, cap: 0 },
      IV: { rep: -2, morale: -4, op: 0, cap: 0 },
      V: { rep: -5, morale: -7, op: 0, cap: 0 },
    }[rating.roman];
    s.reputation += rewards.rep * stakes;
    s.morale += rewards.morale;
    s.money.operating += rewards.op * stakes;
    s.money.capital += rewards.cap * stakes;
    s.stats.competitions.push({ year: s.year, name, rating: rating.name, score: round(score) });
    rememberBestRating(s, rating);
    const change = rewards.rep >= 0 ? `+${round(rewards.rep * stakes)}` : `${round(rewards.rep * stakes)}`;
    log(
      s,
      `${name}: ${rating.name} (${rating.roman}), score ${round(score)}. Reputation ${change}.`,
      rewards.rep >= 1 ? "good" : "bad"
    );
  }

  const RATING_ORDER = ["Poor", "Fair", "Good", "Excellent", "Superior"];
  function rememberBestRating(s, rating) {
    if (!s.bestRating || RATING_ORDER.indexOf(rating.name) > RATING_ORDER.indexOf(s.bestRating))
      s.bestRating = rating.name;
  }

  // ---- Random event deck (the part that mirrors your real year) ----------
  // Each choice mutates state and returns a result line for the log.
  const EVENTS = [
    {
      id: "bus",
      title: "The bus breaks down",
      text: "Game morning. The charter company calls: your bus has a 'mechanical issue.' Sound familiar?",
      choices: [
        {
          label: "Pay $800 for a scramble replacement",
          apply(s) {
            s.money.operating -= 800;
            s.morale += 1;
            return "You find a backup bus. Expensive, but the kids perform. Operating -$800.";
          },
        },
        {
          label: "Cancel the trip",
          apply(s) {
            s.reputation -= 4;
            s.morale -= 6;
            return "You cancel. The kids are crushed and word gets around. Reputation -4, morale -6.";
          },
        },
      ],
    },
    {
      id: "hvac",
      title: "A booster's offer",
      text: "A parent who owns an HVAC company offers $2,000 if you name this season's show after his business.",
      choices: [
        {
          label: "Take the money, name the show 'Cool Air: A Journey'",
          apply(s) {
            s.money.capital += 2000;
            s.reputation -= 2;
            s.morale -= 1;
            return "Capital +$2,000. The show title gets some side-eye. Reputation -2.";
          },
        },
        {
          label: "Decline, keep the artistic vision",
          apply(s) {
            s.reputation += 1;
            return "You decline gracefully. Your staff respects it. Reputation +1.";
          },
        },
      ],
    },
    {
      id: "star_quit",
      title: "Your drum major wants out",
      text: "Your best leader is overwhelmed and talking about quitting two weeks before finals.",
      choices: [
        {
          label: "Spend real time talking it through",
          apply(s) {
            s.energy -= 30;
            s.morale += 3;
            return "A long conversation. They stay, and the section feels it. Morale +3, energy -30.";
          },
        },
        {
          label: "Let them step away",
          apply(s) {
            s.skill -= 5;
            s.morale -= 4;
            return "They step down. The ensemble loses an anchor. Musicianship -5, morale -4.";
          },
        },
      ],
    },
    {
      id: "prodigy",
      title: "A freshman surprise",
      text: "A quiet freshman turns out to be a phenomenal player who lifts everyone around them.",
      choices: [
        {
          label: "Put them in a leadership spot",
          apply(s) {
            s.skill += 6;
            s.morale += 2;
            return "The whole section levels up. Musicianship +6, morale +2.";
          },
        },
      ],
    },
    {
      id: "grant",
      title: "A grant opening",
      text: "A local arts foundation has an instrument grant due Friday. The application is a slog.",
      choices: [
        {
          label: "Stay late and apply",
          apply(s) {
            s.energy -= 20;
            if (chance(0.5)) {
              s.money.capital += 3000;
              return "Funded! Capital +$3,000. Worth the late night.";
            }
            return "You apply. No word back this cycle. Energy -20.";
          },
        },
        {
          label: "Skip it this year",
          apply(s) {
            return "You let it go. There will be other cycles.";
          },
        },
      ],
    },
    {
      id: "broken_horn",
      title: "An instrument dies",
      text: "A school sousaphone finally gives up the ghost mid-rehearsal.",
      choices: [
        {
          label: "Repair it ($300)",
          apply(s) {
            s.money.operating -= 300;
            s.condition += 3;
            return "Back in service. Operating -$300, fleet condition nudges up.";
          },
        },
        {
          label: "Retire it",
          apply(s) {
            s.instruments -= 1;
            s.morale -= 2;
            return "One fewer horn in the room. Capacity -1, morale -2.";
          },
        },
      ],
    },
    {
      id: "parent",
      title: "A parent complaint",
      text: "A parent emails the principal about playing time before talking to you.",
      choices: [
        {
          label: "Meet them in person, hear it out",
          apply(s) {
            s.energy -= 15;
            s.reputation += 1;
            return "A calm meeting defuses it. Reputation +1, energy -15.";
          },
        },
        {
          label: "Let it sit in the inbox",
          apply(s) {
            s.reputation -= 2;
            return "It festers and spreads. Reputation -2.";
          },
        },
      ],
    },
    {
      id: "pizza",
      title: "The room is dragging",
      text: "Energy is low after a brutal week of rehearsals. A pizza party would help.",
      choices: [
        {
          label: "Throw the party ($150)",
          apply(s) {
            s.money.operating -= 150;
            s.morale += 8;
            return "Pizza fixes a lot. Morale +8, operating -$150.";
          },
        },
        {
          label: "Push through, no party",
          apply(s) {
            s.morale -= 1;
            return "You push on. The room stays a little flat.";
          },
        },
      ],
    },
    {
      id: "news",
      title: "Local news comes calling",
      text: "A TV reporter wants to feature the band's halftime show on the evening news.",
      choices: [
        {
          label: "Roll out the red carpet",
          apply(s) {
            s.reputation += 5;
            s.morale += 3;
            return "Great segment. The whole town sees it. Reputation +5, morale +3.";
          },
        },
      ],
    },
    {
      id: "heat",
      title: "Heat wave at band camp",
      text: "It is 98 degrees on the practice field and kids are wilting.",
      choices: [
        {
          label: "Buy water, ice, and shade ($100)",
          apply(s) {
            s.money.operating -= 100;
            s.morale -= 1;
            return "You keep everyone safe and going. Operating -$100, morale -1.";
          },
        },
        {
          label: "Tough it out",
          apply(s) {
            s.morale -= 5;
            return "A rough, miserable day on the field. Morale -5.";
          },
        },
      ],
    },
    {
      id: "alumni",
      title: "An alum gives back",
      text: "A former student, now doing well, mails the program a check out of nowhere.",
      choices: [
        {
          label: "Write a heartfelt thank-you",
          apply(s) {
            s.money.capital += 1000;
            s.reputation += 1;
            return "Capital +$1,000, and the relationship deepens. Reputation +1.";
          },
        },
      ],
    },
    {
      id: "rivalry",
      title: "Drumline vs. brass",
      text: "A turf war is brewing between the battery and the brass. It is getting personal.",
      choices: [
        {
          label: "Run a team-building night",
          apply(s) {
            s.energy -= 15;
            s.morale += 5;
            return "You get them in one room and it clicks. Morale +5, energy -15.";
          },
        },
        {
          label: "Tell them to grow up",
          apply(s) {
            s.morale -= 3;
            return "It simmers under the surface. Morale -3.";
          },
        },
      ],
    },
    {
      id: "uniform",
      title: "Wardrobe malfunction",
      text: "Half the uniforms come back from storage with broken zippers, right before a show.",
      choices: [
        {
          label: "Emergency repairs ($200)",
          apply(s) {
            s.money.operating -= 200;
            return "Fixed in time. Nobody in the stands ever knows. Operating -$200.";
          },
        },
        {
          label: "Safety-pin it and pray",
          apply(s) {
            s.reputation -= 2;
            return "A couple of visible mishaps on the field. Reputation -2.";
          },
        },
      ],
    },
    {
      id: "shortfall",
      title: "Fee shortfall",
      text: "A chunk of families could not pay their band fees this year, and it is nobody's fault.",
      choices: [
        {
          label: "Cover it from the program, no kid left out",
          apply(s) {
            s.money.operating -= 400;
            s.morale += 2;
            return "Every kid marches. Operating -$400, morale +2.";
          },
        },
        {
          label: "Hold a quick extra fundraiser",
          apply(s) {
            s.money.operating += randInt(100, 300);
            s.morale -= 2;
            return "You scramble and recover some of it, but the kids are tired of selling.";
          },
        },
      ],
    },
    {
      id: "second_instrument",
      title: "A kid wants to double",
      text: "A dedicated student asks to learn a second instrument to fill a hole in the ensemble.",
      choices: [
        {
          label: "Coach them through it",
          apply(s) {
            s.energy -= 10;
            s.skill += 3;
            s.morale += 2;
            return "They pick it up fast and plug the gap. Musicianship +3, morale +2.";
          },
        },
      ],
    },
  ];
  const EVENTS_BY_ID = {};
  EVENTS.forEach((e) => (EVENTS_BY_ID[e.id] = e));

  // Build the serializable card stored on state (no functions).
  function toCard(ev) {
    return {
      id: ev.id,
      title: ev.title,
      text: ev.text,
      choices: ev.choices.map((c) => ({ label: c.label })),
    };
  }

  function drawEvent(s) {
    const ev = EVENTS[randInt(0, EVENTS.length - 1)];
    s.pendingEvent = toCard(ev);
  }

  // ---- The weekly tick ----------------------------------------------------
  function applyWeeklyDrift(s) {
    s.morale -= 1; // the grind
    s.condition -= 1.5; // wear and tear
    s.energy += CONFIG.WEEKLY_ENERGY_RECOVERY;
    s.money.operating -= s.roster * CONFIG.UPKEEP_PER_STUDENT + s.staff * CONFIG.STAFF_SALARY;
    // Low morale bleeds members.
    if (s.morale < 40 && chance(0.5)) {
      const lost = randInt(1, 2);
      s.roster -= lost;
      log(s, `${lost} student(s) quit over low morale.`, "bad");
    }
  }

  // Take a weekly action. Returns the (mutated) state. If a random event
  // fires, state.pendingEvent is set and the week is NOT yet finalized -
  // the UI must call resolveEvent() to continue.
  function takeWeek(s, actionId) {
    if (s.status !== "playing" || s.pendingEvent) return s;
    const action = ACTIONS[actionId];
    if (!action) return s;

    const msg = action(s);
    log(s, msg, "action");
    applyWeeklyDrift(s);
    applyScheduled(s);
    normalize(s);

    const scheduledThisWeek =
      CONFIG.FOOTBALL_WEEKS.includes(s.week) ||
      s.week === CONFIG.PARADE_WEEK ||
      s.week === CONFIG.MPA_WEEK ||
      s.week === CONFIG.FINALS_WEEK;

    if (!scheduledThisWeek && chance(CONFIG.EVENT_CHANCE)) {
      drawEvent(s);
      return s; // wait for the player's choice
    }
    finalizeWeek(s);
    return s;
  }

  // Resolve the pending event choice, then finalize the week.
  function resolveEvent(s, choiceIndex) {
    if (!s.pendingEvent) return s;
    const ev = EVENTS_BY_ID[s.pendingEvent.id];
    const choice = ev && ev.choices[choiceIndex];
    if (choice) {
      const result = choice.apply(s);
      log(s, `${ev.title}: ${result}`, "event");
    }
    s.pendingEvent = null;
    normalize(s);
    finalizeWeek(s);
    return s;
  }

  function finalizeWeek(s) {
    s.stats.weeksPlayed += 1;
    normalize(s);
    if (checkEndConditions(s)) return;
    s.week += 1;
    if (s.week > CONFIG.SEASON_WEEKS) runOffseason(s);
    checkEndConditions(s);
  }

  // ---- Offseason ----------------------------------------------------------
  function runOffseason(s) {
    s.stats.yearsCompleted += 1;
    const grads = round(s.roster * rand(0.15, 0.25));
    s.roster -= grads;
    const skillDrop = randInt(3, 7);
    s.skill -= skillDrop;
    s.condition -= 8;
    // Reputation drives the incoming class.
    const incoming = Math.round(s.reputation / 4) + randInt(3, 8);
    const capacity = Math.max(0, s.instruments - s.roster);
    const joined = Math.min(incoming, capacity);
    s.roster += joined;
    s.morale = clamp(s.morale + 5, 0, 100); // fresh-year optimism
    s.energy = 100;
    s.year += 1;
    s.week = 1;
    normalize(s);
    log(
      s,
      `--- Offseason: ${grads} seniors graduate, ${joined} rookies join. Musicianship dips, the room resets. Welcome to Year ${s.year}. ---`,
      "season"
    );
  }

  // ---- Win / lose ---------------------------------------------------------
  function checkEndConditions(s) {
    if (s.status !== "playing") return true;
    if (s.reputation >= CONFIG.WIN_REPUTATION) {
      s.status = "won";
      s.ending =
        `Program of Distinction. After ${s.year} year(s), your band is the standard ` +
        `everyone else measures against. Best result on the field: ${s.bestRating || "n/a"}.`;
      log(s, "PROGRAM OF DISTINCTION. You built it.", "win");
      return true;
    }
    if (s.money.operating <= CONFIG.LOSE_OPERATING) {
      s.status = "lost";
      s.ending = "The program ran out of money and got defunded. The doors close.";
      log(s, "Defunded. The program folds.", "lose");
      return true;
    }
    if (s.roster <= CONFIG.LOSE_ROSTER) {
      s.status = "lost";
      s.ending = "There is no one left to teach. The program is gone.";
      log(s, "No students left.", "lose");
      return true;
    }
    if (s.morale <= CONFIG.LOSE_MORALE) {
      s.status = "lost";
      s.ending = "Morale collapsed. The room walked out. You cannot run a band alone.";
      log(s, "Morale mutiny. The room is empty.", "lose");
      return true;
    }
    return false;
  }

  // ---- Save / load (resilient to storage being blocked on file://) -------
  const SAVE_KEY = "mbt_save_v1";
  function save(s) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }
  function load() {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearSave() {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }

  return {
    CONFIG,
    newGame,
    takeWeek,
    resolveEvent,
    buyInstruments,
    hireStaff,
    fmtMoney,
    ratingFor,
    save,
    load,
    clearSave,
    SAVE_KEY,
    ACTIONS,
    EVENTS,
  };
});
