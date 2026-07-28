import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * The analyzer is opt-in and inert in a normal build.
 *
 * `yarn analyze` sets `ANALYZE=1` and produces a treemap of the client bundle;
 * `yarn build` does not, and the wrapper hands the config back untouched. It
 * exists to answer one question with evidence rather than inference: the README
 * attributes most of a 291 KiB client chunk to `react-phone-number-input`'s
 * 250-flag SVG barrel, imported wholesale by both `CountryField` and
 * `PhoneField` — an attribution that was reasoned to, not measured.
 *
 * `@next/bundle-analyzer` is a devDependency, and nothing it pulls in reaches
 * the client bundle or runs at request time, so the demo's no-egress guarantee
 * is untouched.
 */
export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "1" })(nextConfig);
