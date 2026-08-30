/*
 * data.js — Researched facts about Starcloud-1 and its TLE.
 * Sources: Starcloud, NVIDIA, GeekWire, DCD, SpaceNews, TechCrunch,
 * Gunter's Space Page, SatNOGS DB. Compiled Aug 2026.
 */

const SATELLITE = {
  name: "STARCLOUD-1",
  formerName: "Lumen-1",
  noradId: "66303",
  intlDesignator: "2025-248L",
  operator: "Starcloud, Inc.",
  bus: "Astro Digital Corvus-Micro",
  massKg: 60,
  sizeNote: "roughly the size of a small refrigerator",
  payload: "A single NVIDIA H100 — the first data-center-class GPU ever flown in orbit.",

  launch: {
    dateLabel: "2 November 2025",
    vehicle: "SpaceX Falcon 9 — Bandwagon rideshare mission",
    site: "Cape Canaveral Space Force Station, Florida"
  },

  missionLifetimeMonths: 11,

  tle: {
    line1: "1 66303U 25248L   26207.16029198  .00005005  00000-0  22976-3 0  9991",
    line2: "2 66303  45.3997 271.0639 0006322 268.1150  91.9012 15.21652070 40477",
    epochLabel: "26 Jul 2026 (UTC)",
    source: "Space-Track.org, via SatNOGS DB"
  },

  liveTleUrl: "https://celestrak.org/NORAD/elements/gp.php?CATNR=66303&FORMAT=TLE",

  milestones: [
    { date: "2 Nov 2025", text: "Launches aboard a SpaceX Falcon 9 and separates cleanly into orbit; Starcloud confirms stable attitude control and full battery health within hours." },
    { date: "10 Dec 2025", text: "Trains NanoGPT — Andrej Karpathy's compact GPT architecture — on a Shakespeare text corpus, the first language model ever trained in orbit." },
    { date: "Dec 2025", text: "Runs inference with a Gemma/Gemini-class model on board, another first for space-based computing." },
    { date: "30 Mar 2026", text: "Starcloud closes a $170M Series A at a $1.1B valuation, becoming the fastest company to reach unicorn status in Y Combinator's history." },
    { date: "21 Aug 2026", text: "Raises a $250M Series A extension at a $2.3B valuation, joined by new investor NVIDIA." }
  ],

  company: {
    name: "Starcloud",
    founded: "January 2024, El Segundo, CA",
    hq: "Redmond, Washington",
    founders: "Philip Johnston (CEO), Ezra Feilden (CTO), Adi Oltean (Chief Engineer)",
    thesis: "Move AI compute into orbit to draw on near-continuous solar power and the vacuum of space as a heat sink — sidestepping the land, water and grid constraints that limit terrestrial data centers."
  },

  whatsNext: "Starcloud-2 is next, carrying an NVIDIA Blackwell B200 with roughly 100x the power generation of Starcloud-1, with limited commercial access planned through neocloud partner Crusoe from early 2027. Further out, Starcloud has pitched a 5-gigawatt orbital data center carried on a solar array approximately 4 km on a side."
};

// Fallback constants used only if the live TLE fetch is unavailable (offline, or blocked by the browser).
const FALLBACK_NOTE = "Showing the last known trajectory (TLE epoch " + SATELLITE.tle.epochLabel + "). Live tracking data could not be reached.";
