"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Plus, Users } from "lucide-react";

export default function SkillsPage() {
  const categoryStyles: Record<string, { badge: string; icon: string }> = {
    Programming: {
      badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
      icon: "from-indigo-200/70 to-indigo-50 text-indigo-600 ring-indigo-200/60",
    },
    Analytics: {
      badge: "bg-sky-100 text-sky-700 border-sky-200",
      icon: "from-sky-200/70 to-sky-50 text-sky-600 ring-sky-200/60",
    },
    Business: {
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      icon: "from-amber-200/70 to-amber-50 text-amber-600 ring-amber-200/60",
    },
    Design: {
      badge: "bg-pink-100 text-pink-700 border-pink-200",
      icon: "from-pink-200/70 to-pink-50 text-pink-600 ring-pink-200/60",
    },
    Technology: {
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: "from-emerald-200/70 to-emerald-50 text-emerald-600 ring-emerald-200/60",
    },
  };

  const getCategoryStyle = (category: string) =>
    categoryStyles[category] || {
      badge: "bg-primary/10 text-primary border-primary/20",
      icon: "from-primary/15 to-primary/5 text-primary ring-primary/20",
    };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Manage skills and competencies in the system"
        action={{
          label: "Add Skill",
          icon: Plus,
          onClick: () => console.log("Add skill"),
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "JavaScript", category: "Programming", count: 245 },
          { name: "Python", category: "Programming", count: 198 },
          { name: "Data Analysis", category: "Analytics", count: 167 },
          { name: "Project Management", category: "Business", count: 134 },
          { name: "UX Design", category: "Design", count: 112 },
          { name: "Cloud Computing", category: "Technology", count: 156 },
        ].map((skill, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-muted/60">
            <CardContent className="p-6 bg-gradient-to-br from-background to-muted/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl bg-gradient-to-br p-2.5 ring-1 transition-all group-hover:ring-primary/20 ${getCategoryStyle(skill.category).icon}`}
                  >
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg tracking-tight">{skill.name}</h3>
                    <Badge
                      variant="secondary"
                      className={`mt-1 ${getCategoryStyle(skill.category).badge}`}
                    >
                      {skill.category}
                    </Badge>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1 bg-secondary/70">
                  <Users className="h-3 w-3" />
                  {skill.count}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 hover:bg-muted">
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 hover:bg-muted">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
