export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Recommendations</h2>
          <p className="text-muted-foreground">
            View and manage career recommendations sent to users
          </p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-md border border-input bg-white px-3 py-2 text-sm">
            <option>All Status</option>
            <option>Pending</option>
            <option>Sent</option>
            <option>Viewed</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Recommendations</p>
          <p className="mt-2 text-3xl font-bold text-primary">1,650</p>
          <p className="mt-1 text-xs text-green-600">+18% from last month</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Pending</p>
          <p className="mt-2 text-3xl font-bold">234</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Sent</p>
          <p className="mt-2 text-3xl font-bold">1,198</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-medium text-muted-foreground">Avg Match Score</p>
          <p className="mt-2 text-3xl font-bold">87%</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Career Recommended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Match Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                {
                  user: "John Doe",
                  career: "Software Engineer",
                  score: 92,
                  status: "Viewed",
                  date: "2026-02-04",
                },
                {
                  user: "Jane Smith",
                  career: "Data Scientist",
                  score: 88,
                  status: "Sent",
                  date: "2026-02-04",
                },
                {
                  user: "Mike Johnson",
                  career: "Product Manager",
                  score: 85,
                  status: "Pending",
                  date: "2026-02-05",
                },
              ].map((rec, index) => (
                <tr key={index} className="hover:bg-muted/50">
                  <td className="px-6 py-4 text-sm font-medium">{rec.user}</td>
                  <td className="px-6 py-4 text-sm">{rec.career}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${rec.score}%` }}
                        />
                      </div>
                      <span className="font-medium">{rec.score}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        rec.status === "Viewed"
                          ? "bg-green-100 text-green-700"
                          : rec.status === "Sent"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{rec.date}</td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-primary hover:underline">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
