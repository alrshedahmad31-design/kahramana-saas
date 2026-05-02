import { BRANCHES } from '@/lib/constants/branches'

export function FAQSchema({ locale }: { locale: "ar" | "en" }) {
  const riffa = BRANCHES[0]
  const qallali = BRANCHES[1]
  const badi = BRANCHES[2]

  const faqs = locale === "ar"
    ? [
        {
          q: "ما أوقات عمل مطعم كهرمانة بغداد؟",
          a: `${riffa.name_ar}: يومياً من ${riffa.opens_display_ar} حتى ${riffa.closes_display_ar}. ${qallali.name_ar}: يومياً من ${qallali.opens_display_ar} حتى ${qallali.closes_display_ar}. ${badi.name_ar}: قريباً.`
        },
        {
          q: "أين يقع مطعم كهرمانة بغداد في البحرين؟",
          a: "كهرمانة بغداد لديها فرعان في البحرين: فرع الرفاع وفرع قلالي، مع فرع ثالث قيد الإنشاء في البديع."
        },
        {
          q: "كيف أطلب من مطعم كهرمانة؟",
          a: `يمكنك الطلب مباشرة عبر واتساب على الرقم ${riffa.whatsapp} أو بالزيارة المباشرة لأي فرع.`
        },
        {
          q: "كم سعر المسكوف العراقي في كهرمانة البحرين؟",
          a: "يبدأ سعر المسكوف العراقي الأصيل المشوي على حطب المشمش من 9.000 دينار بحريني في مطعم كهرمانة بغداد."
        },
        {
          q: "هل يقدم مطعم كهرمانة فطوراً بغدادياً؟",
          a: "نعم، تقدم كهرمانة بغداد فطوراً عراقياً أصيلاً يضم أكثر من ٢٣ صنفاً من الباقلاء بالدهن والمخلمة وبيض الدهن الحر والمضروبة البحرينية."
        },
        {
          q: "هل مطعم كهرمانة يقدم وجبات الشاورما؟",
          a: "نعم، تقدم كهرمانة شاورما عراقية أصيلة بأنواع متعددة: خبز تنور، صمون عراقي، خبز لبناني، وصاج، بأسعار تبدأ من ٠.٥ دينار بحريني."
        },
        {
          q: "هل يقدم مطعم كهرمانة خدمات للولائم والمناسبات؟",
          a: "نعم، تقدم كهرمانة بغداد خدمات الولائم والمناسبات بما فيها الخروف الكامل المطهو ببطء من 40.000 دينار بحريني. تواصل معنا عبر واتساب."
        },
        {
          q: "ما هو أفضل مطعم عراقي في البحرين؟",
          a: "كهرمانة بغداد هو المطعم العراقي الأصيل في البحرين، يقدم أكثر من 168 طبقاً بغدادياً من مسكوف ومشاوي وقوزي وفطور عراقي في فروع الرفاع وقلالي."
        },
        {
          q: "هل مطعم كهرمانة يقدم بيتزا؟",
          a: "تقدم كهرمانة بغداد بيتزا كهرمانة بنكهة عراقية مميزة، إضافة إلى مجموعة واسعة من الفطائر والمشويات على التنور."
        },
        {
          q: "ما أنواع المشويات المتوفرة في كهرمانة؟",
          a: "تقدم كهرمانة مشويات متنوعة على الفحم: كباب لحم وكباب دجاج، تكة لحم وتكة دجاج، ضلوع غنم، رقبة مشوية، عرايس، معلاق، وجوانح دجاج — بأسعار تبدأ من 1.200 دينار."
        }
      ]
    : [
        {
          q: "What are Kahramana Baghdad's opening hours in Bahrain?",
          a: `${riffa.name_en}: Daily ${riffa.opens_display_en} - ${riffa.closes_display_en}. ${qallali.name_en}: Daily ${qallali.opens_display_en} - ${qallali.closes_display_en}. ${badi.name_en}: Coming soon.`
        },
        {
          q: "Where is Kahramana Baghdad restaurant located in Bahrain?",
          a: "Kahramana Baghdad has two branches in Bahrain: Riffa branch and Qallali branch, with a third branch coming soon in Al-Budaiya."
        },
        {
          q: "How can I order from Kahramana Baghdad?",
          a: `You can order directly via WhatsApp at ${riffa.phone} or visit any of our branches in Bahrain.`
        },
        {
          q: "How much does Masgouf cost at Kahramana Bahrain?",
          a: "Authentic Iraqi Masgouf grilled on apricot wood starts from 9.000 BHD at Kahramana Baghdad restaurant in Bahrain."
        },
        {
          q: "Does Kahramana Baghdad serve Iraqi breakfast?",
          a: "Yes, Kahramana Baghdad offers an authentic Baghdadi breakfast menu with over 23 items including Bagela bil Dihen, Makhlama, Fried Eggs in Ghee, and Bahraini Madhroobah."
        },
        {
          q: "What is the best Iraqi restaurant in Bahrain?",
          a: "Kahramana Baghdad is Bahrain's authentic Iraqi restaurant, serving over 168 Baghdadi dishes including Masgouf, grills, Quzi, Iraqi breakfast, and Iraqi shawarma at branches in Riffa and Qallali."
        },
        {
          q: "Does Kahramana offer catering and events?",
          a: "Yes, Kahramana Baghdad offers full catering and banquet services including whole slow-cooked lamb starting from 40.000 BHD. Contact us via WhatsApp."
        },
        {
          q: "What types of grills does Kahramana serve?",
          a: "Kahramana serves charcoal-grilled meat and chicken kabab, tikka, lamb ribs, grilled neck, arayes, grilled liver, and chicken wings — starting from 1.200 BHD."
        }
      ];

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(({ q, a }) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": a
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 0) }}
    />
  );
}
