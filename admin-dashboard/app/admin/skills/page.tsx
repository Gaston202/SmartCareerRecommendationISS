export default function SkillsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Skills</h2>
          <p className="text-muted-foreground">
            Manage skills and competencies in the system
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Skill
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "JavaScript", category: "Programming", count: 245 },
          { name: "Python", category: "Programming", count: 198 },
          { name: "Data Analysis", category: "Analytics", count: 167 },
          { name: "Project Management", category: "Business", count: 134 },
          { name: "UX Design", category: "Design", count: 112 },
          { name: "Cloud Computing", category: "Technology", count: 156 },
        ].map((skill, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-white p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{skill.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{skill.category}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {skill.count} users
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="text-sm text-primary hover:underline">Edit</button>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
