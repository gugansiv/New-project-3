'use client';

import React from 'react';
import Link from 'next/link';

export default function TermsOfUse() {
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
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-gray-500 font-semibold">
            Last updated: June 17, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Crispy Chicken Co. website, mobile application, or any
              associated services (collectively, the &quot;Platform&quot;), you agree to be bound by
              these Terms &amp; Conditions (&quot;Terms&quot;). If you do not agree to all of these
              Terms, you must discontinue use of the Platform immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              2. Account Registration
            </h2>
            <p className="mb-2">
              To place orders on the Platform, you may be required to create an account. You agree to:
            </p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your password and accept all risks of unauthorized access.</li>
              <li>Notify us immediately if you suspect unauthorized use of your account.</li>
              <li>Not create accounts under false names or impersonate another person.</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              3. Orders &amp; Payments
            </h2>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                All orders placed on the Platform constitute an offer to purchase. We reserve the
                right to accept or reject any order at our discretion.
              </li>
              <li>
                Prices displayed are in Indian Rupees (₹) and are inclusive of applicable taxes
                unless stated otherwise. An 8% tax is applied at checkout.
              </li>
              <li>
                We accept payments via Credit/Debit Card, UPI, Apple Pay, Google Pay, and Cash on
                Delivery. All electronic payments are processed through secure third-party
                payment gateways.
              </li>
              <li>
                Once an order is confirmed and being prepared, cancellations may not be possible.
                Please contact the store directly for cancellation requests.
              </li>
              <li>
                Promotional codes and discounts are subject to availability, expiration dates, and
                specific terms. They cannot be combined unless explicitly stated.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              4. Food Safety &amp; Allergen Information
            </h2>
            <p className="mb-2">
              Crispy Chicken Co. is committed to food safety. However:
            </p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                Menu items may contain common allergens including but not limited to gluten, eggs,
                dairy, soy, nuts, and sesame. Please review item descriptions carefully.
              </li>
              <li>
                Despite our best efforts, cross-contamination may occur during food preparation.
                Customers with severe allergies should exercise caution.
              </li>
              <li>
                Nutritional information (calories, etc.) provided on the Platform is approximate
                and may vary based on preparation and portion size.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              5. Delivery &amp; Pickup
            </h2>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                Delivery times are estimates and may vary due to order volume, weather,
                traffic, or other factors beyond our control.
              </li>
              <li>
                You are responsible for providing an accurate delivery address. We are not liable
                for delays or failed deliveries due to incorrect address information.
              </li>
              <li>
                For pickup orders, items must be collected within 30 minutes of the &quot;Ready&quot;
                notification. Uncollected orders may be discarded without refund.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              6. Intellectual Property
            </h2>
            <p>
              All content on the Platform — including but not limited to logos, trademarks, text,
              images, graphics, icons, and software — is the property of Crispy Chicken Co. or its
              licensors and is protected by applicable intellectual property laws. You may not
              reproduce, distribute, modify, or create derivative works from any content without
              our express written consent.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              7. User Conduct
            </h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>Use the Platform for any unlawful purpose or to violate any applicable laws.</li>
              <li>Attempt to gain unauthorized access to our systems, servers, or databases.</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform.</li>
              <li>Submit false reviews, fake orders, or fraudulent payment information.</li>
              <li>Scrape, data-mine, or harvest data from the Platform without authorization.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Crispy Chicken Co. shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, including but
              not limited to loss of profits, data, or goodwill, arising out of or in connection
              with your use of the Platform. Our total liability shall not exceed the amount you
              paid for the specific order giving rise to the claim.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              9. Refund &amp; Return Policy
            </h2>
            <ul className="list-disc ml-6 space-y-1.5">
              <li>
                If you receive an incorrect or damaged order, please contact us within 1 hour of
                delivery/pickup with photographic evidence.
              </li>
              <li>
                Refunds, if approved, will be processed to the original payment method within 5–7
                business days.
              </li>
              <li>
                We do not offer refunds for orders that have been partially consumed or for
                changes in personal taste preferences.
              </li>
            </ul>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              10. Privacy
            </h2>
            <p>
              Your use of the Platform is also governed by our{' '}
              <Link href="/privacy" className="text-[#E4002B] font-bold hover:underline">
                Privacy Policy
              </Link>
              , which explains how we collect, use, and protect your personal information.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              11. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we do, we will revise the
              &quot;Last updated&quot; date at the top of this page. Continued use of the Platform
              after any changes constitutes your acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              12. Governing Law
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India.
              Any disputes arising from these Terms shall be subject to the exclusive jurisdiction
              of the courts in New Delhi, India.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-lg font-black text-black uppercase tracking-tight mb-3">
              13. Contact Us
            </h2>
            <p>
              If you have questions about these Terms, please contact us:
            </p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-1.5">
              <p className="font-black text-black">Crispy Chicken Co.</p>
              <p>📧 Email: <a href="mailto:legal@crispychickenco.com" className="text-[#E4002B] font-bold hover:underline">legal@crispychickenco.com</a></p>
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
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors text-white">Terms of Use</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
