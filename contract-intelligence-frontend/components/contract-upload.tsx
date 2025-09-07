"use client"

import { useState, useCallback, useMemo } from "react"
import { useDropzone } from "react-dropzone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { contractAPI } from "@/lib/api"
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadFile {
  file: File
  id: string
  status: "pending" | "uploading" | "processing" | "completed" | "error"
  progress: number
  contractId?: string
  error?: string
}

export function ContractUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isDragActive, setIsDragActive] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: "pending",
      progress: 0,
    }))

    setUploadFiles((prev) => [...prev, ...newFiles])

    // Start uploading each file
    newFiles.forEach((uploadFile) => {
      uploadContract(uploadFile)
    })
  }, [])

  const {
    getRootProps,
    getInputProps,
    isDragActive: dropzoneActive,
  } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  })

  const uploadContract = useCallback(async (uploadFile: UploadFile) => {
    try {
      // Update status to uploading
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading", progress: 30 } : f)),
      )

      // Simulate upload progress with smoother animation
      const progressInterval = setInterval(() => {
        setUploadFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id && f.progress < 90 ? { ...f, progress: f.progress + 5 } : f)),
        )
      }, 100)

      const response = await contractAPI.uploadContract(uploadFile.file)

      clearInterval(progressInterval)

      // Update to processing status
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: "processing",
                progress: 100,
                contractId: response.contract_id,
              }
            : f,
        ),
      )

      // Poll for processing completion
      pollProcessingStatus(uploadFile.id, response.contract_id)
    } catch (error) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f,
        ),
      )
    }
  }, [])

  const pollProcessingStatus = useCallback(async (fileId: string, contractId: string) => {
    try {
      const contract = await contractAPI.getContractStatus(contractId)

      if (contract.status === "completed") {
        setUploadFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "completed" } : f)))
      } else if (contract.status === "failed") {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "error", error: contract.error || "Processing failed" } : f,
          ),
        )
      } else {
        // Continue polling with exponential backoff
        setTimeout(() => pollProcessingStatus(fileId, contractId), 3000)
      }
    } catch (error) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "error",
                error: "Failed to check processing status",
              }
            : f,
        ),
      )
    }
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const formatFileSize = useMemo(
    () => (bytes: number) => {
      if (bytes === 0) return "0 Bytes"
      const k = 1024
      const sizes = ["Bytes", "KB", "MB", "GB"]
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    },
    [],
  )

  const getStatusIcon = useCallback((status: UploadFile["status"]) => {
    switch (status) {
      case "pending":
        return <Upload className="h-4 w-4 text-muted-foreground" />
      case "uploading":
      case "processing":
        return <LoadingSpinner size="sm" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />
    }
  }, [])

  const getStatusBadge = useCallback((status: UploadFile["status"]) => {
    const variants = {
      pending: "secondary",
      uploading: "default",
      processing: "default",
      completed: "default",
      error: "destructive",
    } as const

    const labels = {
      pending: "Pending",
      uploading: "Uploading",
      processing: "Processing",
      completed: "Completed",
      error: "Error",
    }

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    )
  }, [])

  const uploadStats = useMemo(() => {
    const total = uploadFiles.length
    const completed = uploadFiles.filter((f) => f.status === "completed").length
    const processing = uploadFiles.filter((f) => f.status === "uploading" || f.status === "processing").length
    const failed = uploadFiles.filter((f) => f.status === "error").length

    return { total, completed, processing, failed }
  }, [uploadFiles])

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Contracts
            {uploadStats.total > 0 && (
              <div className="flex gap-2 ml-auto">
                {uploadStats.processing > 0 && (
                  <Badge variant="secondary" className="animate-pulse">
                    {uploadStats.processing} processing
                  </Badge>
                )}
                {uploadStats.completed > 0 && (
                  <Badge variant="default" className="bg-green-600">
                    {uploadStats.completed} completed
                  </Badge>
                )}
                {uploadStats.failed > 0 && <Badge variant="destructive">{uploadStats.failed} failed</Badge>}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
              "hover:border-accent/70 hover:bg-accent/5",
              isDragActive || dropzoneActive
                ? "border-accent bg-accent/10 scale-[1.02]"
                : "border-border hover:border-accent/50",
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-secondary transition-all duration-300 hover:scale-110">
                <FileText className="h-8 w-8 text-secondary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {isDragActive || dropzoneActive
                    ? "Drop your contracts here"
                    : "Drag & drop contracts or click to browse"}
                </h3>
                <p className="text-muted-foreground">Supports PDF files up to 50MB</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="transition-all duration-200 hover:scale-105 bg-transparent"
              >
                Choose Files
              </Button>
            </div>
          </div>

          {uploadFiles.length > 0 && (
            <Alert className="mt-4 border-accent/30 bg-accent/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Files are being processed in the background. You can continue using the application while processing
                completes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <Card className="transition-all duration-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upload Queue</span>
              <Badge variant="outline">{uploadFiles.length} files</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-4 p-4 border rounded-lg transition-all duration-200 hover:shadow-sm hover:border-accent/30"
                >
                  <div className="flex-shrink-0">{getStatusIcon(uploadFile.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{uploadFile.file.name}</p>
                        {getStatusBadge(uploadFile.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{formatFileSize(uploadFile.file.size)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {(uploadFile.status === "uploading" || uploadFile.status === "processing") && (
                      <Progress value={uploadFile.progress} className="h-2 transition-all duration-300" />
                    )}

                    {uploadFile.error && (
                      <p className="text-sm text-destructive mt-1 animate-in slide-in-from-top-1 duration-300">
                        {uploadFile.error}
                      </p>
                    )}

                    {uploadFile.status === "completed" && uploadFile.contractId && (
                      <p className="text-sm text-muted-foreground mt-1 animate-in slide-in-from-top-1 duration-300">
                        Contract ID: {uploadFile.contractId}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
