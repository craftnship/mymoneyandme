/** Narrow column for the account pages (sign in, sign up, reset). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-md mx-auto">{children}</div>;
}
