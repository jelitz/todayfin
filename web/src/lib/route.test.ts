import { describe, expect, it } from "vitest";
import { parseHash } from "./route";

describe("parseHash", () => {
  it("빈 해시는 홈", () => {
    expect(parseHash("")).toEqual({ name: "home" });
  });

  it("#/ 는 홈", () => {
    expect(parseHash("#/")).toEqual({ name: "home" });
  });

  it("#/about 은 소개 페이지", () => {
    expect(parseHash("#/about")).toEqual({ name: "about" });
  });

  it("#/alsangmoo 는 알상무 페이지", () => {
    expect(parseHash("#/alsangmoo")).toEqual({ name: "alsangmoo" });
  });

  it("#/i/{id} 는 상세", () => {
    expect(parseHash("#/i/kospi")).toEqual({ name: "detail", id: "kospi" });
  });

  it("상세 id의 %-인코딩을 디코드한다", () => {
    expect(parseHash("#/i/%EA%B5%AD%EA%B3%A0%EC%B1%84")).toEqual({
      name: "detail",
      id: "국고채",
    });
  });

  it("잘못된 %-이스케이프는 원본 문자열을 그대로 쓴다", () => {
    expect(parseHash("#/i/%E0%A4%A")).toEqual({ name: "detail", id: "%E0%A4%A" });
  });

  it("알 수 없는 해시는 홈으로 폴백", () => {
    expect(parseHash("#/nonexistent")).toEqual({ name: "home" });
  });
});
