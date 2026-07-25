'use client'
import Link from 'next/link'
import { Swords, Twitter, Linkedin, Github, Instagram } from 'lucide-react'

const links = {
  Product: [['Features','#features'],['Pricing','#pricing'],['Dashboard','#dashboard'],['Changelog','/changelog'],['Roadmap','/roadmap']],
  Company: [['About','/about'],['Blog','/blog'],['Careers','/careers'],['Press Kit','/press'],['Contact','/contact']],
  Support: [['Documentation','/docs'],['Help Center','/help'],['API Reference','/api'],['Status','/status'],['Community','/community']],
  Legal: [['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Cookie Policy','/cookies'],['GDPR','/gdpr']],
}

export function Footer() {
  return (
    <footer className="border-t border-dark-700 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center"><Swords size={18} className="text-dark-950"/></div>
              <span className="font-display text-xl tracking-wider">VANCE</span>
            </Link>
            <p className="text-dark-400 text-sm leading-relaxed mb-6 max-w-xs">The all-in-one fight club management platform for combat sports gyms.</p>
            <div className="flex gap-3">
              {[Twitter, Linkedin, Github, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-lg bg-dark-800 border border-dark-600 flex items-center justify-center text-dark-400 hover:text-white hover:border-dark-500 transition-colors">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <h4 className="font-semibold text-white text-sm mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {items.map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-dark-400 text-sm hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-dark-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-dark-500 text-sm">© 2026 Vance Inc. All rights reserved.</p>
          <p className="text-dark-500 text-sm">Made with ❤️ for fight club owners worldwide</p>
        </div>
      </div>
    </footer>
  )
}
