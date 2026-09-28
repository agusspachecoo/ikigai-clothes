import { Link } from 'react-router-dom'

export interface Miga {
  label: string
  to?: string
}

/** Miga de pan para catálogo, outfit y páginas institucionales. */
export function Breadcrumbs({ items }: { items: Miga[] }) {
  return (
    <nav aria-label="Miga de pan" className="text-xs opacity-60 mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.to ? (
              <Link to={item.to} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
