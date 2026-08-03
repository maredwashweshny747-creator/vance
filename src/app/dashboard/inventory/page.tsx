'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, ShoppingCart, AlertTriangle, DollarSign, TrendingUp, Search, X, Trash2, Minus } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Item { id:string; name:string; sku?:string; category:string; costPrice:number; sellPrice:number; stock:number; lowStockAt:number; barcode?:string; description?:string }
interface Sale { id:string; soldAt:string; quantity:number; total:number; unitPrice:number; item:Item }
interface Stats { lowStockCount:number; totalValue:number; todayRevenue:number; todaySales:number }

const CATEGORIES = ['SUPPLEMENT','DRINK','MERCHANDISE','GEAR','OTHER']
const CAT_COLORS: Record<string,string> = { SUPPLEMENT:'text-primary-400', DRINK:'text-blue-400', MERCHANDISE:'text-purple-400', GEAR:'text-crimson-400', OTHER:'text-dark-300' }

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock'|'pos'|'sales'>('stock')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [cart, setCart] = useState<{item:Item; qty:number}[]>([])
  const [payMethod, setPayMethod] = useState<'CASH'|'CARD'>('CASH')
  const [form, setForm] = useState({ name:'', sku:'', category:'SUPPLEMENT', costPrice:0, sellPrice:0, stock:0, lowStockAt:5, description:'' })

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/inventory').then(r=>r.json()),
      fetch('/api/inventory?type=sales').then(r=>r.json()),
    ]).then(([inv, sl]) => {
      setItems(inv.items || []); setStats(inv.stats || null)
      setSales(Array.isArray(sl) ? sl : []); setLoading(false)
    }).catch(()=>setLoading(false))
  }
  useEffect(()=>{ load() },[])

  async function addItem(e:React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/inventory', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    if(res.ok){ toast.success('Item added!'); setShowForm(false); load() } else { toast.error('Failed') }
  }

  async function checkout() {
    if(cart.length===0){ toast.error('Cart is empty'); return }
    let errors = 0
    for(const {item, qty} of cart) {
      const res = await fetch('/api/inventory', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ _type:'sale', itemId:item.id, quantity:qty, method:payMethod }) })
      if(!res.ok) errors++
    }
    if(errors===0){ toast.success(`Sale completed! ${formatCurrency(cartTotal)}`); setCart([]); load() }
    else toast.error(`${errors} item(s) failed`)
  }

  async function adjustStock(item:Item, delta:number) {
    const newStock = Math.max(0, item.stock + delta)
    await fetch(`/api/inventory?id=${item.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({stock:newStock}) })
    load()
  }

  async function deleteItem(id:string) {
    await fetch(`/api/inventory?id=${id}`, { method:'DELETE' })
    toast.success('Item removed'); load()
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
  const cartTotal = cart.reduce((s,c)=>s+c.item.sellPrice*c.qty, 0)

  function addToCart(item:Item) {
    setCart(prev => {
      const existing = prev.find(c=>c.item.id===item.id)
      if(existing) return prev.map(c=>c.item.id===item.id?{...c,qty:c.qty+1}:c)
      return [...prev, {item, qty:1}]
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">STORE & INVENTORY</h1>
          <p className="text-dark-300 text-sm mt-1">Supplements, drinks, merchandise — sell and track everything</p>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-primary"><Plus size={16}/> Add Item</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Today's Sales", value: formatCurrency(stats?.todayRevenue||0), color:'text-primary-400', icon:TrendingUp },
          { label:'Transactions Today', value: String(stats?.todaySales||0), color:'text-blue-400', icon:ShoppingCart },
          { label:'Inventory Value', value: formatCurrency(stats?.totalValue||0), color:'text-white', icon:Package },
          { label:'Low Stock Alerts', value: String(stats?.lowStockCount||0), color: stats?.lowStockCount ? 'text-red-400' : 'text-primary-400', icon:AlertTriangle },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="card">
              <Icon size={16} className={cn('mb-3', s.color)}/>
              <div className={cn('font-display text-3xl mb-0.5', s.color)}>{s.value}</div>
              <div className="text-xs text-dark-400">{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['stock','pos','sales'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={cn('px-5 py-2.5 rounded-xl text-sm font-medium capitalize transition-all', tab===t?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>
            {t === 'pos' ? '🛒 POS' : t === 'stock' ? '📦 Stock' : '📊 Sales Log'}
          </button>
        ))}
      </div>

      {/* Stock tab */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..." className="input pl-9"/></div>
          {stats && stats.lowStockCount > 0 && (
            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0"/>
              <p className="text-red-300 text-sm"><span className="font-bold">{stats.lowStockCount} items</span> are running low on stock</p>
            </div>
          )}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-dark-700"><tr>
                {['Item','Category','Cost','Price','Stock','Margin','Actions'].map(h=><th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? [...Array(4)].map((_,i)=><tr key={i}><td colSpan={7}><div className="h-12 skeleton m-4 rounded"/></td></tr>)
                : filtered.length===0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-dark-400">No items found</td></tr>
                : filtered.map(item=>{
                  const margin = item.sellPrice > 0 ? Math.round(((item.sellPrice-item.costPrice)/item.sellPrice)*100) : 0
                  const isLow = item.stock <= item.lowStockAt
                  return (
                    <tr key={item.id} className="hover:bg-dark-750 group transition-colors">
                      <td className="px-5 py-4">
                        <div className="text-white text-sm font-medium">{item.name}</div>
                        {item.sku && <div className="text-dark-500 text-xs">SKU: {item.sku}</div>}
                      </td>
                      <td className="px-5 py-4"><span className={cn('text-xs font-medium', CAT_COLORS[item.category])}>{item.category}</span></td>
                      <td className="px-5 py-4 text-dark-400 text-sm">{formatCurrency(item.costPrice)}</td>
                      <td className="px-5 py-4 text-white font-semibold text-sm">{formatCurrency(item.sellPrice)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={()=>adjustStock(item,-1)} className="w-6 h-6 rounded bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-dark-300 hover:text-white transition-colors"><Minus size={10}/></button>
                          <span className={cn('font-mono text-sm font-bold', isLow?'text-red-400':'text-white')}>{item.stock}</span>
                          <button onClick={()=>adjustStock(item,1)} className="w-6 h-6 rounded bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-dark-300 hover:text-white transition-colors"><Plus size={10}/></button>
                          {isLow && <AlertTriangle size={12} className="text-red-400"/>}
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className={cn('text-sm font-semibold', margin>40?'text-primary-400':margin>20?'text-yellow-400':'text-red-400')}>{margin}%</span></td>
                      <td className="px-5 py-4">
                        <button onClick={()=>deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-dark-600 transition-all"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* POS tab */}
      {tab === 'pos' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find item..." className="input pl-9"/></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.filter(i=>i.stock>0).map(item=>(
                <motion.button key={item.id} whileTap={{scale:0.97}} onClick={()=>addToCart(item)}
                  className="card-hover text-left p-4 transition-all hover:border-primary-400/40">
                  <div className={cn('text-xs font-medium mb-2', CAT_COLORS[item.category])}>{item.category}</div>
                  <div className="text-white text-sm font-semibold mb-1 line-clamp-2">{item.name}</div>
                  <div className="text-primary-400 font-display text-lg">{formatCurrency(item.sellPrice)}</div>
                  <div className="text-dark-500 text-xs mt-1">{item.stock} in stock</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 flex flex-col">
            <h3 className="font-display text-xl tracking-wider text-white mb-4">CART</h3>
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-dark-500 text-sm">Click items to add</div>
            ) : (
              <div className="flex-1 space-y-2 mb-4">
                {cart.map(({item,qty})=>(
                  <div key={item.id} className="flex items-center gap-2 bg-dark-700 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate">{item.name}</div>
                      <div className="text-dark-400 text-xs">{formatCurrency(item.sellPrice)} each</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setCart(c=>c.map(x=>x.item.id===item.id?{...x,qty:Math.max(1,x.qty-1)}:x))} className="w-6 h-6 rounded bg-dark-600 hover:bg-dark-500 flex items-center justify-center text-xs">-</button>
                      <span className="text-white text-sm w-5 text-center">{qty}</span>
                      <button onClick={()=>setCart(c=>c.map(x=>x.item.id===item.id?{...x,qty:x.qty+1}:x))} className="w-6 h-6 rounded bg-dark-600 hover:bg-dark-500 flex items-center justify-center text-xs">+</button>
                    </div>
                    <button onClick={()=>setCart(c=>c.filter(x=>x.item.id!==item.id))} className="text-dark-500 hover:text-red-400 p-1"><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-dark-700 pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400 text-sm">Total</span>
                <span className="text-white font-display text-xl">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex gap-2">
                {(['CASH','CARD'] as const).map(m=>(
                  <button key={m} onClick={()=>setPayMethod(m)}
                    className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', payMethod===m?'bg-primary-400 text-dark-950 font-bold':'bg-dark-700 text-dark-300')}>
                    {m==='CASH'?'💵 Cash':'💳 Card'}
                  </button>
                ))}
              </div>
              <button onClick={checkout} disabled={cart.length===0} className="btn-primary w-full justify-center disabled:opacity-50">
                <ShoppingCart size={16}/> Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales log */}
      {tab === 'sales' && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-dark-700"><tr>
              {['Item','Qty','Unit Price','Total','Date'].map(h=><th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-dark-700">
              {sales.length===0?<tr><td colSpan={5} className="px-5 py-12 text-center text-dark-400">No sales yet</td></tr>
              : sales.map(s=>(
                <tr key={s.id} className="hover:bg-dark-750 transition-colors">
                  <td className="px-5 py-3 text-white text-sm">{s.item.name}</td>
                  <td className="px-5 py-3 text-dark-400 text-sm">{s.quantity}</td>
                  <td className="px-5 py-3 text-dark-400 text-sm">{formatCurrency(s.unitPrice)}</td>
                  <td className="px-5 py-3 text-primary-400 font-semibold text-sm">{formatCurrency(s.total)}</td>
                  <td className="px-5 py-3 text-dark-400 text-xs">{new Date(s.soldAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD ITEM</h2>
                <button onClick={()=>setShowForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <form onSubmit={addItem} className="space-y-4">
                <div><label className="label">Product Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="e.g. Whey Protein 1kg"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Category</label>
                    <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="input">
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="label">SKU (optional)</label><input value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} className="input" placeholder="WP-1KG"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Cost Price ($)</label><input type="number" value={form.costPrice} onChange={e=>setForm(f=>({...f,costPrice:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                  <div><label className="label">Sell Price ($)</label><input type="number" value={form.sellPrice} onChange={e=>setForm(f=>({...f,sellPrice:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Initial Stock</label><input type="number" value={form.stock} onChange={e=>setForm(f=>({...f,stock:+e.target.value}))} min={0} className="input"/></div>
                  <div><label className="label">Low Stock Alert at</label><input type="number" value={form.lowStockAt} onChange={e=>setForm(f=>({...f,lowStockAt:+e.target.value}))} min={0} className="input"/></div>
                </div>
                {form.costPrice>0&&form.sellPrice>0&&<div className="bg-dark-700 rounded-xl p-3 text-center"><span className="text-dark-400 text-sm">Profit Margin: </span><span className={cn('font-bold text-sm',((form.sellPrice-form.costPrice)/form.sellPrice)*100>40?'text-primary-400':'text-yellow-400')}>{Math.round(((form.sellPrice-form.costPrice)/form.sellPrice)*100)}%</span></div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Item</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
