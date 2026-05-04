import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { GENERAL_CONTACT, SITE_URL } from '@/constants/contact'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'ar'
      ? 'شروط الخدمة — كهرمانة بغداد'
      : 'Terms of Service — Kahramana Baghdad',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: locale === 'ar' ? `${SITE_URL}/terms` : `${SITE_URL}/en/terms`,
      languages: {
        'x-default': `${SITE_URL}/terms`,
        ar: `${SITE_URL}/terms`,
        en: `${SITE_URL}/en/terms`,
      },
    },
  }
}

const LAST_UPDATED = 'أبريل ٢٠٢٦ · April 2026'

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const isAr = locale === 'ar'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black px-4 sm:px-6 pt-10 pb-20 max-w-3xl mx-auto"
    >
      <div className="mb-10 pb-8 border-b border-brand-border">
        <h1
          className={`text-4xl font-black text-brand-text mb-3
            ${isAr ? 'font-cairo' : 'font-editorial'}`}
        >
          {isAr ? 'شروط الخدمة' : 'Terms of Service'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted">{LAST_UPDATED}</p>
      </div>

      {isAr ? <TermsArabic email={GENERAL_CONTACT.email} /> : <TermsEnglish email={GENERAL_CONTACT.email} />}
    </div>
  )
}

// ── Arabic ─────────────────────────────────────────────────────────────────────

function TermsArabic({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-8">
      <S title="القبول بالشروط">
        <p>
          باستخدامك لموقع كهرمانة بغداد (kahramanat.com) أو تقديمك طلباً عبره، فإنك توافق
          على هذه الشروط والأحكام. إذا لم توافق على هذه الشروط، يرجى عدم استخدام الموقع.
        </p>
      </S>

      <S title="وصف الخدمة">
        <p>
          يتيح لك موقعنا تصفح قائمة طعام كهرمانة بغداد وتقديم طلبات الطعام إلكترونياً عبر
          واتساب. نحن نعمل من خلال فرعَين في البحرين: الرفاع وقلالي. الخدمة متاحة يومياً
          خلال ساعات العمل المحددة لكل فرع.
        </p>
      </S>

      <S title="تقديم الطلبات وتأكيدها">
        <ul>
          <li>تُعدّ الطلبات مؤكدة فقط عند تلقي فريقنا رسالة واتساب وردّه بتأكيد رسمي.</li>
          <li>تعتمد الأسعار المعروضة على الموقع على المنيو المحدَّث، وقد تتغير دون إشعار مسبق.</li>
          <li>الدفع نقداً عند الاستلام أو في الفرع. لا يتوفر حالياً دفع إلكتروني.</li>
          <li>نحتفظ بالحق في رفض أي طلب أو إلغائه لأسباب خارجة عن إرادتنا.</li>
        </ul>
      </S>

      <S title="سياسة الإلغاء">
        <p>
          يمكنك إلغاء طلبك مجاناً خلال <strong>١٠ دقائق</strong> من تقديمه عبر التواصل مباشرة
          مع فريقنا على واتساب. بعد بدء التحضير، قد لا يكون الإلغاء ممكناً. يرجى الاطلاع على{' '}
          <Link href="/refund-policy" className="text-brand-gold hover:text-brand-gold-light">
            سياسة الإلغاء والاسترداد
          </Link>{' '}
          للمزيد من التفاصيل.
        </p>
      </S>

      <S title="الاستخدام المقبول">
        <p>تلتزم بعدم استخدام الموقع من أجل:</p>
        <ul>
          <li>تقديم معلومات كاذبة أو مضللة.</li>
          <li>الإضرار بالموقع أو التأثير على تجربة المستخدمين الآخرين.</li>
          <li>أي غرض غير قانوني أو مخالف للأنظمة البحرينية.</li>
        </ul>
      </S>

      <S title="إخلاء المسؤولية">
        <p>
          نسعى دائماً لتقديم أفضل خدمة ممكنة، إلا أننا لا نضمن توفر جميع الأصناف في جميع
          الأوقات. لا نتحمل المسؤولية عن أي تأخير في التوصيل ناجم عن ظروف خارجة عن إرادتنا
          (كازدحام المرور أو الأحوال الجوية). تقتصر مسؤوليتنا القصوى على قيمة الطلب المدفوعة.
        </p>
      </S>

      <S title="القانون المنظِّم">
        <p>
          تخضع هذه الشروط لقوانين مملكة البحرين. تختص المحاكم البحرينية بالنظر في أي نزاع
          ينشأ عن استخدام هذا الموقع أو يتعلق به.
        </p>
      </S>

      <S title="التواصل">
        <p>
          لأي استفسار حول هذه الشروط، يرجى التواصل معنا عبر:{' '}
          <a href={`mailto:${email}`} className="text-brand-gold hover:text-brand-gold-light">{email}</a>
        </p>
      </S>
    </div>
  )
}

