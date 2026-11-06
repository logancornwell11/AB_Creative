/*
  Receives a quote request from the website, rebuilds the price on the server,
  emails the client their invoice (deposit amount and due dates) and emails Avery the details.

  Environment variables (set in Netlify > Site configuration > Environment variables):
    RESEND_API_KEY      required   API key from resend.com
    AVERY_EMAIL         required   where new requests are sent
    FROM_EMAIL          optional   e.g. "AB_Creative <hello@yourdomain.com>" (must be a sender you verified in Resend)
    PAY_INSTRUCTIONS    optional   how clients pay, e.g. "Venmo @your-handle, or Zelle to 316-555-0100"
*/
const P = require("../../public/pricing.js");

const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ").trim();
const dateText = (d, empty) => (d ? P.fmtDate(d) : empty);

function invoiceNumber(today) {
  return "ABC-" + today.replace(/-/g, "").slice(2) + "-" + String(Math.floor(100 + Math.random() * 900));
}

function clientInvoice(q, inv, env) {
  const S = P.CONFIG, { a, contact, r, dates, included } = q;
  const first = contact.name.split(/\s+/)[0];
  const dep = P.money(r.deposit), bal = P.money(r.balance), tot = P.money(r.final);
  const depDue = dateText(dates.depositDue);
  const balDue = dates.balanceDue ? dateText(dates.balanceDue) : S.svc[a.service].due + " days before your session (we'll set the exact day once your date is confirmed)";
  const pay = env.PAY_INSTRUCTIONS || "Reply to this email and I'll send you payment details.";
  const why = S.nonRefundable ? "Your deposit holds your date and is non-refundable, so I can keep that day open just for you." : "Your deposit holds your date.";
  const rows = [
    ["Session", S.svc[a.service].label],
    ["Date", a.date ? dateText(a.date) : "To be decided"],
    ["Total", tot],
    ["Deposit to hold your date", dep + " (due " + depDue + ")"],
    [dates.payAtOnce ? "Remaining, due with your deposit" : "Remaining", bal + " (due " + balDue + ")"]
  ];
  const text = [
    "Hi " + first + "!", "",
    "Thanks so much for building your quote with AB_Creative. Here is your invoice.", "",
    "Invoice " + inv,
    ...rows.map((x) => x[0] + ": " + x[1]), "",
    "Your session includes:", ...included.map((x) => "- " + x), "",
    "How to pay: " + pay, "",
    why, "",
    "Questions, or want to change anything? Just reply to this email.", "",
    S.owner + "\nAB_Creative, Wichita, Kansas"
  ].join("\n");
  const html = `<div style="background:#EFE5D2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#33211C">
<div style="max-width:560px;margin:0 auto;background:#FCF1DA;border-top:8px dashed #D8341C">
<div style="padding:28px 28px 8px"><div style="font-size:26px;font-weight:bold;color:#C23F1A">AB_Creative</div>
<p style="font-size:16px;line-height:1.5">Hi ${esc(first)}!<br>Thanks so much for building your quote. Here is your invoice.</p>
<p style="font-size:13px;color:#6C5A4A;margin:0">Invoice ${esc(inv)}</p></div>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 0">
${rows.map((x, i) => `<tr><td style="padding:10px 28px;border-top:1px solid #E3D3B4;font-size:14px;color:#6C5A4A;width:38%">${esc(x[0])}</td><td style="padding:10px 28px;border-top:1px solid #E3D3B4;font-size:${i >= 2 ? 16 : 14}px;font-weight:${i >= 2 ? "bold" : "normal"}">${esc(x[1])}</td></tr>`).join("")}
</table>
<div style="padding:18px 28px 6px;font-size:14px;line-height:1.5"><b>Your session includes</b><ul style="margin:6px 0 0;padding-left:20px">${included.map((x) => "<li>" + esc(x) + "</li>").join("")}</ul></div>
<div style="margin:16px 28px;padding:14px;background:#F7D3D9;font-size:14px;line-height:1.5"><b>How to pay</b><br>${esc(pay)}</div>
<p style="padding:0 28px;font-size:14px;line-height:1.5">${esc(why)}</p>
<p style="padding:0 28px 28px;font-size:14px;line-height:1.5">Questions, or want to change anything? Just reply to this email.<br><br>${esc(S.owner)}<br>AB_Creative, Wichita, Kansas</p>
</div></div>`;
  return { subject: oneLine("Your AB_Creative invoice: " + dep + " deposit due " + depDue), text, html };
}

