import Link from "next/link";
import { MascotWordmark } from "@myhoodora/ui/logo";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 text-sm">
        <div className="col-span-2 space-y-6">
          <MascotWordmark size="md" tone="reversed" />
          <p className="max-w-xs leading-relaxed text-slate-400">
            Hometown, Previous Hood.
          </p>
          <div className="flex gap-3">
            <Link
              href="https://www.linkedin.com/company/myhoodora"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="myHoodora on LinkedIn"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </Link>
            <Link
              href="https://www.facebook.com/people/MyHoodora/61574388514329/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="myHoodora on Facebook"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7.5v-3H10V9.69c0-2.47 1.47-3.83 3.72-3.83 1.08 0 2.2.19 2.2.19v2.42h-1.24c-1.23 0-1.61.76-1.61 1.54V12h2.73l-.44 3h-2.29v6.8c4.56-.93 8-4.96 8-9.8z" />
              </svg>
            </Link>
            <Link
              href="https://www.instagram.com/myhoodora/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="myHoodora on Instagram"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </Link>
            <Link
              href="https://x.com/myHoodora"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="myHoodora on X (Twitter)"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-3">
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/about"
              >
                About Us
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/careers"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/press"
              >
                Press
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/contact"
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-semibold mb-4">Platform</h4>
          <ul className="space-y-3">
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/verification"
              >
                Neighbour Verification
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/safety-center"
              >
                Safety Centre
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/business-pages"
              >
                Business Pages
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/coming-soon/api"
              >
                Developer API
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-semibold mb-4">Legal</h4>
          <ul className="space-y-3">
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/privacy"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/terms"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/cookie-settings"
              >
                Cookie Settings
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/guidelines"
              >
                Guidelines
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-900 text-xs flex flex-col md:flex-row justify-between gap-4">
        <p>© {new Date().getFullYear()} myHoodora Inc. All rights reserved.</p>
        <div className="flex gap-6">
          <Link className="hover:text-white transition-colors" href="#">
            English (US)
          </Link>
          <Link className="hover:text-white transition-colors" href="#">
            Cookie Preferences
          </Link>
        </div>
      </div>
    </footer>
  );
}
