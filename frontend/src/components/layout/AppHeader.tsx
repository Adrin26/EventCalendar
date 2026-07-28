import { Link, useRouter } from "@tanstack/react-router";
import { Calendar, LayoutDashboard, LogOut, MessageSquare, Moon, Sun, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, isAdmin } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const admin = isAdmin(user);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Calendar className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">CareerFair</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <NavItem to="/" label="Calendar" icon={<Calendar className="h-4 w-4" />} />
          <NavItem to="/chatbot" label="Ask AI" icon={<MessageSquare className="h-4 w-4" />} />
          {admin && (
            <>
              <NavItem to="/admin" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} />
              <NavItem to="/admin/assistant" label="AI Assistant" icon={<Sparkles className="h-4 w-4" />} />
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <>
              <div className="hidden text-right text-xs md:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-muted-foreground capitalize">{user.role}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  logout();
                  router.navigate({ to: "/" });
                }}
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link to="/admin/login">
                <Shield className="mr-1.5 h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
      )}
      activeProps={{ className: "bg-accent text-foreground font-medium" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}
