
[build]
  publish = "."
  functions = "netlify/functions"

[[redirects]]
  from = "/api/quote"
  to = "/.netlify/functions/quote"
  status = 200

# AB_Creative website

A one-page site with a quote builder. Clients answer questions, see their price, and get an emailed invoice (deposit amount and due dates). Avery gets an email with every request.

## Files
- `public/index.html`: the site (generated from `src/index.template.html` by `python3 build.py .`; you can also edit index.html directly)
- `public/pricing.js`: ALL prices and rules (base prices, deposits, due dates, towns). Edit here.
- `netlify/functions/quote.js`: checks the request, recalculates the price on the server, sends the emails
- `test/`: run `node test/pricing.test.js` and `node test/quote.test.js`

## Set up email (Resend)
1. Make a free account at resend.com and create an API key.
2. Verify your domain in Resend so emails can come from e.g. hello@yourdomain.com (without this, Resend only lets you send to your own address).

## Deploy (Netlify)
1. Put this folder in a GitHub repo, then on netlify.com choose "Add new site", "Import from GitHub". No build command is needed.
2. In Site configuration, Environment variables, add:
   - `RESEND_API_KEY` (required)
   - `AVERY_EMAIL` (required): where requests are sent
   - `FROM_EMAIL`: e.g. `AB_Creative <hello@yourdomain.com>`
   - `PAY_INSTRUCTIONS`: e.g. `Venmo @your-handle, or Zelle to 316-555-0100. Put your invoice number in the note.`
3. Redeploy, then submit a test quote with your own email.

## Not included yet
- Card payment (invoices say how to pay by Venmo, Zelle, etc.). Stripe invoicing can be added.
- Signed agreement and text message updates.
- Prices live in pricing.js, which visitors can see in the page source.
- The email sending has only been tested with a simulated email service, not live.
