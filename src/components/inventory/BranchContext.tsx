'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface BranchOption {
  id:      string
  name_ar: string
  name_en: string
}

interface BranchContextValue {
  selectedBranchId: string | null
  setSelectedBranch: (id: string | null) => void
  branches: BranchOption[]
  isGlobal: boolean
}

const BranchCtx = createContext<BranchContextValue>({
  selectedBranchId:  null,
  setSelectedBranch: () => {},
  branches:          [],
  isGlobal:          false,
})

const LS_KEY = 'kahramana_inventory_branch'

interface Props {
  children:        ReactNode
  branches:        BranchOption[]
  defaultBranchId: string | null
  isGlobal:        boolean
}

export function BranchProvider({ children, branches, defaultBranchId, isGlobal }: Props) {
  const [selectedBranchId, setSelected] = useState<string | null>(() => {
    if (!isGlobal) return defaultBranchId
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LS_KEY)
      if (stored && branches.some(b => b.id === stored)) return stored
    }
    return defaultBranchId
  })

  useEffect(() => {
    if (isGlobal && selectedBranchId) {
      localStorage.setItem(LS_KEY, selectedBranchId)
    }
  }, [isGlobal, selectedBranchId])

  const setSelectedBranch = (id: string | null) => {
    if (!isGlobal) return
    setSelected(id)
  }

  return (
    <BranchCtx.Provider value={{ selectedBranchId, setSelectedBranch, branches, isGlobal }}>
      {children}
    </BranchCtx.Provider>
  )
}

export function useBranchContext() {
  return useContext(BranchCtx)
}
