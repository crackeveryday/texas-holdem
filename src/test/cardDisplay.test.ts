import { describe, expect, it } from "vitest";
import { cardDisplayKey, getRankLabel, getSuitColorClass, getSuitSymbol } from "../lib/cardDisplay";
import { parseCard } from "../lib/cards";

describe("card display helpers", () => {
  it("converts suits to card symbols", () => {
    expect(getSuitSymbol("spades")).toBe("♠");
    expect(getSuitSymbol("hearts")).toBe("♥");
    expect(getSuitSymbol("diamonds")).toBe("♦");
    expect(getSuitSymbol("clubs")).toBe("♣");
  });

  it("marks hearts and diamonds as red", () => {
    expect(getSuitColorClass("hearts")).toBe("suit-red");
    expect(getSuitColorClass("diamonds")).toBe("suit-red");
  });

  it("marks spades and clubs as dark", () => {
    expect(getSuitColorClass("spades")).toBe("suit-dark");
    expect(getSuitColorClass("clubs")).toBe("suit-dark");
  });

  it("formats rank labels and stable display keys", () => {
    const ace = parseCard("AS");
    const ten = parseCard("TD");

    expect(getRankLabel(ace)).toBe("A");
    expect(getRankLabel(ten)).toBe("10");
    expect(cardDisplayKey(ace)).toBe("A-spades");
  });
});
