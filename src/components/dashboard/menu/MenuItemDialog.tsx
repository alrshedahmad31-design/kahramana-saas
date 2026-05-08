'use client'

import { useState } from 'react'
import { createMenuItem, updateMenuItem } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Edit } from 'lucide-react'

interface MenuItem {
  id: string
  name_ar: string
  name_en: string
  description_ar?: string
  description_en?: string
  price_bhd: number
  category: string
  image_url: string
  station: string
  is_available: boolean
}

interface DialogTranslations {
  add_item:                  string
  add_item_title:            string
  edit_item_title:           string
  menu_item_form_description: string
  item_slug:                 string
  price:                     string
  name_ar:                   string
  name_en:                   string
  description_ar:            string
  description_en:            string
  category_id:               string
  kds_station:               string
  image_url:                 string
  create:                    string
  save:                      string
  add_success:               string
  update_success:            string
  error:                     string
}

interface Props {
  item?: MenuItem
  mode: 'add' | 'edit'
  translations: DialogTranslations
}

export default function MenuItemDialog({ item, mode, translations: t }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    id: item?.id || '',
    name_ar: item?.name_ar || '',
    name_en: item?.name_en || '',
    description_ar: item?.description_ar || '',
    description_en: item?.description_en || '',
    price_bhd: item?.price_bhd || 0,
    category: item?.category || '',
    image_url: item?.image_url || '',
    station: item?.station || 'main',
    is_available: item?.is_available ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = mode === 'add' 
        ? await createMenuItem(formData)
        : await updateMenuItem(item!.id, formData)

      if (res.success) {
        toast.success(mode === 'add' ? t.add_success : t.update_success)
        setOpen(false)
        if (mode === 'add') {
          setFormData({
            id: '',
            name_ar: '',
            name_en: '',
            description_ar: '',
            description_en: '',
            price_bhd: 0,
            category: '',
            image_url: '',
            station: 'main',
            is_available: true
          })
        }
      } else {
        toast.error(res.error || t.error)
      }
    } catch {
      toast.error(t.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === 'add' ? (
          <Button className="bg-brand-gold hover:bg-brand-gold/90 text-brand-surface font-bold">
            <Plus className="me-2 h-4 w-4" />
            {t.add_item}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'add' ? t.add_item_title : t.edit_item_title}</DialogTitle>
            <DialogDescription>{t.menu_item_form_description}</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id">{t.item_slug} (ID)</Label>
                <Input 
                  id="id" 
                  disabled={mode === 'edit'}
                  required
                  placeholder="item-slug-name"
                  value={formData.id}
                  onChange={(e) => setFormData({...formData, id: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t.price} (BHD)</Label>
                <Input 
                  id="price" 
                  type="number" 
                  step="0.001"
                  required
                  value={formData.price_bhd}
                  onChange={(e) => setFormData({...formData, price_bhd: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name_ar">{t.name_ar}</Label>
                <Input 
                  id="name_ar" 
                  required
                  value={formData.name_ar}
                  onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_en">{t.name_en}</Label>
                <Input 
                  id="name_en" 
                  required
                  value={formData.name_en}
                  onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description_ar">{t.description_ar}</Label>
                <Textarea 
                  id="description_ar" 
                  value={formData.description_ar}
                  onChange={(e) => setFormData({...formData, description_ar: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description_en">{t.description_en}</Label>
                <Textarea 
                  id="description_en" 
                  value={formData.description_en}
                  onChange={(e) => setFormData({...formData, description_en: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t.category_id}</Label>
                <Input 
                  id="category" 
                  required
                  placeholder="e.g., grills, starters"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="station">{t.kds_station}</Label>
                <Select 
                  value={formData.station} 
                  onValueChange={(v) => setFormData({...formData, station: v})}
                >
                  <SelectTrigger id="station">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main (Default)</SelectItem>
                    <SelectItem value="grill">Grill</SelectItem>
                    <SelectItem value="shawarma">Shawarma</SelectItem>
                    <SelectItem value="bakery">Bakery & Pizza</SelectItem>
                    <SelectItem value="appetizer_drinks">Appetizers & Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">{t.image_url}</Label>
              <Input 
                id="image_url" 
                placeholder="/assets/gallery/image.webp"
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === 'add' ? t.create : t.save)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
