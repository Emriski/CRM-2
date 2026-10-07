# CRM 2

Worker/admin CRM MVP using Next.js, Supabase and Vercel.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Apply `supabase/migrations/20261007000000_crm2_foundation.sql` to the CRM 2 Supabase project.
3. Run `npm install` then `npm run dev`.

## First admin
Create an account, sign in, and claim the first-admin role. Only the first authenticated user can claim admin while no admin exists.

## Worker flow
Worker signs up -> admin generates a one-time activation code -> worker enters it -> worker can start/end work, add leads and log contacts.

Never commit Supabase service-role keys.
