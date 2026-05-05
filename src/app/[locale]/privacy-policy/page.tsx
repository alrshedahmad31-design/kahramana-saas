import type { Metadata } from 'next'
import { BRANCH_LIST, GENERAL_CONTACT, SITE_URL } from '@/constants/contact'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isAr = locale === 'ar'
  return {
    title: isAr
      ? 'سياسة الخصوصية — كهرمانة بغداد'
      : 'Privacy Policy — Kahramana Baghdad',
    robots: { index: true, follow: true },
    alternates: {
      canonical: isAr ? `${SITE_URL}/privacy-policy` : `${SITE_URL}/en/privacy-policy`,
      languages: {
        'x-default': `${SITE_URL}/privacy-policy`,
        ar: `${SITE_URL}/privacy-policy`,
        en: `${SITE_URL}/en/privacy-policy`,
      },
    },
  }
}

const LAST_UPDATED = 'مايو ٢٠٢٦ · May 2026'

export default async function PrivacyPolicyPage({
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
          {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted">{LAST_UPDATED}</p>
      </div>

      {isAr ? <PrivacyArabic /> : <PrivacyEnglish />}

      <div className="mt-12 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-6">
        <h2
          className={`font-semibold text-brand-text mb-3
            ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          {isAr ? 'تواصل معنا بشأن بياناتك' : 'Contact Us About Your Data'}
        </h2>
        <p className="font-almarai text-sm text-brand-muted mb-4">
          {isAr
            ? 'لأي استفسار أو طلب حذف بياناتك، تواصل معنا:'
            : 'For any data inquiry or deletion request, reach us at:'}
        </p>
        <div className="flex flex-col gap-3">
          {BRANCH_LIST.filter((b) => b.status === 'active').map((branch) => (
            <div key={branch.id} className="flex items-center gap-4 flex-wrap">
              <span
                className={`font-semibold text-sm text-brand-text
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}
              >
                {isAr ? branch.nameAr : branch.nameEn}
              </span>
              <a
                href={branch.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-satoshi text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={`tel:${branch.phone}`}
                className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors tabular-nums"
                dir="ltr"
              >
                {branch.phone}
              </a>
            </div>
          ))}
          <a
            href={`mailto:${GENERAL_CONTACT.email}`}
            className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            {GENERAL_CONTACT.email}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Arabic ─────────────────────────────────────────────────────────────────────

function PrivacyArabic() {
  return (
    <div className="flex flex-col gap-8">
      <S title="ما البيانات التي نجمعها؟">
        <p>
          عند تقديم طلبك عبر النظام، نجمع البيانات التالية حصراً:
        </p>
        <ul>
          <li><strong>الاسم</strong> — لتأكيد الطلب وتسليمه.</li>
          <li><strong>رقم الهاتف</strong> — للتواصل بشأن طلبك عبر واتساب أو الاتصال المباشر.</li>
          <li><strong>عنوان التوصيل</strong> — للطلبات التي تشمل التوصيل.</li>
          <li><strong>تفاصيل الطلب</strong> — الأصناف والكميات والملاحظات.</li>
        </ul>
        <p>
          لا نجمع بيانات بطاقة ائتمانية، وبيانات المدفوعات تُعالَج عبر بوابة دفع آمنة مستقلة.
        </p>
      </S>

      <S title="كيف نستخدم بياناتك؟">
        <p>تُستخدم بياناتك فقط لـ:</p>
        <ul>
          <li>تأكيد طلبك وإيصاله.</li>
          <li>التواصل معك بشأن الطلب عبر واتساب.</li>
          <li>معالجة أي طلب استرداد أو شكوى.</li>
        </ul>
        <p>
          لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تسويقية.
        </p>
      </S>

      <S title="واتساب والبيانات">
        <p>
          يُرسَل ملخص طلبك إلى واتساب الفرع المختار لتأكيده وتحضيره. هذه الرسالة تحتوي على:
          اسمك، تفاصيل الطلب، وعنوان التوصيل إن وُجد.
        </p>
        <p>
          تخضع بيانات واتساب لسياسة خصوصية Meta المستقلة. نوصيك بمراجعة{' '}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold underline"
          >
            سياسة خصوصية واتساب
          </a>.
        </p>
      </S>

      <S title="مدة الاحتفاظ بالبيانات">
        <p>
          نحتفظ ببيانات الطلبات لمدة <strong>١٢ شهراً</strong> من تاريخ الطلب لأغراض
          التشغيل والمحاسبة. بعد ذلك يتم حذفها أو إخفاء هويتها.
        </p>
      </S>

      <S title="حقك في حذف بياناتك">
        <p>
          يمكنك طلب حذف بياناتك الشخصية في أي وقت عبر التواصل معنا. سنعالج طلبك خلال{' '}
          <strong>٧ أيام عمل</strong>.
        </p>
      </S>

      <S title="الكوكيز والتتبع">
        <p>
          يستخدم الموقع ملفات كوكيز ضرورية لعمل النظام (مثل سلة الطلبات وتسجيل الدخول).
          بالإضافة إلى أدوات تحليلية مثل Google Analytics وMicrosoft Clarity لتحسين تجربة
          المستخدم. يمكنك رفض الكوكيز غير الضرورية عبر بانر الكوكيز عند أول زيارة.
        </p>
      </S>

      <S title="تغييرات على سياسة الخصوصية">
        <p>
          أي تعديلات جوهرية على هذه السياسة ستُنشر على هذه الصفحة مع تحديث تاريخ المراجعة أعلاه.
        </p>
      </S>
    </div>
  )
}

// ── English ────────────────────────────────────────────────────────────────────

function PrivacyEnglish() {
  return (
    <div className="flex flex-col gap-8">
      <S title="What Data Do We Collect?">
        <p>When you place an order through our system, we collect only the following:</p>
        <ul>
          <li><strong>Name</strong> — to confirm and fulfil your order.</li>
          <li><strong>Phone number</strong> — to contact you about your order via WhatsApp or direct call.</li>
          <li><strong>Delivery address</strong> — for orders that include delivery.</li>
          <li><strong>Order details</strong> — items, quantities, and notes.</li>
        </ul>
        <p>
          We do not collect credit card data. Payment information is processed through an
          independent, secure payment gateway.
        </p>
      </S>

      <S title="How Do We Use Your Data?">
        <p>Your data is used solely to:</p>
        <ul>
          <li>Confirm and deliver your order.</li>
          <li>Contact you about your order via WhatsApp.</li>
          <li>Process any refund request or complaint.</li>
        </ul>
        <p>We do not sell or share your data with third parties for marketing purposes.</p>
      </S>

      <S title="WhatsApp & Data Handling">
        <p>
          A summary of your order is sent to the selected branch&apos;s WhatsApp account for
          confirmation and preparation. This message contains your name, order details, and
          delivery address if applicable.
        </p>
        <p>
          WhatsApp data is subject to Meta&apos;s independent privacy policy. We recommend reviewing{' '}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold underline"
          >
            WhatsApp&apos;s Privacy Policy
          </a>.
        </p>
      </S>

      <S title="Data Retention">
        <p>
          We retain order data for <strong>12 months</strong> from the order date for
          operational and accounting purposes. After this period, data is deleted or anonymised.
        </p>
      </S>

      <S title="Your Right to Deletion">
        <p>
          You may request deletion of your personal data at any time by contacting us. We will
          process your request within <strong>7 business days</strong>.
        </p>
      </S>

      <S title="Cookies & Tracking">
        <p>
          This site uses necessary cookies for system functionality (e.g. shopping cart, login).
          We also use analytical tools such as Google Analytics and Microsoft Clarity to improve
          the user experience. You can decline non-essential cookies via the cookie banner on
          your first visit.
        </p>
      </S>

      <S title="Changes to This Policy">
        <p>
          Any material changes to this policy will be published on this page with an updated
          revision date shown above.
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
                   [&_li]:leading-relaxed [&_strong]:text-brand-text"
      >
        {children}
      </div>
    </section>
  )
}
