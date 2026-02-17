'use client'

import dynamic from 'next/dynamic'

const BuilderApp = dynamic(() => import('@/components/builder/core/App'), { ssr: false })

export default function BuilderPage() {
  return <BuilderApp />
}