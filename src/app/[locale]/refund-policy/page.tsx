import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { BRANCH_LIST, GENERAL_CONTACT } from '@/constants/contact'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'ar'
      ? 'سياسة الإلغاء والاسترداد — كهرمانة بغداد'
      : 'Cancellation & Refund Policy — Kahramana Baghdad',
    alternates: {
      languages: { ar: '/refund-policy', en: '/en/refund-policy' },
    },
  }
}

const LAST_UPDATED = 'أبريل ٢٠٢٦ · April 2026'

export default async function RefundPolicyPage({
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
          {isAr ? 'سياسة الإلغاء والاسترداد' : 'Refund & Cancellation Policy'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted">{LAST_UPDATED}</p>
      </div>

      {isAr
        ? <RefundArabic />
        : <RefundEnglish />
      }

      {/* Contact for disputes */}
      <div className="mt-12 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-6">
        <h2
          className={`font-semibold text-brand-text mb-3
            ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          {isAr ? 'للتواصل بشأن طلب استرداد' : 'Contact Us About a Refund'}
        </h2>
        <p className="font-almarai text-sm text-brand-muted mb-4">
          {isAr
            ? 'تواصل مع فرعك مباشرة عبر واتساب أو اتصل بنا:'
            : 'Contact your branch directly via WhatsApp or reach us at:'}
        </p>
        <div className="flex flex-col gap-3">
          {BRANCH_LIST.map((branch) => (
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

function RefundArabic() {
  return (
    <div className="flex flex-col gap-8">
      <R title="نافذة الإلغاء المجاني">
        <p>
          يمكنك إلغاء طلبك <strong>مجاناً وبالكامل</strong> خلال <strong>١٠ دقائق</strong> من
          تأكيد طلبك عبر واتساب. بعد هذه المدة، يكون الطلب قيد التحضير وقد لا يمكن إلغاؤه.
        </p>
        <p>
          لإلغاء طلبك، أرسل رسالة واتساب إلى فرعك الذي طلبت منه مع ذكر رقم الطلب
          وطلب الإلغاء.
        </p>
      </R>

      <R title="حالات الاسترداد المقبولة">
        <p>نقبل طلبات الاسترداد في الحالات التالية:</p>
        <ul>
          <li>استلام طلب مختلف تماماً عما طلبت.</li>
          <li>عدم اكتمال الطلب (أصناف ناقصة).</li>
          <li>وجود مشكلة في جودة الطعام تؤكدها الصور أو يقرها فريقنا.</li>
          <li>عدم وصول الطلب بعد مرور وقت معقول.</li>
        </ul>
      </R>

      <R title="حالات عدم الاسترداد">
        <p>لا نقبل طلبات الاسترداد في الحالات التالية:</p>
        <ul>
          <li>تغيير رأيك بعد بدء التحضير.</li>
          <li>تقديم بيانات تواصل خاطئة أدت إلى تأخير التوصيل.</li>
          <li>مرور أكثر من ٢٤ ساعة على استلام الطلب دون إبلاغنا بالمشكلة.</li>
          <li>الطلبات المُلغاة بعد التسليم إلى سائق التوصيل.</li>
        </ul>
      </R>

      <R title="آلية الاسترداد">
        <p>
          بما أن الدفع نقدي حالياً، يتم الاسترداد عبر إحدى الطريقتين:
        </p>
        <ul>
          <li><strong>الاسترداد الفوري</strong> — نقداً في الفرع عند إعادة الطلب.</li>
          <li><strong>قسيمة شراء</strong> — رصيد لطلبك القادم بنفس القيمة أو أعلى.</li>
        </ul>
        <p>
          نهدف إلى معالجة جميع طلبات الاسترداد خلال <strong>٢٤ ساعة</strong> من الإبلاغ.
        </p>
      </R>

      <R title="استثناءات">
        <p>
          في حالات القوة القاهرة (أعطال الطريق، الكوارث الطبيعية، وغيرها)، قد يتأخر التوصيل
          أو يُلغى دون استرداد إضافي. سنحرص دائماً على التواصل معك مسبقاً.
        </p>
      </R>
    </div>
  )
}

// ── English ────────────────────────────────────────────────────────────────────

function RefundEnglish() {
  return (
    <div className="flex flex-col gap-8">
      <R title="Free Cancellation Window">
        <p>
          You may cancel your order <strong>free of charge in full</strong> within{' '}
          <strong>10 minutes</strong> of your order being confirmed via WhatsApp. After this
          period, your order is in preparation and cancellation may no longer be possible.
        </p>
        <p>
          To cancel, send a WhatsApp message to the branch you ordered from, quoting your
          order number and requesting cancellation.
        </p>
      </R>

      <R title="Accepted Refund Scenarios">
        <p>We accept refund requests in the following cases:</p>
        <ul>
          <li>You received a completely different order from what you requested.</li>
          <li>Your order was incomplete (missing items).</li>
          <li>A food quality issue confirmed by photos or acknowledged by our team.</li>
          <li>Your order failed to arrive within a reasonable time.</li>
        </ul>
      </R>

      <R title="Non-Refundable Situations">
        <p>We do not accept refund requests in the following situations:</p>
        <ul>
          <li>Change of mind after preparation has begun.</li>
          <li>Incorrect contact details provided, leading to delivery delays.</li>
          <li>More than 24 hours have passed since receiving the order without notifying us.</li>
          <li>Orders cancelled after handover to the delivery driver.</li>
        </ul>
      </R>

      <R title="Refund Process">
        <p>
          As payment is currently cash-only, refunds are processed via one of two methods:
        </p>
        <ul>
          <li><strong>Immediate cash refund</strong> — returned at the branch upon order return.</li>
          <li><strong>Store credit voucher</strong> — credit toward your next order of equal or greater value.</li>
        </ul>
        <p>
          We aim to process all refund requests within <strong>24 hours</strong> of notification.
        </p>
      </R>

      <R title="Exceptions">
        <p>
          In cases of force majeure (road accidents, natural disasters, etc.), delivery may be
          delayed or cancelled without an additional refund. We will always make every effort
          to contact you in advance.
        </p>
      </R>
    </div>
  )
}

function R({ title, children }: { title: string; children: React.ReactNode }) {
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
