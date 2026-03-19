import "../globals.css";
import Link from "next/link";
import { AuthProvider } from "./_context/AuthContext";
import Topbar from "./_components/Topbar";

export const metadata = {
  title: "EA Dental Video Platform",
  description: "EA Dental Video Platform dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="appShell">
            <Topbar />
            {children}
            <footer className="footer">
              <div className="container footerInner">
                <span className="small">EA Dental Video Platform</span>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
