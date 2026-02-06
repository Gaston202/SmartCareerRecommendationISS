"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, TrendingUp, DollarSign } from "lucide-react";

export default function CareersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Careers"
        description="Manage career paths and job categories"
        action={{
          label: "Add Career",
          icon: Plus,
          onClick: () => console.log("Add career"),
        }}
      />

      <div className="grid gap-4">
        {[
          {
            title: "Software Engineer",
            category: "Technology",
            salary: "$95,000 - $150,000",
            demand: "Very High",
            growth: "+22%",
          },
          {
            title: "Data Scientist",
            category: "Analytics",
            salary: "$100,000 - $160,000",
            demand: "High",
            growth: "+28%",
          },
          {
            title: "Product Manager",
            category: "Business",
            salary: "$90,000 - $140,000",
            demand: "High",
            growth: "+14%",
          },
          {
            title: "UX Designer",
            category: "Design",
            salary: "$75,000 - $120,000",
            demand: "Medium",
            growth: "+16%",
          },
        ].map((career, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-muted/60">
            <CardContent className="p-6 bg-gradient-to-br from-background to-muted/30">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:ring-primary/20">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">{career.title}</h3>
                      <Badge variant="secondary" className="mt-1">
                        {career.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Salary Range</span>
                      </div>
                      <p className="font-medium">{career.salary}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Demand Level</p>
                      <Badge
                        variant="secondary"
                        className={
                          career.demand === "Very High"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : career.demand === "High"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {career.demand}
                      </Badge>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span>Growth Rate</span>
                      </div>
                      <p className="font-medium text-green-600">{career.growth}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="hover:bg-muted">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:bg-muted">
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
