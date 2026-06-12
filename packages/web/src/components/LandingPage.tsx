import { MarketingHeader } from "@/components/ui/MarketingHeader";
import { MarketingFooter } from "@/components/ui/MarketingFooter";
import { ButtonLink } from "@/components/ui/Button";

const CHECKS = [
  {
    id: "hardcoded-colors",
    title: "No Hard-Coded Colors",
    description:
      "Finds unbound fills and strokes that should use color variables.",
  },
  {
    id: "hardcoded-spacing",
    title: "No Hard-Coded Spacing",
    description:
      "Detects raw pixel values in paddings and gaps that should reference spacing tokens.",
  },
  {
    id: "hardcoded-text-styles",
    title: "No Hard-Coded Text Styles",
    description:
      "Flags font sizes, weights, and families not bound to text style variables.",
  },
  {
    id: "no-primitive-tokens",
    title: "Correct Token Usage",
    description:
      "Ensures components reference semantic tokens instead of raw primitive values.",
  },
  {
    id: "state-variables",
    title: "State Variables Available",
    description:
      "Verifies that interactive components define variables for all interaction states.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MarketingHeader />

      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
            Audit your Figma
            <br />
            design system
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            DS Validation scans your Figma file for token misuse and missing
            design tokens. Find hard-coded colors, spacing, and text styles
            before your developers do.
          </p>
          <ButtonLink href="/login" size="lg">
            Audit your design system
          </ButtonLink>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-semibold text-center text-gray-900 mb-12">
            What we check
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CHECKS.map((check) => (
              <div
                key={check.id}
                className="rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 mb-2">
                  {check.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {check.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Ready to clean up your design system?
            </h2>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto">
              Paste a Figma link, pick your pages, and get a full audit in
              minutes. Free during beta.
            </p>
            <ButtonLink href="/login" size="lg">
              Get started
            </ButtonLink>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
