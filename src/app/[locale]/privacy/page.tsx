import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { GENERAL_CONTACT, SITE_URL } from '@/constants/contact'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'ar'
      ? 'سياسة الخصوصية — كهرمانة بغداد'
      : 'Privacy Policy — Kahramana Baghdad',
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/privacy`,
      languages: {
        ar: `${SITE_URL}/ar/privacy`,
        en: `${SITE_URL}/en/privacy`,
      },
    },
  }
}

const LAST_UPDATED = 'أبريل ٢٠٢٦ · April 2026'

export default async function PrivacyPage({
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
      <LegalHeader
        arTitle="سياسة الخصوصية"
        enTitle="Privacy Policy"
        updated={LAST_UPDATED}
        isAr={isAr}
      />

      {isAr ? <PrivacyArabic email={GENERAL_CONTACT.email} /> : <PrivacyEnglish email={GENERAL_CONTACT.email} />}
    </div>
  )
}

// ── Arabic content ─────────────────────────────────────────────────────────────

function PrivacyArabic({ email }: { email: string }) {
  return (
    <LegalBody>
      <LegalSection title="المقدمة">
        <p>
          تلتزم كهرمانة بغداد بحماية خصوصية زوار موقعنا وعملائنا. تصف هذه السياسة كيفية
          جمعنا للبيانات الشخصية واستخدامها وحمايتها عند استخدامك لموقعنا الإلكتروني أو
          تقديمك طلباً عبره.
        </p>
      </LegalSection>

      <LegalSection title="البيانات التي نجمعها">
        <p>نجمع البيانات التالية فقط عند تقديمك لطلب أو إرسالك رسالة تواصل:</p>
        <ul>
          <li><strong>الاسم</strong> — لتخصيص تجربتك وإعداد طلبك.</li>
          <li><strong>رقم الهاتف</strong> — للتواصل معك بشأن طلبك عبر واتساب أو الاتصال المباشر.</li>
          <li><strong>تفاصيل الطلب</strong> — الأصناف المختارة والكميات والأسعار للاحتفاظ بسجل الطلبات.</li>
          <li><strong>البريد الإلكتروني</strong> — عند إرسال رسالة تواصل فقط.</li>
          <li><strong>معلومات الجهاز</strong> — بيانات تقنية مجهولة الهوية لتحليل الأداء والأخطاء.</li>
        </ul>
        <p>لا نطلب منك إنشاء حساب ولا نخزّن معلومات الدفع.</p>
      </LegalSection>

      <LegalSection title="كيف نستخدم بياناتك">
        <ul>
          <li>تنفيذ طلبات الطعام وإيصالها أو إتاحتها للاستلام.</li>
          <li>إرسال تحديثات حالة الطلب عبر واتساب.</li>
          <li>الرد على استفساراتك ورسائل التواصل.</li>
          <li>تحسين موقعنا وخدماتنا بناءً على أنماط الاستخدام.</li>
        </ul>
        <p>لا نبيع بياناتك لأي طرف ثالث ولا نستخدمها للتسويق المباشر دون إذنك.</p>
      </LegalSection>

      <LegalSection title="ملفات تعريف الارتباط (Cookies)">
        <p>
          يستخدم موقعنا ملفات تعريف ارتباط ضرورية لعمل الموقع وتحليل الأداء التقني.
          لا نستخدم ملفات تعريف الارتباط لأغراض تسويقية أو تتبع سلوكي في الوقت الحالي.
          يمكنك تعطيل ملفات تعريف الارتباط في إعدادات متصفحك، مع الأخذ بعين الاعتبار أن
          ذلك قد يؤثر على بعض وظائف الموقع.
        </p>
      </LegalSection>

      <LegalSection title="الخدمات الخارجية">
        <p>نستخدم مزودي خدمات موثوقين لتشغيل موقعنا:</p>
        <ul>
          <li><strong>Supabase</strong> — تخزين البيانات وقواعد البيانات (قوائم الخوادم في الاتحاد الأوروبي).</li>
          <li><strong>Vercel</strong> — استضافة الموقع وشبكة توصيل المحتوى.</li>
          <li><strong>WhatsApp (Meta)</strong> — إرسال تحديثات الطلبات وتلقيها.</li>
        </ul>
        <p>كل مزود ملزم بسياسة خصوصية خاصة به وفق لوائح حماية البيانات الدولية.</p>
      </LegalSection>

      <LegalSection title="حقوقك">
        <p>يحق لك في أي وقت:</p>
        <ul>
          <li>طلب الاطلاع على البيانات الشخصية التي نحتفظ بها.</li>
          <li>طلب تصحيح أي معلومات غير دقيقة.</li>
          <li>طلب حذف بياناتك (مع مراعاة الالتزامات القانونية للاحتفاظ بسجلات الطلبات).</li>
        </ul>
        <p>
          لممارسة أي من هذه الحقوق، يرجى التواصل معنا عبر البريد الإلكتروني:{' '}
          <a href={`mailto:${email}`} className="text-brand-gold hover:text-brand-gold-light">{email}</a>
        </p>
      </LegalSection>

      <LegalSection title="تعديلات السياسة">
        <p>
          نحتفظ بالحق في تعديل هذه السياسة في أي وقت. سيُشار إلى تاريخ آخر تحديث أعلى الصفحة.
          استمرارك في استخدام الموقع بعد أي تعديل يُعدّ موافقةً منك على السياسة المحدَّثة.
        </p>
      </LegalSection>
    </LegalBody>
  )
}

// ── English content ────────────────────────────────────────────────────────────

function PrivacyEnglish({ email }: { email: string }) {
  return (
    <LegalBody>
      <LegalSection title="Introduction">
        <p>
          Kahramana Baghdad is committed to protecting the privacy of our website visitors
          and customers. This policy explains how we collect, use, and safeguard your personal
          data when you use our website or place an order through it.
        </p>
      </LegalSection>

      <LegalSection title="Data We Collect">
        <p>We only collect the following data when you place an order or send us a message:</p>
        <ul>
          <li><strong>Name</strong> — to personalise your experience and prepare your order.</li>
          <li><strong>Phone number</strong> — to contact you about your order via WhatsApp or call.</li>
          <li><strong>Order details</strong> — items, quantities, and prices for order records.</li>
          <li><strong>Email address</strong> — only when you submit a contact message.</li>
          <li><strong>Device information</strong> — anonymised technical data for performance monitoring.</li>
        </ul>
        <p>We do not require account creation and do not store payment information.</p>
      </LegalSection>

      <LegalSection title="How We Use Your Data">
        <ul>
          <li>Fulfil food orders for delivery or pickup.</li>
          <li>Send order status updates via WhatsApp.</li>
          <li>Respond to your enquiries and contact messages.</li>
          <li>Improve our website and services based on usage patterns.</li>
        </ul>
        <p>We do not sell your data to third parties or use it for direct marketing without your consent.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Our website uses essential cookies necessary for its operation and technical
          performance monitoring. We do not currently use cookies for marketing or behavioural
          tracking. You may disable cookies in your browser settings, though this may affect
          some website functionality.
        </p>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <p>We use trusted service providers to operate our website:</p>
        <ul>
          <li><strong>Supabase</strong> — data storage and databases (EU-region servers).</li>
          <li><strong>Vercel</strong> — website hosting and content delivery network.</li>
          <li><strong>WhatsApp (Meta)</strong> — sending and receiving order updates.</li>
        </ul>
        <p>Each provider is bound by its own privacy policy in accordance with international data protection regulations.</p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>You have the right at any time to:</p>
        <ul>
          <li>Request access to the personal data we hold about you.</li>
          <li>Request correction of any inaccurate information.</li>
          <li>Request deletion of your data (subject to legal obligations to retain order records).</li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at:{' '}
          <a href={`mailto:${email}`} className="text-brand-gold hover:text-brand-gold-light">{email}</a>
        </p>
      </LegalSection>

      <LegalSection title="Policy Changes">
        <p>
          We reserve the right to update this policy at any time. The date of the last update
          will be shown at the top of this page. Your continued use of the website after any
          changes constitutes your acceptance of the updated policy.
        </p>
      </LegalSection>
    </LegalBody>
  )
}

// ── Shared layout helpers ──────────────────────────────────────────────────────

function LegalHeader({
  arTitle,
  enTitle,
  updated,
  isAr,
}: {
  arTitle: string
  enTitle: string
  updated: string
  isAr: boolean
}) {
  return (
    <div className="mb-10 pb-8 border-b border-brand-border">
      <h1
        className={`text-4xl font-black text-brand-text mb-3
          ${isAr ? 'font-cairo' : 'font-editorial'}`}
      >
        {isAr ? arTitle : enTitle}
      </h1>
      <p className="font-satoshi text-sm text-brand-muted">{updated}</p>
    </div>
  )
}

function LegalBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>
}

function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
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
