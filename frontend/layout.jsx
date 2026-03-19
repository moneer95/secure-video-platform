import "./globals.css";

export const metadata = {
  title: "Secure Video Platform",
  description: "Upload, convert, and protect videos"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
