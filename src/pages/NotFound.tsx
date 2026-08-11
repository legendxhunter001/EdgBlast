import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <Logo size={56} className="mx-auto mb-6" />
        <h1 className="mb-2 font-display text-4xl font-semibold">404</h1>
        <p className="mb-6 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="text-primary underline hover:text-primary/80">
          Return home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
