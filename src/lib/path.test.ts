import { describe, it, expect } from "vitest";
import { pathSegments } from "./path";

describe("pathSegments", () => {
  it("returns nothing for an empty path", () => {
    expect(pathSegments("")).toEqual([]);
  });

  it("splits a POSIX path into a root plus each component, carrying the cumulative path", () => {
    expect(pathSegments("/home/steve/videos")).toEqual([
      { label: "/", path: "/" },
      { label: "home", path: "/home" },
      { label: "steve", path: "/home/steve" },
      { label: "videos", path: "/home/steve/videos" },
    ]);
  });

  it("keeps the POSIX root on its own", () => {
    expect(pathSegments("/")).toEqual([{ label: "/", path: "/" }]);
  });

  it("splits a Windows drive path, keeping the drive as the root segment", () => {
    expect(pathSegments("C:\\Users\\steve")).toEqual([
      { label: "C:\\", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "steve", path: "C:\\Users\\steve" },
    ]);
  });

  it("keeps a bare drive root on its own", () => {
    expect(pathSegments("C:\\")).toEqual([{ label: "C:\\", path: "C:\\" }]);
    expect(pathSegments("D:")).toEqual([{ label: "D:\\", path: "D:\\" }]);
  });

  it("tolerates forward slashes in a Windows path (mixed separators)", () => {
    expect(pathSegments("C:/Users/steve")).toEqual([
      { label: "C:\\", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "steve", path: "C:\\Users\\steve" },
    ]);
  });
});
