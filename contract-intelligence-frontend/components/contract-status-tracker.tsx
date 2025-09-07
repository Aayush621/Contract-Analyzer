"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { contractAPI, type Contract } from "@/lib/api"
import { Clock, CheckCircle, AlertCircle, FileText, Brain, Search, Database, Zap, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContractStatusTrackerProps {
  contractId: string
  onClose?: () => void
}

export function ContractStatusTracker({ contractId, onClose }: ContractStatusTrackerProps) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setError(null)
      const contractData = await contractAPI.getContractStatus(contractId)
      setContract(contractData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Poll for updates if still processing
    const interval = setInterval(() => {
      if (contract?.status === "pending" || contract?.status === "processing") {
        fetchStatus()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [contractId, contract?.status])

  const getProcessingStages = () => {
    const stages = [
      {
        id: "upload",
        label: "File Upload",
        icon: FileText,
        description: "Contract file received and validated",
      },
      {
        id: "parsing",
        label: "Document Parsing",
        icon: Search,
        description: "Extracting text and structure from PDF",
      },
      {
        id: "analysis",
        label: "AI Analysis",
        icon: Brain,
        description: "Identifying key contract elements and clauses",
      },
      {
        id: "extraction",
        label: "Data Extraction",
        icon: Database,
        description: "Extracting structured data with confidence scores",
      },
      {
        id: "completion",
        label: "Processing Complete",
        icon: CheckCircle,
        description: "Contract ready for review and analysis",
      },
    ]

    return stages
  }

  const getCurrentStageIndex = () => {
    if (!contract) return 0

    switch (contract.status) {
      case "pending":
        return 0
      case "processing":
        return Math.min(Math.floor((contract.progress || 0) / 25), 3)
      case "completed":
        return 4
      case "failed":
        return -1
      default:
        return 0
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: Contract["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-600"
      case "processing":
        return "text-accent"
      case "completed":
        return "text-green-600"
      case "failed":
        return "text-destructive"
      default:
        return "text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Contract Status</span>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !contract) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Contract Status</span>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error || "Contract not found"}</p>
            <Button onClick={fetchStatus} variant="outline" size="sm" className="mt-2 bg-transparent">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stages = getProcessingStages()
  const currentStageIndex = getCurrentStageIndex()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Status
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contract Info */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <h3 className="font-medium">{contract.filename}</h3>
            <p className="text-sm text-muted-foreground">ID: {contract.id}</p>
          </div>
          <div className="text-right">
            <Badge variant={contract.status === "completed" ? "default" : "secondary"} className="mb-1">
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </Badge>
            <p className="text-xs text-muted-foreground">Uploaded: {formatDate(contract.uploadedAt)}</p>
          </div>
        </div>

        {/* Overall Progress */}
        {(contract.status === "processing" || contract.status === "pending") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{contract.progress || 0}%</span>
            </div>
            <Progress value={contract.progress || 0} className="h-3" />
          </div>
        )}

        {/* Processing Stages */}
        <div className="space-y-4">
          <h4 className="font-medium">Processing Stages</h4>
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const Icon = stage.icon
              const isCompleted = currentStageIndex > index || contract.status === "completed"
              const isCurrent = currentStageIndex === index && contract.status === "processing"
              const isFailed = contract.status === "failed" && currentStageIndex === index

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    isCompleted && "bg-green-50 border-green-200",
                    isCurrent && "bg-accent/10 border-accent/30",
                    isFailed && "bg-destructive/10 border-destructive/30",
                    !isCompleted && !isCurrent && !isFailed && "bg-muted/30 border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      isCompleted && "bg-green-600 text-white",
                      isCurrent && "bg-accent text-accent-foreground",
                      isFailed && "bg-destructive text-destructive-foreground",
                      !isCompleted && !isCurrent && !isFailed && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCurrent ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : isFailed ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{stage.label}</h5>
                    <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                    {isCurrent && contract.progress && (
                      <div className="mt-2">
                        <Progress value={(contract.progress % 25) * 4} className="h-1" />
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {isCurrent && <Clock className="h-4 w-4 text-accent" />}
                    {isFailed && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error Details */}
        {contract.status === "failed" && contract.error && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">Processing Failed</span>
            </div>
            <p className="text-sm text-destructive/80">{contract.error}</p>
          </div>
        )}

        {/* Completion Details */}
        {contract.status === "completed" && contract.processedAt && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Processing Complete</span>
            </div>
            <p className="text-sm text-green-700">Completed at: {formatDate(contract.processedAt)}</p>
            {contract.extractedData && (
              <p className="text-sm text-green-700 mt-1">
                Extracted {Object.keys(contract.extractedData).length} data fields
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={fetchStatus} variant="outline" size="sm" className="flex-1 bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
          {contract.status === "completed" && (
            <Button variant="default" size="sm" className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              View Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
