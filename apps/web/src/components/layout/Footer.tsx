import Link from "next/link";
import { Globe, Share2 } from "lucide-react";
import { Logo } from "@myhoodora/ui/logo";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16 px-6 lg:px-20 border-t border-slate-900">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 text-sm">
        <div className="col-span-2 space-y-6">
          <Logo size="sm" className="text-white" />
          <p className="max-w-xs leading-relaxed text-slate-400">
            Connecting neighbors across the globe to build better places to
            live, work, and thrive.
          </p>
          <div className="flex gap-4">
            <Link
              href="#"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <Globe className="size-5" />
            </Link>
            <Link
              href="#"
              className="size-10 bg-slate-900 rounded-full flex items-center justify-center hover:bg-primary transition-colors text-white"
            >
              <Share2 className="size-5" />
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-bold mb-4">Company</h4>
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
                href="/careers"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/press"
              >
                Press
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/contact"
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-bold mb-4">Platform</h4>
          <ul className="space-y-3">
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/verification"
              >
                Neighbor Verification
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/safety-center"
              >
                Safety Center
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/business-pages"
              >
                Business Pages
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-primary transition-colors"
                href="/api"
              >
                Developer API
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-bold mb-4">Legal</h4>
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