// ── English ────────────────────────────────────────────────────────────────────

function TermsEnglish({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-8">
      <S title="Acceptance of Terms">
        <p>
          By using the Kahramana Baghdad website (kahramanat.com) or placing an order through
          it, you agree to these terms and conditions. If you do not agree, please do not use
          the website.
        </p>
      </S>

      <S title="Service Description">
        <p>
          Our website allows you to browse the Kahramana Baghdad menu and place food orders
          electronically via WhatsApp. We operate two branches in Bahrain: Riffa and Qallali.
          The service is available daily during the opening hours specified for each branch.
        </p>
      </S>

      <S title="Placing and Confirming Orders">
        <ul>
          <li>Orders are confirmed only when our team receives your WhatsApp message and replies with an official confirmation.</li>
          <li>Prices shown on the website reflect the current menu and may change without prior notice.</li>
          <li>Payment is cash on delivery or at the branch. Electronic payment is not currently available.</li>
          <li>We reserve the right to refuse or cancel any order for reasons beyond our control.</li>
        </ul>
      </S>

      <S title="Cancellation Policy">
        <p>
          You may cancel your order free of charge within <strong>10 minutes</strong> of placing
          it by contacting our team directly on WhatsApp. Once preparation has begun, cancellation
          may not be possible. Please refer to our{' '}
          <Link href="/refund-policy" className="text-brand-gold hover:text-brand-gold-light">
            Refund & Cancellation Policy
          </Link>{' '}
          for full details.
        </p>
      </S>

      <S title="Acceptable Use">
        <p>You agree not to use the website to:</p>
        <ul>
          <li>Submit false or misleading information.</li>
          <li>Harm the website or interfere with other users&apos; experience.</li>
          <li>Any unlawful purpose or activity that violates Bahraini regulations.</li>
        </ul>
      </S>

      <S title="Disclaimer of Warranties">
        <p>
          We always strive to provide the best possible service; however, we cannot guarantee
          that all menu items will be available at all times. We are not liable for delivery
          delays caused by circumstances beyond our control (such as traffic or weather
          conditions). Our maximum liability is limited to the value of the order paid.
        </p>
      </S>

      <S title="Governing Law">
        <p>
          These terms are governed by the laws of the Kingdom of Bahrain. The Bahraini courts
          have exclusive jurisdiction over any dispute arising from or related to use of this
          website.
        </p>
      </S>

      <S title="Contact">
        <p>
          For any enquiries about these terms, please contact us at:{' '}
          <a href={`mailto:${email}`} className="text-brand-gold hover:text-brand-gold-light">{email}</a>
        </p>
      </S>
    </div>
  )
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-satoshi font-semibold text-lg text-brand-text">{title}</h2>
      <div
        className="font-almarai text-sm text-brand-muted leading-relaxed
                   [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
                   [&_li]:leading-relaxed [&_strong]:text-brand-text [&_a]:underline-offset-2"
      >
        {children}
      </div>
    </section>
  )
}
