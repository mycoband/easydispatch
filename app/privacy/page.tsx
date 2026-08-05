import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | EasyDispatch',
  description: 'EasyDispatch privacy policy, including SMS and mobile messaging disclosures.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        ← EasyDispatch
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: August 4, 2026</p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-ink-700">
        <p>
          EasyDispatch (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          provides field service software for HVAC and related businesses. This
          Privacy Policy explains how we collect, use, and share information
          when you use easydispatch.app, easydispatch.vercel.app, and related
          apps or messaging services.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Information we collect
        </h2>
        <p>Depending on how you use EasyDispatch, we may process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details (name, email, company name, role)</li>
          <li>Customer and job data you or your company enter</li>
          <li>Phone numbers used for appointment, dispatch, invoice, or support texts</li>
          <li>Call/SMS content when AI receptionist or messaging features are enabled</li>
          <li>Device and log data needed to operate and secure the service</li>
        </ul>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          How we use information
        </h2>
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide and improve EasyDispatch for your company</li>
          <li>Send transactional messages you or your company initiate (for example job updates, reminders, invoices, and intake replies)</li>
          <li>Operate AI receptionist and related automation when enabled</li>
          <li>Provide support, prevent abuse, and meet legal obligations</li>
        </ul>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          SMS / mobile messaging (A2P)
        </h2>
        <p>
          If you provide a mobile number to EasyDispatch or to a business using
          EasyDispatch, that number may be used to send and receive service-
          related text messages (for example appointment confirmations, on-my-way
          notices, invoice links, and AI receptionist replies).
        </p>
        <p>
          <strong>We do not sell, rent, or share mobile phone numbers with
          third parties or affiliates for their marketing or promotional
          purposes.</strong>{' '}
          Mobile numbers are used only to provide messaging and related
          services for your company (and necessary vendors that help deliver
          those messages, such as Twilio).
        </p>
        <p>
          <strong>Message frequency varies</strong> based on your interactions
          with the business (for example how many appointments, updates, or
          support conversations you have).
        </p>
        <p>
          <strong>Message and data rates may apply.</strong> Check your wireless
          plan for details.
        </p>
        <p>
          You can opt out of SMS by replying <strong>STOP</strong> to any
          message. For help, reply <strong>HELP</strong> or email{' '}
          <a
            href="mailto:support@easydispatch.app"
            className="font-medium text-brand-700 hover:underline"
          >
            support@easydispatch.app
          </a>
          . Opting out of SMS does not cancel your EasyDispatch subscription or
          delete your account unless you also request that separately.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          AI receptionist (calls &amp; texts)
        </h2>
        <p>
          When a shop enables AI receptionist, inbound SMS and phone calls to
          their connected number may be handled by an automated assistant.
          Callers should be told they are interacting with an AI assistant.
          Conversations may be transcribed and stored so the shop can create a
          service ticket. Call recordings, if enabled, are retained only as
          needed to provide the service and as required by law. Shops are
          responsible for consent and recording rules in their service area.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Sharing
        </h2>
        <p>
          We share information with service providers that help us run the
          product (for example hosting, database, email, and SMS/voice carriers)
          under agreements that limit use to providing those services. We may
          also share information if required by law or to protect rights and
          safety. We do not sell personal information.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Retention &amp; security
        </h2>
        <p>
          We retain information for as long as needed to provide the service and
          meet legal or accounting requirements. We use reasonable safeguards to
          protect data, but no method of transmission or storage is completely
          secure.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Your choices
        </h2>
        <p>
          Account users can update profile and company settings in the app.
          Mobile users can opt out of SMS with STOP as described above. For
          access or deletion requests related to EasyDispatch platform data,
          contact us at the email below. Requests about a specific HVAC job or
          customer record may need to go through the shop that holds that
          relationship.
        </p>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink-950">
          Contact
        </h2>
        <p>
          Privacy questions:{' '}
          <a
            href="mailto:support@easydispatch.app"
            className="font-medium text-brand-700 hover:underline"
          >
            support@easydispatch.app
          </a>
        </p>
        <p>
          See also our{' '}
          <Link
            href="/terms"
            className="font-medium text-brand-700 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
