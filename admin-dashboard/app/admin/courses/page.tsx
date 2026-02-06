"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Clock, Star, Users } from "lucide-react";

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Manage learning resources and training courses"
        action={{
          label: "Add Course",
          icon: Plus,
          onClick: () => console.log("Add course"),
        }}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Complete JavaScript Course",
            provider: "Udemy",
            duration: "40 hours",
            level: "Beginner",
            rating: 4.8,
            students: 12450,
          },
          {
            title: "Python for Data Science",
            provider: "Coursera",
            duration: "35 hours",
            level: "Intermediate",
            rating: 4.9,
            students: 8920,
          },
          {
            title: "AWS Cloud Practitioner",
            provider: "AWS Training",
            duration: "20 hours",
            level: "Beginner",
            rating: 4.7,
            students: 15630,
          },
          {
            title: "Advanced React Patterns",
            provider: "Frontend Masters",
            duration: "12 hours",
            level: "Advanced",
            rating: 4.9,
            students: 5420,
          },
          {
            title: "Machine Learning A-Z",
            provider: "Udemy",
            duration: "44 hours",
            level: "Intermediate",
            rating: 4.6,
            students: 21340,
          },
          {
            title: "UI/UX Design Fundamentals",
            provider: "LinkedIn Learning",
            duration: "18 hours",
            level: "Beginner",
            rating: 4.5,
            students: 9870,
          },
        ].map((course, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-muted/60">
            <CardContent className="p-6 bg-gradient-to-br from-background to-muted/30">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:ring-primary/20">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg line-clamp-2 tracking-tight">
                      {course.title}
                    </h3>
                    <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary border-primary/20">
                      {course.provider}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{course.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{course.students.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Badge
                    variant={
                      course.level === "Beginner"
                        ? "secondary"
                        : course.level === "Advanced"
                        ? "default"
                        : "outline"
                    }
                    className={
                      course.level === "Advanced"
                        ? "bg-primary/90 text-primary-foreground"
                        : course.level === "Beginner"
                        ? "bg-secondary/70"
                        : undefined
                    }
                  >
                    {course.level}
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="hover:bg-muted">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="hover:bg-muted">
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
