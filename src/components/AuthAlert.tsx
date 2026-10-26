import type { ReactNode } from 'react'

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-red-700"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.34 3.94l-7.5 13A1.5 1.5 0 004.14 19.5h15.72a1.5 1.5 0 001.3-2.56l-7.5-13a1.5 1.5 0 00-2.6 0z"
        />
      </svg>
      <span>{children}</span>
    </div>
  )
}
