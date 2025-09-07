"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { contractAPI } from "@/lib/api"
import { FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

interface Stats {
  total: number
  processing: number
  completed: number
  failed: number
}

export function ContractStats() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  })
  const [loading, setLoading] = useState(true)
  const [previousStats, setPreviousStats] = useState<Stats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Store previous stats for trend calculation
        if (stats.total > 0) {
          setPreviousStats(stats)
        }

        // Fetch contracts to calculate stats
        const response = await contractAPI.getContracts({ limit: 1000 })
        const contracts = response.contracts

        const newStats = {
          total: contracts.length,
          processing: contracts.filter((c) => c.status === "pending" || c.status === "processing").length,
          completed: contracts.filter((c) => c.status === "completed").length,
          failed: contracts.filter((c) => c.status === "failed").length,
        }

        setStats(newStats)
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const statCards = useMemo(() => {
    const getTrend = (current: number, previous: number | undefined) => {
      if (!previous || previous === 0) return null
      const change = ((current - previous) / previous) * 100
      return {
        value: Math.abs(change),
        isPositive: change > 0,
        isSignificant: Math.abs(change) > 5,
      }
    }

    return [
      {
        title: "Total Contracts",
        value: stats.total,
        icon: FileText,
        color: "text-foreground",
        trend: getTrend(stats.total, previousStats?.total),
      },
      {
        title: "Processing",
        value: stats.processing,
        icon: Clock,
        color: "text-accent",
        trend: getTrend(stats.processing, previousStats?.processing),
      },
      {
        title: "Completed",
        value: stats.completed,
        icon: CheckCircle,
        color: "text-green-600",
        trend: getTrend(stats.completed, previousStats?.completed),
      },
      {
        title: "Failed",
        value: stats.failed,
        icon: AlertTriangle,
        color: "text-destructive",
        trend: getTrend(stats.failed, previousStats?.failed),
      },
    ]
  }, [stats, previousStats])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color} transition-all duration-200`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold transition-all duration-300">{stat.value}</div>
              {stat.trend && stat.trend.isSignificant && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 animate-in slide-in-from-bottom-1 duration-300">
                  {stat.trend.isPositive ? (
                    <TrendingUp className="inline h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="inline h-3 w-3 text-red-600" />
                  )}
                  {stat.trend.isPositive ? "+" : "-"}
                  {stat.trend.value.toFixed(1)}% from last update
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
