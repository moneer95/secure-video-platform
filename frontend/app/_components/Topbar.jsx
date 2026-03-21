"use client";

import Link from "next/link";
import { useAuth } from "../_context/AuthContext";

export default function Topbar() {
  const { authenticated, ready, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="container topbarInner">
        <Link href="/" className="brand">
          <div className="logoMark" aria-hidden />
          <div>
            <div className="brandTitle">EA Dental</div>
            <div className="brandSub">Video Platform</div>
          </div>
        </Link>
        {ready && authenticated && (
          <nav className="topbarNav" aria-label="Main">
            <Link href="/" className="topbarNavLink">Videos</Link>
            <Link href="/upload" className="topbarNavLink">Upload</Link>
            <Link href="/categories" className="topbarNavLink">Categories</Link>
            <button type="button" className="btn btnGhost topbarNavLink" onClick={logout} style={{ marginLeft: 4 }}>
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
