import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/signup")({
  head: () => ({ meta: [{ title: "Admin signup — CareerFair" }, { name: "description", content: "Create an admin account. The first account becomes superadmin." }] }),
  component: SignupPage,
});

function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const u = await signup(name, email, password);
      toast.success(`Account created — role: ${u.role}`);
      nav({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><UserPlus className="h-4 w-4" /></div>
          <div>
            <h1 className="text-lg font-semibold">Create admin account</h1>
            <p className="text-xs text-muted-foreground">First user becomes superadmin.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have one? <Link to="/admin/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