function clientConsult(q) {
  const S = P.CONFIG, { contact, r, a } = q;
  const first = contact.name.split(/\s+/)[0];
  const text = ["Hi " + first + "!", "",
    "Thanks for reaching out to AB_Creative. " + S.owner + " got your request and will contact you soon to set up a consultation" + (contact.pref ? " (you prefer " + contact.pref.toLowerCase() + ")" : "") + ".", "",
    "Your estimate for your " + S.svc[a.service].noun + " was " + P.money(r.final) + ". We can adjust it together when we talk.", "",
    S.owner + "\nAB_Creative, Wichita, Kansas"].join("\n");
  const html = `<div style="background:#EFE5D2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#33211C"><div style="max-width:560px;margin:0 auto;background:#FCF1DA;border-top:8px dashed #D8341C;padding:28px"><div style="font-size:26px;font-weight:bold;color:#C23F1A">AB_Creative</div>${text.split("\n\n").slice(0, -1).map((p) => `<p style="font-size:16px;line-height:1.5">${esc(p)}</p>`).join("")}<p style="font-size:16px;line-height:1.5">${esc(S.owner)}<br>AB_Creative, Wichita, Kansas</p></div></div>`;
  return { subject: "We got your consultation request", text, html };
}

function averyNotice(q, inv, invoiceSent) {
  const S = P.CONFIG, { a, contact, extra, r, dates } = q;
  const lines = [
    ["Request", q.action === "consult" ? "Wants a consultation first" : "Invoice emailed to client (" + inv + ")"],
    ["Name", contact.name], ["Email", contact.email], ["Phone", contact.phone], ["Prefers", contact.pref], ["Heard about you via", contact.source],
    ["Session", S.svc[a.service].label], ["Date", a.date ? dateText(a.date) : "Not chosen"], ["Date flexibility", extra.flex],
    ["Town", extra.town + (a.travelTbd ? " (confirm travel)" : "")], ["Venue or spot", extra.venue],
    ["Hours", P.fmtHrs(a.hours)], ["People", a.people], ["Locations", a.locations],
    ["Occasion", extra.occasion], ["Photos are for", extra.purpose], ["Business use", a.usage === "business" ? "Yes" : ""],
    ["Who is in the photos", extra.famWho], ["Style words", extra.vibe.join(", ")], ["Must-have shots", extra.must],
    ["Extras", a.adds.join(", ")], ["Faster delivery", a.rush === "rush" ? "Yes" : ""], ["Budget range", extra.budget], ["Notes", extra.notes],
    ["Quote total", P.money(r.final)], ["Deposit", P.money(r.deposit) + " due " + dateText(dates.depositDue)],
    ["Remaining", P.money(r.balance) + (dates.balanceDue ? " due " + dateText(dates.balanceDue) : " (date not set)")]
  ].filter((x) => x[1] !== "" && x[1] !== undefined);
  const text = lines.map((x) => x[0] + ": " + x[1]).join("\n") + (invoiceSent === false ? "\n\nNote: the invoice email to the client did not send. Please contact them." : "");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#33211C"><table style="border-collapse:collapse">${lines.map((x) => `<tr><td style="padding:4px 14px 4px 0;color:#6C5A4A;vertical-align:top">${esc(x[0])}</td><td style="padding:4px 0">${esc(x[1])}</td></tr>`).join("")}</table>${invoiceSent === false ? '<p style="color:#8E1F10"><b>The invoice email to the client did not send. Please contact them.</b></p>' : ""}</div>`;
  const what = q.action === "consult" ? "Consultation request" : "New quote";
  return { subject: oneLine(what + ": " + contact.name + ", " + S.svc[a.service].label + (a.date ? ", " + a.date : "")), text, html };
}

async function send(env, msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.RESEND_API_KEY },
    body: JSON.stringify(msg)
  });
  if (!res.ok) throw new Error("Email service answered " + res.status);
}

exports.handler = async (event) => {
  const env = process.env;
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });
  if ((event.body || "").length > 20000) return json(413, { error: "That request is too large." });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "That request could not be read." }); }
  if (body.website) return json(200, { ok: true }); // hidden field that only bots fill in

  const today = env.AB_TODAY || P.todayCT();
  const q = P.quote(body, P.CONFIG, today);
  if (q.errs.length) return json(400, { error: q.errs[0], errors: q.errs });
  if (!env.RESEND_API_KEY || !env.AVERY_EMAIL) return json(500, { error: "Email isn't set up on this site yet." });

  const from = env.FROM_EMAIL || "AB_Creative <onboarding@resend.dev>";
  const inv = invoiceNumber(today);
  const mail = q.action === "consult" ? clientConsult(q) : clientInvoice(q, inv, env);
  let sent = true;
  try {
    await send(env, { from, to: [q.contact.email], reply_to: env.AVERY_EMAIL, subject: mail.subject, text: mail.text, html: mail.html });
  } catch (e) { sent = false; }
  // Always tell Avery, even if the client's email failed, so the lead is never lost.
  const note = averyNotice(q, inv, sent);
  try {
    await send(env, { from, to: [env.AVERY_EMAIL], reply_to: q.contact.email, subject: note.subject, text: note.text, html: note.html });
  } catch (e) {
    if (!sent) return json(502, { error: "We couldn't send that just now." });
  }
  if (!sent) return json(502, { error: "We couldn't email your invoice just now. Avery has your request and will be in touch." });

  const r = q.r;
  return json(200, { ok: true, action: q.action, invoice: q.action === "invoice" ? inv : undefined, total: r.final, deposit: r.deposit, balance: r.balance, depositDue: q.dates.depositDue, balanceDue: q.dates.balanceDue });
};
