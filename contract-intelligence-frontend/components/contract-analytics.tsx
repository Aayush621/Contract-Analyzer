"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { contractAPI, type Contract } from "@/lib/api"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Clock,
  AlertTriangle,
  Target,
  BarChart3,
  PieChartIcon,
} from "lucide-react"

interface AnalyticsData {
  statusDistribution: { name: string; value: number; color: string }[]
  monthlyUploads: { month: string; uploads: number; processed: number }[]
  contractValues: { range: string; count: number }[]
  confidenceScores: { field: string; avgConfidence: number }[]
  processingTimes: { date: string; avgTime: number }[]
  totalValue: number
  avgConfidence: number
  avgProcessingTime: number
}

export function ContractAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("30d")

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all contracts for analysis
      const response = await contractAPI.getContracts({ limit: 1000 })
      const contracts = response.contracts

      // Process data for analytics
      const analytics = processContractsForAnalytics(contracts)
      setAnalyticsData(analytics)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics")
    } finally {
      setLoading(false)
    }
  }

  const processContractsForAnalytics = (contracts: Contract[]): AnalyticsData => {
    // Status distribution
    const statusCounts = contracts.reduce(
      (acc, contract) => {
        acc[contract.status] = (acc[contract.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const statusDistribution = [
      { name: "Completed", value: statusCounts.completed || 0, color: "#22c55e" },
      { name: "Processing", value: statusCounts.processing || 0, color: "#ec4899" },
      { name: "Pending", value: statusCounts.pending || 0, color: "#f59e0b" },
      { name: "Failed", value: statusCounts.failed || 0, color: "#ef4444" },
    ]

    // Monthly uploads (last 6 months)
    const monthlyData = new Map<string, { uploads: number; processed: number }>()
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      monthlyData.set(monthKey, { uploads: 0, processed: 0 })
    }

    contracts.forEach((contract) => {
      const uploadDate = new Date(contract.uploadedAt)
      const monthKey = uploadDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      const data = monthlyData.get(monthKey)
      if (data) {
        data.uploads++
        if (contract.status === "completed") {
          data.processed++
        }
      }
    })

    const monthlyUploads = Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      ...data,
    }))

    // Contract values distribution
    const completedContracts = contracts.filter((c) => c.status === "completed" && c.extractedData?.contract_value)
    const contractValues = [
      { range: "$0-10K", count: 0 },
      { range: "$10K-50K", count: 0 },
      { range: "$50K-100K", count: 0 },
      { range: "$100K-500K", count: 0 },
      { range: "$500K+", count: 0 },
    ]

    completedContracts.forEach((contract) => {
      const value = Number.parseFloat(contract.extractedData?.contract_value?.value || "0")
      if (value < 10000) contractValues[0].count++
      else if (value < 50000) contractValues[1].count++
      else if (value < 100000) contractValues[2].count++
      else if (value < 500000) contractValues[3].count++
      else contractValues[4].count++
    })

    // Confidence scores by field
    const fieldConfidences = new Map<string, number[]>()
    completedContracts.forEach((contract) => {
      if (contract.extractedData) {
        Object.entries(contract.extractedData).forEach(([field, data]) => {
          if (!fieldConfidences.has(field)) {
            fieldConfidences.set(field, [])
          }
          fieldConfidences.get(field)!.push(data.confidence)
        })
      }
    })

    const confidenceScores = Array.from(fieldConfidences.entries())
      .map(([field, scores]) => ({
        field: field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        avgConfidence: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100),
      }))
      .sort((a, b) => b.avgConfidence - a.avgConfidence)

    // Processing times (mock data for demo)
    const processingTimes = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        avgTime: Math.floor(Math.random() * 120) + 30, // 30-150 minutes
      }
    }).reverse()

    // Calculate totals
    const totalValue = completedContracts.reduce((sum, contract) => {
      const value = Number.parseFloat(contract.extractedData?.contract_value?.value || "0")
      return sum + value
    }, 0)

    const allConfidences = Array.from(fieldConfidences.values()).flat()
    const avgConfidence =
      allConfidences.length > 0 ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length : 0

    const avgProcessingTime = processingTimes.reduce((sum, item) => sum + item.avgTime, 0) / processingTimes.length

    return {
      statusDistribution,
      monthlyUploads,
      contractValues,
      confidenceScores,
      processingTimes,
      totalValue,
      avgConfidence,
      avgProcessingTime,
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !analyticsData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error || "Failed to load analytics"}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analyticsData.avgConfidence * 100)}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +3% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(Math.round(analyticsData.avgProcessingTime))}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1" />
              -8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                ((analyticsData.statusDistribution.find((s) => s.name === "Completed")?.value || 0) /
                  analyticsData.statusDistribution.reduce((sum, s) => sum + s.value, 0)) *
                  100,
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +5% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Contract Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analyticsData.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-4">
              {analyticsData.statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">
                    {item.name} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Upload Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.monthlyUploads}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="uploads" stackId="1" stroke="#ec4899" fill="#ec4899" fillOpacity={0.6} />
                <Area
                  type="monotone"
                  dataKey="processed"
                  stackId="2"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contract Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Contract Value Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.contractValues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1b3c53" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Confidence Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Field Confidence Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.confidenceScores.slice(0, 6).map((item) => (
                <div key={item.field} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.field}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-secondary rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full transition-all"
                        style={{ width: `${item.avgConfidence}%` }}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.avgConfidence}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Processing Time Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.processingTimes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [formatTime(value as number), "Avg Processing Time"]} />
              <Line type="monotone" dataKey="avgTime" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
