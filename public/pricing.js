/*
  AB_Creative pricing.
  The website (browser) and the invoice email function (server) both load this file,
  so the price a client sees is the price the invoice is built from.
  Change prices in CONFIG below.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ABPricing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CONFIG = {
    business: "AB_Creative",
    owner: "Avery",
    nonRefundable: true,
    depositDays: 3, // deposit is due this many days after the quote
    freeMiles: 30,
    perMile: 0.6,
    minHr: 50, // never quote below this per shooting hour
    commercialPct: 15,
    incl: "All of your best edited photos in an online gallery",
    svc: {
      wedding: { label: "Wedding", noun: "wedding", base: 1000, big: 0, hrs: 6, xhr: 100, min: 1000, ppl: 100, xppl: 1, loc: 2, xloc: 50, peak: 10, rush: 100, ret: 30, due: 30 },
      elopement: { label: "Elopement or intimate wedding", noun: "elopement", base: 600, big: 0, hrs: 2, xhr: 100, min: 600, ppl: 10, xppl: 10, loc: 1, xloc: 50, peak: 5, rush: 75, ret: 50, due: 14 },
      couples: { label: "Couples or engagement session", noun: "couples session", base: 200, big: 0, hrs: 1, xhr: 75, min: 200, ppl: 2, xppl: 10, loc: 1, xloc: 25, peak: 0, rush: 50, ret: 50, due: 7 },
      family: { label: "Family session", noun: "family session", base: 250, big: 300, hrs: 1, xhr: 75, min: 250, ppl: 6, xppl: 0, loc: 1, xloc: 25, peak: 0, rush: 50, ret: 50, due: 7 },
      individual: { label: "Individual portraits", noun: "portrait session", base: 150, big: 0, hrs: 1, xhr: 75, min: 150, ppl: 1, xppl: 10, loc: 1, xloc: 25, peak: 0, rush: 50, ret: 50, due: 7 },
      other: { label: "Other session", noun: "photo session", base: 200, big: 0, hrs: 1, xhr: 75, min: 200, ppl: 6, xppl: 10, loc: 1, xloc: 25, peak: 0, rush: 50, ret: 50, due: 7 }
    },
    addons: {
      second: { def: 250 },
      engage: { def: 200 },
      album: { def: 250 },
      film: { wedding: 200, elopement: 125, def: 75 },
      prints: { def: 60 }
    }
  };

  const ALL = ["wedding", "elopement", "couples", "family", "individual", "other"];
  const ADDONS = [
    { id: "second", label: "Second photographer", svc: ["wedding"] },
    { id: "engage", label: "Engagement session with your wedding", svc: ["wedding"] },
    { id: "album", label: "Printed album", svc: ["wedding", "elopement"] },
    { id: "film", label: "Film photography", svc: ALL },
    { id: "prints", label: "Print package", svc: ALL }
  ];
  // [id, label, one-way miles from Wichita]
  const TOWNS = [
    ["wichita", "Wichita", 0], ["derby", "Derby", 13], ["andover", "Andover", 15], ["haysville", "Haysville", 10],
    ["maize", "Maize", 10], ["goddard", "Goddard", 16], ["parkcity", "Park City", 8], ["belaire", "Bel Aire", 10],
    ["newton", "Newton", 28], ["eldorado", "El Dorado", 28], ["winfield", "Winfield", 43], ["hutchinson", "Hutchinson", 52],
    ["other", "Another town (Avery will confirm travel)", 0]
  ];
  const VIBES = ["Light and airy", "Warm and film-like", "Moody and dramatic", "Candid and documentary", "Classic and posed", "Bright and colorful"];
  const BUDGETS = [["u500", "Under $500"], ["500", "$500 to $1,000"], ["1000", "$1,000 to $2,500"], ["2500", "$2,500 to $4,000"], ["4000", "$4,000 or more"], ["unsure", "Not sure yet"]];
  const FLEX = ["This exact date only", "Flexible by a few days", "Flexible within a month", "Open to suggestions"];

  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtHrs = (h) => (h < 1 ? Math.round(h * 60) + " minutes" : h === 1 ? "1 hour" : h + " hours");
  const clamp = (n, lo, hi) => { n = Number(n); if (!isFinite(n)) n = lo; return Math.min(hi, Math.max(lo, n)); };
  const str = (x, max) => String(x == null ? "" : x).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
  const addDays = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const todayCT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const isPeak = (d) => {
    if (!d) return false;
    const t = new Date(d + "T12:00:00Z"), m = t.getUTCMonth(), w = t.getUTCDay();
    return m >= 4 && m <= 9 && (w === 5 || w === 6);
  };
  const addonPrice = (S, id, svc) => { const p = S.addons[id]; return p[svc] !== undefined ? p[svc] : p.def; };

  function calc(S, a) {
    const v = S.svc[a.service], L = [];
    const add = (t, n) => { n = Math.round(n); if (n) L.push([t, n]); return n; };
    let core = 0;
    const big = v.big > 0 && a.people > v.ppl;
    const xh = Math.max(0, a.hours - v.hrs), xp = big ? 0 : Math.max(0, a.people - v.ppl), xl = Math.max(0, a.locations - v.loc);
    core += add(v.label + (big ? " (larger group)" : "") + " (" + fmtHrs(v.hrs) + " included)", big ? v.big : v.base);
    core += add("Extra coverage (" + fmtHrs(xh) + ")", xh * v.xhr);
    core += add("Extra people (" + xp + ")", xp * v.xppl);
    core += add("Extra locations (" + xl + ")", xl * v.xloc);
    ADDONS.forEach((x) => { if (a.adds.includes(x.id) && x.svc.includes(a.service)) core += add(x.label, addonPrice(S, x.id, a.service)); });
    core += add("Custom: " + (a.customLabel || "add-on"), a.customAmt);
    const pk = a.dateType === "peak" ? v.peak : 0;
    const bz = a.usage === "business" && (a.service === "individual" || a.service === "other") ? S.commercialPct : 0;
    const mi = Math.max(0, a.miles - S.freeMiles);
    let raw = core;
    raw += add("Peak date (+" + pk + "%)", (core * pk) / 100);
    raw += add("Business use (+" + bz + "%)", (core * bz) / 100);
    raw += add("Travel (" + Math.round(mi) + " miles past " + S.freeMiles + ")", mi * S.perMile);
    if (a.rush === "rush") raw += add("Faster delivery", v.rush);
    if (a.adjust) raw += add("Adjustment" + (a.adjustNote ? ": " + a.adjustNote : ""), a.adjust);
    const hrFloor = a.hours * S.minHr, floor = Math.max(v.min, hrFloor);
    const minApplied = raw < floor, base = Math.max(raw, floor), final = Math.ceil(base / 5) * 5;
    if (minApplied) L.push([hrFloor > v.min ? "Minimum $" + S.minHr + " per hour applied" : "Minimum price applied", Math.round(floor - raw)]);
    if (final > base) L.push(["Rounded up to the next $5", Math.round(final - base)]);
    const deposit = Math.round((final * v.ret) / 100 / 5) * 5;
    return { v, L, raw, final, deposit, balance: final - deposit, minApplied };
  }

  // Deposit is due a few days after the quote. The rest is due `due` days before the session.
  function dueDates(S, v, date, today) {
    let depositDue = addDays(today, S.depositDays);
    if (!date) return { depositDue, balanceDue: null, payAtOnce: false };
    if (depositDue >= date) depositDue = addDays(date, -1) <= today ? today : addDays(date, -1);
    let balanceDue = addDays(date, -v.due), payAtOnce = false;
    if (balanceDue <= depositDue) { balanceDue = depositDue; payAtOnce = true; }
    return { depositDue, balanceDue, payAtOnce };
  }

  function includedList(S, a) {
    const out = [fmtHrs(a.hours) + " of photography", a.locations + (a.locations === 1 ? " location" : " locations")];
    if (S.incl) out.push(S.incl);
    ADDONS.forEach((x) => { if (a.adds.includes(x.id) && x.svc.includes(a.service)) out.push(x.label); });
    if (a.rush === "rush") out.push("Faster delivery");
    if (a.travelTbd) out.push("Travel (if any) confirmed by " + S.owner);
    return out;
  }

  // Turns whatever the browser sent into safe, known values.
  function clean(raw, S, today) {
    S = S || CONFIG; today = today || todayCT();
    const r = raw || {}, errs = [];
    const service = S.svc[r.service] ? r.service : "";
    if (!service) errs.push("Please choose what you'd like to book.");
    const v = service ? S.svc[service] : S.svc.other;
    let date = str(r.date, 10);
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + "T12:00:00Z"))) { errs.push("That date doesn't look right."); date = ""; }
      else if (date <= today) { errs.push("Please pick a date after today."); date = ""; }
    }
    const maxH = service === "wedding" ? 14 : service === "elopement" ? 6 : 4;
    const hoursIn = r.hours === undefined || r.hours === "" || r.hours === null ? v.hrs : r.hours;
    const hours = Math.round(clamp(hoursIn, 0.5, maxH) * 2) / 2;
    if (!(Number(r.people) >= 1)) errs.push("Please tell us how many people will be in the photos.");
    const people = Math.round(clamp(r.people, 1, 500));
    const locations = Math.round(clamp(r.locations === undefined || r.locations === "" ? v.loc : r.locations, 1, 6));
    const town = TOWNS.find((t) => t[0] === r.town) || TOWNS[0];
    const adds = [...new Set((Array.isArray(r.adds) ? r.adds : []).filter((id) => ADDONS.some((x) => x.id === id && x.svc.includes(service))))];
    const a = {
      service, date, dateType: isPeak(date) ? "peak" : "std", hours, people, locations,
      miles: town[2], travelTbd: town[0] === "other", adds,
      rush: r.rush === "rush" ? "rush" : "std", usage: r.usage === "business" ? "business" : "personal",
      customLabel: "", customAmt: 0, adjust: 0, adjustNote: ""
    };
    const name = str(r.name, 80), email = str(r.email, 120).toLowerCase();
    if (!name) errs.push("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push("Please add a valid email so we can send your invoice.");
    const pick = (x, list) => (list.includes(x) ? x : "");
    const contact = { name, email, phone: str(r.phone, 30), pref: pick(r.pref, ["Text", "Email", "Either"]), source: str(r.source, 100) };
    const extra = {
      flex: pick(r.flex, FLEX), town: town[1], venue: str(r.venue, 120), occasion: str(r.occasion, 40), purpose: str(r.purpose, 40),
      famWho: str(r.famWho, 400), vibe: (Array.isArray(r.vibe) ? r.vibe : []).filter((x) => VIBES.includes(x)),
      must: str(r.must, 800), budget: (BUDGETS.find((b) => b[0] === r.budget) || ["", ""])[1], notes: str(r.notes, 800)
    };
    return { errs, a, contact, extra, action: r.action === "consult" ? "consult" : "invoice" };
  }

  function quote(raw, S, today) {
    S = S || CONFIG; today = today || todayCT();
    const c = clean(raw, S, today);
    if (c.errs.length) return c;
    const r = calc(S, c.a);
    return Object.assign(c, { r, dates: dueDates(S, r.v, c.a.date, today), included: includedList(S, c.a), today });
  }

  return { CONFIG, ALL, ADDONS, TOWNS, VIBES, BUDGETS, FLEX, money, fmtHrs, fmtDate, addDays, todayCT, isPeak, addonPrice, calc, dueDates, includedList, clean, quote };
});
