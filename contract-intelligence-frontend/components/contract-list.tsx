"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { contractAPI, type Contract } from "@/lib/api"
import {
  FileText,
  Download,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Calendar,
  Clock,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ContractDetailsModal } from "./contract-details-modal"
import { AdvancedSearchFilters, type SearchFilters } from "./advanced-search-filters"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

const defaultFilters: SearchFilters = {
  search: "",
  status: [],
  dateRange: { from: null, to: null },
  contractValue: { min: 0, max: 10000000 },
  confidenceScore: { min: 0, max: 100 },
  fileSize: { min: 0, max: 50 },
  extractedFields: [],
}

export function ContractList() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [sortBy, setSortBy] = useState("uploadedAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalContracts, setTotalContracts] = useState(0)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [savedSearches, setSavedSearches] = useState<Array<{ name: string; filters: SearchFilters }>>([])

  const pageSize = 10

  const fetchContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build API parameters from filters
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sortBy,
        sortOrder,
      }

      // Add search term
      if (filters.search) {
        params.search = filters.search
      }

      // Add status filter
      if (filters.status.length > 0) {
        params.status = filters.status.join(",")
      }

      // Add date range
      if (filters.dateRange.from) {
        params.dateFrom = filters.dateRange.from.toISOString()
      }
      if (filters.dateRange.to) {
        params.dateTo = filters.dateRange.to.toISOString()
      }

      // Add value range
      if (filters.contractValue.min > 0 || filters.contractValue.max < 10000000) {
        params.valueMin = filters.contractValue.min
        params.valueMax = filters.contractValue.max
      }

      // Add confidence range
      if (filters.confidenceScore.min > 0 || filters.confidenceScore.max < 100) {
        params.confidenceMin = filters.confidenceScore.min / 100
        params.confidenceMax = filters.confidenceScore.max / 100
      }

      // Add file size range
      if (filters.fileSize.min > 0 || filters.fileSize.max < 50) {
        params.fileSizeMin = filters.fileSize.min * 1024 * 1024 // Convert to bytes
        params.fileSizeMax = filters.fileSize.max * 1024 * 1024
      }

      // Add required fields
      if (filters.extractedFields.length > 0) {
        params.requiredFields = filters.extractedFields.join(",")
      }

      const response = await contractAPI.getContracts(params)
      setContracts(response.contracts)
      setTotalContracts(response.total)
      setTotalPages(Math.ceil(response.total / pageSize))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contracts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContracts()
  }, [currentPage, filters, sortBy, sortOrder])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const handleDownload = async (contractId: string, filename: string) => {
    try {
      console.log("Starting download for:", contractId)
      const blob = await contractAPI.downloadContract(contractId)
      console.log("Blob received:", blob)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log("Download completed")
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  const handleViewDetails = (contractId: string) => {
    setSelectedContractId(contractId)
    setDetailsModalOpen(true)
  }

  const handleDelete = async (contractId: string) => {
    if (!confirm("Are you sure you want to delete this contract? This action cannot be undone.")) {
      return
    }

    try {
      await contractAPI.deleteContract(contractId)
      // Refresh the contracts list after deletion
      await fetchContracts()
    } catch (err) {
      console.error("Delete failed:", err)
      // You could add a toast notification here
    }
  }

  const handleSaveSearch = (name: string, searchFilters: SearchFilters) => {
    const newSavedSearches = [...savedSearches, { name, filters: searchFilters }]
    setSavedSearches(newSavedSearches)
    // In a real app, you'd save this to localStorage or backend
    localStorage.setItem("contractSearches", JSON.stringify(newSavedSearches))
  }

  const handleLoadSearch = (searchFilters: SearchFilters) => {
    setFilters(searchFilters)
  }

  // Load saved searches on mount
  useEffect(() => {
    const saved = localStorage.getItem("contractSearches")
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved))
      } catch (err) {
        console.error("Failed to load saved searches:", err)
      }
    }
  }, [])

  const getStatusBadge = (status: Contract["status"] | string | undefined) => {
    const variants = {
      pending:   { variant: "secondary" as const,   label: "Pending" },
      processing:{ variant: "default" as const,     label: "Processing" },
      completed: { variant: "default" as const,     label: "Completed" },
      failed:    { variant: "destructive" as const, label: "Failed" },
    }

    const key = (status ?? "").toString().toLowerCase() as keyof typeof variants
    const config = variants[key] ?? { variant: "outline" as const, label: status ?? "Unknown" }

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleSort = (field: string) => {
    // Map frontend field names to backend field names
    const fieldMapping: { [key: string]: string } = {
      'filename': 'file_name',
      'uploadedAt': 'upload_timestamp',
      'status': 'processing_status'
    }
    
    const backendField = fieldMapping[field] || field
    
    if (sortBy === backendField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(backendField)
      setSortOrder("desc")
    }
  }

  const handleDropdownClick = (e: React.MouseEvent) => {
    console.log("Dropdown clicked", e)
    e.stopPropagation()
  }

  if (loading && contracts.length === 0) {
    return (
      <div className="space-y-6">
        <AdvancedSearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onSaveSearch={handleSaveSearch}
          savedSearches={savedSearches}
          onLoadSearch={handleLoadSearch}
        />
        <Card>
          <CardHeader>
            <CardTitle>Contract List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Loading contracts...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdvancedSearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onSaveSearch={handleSaveSearch}
          savedSearches={savedSearches}
          onLoadSearch={handleLoadSearch}
        />
        <Card>
          <CardHeader>
            <CardTitle>Contract List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <Button onClick={fetchContracts} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdvancedSearchFilters
        filters={filters}
        onFiltersChange={setFilters}
        onSaveSearch={handleSaveSearch}
        savedSearches={savedSearches}
        onLoadSearch={handleLoadSearch}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract List
              <Badge variant="secondary" className="ml-2">
                {totalContracts} total
              </Badge>
            </div>
            
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [field, order] = value.split('-')
                  setSortBy(field)
                  setSortOrder(order as "asc" | "desc")
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload_timestamp-desc">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4" />
                      Upload Date (Newest)
                    </div>
                  </SelectItem>
                  <SelectItem value="upload_timestamp-asc">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4" />
                      Upload Date (Oldest)
                    </div>
                  </SelectItem>
                  <SelectItem value="file_name-asc">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4" />
                      File Name (A-Z)
                    </div>
                  </SelectItem>
                  <SelectItem value="file_name-desc">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4" />
                      File Name (Z-A)
                    </div>
                  </SelectItem>
                  <SelectItem value="processing_status-asc">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4" />
                      Status (A-Z)
                    </div>
                  </SelectItem>
                  <SelectItem value="processing_status-desc">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4" />
                      Status (Z-A)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract Table */}
          {contracts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No contracts found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search filters or upload your first contract to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => handleSort("file_name")}
                    >
                      <div className="flex items-center gap-1">
                        Filename
                        {sortBy === "file_name" && (
                          sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => handleSort("processing_status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortBy === "processing_status" && (
                          sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => handleSort("upload_timestamp")}
                    >
                      <div className="flex items-center gap-1">
                        Uploaded
                        {sortBy === "upload_timestamp" && (
                          sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{contract.filename}</p>
                            <p className="text-xs text-muted-foreground">ID: {contract.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(contract.uploadedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(contract.fileSize)}
                      </TableCell>
                      <TableCell>
                        {contract.progress !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-secondary rounded-full h-2">
                              <div
                                className="bg-accent h-2 rounded-full transition-all"
                                style={{ width: `${contract.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{contract.progress}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(contract.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(contract.id, contract.filename)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(contract.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalContracts)} of{" "}
                {totalContracts} contracts
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Details Modal */}
      <ContractDetailsModal
        contractId={selectedContractId}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />
    </div>
  )
}
