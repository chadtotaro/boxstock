'use client'

import dynamic from 'next/dynamic'

const BuilderApp = dynamic(() => import('@/components/builder/app/App'), { ssr: false })

export default function BuilderPage() {
  return <BuilderApp />
}