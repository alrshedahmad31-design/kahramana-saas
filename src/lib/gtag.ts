// Thin wrapper around window.gtag for GA4 funnel events.
// Safe to call on server — returns immediately if window/gtag is absent.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function track(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params)
}

export const gtag = {
  viewItem(item: { id: string; name: string; category?: string; price?: number }) {
    track('view_item', {
      currency: 'BHD',
      value: item.price ?? 0,
      items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price ?? 0 }],
    })
  },

  addToCart(item: { id: string; name: string; category?: string; price: number; quantity: number }) {
    track('add_to_cart', {
      currency: 'BHD',
      value: item.price * item.quantity,
      items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price, quantity: item.quantity }],
    })
  },

  beginCheckout(params: { value: number; itemCount: number }) {
    track('begin_checkout', { currency: 'BHD', value: params.value, num_items: params.itemCount })
  },

  whatsappClick(context: 'order' | 'catering' | 'branch' | 'checkout') {
    track('whatsapp_click', { event_category: 'engagement', event_label: context })
  },

  generateLead(type: 'contact_form' | 'catering_inquiry') {
    track('generate_lead', { event_category: 'lead', event_label: type })
  },
}
