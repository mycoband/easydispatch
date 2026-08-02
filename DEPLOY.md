# EasyDispatch — production deploy

Ship a real URL shops can use. Vercel + Supabase is the default path.

## A. Supabase production project

1. Create a **separate** Supabase project for production (don’t reuse local/dev if you can avoid it).
2. Run the SQL stack from [supabase/README.md](./supabase/README.md).
3. Auth → Email: enable confirmations for real users (recommended).
4. Auth → URL configuration:
   - **Site URL:** `https://your-domain.com`
   - **Redirect URLs:** `https://your-domain.com/**`, `https://your-domain.com/login`
5. Database → Backups: enable (Pro) or schedule manual dumps.
6. Copy production API keys into the host’s env (never commit them).

## B. Vercel (or similar)

1. Push the repo to GitHub (exclude `.env.local` — already in `.gitignore`).
2. Import the repo in [Vercel](https://vercel.com) → Framework: Next.js → Root: this app folder.
3. Set environment variables (Production + Preview as needed):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://your-domain.com
XAI_API_KEY=
# Walkthrough AI: Whisper hears video narration (required for video Generate)
OPENAI_API_KEY=
XAI_VISION_MODEL=grok-4.5
XAI_CHAT_MODEL=grok-4.5
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
RESEND_FROM_EMAIL=EasyDispatch <billing@yourdomain.com>
```

4. Deploy. Confirm `https://your-domain.com/login` loads.
5. Attach a custom domain in Vercel → set `NEXT_PUBLIC_APP_URL` to that domain → redeploy.

## C. Stripe (two products)

### 1) Customer invoice payments (job pay links)

1. Developers → Webhooks → Add endpoint:  
   `https://your-domain.com/api/stripe/webhook`
2. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
3. Copy signing secret → `STRIPE_WEBHOOK_SECRET`
4. Use **live** keys in production (`sk_live_…` / `pk_live_…`)

### 2) EasyDispatch SaaS subscriptions

1. Products → create **Starter** and **Pro** recurring prices  
2. Put Price IDs in `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`  
3. Settings → Billing → Customer portal: enable cancel / payment method update  
4. Test with a real Checkout from **Settings → Billing**

## D. Twilio

1. Get a number that can send SMS in your region  
2. Set `TWILIO_*` env vars  
3. From a job: send OMW — confirm the phone receives it (not “simulated”)

## E. Resend (invoice email)

1. Verify your sending domain  
2. Set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`  
3. Send a test invoice to yourself

## F. Post-deploy verification

Run through [docs/GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md).

Critical:

- [ ] Owner signup creates a company  
- [ ] Invite code joins a tech  
- [ ] Job pay link → webhook → `Paid`  
- [ ] SaaS checkout updates company plan  
- [ ] SMS / email not simulated  
- [ ] Role permissions hide tech money actions when configured  
- [ ] Storage uploads (logo / job photo) work  

## G. Ops hygiene

- Rotate `SUPABASE_SERVICE_ROLE_KEY` if it ever leaked  
- Keep Stripe webhook secret in sync after regenerating  
- Never put service role or Stripe secret in client code  
- Prefer staging Supabase for experiments; promote SQL carefully  

## Local webhook testing (before prod)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Put the CLI secret into local `STRIPE_WEBHOOK_SECRET`.
