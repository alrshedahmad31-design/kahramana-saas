import { defineField, defineType, type SchemaTypeDefinition } from 'sanity'

// ── menuItem ──────────────────────────────────────────────────────────────────

const menuItem = defineType({
  name: 'menuItem',
  title: 'Menu Item',
  type: 'document',
  fields: [
    defineField({
      name: 'nameAr',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameEn',
      title: 'Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'descriptionAr',
      title: 'Description (Arabic)',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'descriptionEn',
      title: 'Description (English)',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    }),
    // Pricing — only one structure per item
    defineField({
      name: 'priceBhd',
      title: 'Price (BD) — Simple',
      type: 'number',
      description: 'Use for items with a single price. Leave blank if using sizes or variants.',
    }),
    defineField({
      name: 'sizes',
      title: 'Sizes',
      type: 'array',
      description: 'Use for items with size-based pricing (S/M/L/XL/Glass/etc.)',
      of: [
        defineField({
          name: 'sizeOption',
          title: 'Size Option',
          type: 'object',
          fields: [
            defineField({ name: 'key',      title: 'Key (S/M/L/XL/Glass/…)', type: 'string' }),
            defineField({ name: 'priceBhd', title: 'Price (BD)',              type: 'number' }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      description: 'Use for items with variants (e.g. "Plain" / "With Cheese"). Price is optional (free variant = size drives price).',
      of: [
        defineField({
          name: 'variantOption',
          title: 'Variant Option',
          type: 'object',
          fields: [
            defineField({ name: 'labelAr',  title: 'Label (Arabic)',  type: 'string' }),
            defineField({ name: 'labelEn',  title: 'Label (English)', type: 'string' }),
            defineField({ name: 'priceBhd', title: 'Price (BD) — leave blank if variant is free', type: 'number' }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'available',
      title: 'Available',
      type: 'boolean',
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Vegetarian', value: 'vegetarian' },
          { title: 'Spicy',      value: 'spicy'      },
          { title: 'New',        value: 'new'        },
          { title: 'Popular',    value: 'popular'    },
        ],
      },
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      description: 'Lower = appears first within category',
    }),
  ],
  preview: {
    select: { title: 'nameAr', subtitle: 'nameEn', media: 'image' },
  },
})

// ── category ──────────────────────────────────────────────────────────────────

const category = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'nameAr',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameEn',
      title: 'Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'descriptionAr',
      title: 'Description (Arabic)',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'descriptionEn',
      title: 'Description (English)',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'image',
      title: 'Category Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'nameEn' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      description: 'Lower = appears first in category filter',
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: 'nameAr', subtitle: 'nameEn', media: 'image' },
  },
})

// ── branch ────────────────────────────────────────────────────────────────────

const branch = defineType({
  name: 'branch',
  title: 'Branch',
  type: 'document',
  fields: [
    defineField({
      name: 'nameAr',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameEn',
      title: 'Name (English)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'addressAr',
      title: 'Address (Arabic)',
      type: 'string',
    }),
    defineField({
      name: 'addressEn',
      title: 'Address (English)',
      type: 'string',
    }),
    defineField({
      name: 'image',
      title: 'Branch Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Active',    value: 'active'  },
          { title: 'Planned',   value: 'planned' },
          { title: 'Closed',    value: 'closed'  },
        ],
        layout: 'radio',
      },
      initialValue: 'active',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'hoursAr',
      title: 'Hours (Arabic)',
      type: 'string',
      description: 'e.g. يومياً ٧:٠٠م – ١:٠٠ص',
    }),
    defineField({
      name: 'hoursEn',
      title: 'Hours (English)',
      type: 'string',
      description: 'e.g. Daily 7:00 PM – 1:00 AM',
    }),
    defineField({
      name: 'mapsUrl',
      title: 'Google Maps URL',
      type: 'url',
    }),
    defineField({
      name: 'delivery',
      title: 'Delivery Available',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'dineIn',
      title: 'Dine In Available',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
    }),
  ],
  preview: {
    select: { title: 'nameAr', subtitle: 'status', media: 'image' },
  },
})

// ── staffMember ───────────────────────────────────────────────────────────────
// Display schema only — operational data lives in Supabase auth.users + staff_members

const staffMember = defineType({
  name: 'staffMember',
  title: 'Staff Member',
  type: 'document',
  description: 'Public-facing staff profiles (bios, photos). Operational accounts are managed in Supabase.',
  fields: [
    defineField({
      name: 'nameAr',
      title: 'Name (Arabic)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameEn',
      title: 'Name (English)',
      type: 'string',
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      options: {
        list: [
          { title: 'Owner',           value: 'owner'           },
          { title: 'General Manager', value: 'general_manager' },
          { title: 'Branch Manager',  value: 'branch_manager'  },
          { title: 'Cashier',         value: 'cashier'         },
          { title: 'Kitchen',         value: 'kitchen'         },
          { title: 'Driver',          value: 'driver'          },
        ],
      },
    }),
    defineField({
      name: 'branch',
      title: 'Branch',
      type: 'reference',
      to: [{ type: 'branch' }],
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: { title: 'nameAr', subtitle: 'role', media: 'photo' },
  },
})

// ── order ─────────────────────────────────────────────────────────────────────
// Reference schema only — all order data lives in Supabase orders + order_items tables

const order = defineType({
  name: 'order',
  title: 'Order (Reference)',
  type: 'document',
  description: 'Reference type for Sanity Studio cross-linking. Live order data is in Supabase.',
  fields: [
    defineField({
      name: 'supabaseOrderId',
      title: 'Supabase Order ID',
      type: 'string',
      description: 'UUID from Supabase orders table',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'branch',
      title: 'Branch',
      type: 'reference',
      to: [{ type: 'branch' }],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New',              value: 'new'              },
          { title: 'Under Review',     value: 'under_review'     },
          { title: 'Accepted',         value: 'accepted'         },
          { title: 'Preparing',        value: 'preparing'        },
          { title: 'Ready',            value: 'ready'            },
          { title: 'Out for Delivery', value: 'out_for_delivery' },
          { title: 'Delivered',        value: 'delivered'        },
          { title: 'Completed',        value: 'completed'        },
          { title: 'Cancelled',        value: 'cancelled'        },
          { title: 'Payment Failed',   value: 'payment_failed'   },
        ],
      },
    }),
  ],
  preview: {
    select: { title: 'supabaseOrderId', subtitle: 'status' },
  },
})

// ── Schema export ─────────────────────────────────────────────────────────────

export const schemaTypes: SchemaTypeDefinition[] = [
  menuItem,
  category,
  branch,
  staffMember,
  order,
]

export default schemaTypes
