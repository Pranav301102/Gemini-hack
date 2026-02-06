'use client'

import React from 'react'
import MermaidDiagram from './MermaidDiagram'
import { HiArrowUp, HiArrowDown, HiMinus, HiCheck, HiExclamation, HiClock, HiLightningBolt } from 'react-icons/hi'

// Widget type definitions (mirrors src/types.ts)
type WidgetType = 'diagram' | 'kpi' | 'table' | 'timeline' | 'workflow' | 'list' | 'text' | 'chart'

interface BaseWidget {
  id: string
  type: WidgetType
  title: string
  order: number
}

interface DiagramWidget extends BaseWidget {
  type: 'diagram'
  diagramType: string
  code: string
}

interface KPIWidget extends BaseWidget {
  type: 'kpi'
  metrics: {
    label: string
    value: string | number
    target?: string | number
    unit?: string
    status?: 'on-track' | 'at-risk' | 'critical' | 'complete'
    trend?: 'up' | 'down' | 'stable'
  }[]
}

interface TableWidget extends BaseWidget {
  type: 'table'
  headers: string[]
  rows: string[][]
}

interface TimelineWidget extends BaseWidget {
  type: 'timeline'
  milestones: {
    date: string
    title: string
    description?: string
    status: 'completed' | 'in-progress' | 'upcoming' | 'delayed'
    dependencies?: string[]
  }[]
}

interface WorkflowWidget extends BaseWidget {
  type: 'workflow'
  steps: {
    name: string
    status: 'completed' | 'active' | 'pending' | 'blocked'
    assignee?: string
    dueDate?: string
    blockedReason?: string
    description?: string
  }[]
}

interface ListWidget extends BaseWidget {
  type: 'list'
  listType: 'checklist' | 'bullet' | 'numbered' | 'requirements'
  items: {
    text: string
    completed?: boolean
    priority?: 'critical' | 'high' | 'medium' | 'low'
    category?: string
  }[]
}

interface TextWidget extends BaseWidget {
  type: 'text'
  content: string
}

interface ChartWidget extends BaseWidget {
  type: 'chart'
  chartType: 'line' | 'bar' | 'pie' | 'area'
  data: Record<string, unknown>[]
  xKey: string
  yKeys: string[]
  colors?: string[]
}

export type DashboardWidget =
  | DiagramWidget
  | KPIWidget
  | TableWidget
  | TimelineWidget
  | WorkflowWidget
  | ListWidget
  | TextWidget
  | ChartWidget

// --- Sub-renderers ---

