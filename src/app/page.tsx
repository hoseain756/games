import { Suspense } from 'react'
import { HomeRouter } from '@/components/home-router'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomeRouter />
    </Suspense>
  )
}
