"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useDebounce } from "@/hooks/use-debounce"
import { CalendarIcon, Filter, X, Search, Save, RotateCcw } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export interface SearchFilters {
  search: string
  status: string[]
  dateRange: {
    from: Date | null
    to: Date | null
  }
  contractValue: {
    min: number
    max: number
  }
  confidenceScore: {
    min: number
    max: number
  }
  fileSize: {
    min: number
    max: number
  }
  extractedFields: string[]
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  onSaveSearch?: (name: string, filters: SearchFilters) => void
  savedSearches?: Array<{ name: string; filters: SearchFilters }>
  onLoadSearch?: (filters: SearchFilters) => void
}

const defaultFilters: SearchFilters = {
  search: "",
  status: [],
  dateRange: { from: null, to: null },
  contractValue: { min: 0, max: 10000000 },
  confidenceScore: { min: 0, max: 100 },
  fileSize: { min: 0, max: 50 },
  extractedFields: [],
}

export function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onSaveSearch,
  savedSearches = [],
  onLoadSearch,
}: AdvancedSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const debouncedSearch = useDebounce(filters.search, 300)

  const statusOptions = useMemo(
    () => [
      { value: "pending", label: "Pending" },
      { value: "processing", label: "Processing" },
      { value: "completed", label: "Completed" },
      { value: "failed", label: "Failed" },
    ],
    [],
  )

  const extractedFieldOptions = useMemo(
    () => [
      { value: "contract_value", label: "Contract Value" },
      { value: "start_date", label: "Start Date" },
      { value: "end_date", label: "End Date" },
      { value: "payment_terms", label: "Payment Terms" },
      { value: "parties", label: "Parties" },
      { value: "key_clauses", label: "Key Clauses" },
    ],
    [],
  )

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const resetFilters = () => {
    onFiltersChange(defaultFilters)
    setIsExpanded(false)
  }

  const handleStatusChange = (status: string, checked: boolean) => {
    const newStatus = checked ? [...filters.status, status] : filters.status.filter((s) => s !== status)
    updateFilters({ status: newStatus })
  }

  const handleExtractedFieldChange = (field: string, checked: boolean) => {
    const newFields = checked ? [...filters.extractedFields, field] : filters.extractedFields.filter((f) => f !== field)
    updateFilters({ extractedFields: newFields })
  }

  const handleSaveSearch = () => {
    if (saveSearchName.trim() && onSaveSearch) {
      onSaveSearch(saveSearchName.trim(), filters)
      setSaveSearchName("")
      setShowSaveDialog(false)
    }
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.status.length > 0) count++
    if (filters.dateRange.from || filters.dateRange.to) count++
    if (filters.contractValue.min > 0 || filters.contractValue.max < 10000000) count++
    if (filters.confidenceScore.min > 0 || filters.confidenceScore.max < 100) count++
    if (filters.fileSize.min > 0 || filters.fileSize.max < 50) count++
    if (filters.extractedFields.length > 0) count++
    return count
  }, [filters])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search & Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 animate-in slide-in-from-right-2 duration-300">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="transition-all duration-200 hover:scale-105 bg-transparent"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="transition-all duration-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              {isExpanded ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Contracts</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by filename, contract ID, or content..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <div className="space-y-2">
            <Label>Saved Searches</Label>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((saved, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadSearch?.(saved.filters)}
                  className="text-xs transition-all duration-200 hover:scale-105"
                >
                  {saved.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Filters */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {isExpanded && (
            <div className="space-y-6 pt-4 border-t animate-in slide-in-from-top-2 duration-300">
              {/* Status Filter */}
              <div className="space-y-3">
                <Label>Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${option.value}`}
                        checked={filters.status.includes(option.value)}
                        onCheckedChange={(checked) => handleStatusChange(option.value, checked as boolean)}
                        className="transition-all duration-200"
                      />
                      <Label htmlFor={`status-${option.value}`} className="text-sm cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Date Range */}
              <div className="space-y-3">
                <Label>Upload Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal transition-all duration-200",
                          !filters.dateRange.from && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.from ? format(filters.dateRange.from, "PPP") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.from || undefined}
                        onSelect={(date) => updateFilters({ dateRange: { ...filters.dateRange, from: date || null } })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal transition-all duration-200",
                          !filters.dateRange.to && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.to ? format(filters.dateRange.to, "PPP") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.to || undefined}
                        onSelect={(date) => updateFilters({ dateRange: { ...filters.dateRange, to: date || null } })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />

              {/* Contract Value Range */}
              <div className="space-y-3">
                <Label>Contract Value Range</Label>
                <div className="px-2">
                  <Slider
                    value={[filters.contractValue.min, filters.contractValue.max]}
                    onValueChange={([min, max]) => updateFilters({ contractValue: { min, max } })}
                    max={10000000}
                    step={10000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{formatCurrency(filters.contractValue.min)}</span>
                    <span>{formatCurrency(filters.contractValue.max)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Confidence Score Range */}
              <div className="space-y-3">
                <Label>Confidence Score Range</Label>
                <div className="px-2">
                  <Slider
                    value={[filters.confidenceScore.min, filters.confidenceScore.max]}
                    onValueChange={([min, max]) => updateFilters({ confidenceScore: { min, max } })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{filters.confidenceScore.min}%</span>
                    <span>{filters.confidenceScore.max}%</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* File Size Range */}
              <div className="space-y-3">
                <Label>File Size Range (MB)</Label>
                <div className="px-2">
                  <Slider
                    value={[filters.fileSize.min, filters.fileSize.max]}
                    onValueChange={([min, max]) => updateFilters({ fileSize: { min, max } })}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{filters.fileSize.min} MB</span>
                    <span>{filters.fileSize.max} MB</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Extracted Fields */}
              <div className="space-y-3">
                <Label>Must Have Extracted Fields</Label>
                <div className="grid grid-cols-2 gap-2">
                  {extractedFieldOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-${option.value}`}
                        checked={filters.extractedFields.includes(option.value)}
                        onCheckedChange={(checked) => handleExtractedFieldChange(option.value, checked as boolean)}
                        className="transition-all duration-200"
                      />
                      <Label htmlFor={`field-${option.value}`} className="text-sm cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Save Search */}
              <div className="space-y-3">
                <Label>Save Current Search</Label>
                {showSaveDialog ? (
                  <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                    <Input
                      placeholder="Search name..."
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
                      className="transition-all duration-200"
                    />
                    <Button
                      onClick={handleSaveSearch}
                      size="sm"
                      className="transition-all duration-200 hover:scale-105"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowSaveDialog(false)}
                      size="sm"
                      className="transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveDialog(true)}
                    size="sm"
                    className="transition-all duration-200 hover:scale-105"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Current Search
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <div className="pt-4 border-t animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-wrap gap-2">
              {filters.search && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 transition-all duration-200 hover:scale-105"
                >
                  Search: "{filters.search}"
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => updateFilters({ search: "" })}
                  />
                </Badge>
              )}
              {filters.status.map((status) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className="flex items-center gap-1 transition-all duration-200 hover:scale-105"
                >
                  Status: {status}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => handleStatusChange(status, false)}
                  />
                </Badge>
              ))}
              {(filters.dateRange.from || filters.dateRange.to) && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 transition-all duration-200 hover:scale-105"
                >
                  Date Range
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => updateFilters({ dateRange: { from: null, to: null } })}
                  />
                </Badge>
              )}
              {filters.extractedFields.map((field) => (
                <Badge
                  key={field}
                  variant="secondary"
                  className="flex items-center gap-1 transition-all duration-200 hover:scale-105"
                >
                  Field: {field.replace(/_/g, " ")}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => handleExtractedFieldChange(field, false)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
