export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Courses</h2>
          <p className="text-muted-foreground">
            Manage learning resources and training courses
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Course
        </button>
      </div>

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
          <div
            key={index}
            className="rounded-lg border border-border bg-white p-6 hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg line-clamp-2">{course.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{course.provider}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-yellow-500">★</span>
                <span className="text-sm font-medium">{course.rating}</span>
                <span className="text-sm text-muted-foreground">
                  ({course.students.toLocaleString()} students)
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{course.duration}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    course.level === "Beginner"
                      ? "bg-green-100 text-green-700"
                      : course.level === "Intermediate"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {course.level}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button className="flex-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  Edit
                </button>
                <button className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
