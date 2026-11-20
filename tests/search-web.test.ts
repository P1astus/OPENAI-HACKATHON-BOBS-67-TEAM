import { describe, expect, it } from "vitest";
import { parseWebSearchOutput } from "@/lib/agent/search-web";

describe("online company search output", () => {
  it("filters ungrounded or unsafe entries and returns up to three valid businesses", () => {
    const business = {
      name: " Local Heating ",
      phone: " +49 123 456 ",
      website: "https://example.com/",
      address: " Main Street 1 ",
      source_url: "https://example.com/listing",
    };
    const stub = { output_text: JSON.stringify({ results: [
      { ...business, name: " " },
      { ...business, source_url: undefined },
      { ...business, source_url: "javascript:alert(1)" },
      business,
      { ...business, name: "Heating Two", website: "javascript:alert(1)", phone: "not a number" },
      { ...business, name: "Heating Three" },
      { ...business, name: "Heating Four" },
    ] }) };
    const results = parseWebSearchOutput(stub.output_text);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ ...business, name: "Local Heating", address: "Main Street 1", phone: "+49 123 456" });
    expect(results[1]).toMatchObject({ name: "Heating Two", website: "", phone: "" });
    expect(results[2].name).toBe("Heating Three");
  });

  it("rejects malformed output", () => {
    expect(() => parseWebSearchOutput("invalid JSON")).toThrow();
    expect(() => parseWebSearchOutput('{"results":null}')).toThrow();
  });
});
