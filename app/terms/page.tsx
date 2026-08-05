import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | EasyDispatch',
  description: 'EasyDispatch terms of service, including SMS messaging terms.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        ← EasyDispatch
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: August 4, 2026</p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-ink-700">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern use of EasyDispatch
          websites, apps, and related messaging services. By creating an
          account, using EasyDispatch, or sending/receiving texts through a
          number connected to EasyDispatch, you agree to these Terms.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          The service
        </h2>
        <p>
          EasyDispatch is software for HVAC and field service businesses to
          manage customers, jobs, dispatch, invoicing, and related workflows.
          Features may include AI tools, AI receptionist (SMS and phone intake),
          and customer messaging. We may update or discontinue features with
          reasonable notice when practical.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Accounts
        </h2>
        <p>
          You must provide accurate account information and keep credentials
          secure. You are responsible for activity under your account and for
          your company’s use of the product, including messages sent to
          customers.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          SMS / mobile messaging
        </h2>
        <p>
          Businesses using EasyDispatch may send transactional texts about
          appointments, dispatch status, invoices, and support. By providing a
          mobile number, you consent to receive such messages from that
          business (and from EasyDispatch systems acting on their behalf).
        </p>
        <p>
          <strong>Message frequency varies.</strong>{' '}
          <strong>Message and data rates may apply.</strong>
        </p>
        <p>
          Reply <strong>STOP</strong> to opt out of SMS. Reply{' '}
          <strong>HELP</strong> for help, or email{' '}
          <a
            href="mailto:support@easydispatch.app"
            className="font-medium text-brand-700 hover:underline"
          >
            support@easydispatch.app
          </a>
          . Carriers are not liable for delayed or undelivered messages.
        </p>
        <p>
          EasyDispatch and businesses using EasyDispatch do not sell or share
          mobile numbers with third parties for those parties’ own marketing.
          See our{' '}
          <Link
            href="/privacy"
            className="font-medium text-brand-700 hover:underline"
          >
            Privacy Policy
          </Link>{' '}
          for details.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Acceptable use
        </h2>
        <p>You agree not to use EasyDispatch to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Send unlawful, deceptive, or harassing communications</li>
          <li>Send spam or marketing texts without required consent</li>
          <li>Abuse, disrupt, or reverse engineer the service</li>
          <li>Violate carrier, Twilio, or applicable telemarketing/SMS laws</li>
        </ul>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          AI features
        </h2>
        <p>
          AI outputs (including receptionist conversations and ticket drafts)
          may be incomplete or incorrect. You are responsible for reviewing
          jobs, schedules, and customer communications before relying on them.
          AI receptionist does not replace emergency services — callers with
          gas leaks, fire, or medical emergencies should call local emergency
          numbers.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Fees
        </h2>
        <p>
          Paid plans are billed as described at signup or in your billing
          settings. Carrier message/data charges are separate and billed by
          your wireless provider. Telephony/AI usage costs from providers such
          as Twilio or voice AI vendors may apply in addition to your
          EasyDispatch subscription.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Disclaimer &amp; liability
        </h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY
          KIND TO THE MAXIMUM EXTENT PERMITTED BY LAW. TO THE MAXIMUM EXTENT
          PERMITTED BY LAW, EASYDISPATCH IS NOT LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR LOST PROFITS DAMAGES, OR FOR
          AMOUNTS EXCEEDING FEES PAID TO EASYDISPATCH FOR THE SERVICE IN THE
          THREE MONTHS BEFORE THE CLAIM.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Changes
        </h2>
        <p>
          We may update these Terms by posting a revised version on this page.
          Continued use after changes means you accept the updated Terms.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Contact
        </h2>
        <p>
          <a
            href="mailto:support@easydispatch.app"
            className="font-medium text-brand-700 hover:underline"
          >
            support@easydispatch.app
          </a>
        </p>
      </div>
    </div>
  );
}