function KPIRenderer({ widget }: { widget: KPIWidget }) {
  const statusColors: Record<string, string> = {
    'on-track': 'text-green-400 bg-green-400/10',
    'at-risk': 'text-yellow-400 bg-yellow-400/10',
    'critical': 'text-red-400 bg-red-400/10',
    'complete': 'text-blue-400 bg-blue-400/10',
  }

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === 'up') return <HiArrowUp className="w-3 h-3 text-green-400" />
    if (trend === 'down') return <HiArrowDown className="w-3 h-3 text-red-400" />
    return <HiMinus className="w-3 h-3 text-gray-500" />
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {widget.metrics.map((m, i) => (
        <div key={i} className={`rounded-lg p-3 border border-gray-700 ${statusColors[m.status ?? 'on-track'] ?? 'bg-gray-800/50'}`}>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</div>
          <div className="flex items-end gap-1">
            <span className="text-xl font-bold text-white">{m.value}</span>
            {m.unit && <span className="text-xs text-gray-500 mb-0.5">{m.unit}</span>}
            <TrendIcon trend={m.trend} />
          </div>
          {m.target && (
            <div className="text-[10px] text-gray-500 mt-1">Target: {m.target}{m.unit ? ` ${m.unit}` : ''}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function TableRenderer({ widget }: { widget: TableWidget }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            {widget.headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-3 text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {widget.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 px-3 text-gray-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TimelineRenderer({ widget }: { widget: TimelineWidget }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    completed: { color: 'border-green-500 bg-green-500', icon: <HiCheck className="w-3 h-3 text-white" /> },
    'in-progress': { color: 'border-blue-500 bg-blue-500', icon: <HiLightningBolt className="w-3 h-3 text-white" /> },
    upcoming: { color: 'border-gray-600 bg-gray-700', icon: <HiClock className="w-3 h-3 text-gray-400" /> },
    delayed: { color: 'border-red-500 bg-red-500', icon: <HiExclamation className="w-3 h-3 text-white" /> },
  }

  return (
    <div className="space-y-0">
      {widget.milestones.map((m, i) => {
        const cfg = statusConfig[m.status] ?? statusConfig.upcoming
        return (
          <div key={i} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                {cfg.icon}
              </div>
              {i < widget.milestones.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-700 min-h-[24px]" />
              )}
            </div>
            {/* Content */}
            <div className="pb-4">
              <div className="text-[10px] text-gray-500">{m.date}</div>
              <div className="text-xs font-medium text-white">{m.title}</div>
              {m.description && <div className="text-[10px] text-gray-400 mt-0.5">{m.description}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkflowRenderer({ widget }: { widget: WorkflowWidget }) {
  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    completed: { bg: 'bg-green-900/20', text: 'text-green-400', dot: 'bg-green-500' },
    active: { bg: 'bg-blue-900/20', text: 'text-blue-400', dot: 'bg-blue-500 animate-pulse' },
    pending: { bg: 'bg-gray-800/50', text: 'text-gray-500', dot: 'bg-gray-600' },
    blocked: { bg: 'bg-red-900/20', text: 'text-red-400', dot: 'bg-red-500' },
  }

  return (
    <div className="space-y-1">
      {widget.steps.map((step, i) => {
        const cfg = statusConfig[step.status] ?? statusConfig.pending
        return (
          <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${cfg.bg}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium ${cfg.text}`}>{step.name}</div>
              {step.description && <div className="text-[10px] text-gray-500 truncate">{step.description}</div>}
            </div>
            {step.assignee && <div className="text-[10px] text-gray-500">{step.assignee}</div>}
            {step.blockedReason && (
              <div className="text-[10px] text-red-400 italic">{step.blockedReason}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListRenderer({ widget }: { widget: ListWidget }) {
  const priorityColors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-gray-400',
  }

  return (
    <div className="space-y-1">
      {widget.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 py-1">
          {/* Marker based on list type */}
          {widget.listType === 'checklist' || widget.listType === 'requirements' ? (
            <div className={`w-4 h-4 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center ${
              item.completed ? 'bg-green-500 border-green-500' : 'border-gray-600'
            }`}>
              {item.completed && <HiCheck className="w-3 h-3 text-white" />}
            </div>
          ) : widget.listType === 'numbered' ? (
            <span className="text-xs text-gray-500 w-5 flex-shrink-0 text-right">{i + 1}.</span>
          ) : (
            <span className="text-gray-600 mt-1 flex-shrink-0">&#x2022;</span>
          )}
          <div className="flex-1 min-w-0">
            <span className={`text-xs ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
              {item.text}
            </span>
            {item.priority && (
              <span className={`ml-2 text-[10px] ${priorityColors[item.priority] ?? 'text-gray-500'}`}>
                [{item.priority}]
              </span>
            )}
            {item.category && (
              <span className="ml-2 text-[10px] text-gray-600 bg-gray-800 px-1 rounded">{item.category}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TextRenderer({ widget }: { widget: TextWidget }) {
  return (
    <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
      {widget.content}
    </div>
  )
}

function ChartRenderer({ widget }: { widget: ChartWidget }) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  const colors = widget.colors ?? defaultColors

  if (widget.chartType === 'pie') {
    return <PieChart widget={widget} colors={colors} />
  }

  return <BarChart widget={widget} colors={colors} />
}

function PieChart({ widget, colors }: { widget: ChartWidget; colors: string[] }) {
  const yKey = widget.yKeys[0]
  const total = widget.data.reduce((sum, d) => sum + (Number(d[yKey]) || 0), 0)
  if (total === 0) return <div className="text-xs text-gray-500">No data</div>

  let cumulative = 0
  const slices = widget.data.map((d, i) => {
    const value = Number(d[yKey]) || 0
    const pct = value / total
    const startAngle = cumulative * 360
    cumulative += pct
    const endAngle = cumulative * 360
    return { label: String(d[widget.xKey]), value, pct, startAngle, endAngle, color: colors[i % colors.length] }
  })

  const size = 120
  const r = 50
  const cx = size / 2
  const cy = size / 2

  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          if (s.pct >= 1) {
            return <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />
          }
          const start = polarToCartesian(s.startAngle)
          const end = polarToCartesian(s.endAngle)
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`}
              fill={s.color}
            />
          )
        })}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-300">{s.label}</span>
            <span className="text-gray-500">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ widget, colors }: { widget: ChartWidget; colors: string[] }) {
  const yKey = widget.yKeys[0]
  const maxVal = Math.max(...widget.data.map(d => Number(d[yKey]) || 0), 1)

  return (
    <div className="space-y-1">
      {widget.data.map((d, i) => {
        const value = Number(d[yKey]) || 0
        const pct = (value / maxVal) * 100
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-gray-400 truncate text-right">{String(d[widget.xKey])}</div>
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: colors[i % colors.length] }}
              />
            </div>
            <div className="w-10 text-[10px] text-gray-400 text-right">{value}</div>
          </div>
        )
      })}
    </div>
  )
}

// --- Main Widget Renderer ---

interface WidgetRendererProps {
  widget: DashboardWidget
  className?: string
}

const widgetTypeIcons: Record<WidgetType, string> = {
  diagram: 'flowchart',
  kpi: 'metrics',
  table: 'table',
  timeline: 'timeline',
  workflow: 'workflow',
  list: 'list',
  text: 'text',
  chart: 'chart',
}

export default function WidgetRenderer({ widget, className = '' }: WidgetRendererProps) {
  const renderContent = () => {
    switch (widget.type) {
      case 'diagram':
        return <MermaidDiagram chart={widget.code} />
      case 'kpi':
        return <KPIRenderer widget={widget} />
      case 'table':
        return <TableRenderer widget={widget} />
      case 'timeline':
        return <TimelineRenderer widget={widget} />
      case 'workflow':
        return <WorkflowRenderer widget={widget} />
      case 'list':
        return <ListRenderer widget={widget} />
      case 'text':
        return <TextRenderer widget={widget} />
      case 'chart':
        return <ChartRenderer widget={widget} />
      default:
        return <div className="text-xs text-gray-500">Unknown widget type</div>
    }
  }

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
          {widgetTypeIcons[widget.type]}
        </span>
        <h3 className="text-xs font-medium text-gray-300 truncate">{widget.title}</h3>
      </div>
      <div className="p-3">
        {renderContent()}
      </div>
    </div>
  )
}

// --- Widget Grid for displaying multiple widgets ---

interface WidgetGridProps {
  widgets: DashboardWidget[]
  className?: string
}

export function WidgetGrid({ widgets, className = '' }: WidgetGridProps) {
  if (!widgets || widgets.length === 0) return null

  const sorted = [...widgets].sort((a, b) => a.order - b.order)

  return (
    <div className={`grid gap-3 ${className}`}>
      {sorted.map(w => {
        // Full-width widgets
        const isFullWidth = w.type === 'diagram' || w.type === 'table' || w.type === 'timeline'
        return (
          <div key={w.id} className={isFullWidth ? 'col-span-full' : ''}>
            <WidgetRenderer widget={w} />
          </div>
        )
      })}
    </div>
  )
}
