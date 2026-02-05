export default function CareersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Careers</h2>
          <p className="text-muted-foreground">
            Manage career paths and job categories
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Career
        </button>
      </div>

      <div className="space-y-4">
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
          <div
            key={index}
            className="rounded-lg border border-border bg-white p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{career.title}</h3>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {career.category}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Salary Range</p>
                    <p className="mt-1 font-medium">{career.salary}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Demand Level</p>
                    <p className="mt-1 font-medium">{career.demand}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Growth Rate</p>
                    <p className="mt-1 font-medium text-green-600">{career.growth}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted">
                  Edit
                </button>
                <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted">
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
