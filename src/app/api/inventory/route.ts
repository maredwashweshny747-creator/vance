import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'sales') {
    const sales = await prisma.storeSale.findMany({
      where: { gymId: gym.id },
      include: { item: true },
      orderBy: { soldAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(sales)
  }

  const items = await prisma.inventoryItem.findMany({ where: { gymId: gym.id, isActive: true }, orderBy: { name: 'asc' } })
  const lowStock = items.filter(i => i.stock <= i.lowStockAt)
  const totalValue = items.reduce((s, i) => s + i.stock * i.costPrice, 0)
  const todaySales = await prisma.storeSale.aggregate({
    where: { gymId: gym.id, soldAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    _sum: { total: true },
    _count: true,
  })
  return NextResponse.json({
    items,
    stats: { lowStockCount: lowStock.length, totalValue, todayRevenue: todaySales._sum.total || 0, todaySales: todaySales._count },
  })
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const body = await req.json()

  if (body._type === 'sale') {
    const item = await prisma.inventoryItem.findFirst({ where: { id: body.itemId, gymId: gym.id } })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    const qty = Number(body.quantity) || 1
    if (item.stock < qty) return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    const sale = await prisma.storeSale.create({
      data: {
        gymId:     gym.id,
        itemId:    body.itemId,
        quantity:  qty,
        unitPrice: item.sellPrice,
        total:     item.sellPrice * qty,
        method:    body.method || 'CASH',
      },
    })
    await prisma.inventoryItem.update({ where: { id: body.itemId }, data: { stock: { decrement: qty } } })
    return NextResponse.json(sale)
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        gymId:      gym.id,
        name:       body.name,
        sku:        body.sku        || null,
        category:   body.category   || 'OTHER',
        costPrice:  Number(body.costPrice)  || 0,
        sellPrice:  Number(body.sellPrice)  || 0,
        stock:      Number(body.stock)      || 0,
        lowStockAt: Number(body.lowStockAt) || 5,
        barcode:    body.barcode    || null,
        description:body.description|| null,
      },
    })
    return NextResponse.json(item)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create item' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const body = await req.json()
  const data: any = {}
  if (body.name        !== undefined) data.name        = body.name
  if (body.stock       !== undefined) data.stock       = Number(body.stock)
  if (body.costPrice   !== undefined) data.costPrice   = Number(body.costPrice)
  if (body.sellPrice   !== undefined) data.sellPrice   = Number(body.sellPrice)
  if (body.lowStockAt  !== undefined) data.lowStockAt  = Number(body.lowStockAt)
  if (body.status      !== undefined) data.status      = body.status
  if (body.isActive    !== undefined) data.isActive    = body.isActive
  await prisma.inventoryItem.updateMany({ where: { id, gymId: gym.id }, data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await prisma.inventoryItem.deleteMany({ where: { id, gymId: gym.id } })
  return NextResponse.json({ success: true })
}
