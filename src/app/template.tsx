/**
 * Re-mounted on every navigation, so each page's blocks enter one after another (globals.css).
 * `display: contents`: no box of its own, the layout is untouched.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
