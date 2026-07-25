'use client'

export function LogoMarquee() {
  const clubs = [
    'Ironclad FC', 'Blackout Boxing', 'Apex Combat Club', 'Redline MMA',
    'Titan Fight Team', 'Crescent BJJ', 'Warhouse Muay Thai', 'Vanguard Fighters',
    'Fury Athletics', 'Steel Ring Gym', 'Backstreet Boxing', 'Grit & Bone MMA',
  ]

  return (
    <section className="py-12 border-y border-dark-700 overflow-hidden bg-dark-900/50">
      <p className="text-center text-xs text-dark-400 font-body tracking-widest uppercase mb-6">
        Trusted by fight clubs worldwide
      </p>
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {[...clubs, ...clubs].map((club, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 text-dark-400 font-display text-xl tracking-widest"
          >
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
            {club.toUpperCase()}
          </span>
        ))}
      </div>
    </section>
  )
}
