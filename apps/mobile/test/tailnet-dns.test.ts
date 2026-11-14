import { describe, expect, test } from "bun:test";

// The config plugin is plain CommonJS (expo prebuild loads it); only its pure parts are tested here.
const { withFactory, kotlinSource } = require("../plugins/with-tailnet-dns") as {
  withFactory: (source: string) => string;
  kotlinSource: (pkg: string) => string;
};

/** The part of Expo's MainApplication.kt template the plugin edits. */
const TEMPLATE = `class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}`;

describe("Tailnet names through Tailscale's DNS (Android)", () => {
  test("sets the OkHttp factory right after super.onCreate(), before React Native loads", () => {
    const out = withFactory(TEMPLATE);
    const set = out.indexOf("OkHttpClientProvider.setOkHttpClientFactory(TailnetDnsClientFactory(applicationContext))");
    expect(set).toBeGreaterThan(out.indexOf("super.onCreate()"));
    expect(set).toBeLessThan(out.indexOf("loadReactNative(this)"));
    expect(out).toContain("\n    com.facebook.react.modules.network.OkHttpClientProvider");
  });

  test("runs once: a second prebuild leaves the file as it is", () => {
    const once = withFactory(TEMPLATE);
    expect(withFactory(once)).toBe(once);
  });

  test("fails loudly when the template changes shape", () => {
    expect(() => withFactory("class MainApplication { override fun onCreate() { loadReactNative(this) } }")).toThrow(
      /super\.onCreate/,
    );
  });

  test("the Kotlin file is in the app's package and asks only for *.ts.net names the system couldn't find", () => {
    const source = kotlinSource("chat.agentes.app.preview");
    expect(source.startsWith("package chat.agentes.app.preview\n")).toBe(true);
    expect(source).toContain("return Dns.SYSTEM.lookup(hostname)");
    expect(source).toContain("if (!isTailnet(hostname)) throw e");
    expect(source).toContain('endsWith(".ts.net")');
    expect(source).toContain('"100.100.100.100"');
  });
});
