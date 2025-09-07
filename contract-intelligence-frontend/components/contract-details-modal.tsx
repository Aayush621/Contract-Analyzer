"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { contractAPI, type Contract } from "@/lib/api"
import { ContractStatusTracker } from "./contract-status-tracker"
import { FileText, Download, Calendar, DollarSign, Users, FileCheck, TrendingUp, AlertTriangle } from "lucide-react"

interface ContractDetailsModalProps {
  contractId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContractDetailsModal({ contractId, open, onOpenChange }: ContractDetailsModalProps) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContract = async () => {
    if (!contractId) return

    try {
      setLoading(true)
      setError(null)
      console.log("Fetching contract:", contractId)
      const contractData = await contractAPI.getContract(contractId)
      console.log("Contract data received:", contractData)
      setContract(contractData)
    } catch (err) {
      console.error("Error fetching contract:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch contract")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && contractId) {
      fetchContract()
    }
  }, [open, contractId])

  const handleDownload = async () => {
    if (!contract) return

    try {
      const blob = await contractAPI.downloadContract(contract.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = contract.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600"
    if (confidence >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100)
    if (confidence >= 0.8)
      return (
        <Badge variant="default" className="bg-green-600">
          {percentage}%
        </Badge>
      )
    if (confidence >= 0.6)
      return (
        <Badge variant="secondary" className="bg-yellow-600 text-white">
          {percentage}%
        </Badge>
      )
    return <Badge variant="destructive">{percentage}%</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatCurrency = (value: any) => {
    const num = Number.parseFloat(value)
    if (isNaN(num)) return value
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num)
  }

  if (!open || !contractId) return null

  console.log("Modal state:", { open, contractId, contract })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Details
          </DialogTitle>
        </DialogHeader>

        {/* Add debugging info */}
        <div className="p-4 bg-gray-100 rounded mb-4">
          <p>Debug Info:</p>
          <p>Open: {open.toString()}</p>
          <p>Contract ID: {contractId}</p>
          <p>Contract: {contract ? 'Loaded' : 'Not loaded'}</p>
          <p>Loading: {loading.toString()}</p>
          <p>Error: {error || 'None'}</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-2" />
              <p className="text-muted-foreground">Loading contract details...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchContract} variant="outline" size="sm" className="mt-2 bg-transparent">
              Try Again
            </Button>
          </div>
        )}

        {contract && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="extracted-data">Extracted Data</TabsTrigger>
              <TabsTrigger value="status">Processing Status</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Contract Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{contract.filename}</span>
                    <Button onClick={handleDownload} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contract ID</p>
                    <p className="font-mono text-sm">{contract.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={contract.status === "completed" ? "default" : "secondary"}>
                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Uploaded</p>
                    <p className="text-sm">{formatDate(contract.uploadedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">File Size</p>
                    <p className="text-sm">{(contract.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              {contract.extractedData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {contract.extractedData.contract_value && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(contract.extractedData.contract_value.value)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getConfidenceBadge(contract.extractedData.contract_value.confidence)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {contract.extractedData.start_date && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Start Date</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatDate(contract.extractedData.start_date.value)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {getConfidenceBadge(contract.extractedData.start_date.confidence)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {contract.extractedData.parties && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Parties</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Array.isArray(contract.extractedData.parties.value)
                            ? contract.extractedData.parties.value.length
                            : 2}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getConfidenceBadge(contract.extractedData.parties.confidence)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {contract.extractedData
                          ? Math.round(
                              (Object.values(contract.extractedData).reduce((acc, field) => acc + field.confidence, 0) /
                                Object.values(contract.extractedData).length) *
                                100,
                            )
                          : 0}
                        %
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Average confidence</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="extracted-data" className="space-y-6">
              {contract.status !== "completed" ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Extracted data will be available once processing is complete
                    </p>
                  </CardContent>
                </Card>
              ) : contract.extractedData && Object.keys(contract.extractedData).length > 0 ? (
                <div className="space-y-6">
                  {/* Data Quality Overview */}
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        Data Quality Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Object.keys(contract.extractedData).length}
                          </div>
                          <p className="text-sm text-muted-foreground">Fields Extracted</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round(
                              (Object.values(contract.extractedData).reduce((acc, field) => acc + field.confidence, 0) /
                                Object.values(contract.extractedData).length) * 100
                            )}%
                          </div>
                          <p className="text-sm text-muted-foreground">Average Confidence</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {contract.identifiedGaps?.length || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Identified Gaps</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Categorized Extracted Data */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Party Information */}
                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-700">
                          <Users className="h-5 w-5" />
                          Party Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {contract.extractedData.customer_name && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-green-800">Customer Name</span>
                              {getConfidenceBadge(contract.extractedData.customer_name.confidence)}
                            </div>
                            <p className="text-green-700 font-semibold">
                              {contract.extractedData.customer_name.value}
                            </p>
                          </div>
                        )}
                        {contract.extractedData.vendor_name && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-green-800">Vendor Name</span>
                              {getConfidenceBadge(contract.extractedData.vendor_name.confidence)}
                            </div>
                            <p className="text-green-700 font-semibold">
                              {contract.extractedData.vendor_name.value}
                            </p>
                          </div>
                        )}
                        {contract.extractedData.authorized_signatory && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-green-800">Authorized Signatory</span>
                              {getConfidenceBadge(contract.extractedData.authorized_signatory.confidence)}
                            </div>
                            <p className="text-green-700 font-semibold">
                              {contract.extractedData.authorized_signatory.value}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Financial Information */}
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                          <DollarSign className="h-5 w-5" />
                          Financial Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {contract.extractedData.payment_terms && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-blue-800">Payment Terms</span>
                              {getConfidenceBadge(contract.extractedData.payment_terms.confidence)}
                            </div>
                            <p className="text-blue-700 font-semibold">
                              {contract.extractedData.payment_terms.value}
                            </p>
                          </div>
                        )}
                        {contract.extractedData.billing_cycle && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-blue-800">Billing Cycle</span>
                              {getConfidenceBadge(contract.extractedData.billing_cycle.confidence)}
                            </div>
                            <p className="text-blue-700 font-semibold">
                              {contract.extractedData.billing_cycle.value}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Contract Terms */}
                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-700">
                          <FileCheck className="h-5 w-5" />
                          Contract Terms
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {contract.extractedData.renewal_terms && (
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-purple-800">Renewal Terms</span>
                              {getConfidenceBadge(contract.extractedData.renewal_terms.confidence)}
                            </div>
                            <p className="text-purple-700 font-semibold">
                              {contract.extractedData.renewal_terms.value}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Data Quality Metrics */}
                    <Card className="border-l-4 border-l-orange-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700">
                          <AlertTriangle className="h-5 w-5" />
                          Data Quality
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          {Object.entries(contract.extractedData).map(([key, field]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                              <span className="text-sm font-medium text-orange-800 capitalize">
                                {key.replace(/_/g, " ")}
                              </span>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={field.confidence * 100} 
                                  className="w-16 h-2" 
                                />
                                <span className="text-xs font-medium text-orange-700">
                                  {Math.round(field.confidence * 100)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Identified Gaps */}
                  {contract.identifiedGaps && contract.identifiedGaps.length > 0 && (
                    <Card className="border-l-4 border-l-red-500">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-5 w-5" />
                          Identified Gaps
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {contract.identifiedGaps.map((gap, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <span className="text-sm text-red-700 capitalize">
                                {gap.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No extracted data available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="status">
              <ContractStatusTracker contractId={contractId} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
