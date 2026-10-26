import { useId, type InputHTMLAttributes } from 'react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function AuthField({ label, hint, id, className, ...props }: AuthFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-medium text-base-content/60"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className={`input input-bordered h-12 w-full rounded-xl border-line/70 bg-base-100 px-4 text-sm text-base-content transition-colors duration-200 placeholder:text-base-content/40 focus:border-neutral focus:outline-none focus:ring-2 focus:ring-black/15 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-[11px] leading-snug text-base-content/55">
          {hint}
        </p>
      )}
    </div>
  )
}
