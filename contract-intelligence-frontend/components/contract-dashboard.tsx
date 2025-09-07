"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContractUpload } from "./contract-upload"
import { ContractList } from "./contract-list"
import { ContractStats } from "./contract-stats"
import { ContractAnalytics } from "./contract-analytics"
import { FileText, Upload, List, BarChart3 } from "lucide-react"

export function ContractDashboard() {
  const [activeTab, setActiveTab] = useState("upload")

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in-0 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between animate-in slide-in-from-top-2 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contract Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Upload, process, and analyze your contracts with AI-powered extraction
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-8 w-8 transition-all duration-300 hover:scale-110" />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="animate-in slide-in-from-top-4 duration-500 delay-100">
        <ContractStats />
      </div>

      {/* Main Content */}
      <div className="animate-in slide-in-from-bottom-4 duration-500 delay-200">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 transition-all duration-200">
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 transition-all duration-200 data-[state=active]:scale-105"
            >
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger
              value="contracts"
              className="flex items-center gap-2 transition-all duration-200 data-[state=active]:scale-105"
            >
              <List className="h-4 w-4" />
              Contracts
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 transition-all duration-200 data-[state=active]:scale-105"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6 animate-in fade-in-0 duration-300">
            <ContractUpload />
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6 animate-in fade-in-0 duration-300">
            <ContractList />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-in fade-in-0 duration-300">
            <ContractAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
