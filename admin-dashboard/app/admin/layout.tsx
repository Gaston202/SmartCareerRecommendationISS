import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#E8E4F0]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={session.user}
          onSignOut={async () => {
            "use server";
            const { signOut } = await import("@/auth");
            await signOut({ redirectTo: "/login" });
          }}
        />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#E8E4F0] via-[#E0DCE8] to-[#C9C4D8] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
