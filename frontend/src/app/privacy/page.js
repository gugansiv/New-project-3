'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-black text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl">🍗</span>
            <span className="font-black text-sm uppercase tracking-wider group-hover:text-[#E4002B] transition-colors">
              Crispy Chicken Co.
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            ← Back to Menu
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-black uppercase tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 font-semibold">
            Last updated: June 17, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              1. Information We Collect
            </h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                <strong>Account Information:</strong> Name, email address, and encrypted password
                when you create an account.
              </li>
              <li>
                <strong>Order Information:</strong> Items ordered, delivery address, payment method,
                store selection, and order history.
              </li>
              <li>
                <strong>Usage Data:</strong> Pages visited, features used, time spent, and device
                information (browser type, OS, screen resolution).
              </li>
              <li>
                <strong>Cookies &amp; Local Storage:</strong> We use cookies and browser local
                storage to maintain your session, preferences, and cart items.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>To process and fulfill your food orders.</li>
              <li>To create and manage your account.</li>
              <li>To communicate with you about your orders, promotions, and updates.</li>
              <li>To improve our Platform, services, and customer experience.</li>
              <li>To detect and prevent fraud, unauthorized access, and abuse.</li>
              <li>To comply with legal obligations and enforce our Terms of Use.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              3. Data Security
            </h2>
            <p className="mb-2">
              We take data security seriously and implement industry-standard measures:
            </p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                <strong>Password Hashing:</strong> All passwords are hashed using the scrypt
                algorithm before storage. We never store plaintext passwords.
              </li>
              <li>
                <strong>Authentication Tokens:</strong> Session authentication uses signed JSON Web
                Tokens (JWT) stored in sessionStorage, not persistent cookies.
              </li>
              <li>
                <strong>API Security:</strong> All sensitive API endpoints require authenticated
                Bearer tokens with role-based access control.
              </li>
              <li>
                <strong>HTTPS:</strong> All data in transit is encrypted via TLS/SSL.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              4. Data Sharing
            </h2>
            <p className="mb-2">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                <strong>Payment Processors:</strong> To process card, UPI, and digital wallet
                transactions securely.
              </li>
              <li>
                <strong>Store Operators:</strong> Order details necessary to prepare and fulfill
                your order (name, items, payment method).
              </li>
              <li>
                <strong>Legal Authorities:</strong> When required by law, subpoena, or court order.
              </li>
              <li>
                <strong>Service Providers:</strong> Hosting, analytics, and email services that
                support our operations, under strict data protection agreements.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              5. Your Rights
            </h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Opt out of promotional emails and newsletters.</li>
              <li>Withdraw consent for data processing where applicable.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@crispychickenco.com" className="text-[#E4002B] font-bold hover:underline">
                privacy@crispychickenco.com
              </a>.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              6. Data Retention
            </h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide our services. Order history is retained for up to 3 years for financial and
              legal compliance. Upon account deletion, personal data will be purged within 30 days,
              except where retention is required by law.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              7. Children&apos;s Privacy
            </h2>
            <p>
              Our Platform is not intended for children under 13 years of age. We do not knowingly
              collect personal information from children. If we discover that a child under 13 has
              provided us with personal data, we will promptly delete it.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. Changes will be posted on this page
              with an updated &quot;Last updated&quot; date. We encourage you to review this page
              regularly.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              9. Contact Us
            </h2>
            <p>For privacy-related inquiries:</p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-1.5">
              <p className="font-black text-black">Crispy Chicken Co. — Privacy Team</p>
              <p>📧 Email: <a href="mailto:privacy@crispychickenco.com" className="text-[#E4002B] font-bold hover:underline">privacy@crispychickenco.com</a></p>
              <p>📞 Phone: +91 1800-CRISPY (274-779)</p>
              <p>📍 Headquarters: 742 Broadway, New York, NY</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black text-gray-400 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold gap-4">
          <p>© 2026 Crispy Chicken Co. All Rights Reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
