import "../globals.css";
import Link from "next/link";

export const metadata = {
  title: "EA Dental Video Platform",
  description: "EA Dental Video Platform dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="appShell">
          <header className="topbar">
            <div className="container topbarInner">
              <Link href="/" className="brand">
                <div className="logoMark" aria-hidden />
                <div>
                  <div className="brandTitle">EA Dental</div>
                  <div className="brandSub">Video Platform</div>
                </div>
              </Link>
              <nav className="topbarNav" aria-label="Main">
                <Link href="/" className="topbarNavLink">Videos</Link>
                <Link href="/upload" className="topbarNavLink">Upload</Link>
                <Link href="/categories" className="topbarNavLink">Categories</Link>
              </nav>
            </div>
          </header>
          {children}
          <footer className="footer">
            <div className="container footerInner">
              <span className="small">EA Dental Video Platform</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
