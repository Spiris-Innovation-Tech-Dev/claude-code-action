import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as core from "@actions/core";
import {
  parseAdditionalPermissions,
  setupGitHubToken,
} from "../src/github/token";

describe("github token setup", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("parseAdditionalPermissions merges configured permissions with defaults", () => {
    process.env.ADDITIONAL_PERMISSIONS = "actions: read\nchecks: write";

    expect(parseAdditionalPermissions()).toEqual({
      contents: "write",
      pull_requests: "write",
      issues: "write",
      actions: "read",
      checks: "write",
    });
  });

  test("setupGitHubToken does not skip workflow validation mismatches", async () => {
    const getIdTokenSpy = spyOn(core, "getIDToken").mockResolvedValue(
      "oidc-token",
    );
    const setSecretSpy = spyOn(core, "setSecret").mockImplementation(() => {});
    const warningSpy = spyOn(core, "warning").mockImplementation(() => {});
    const fetchSpy = spyOn(global, "fetch").mockImplementation((async () => {
      return new Response(
        JSON.stringify({
          message: "Workflow missing from current branch",
          error: {
            message: "Workflow missing from current branch",
            details: {
              error_code: "workflow_not_found_on_default_branch",
            },
          },
        }),
        { status: 400, statusText: "Bad Request" },
      );
    }) as any);
    const setTimeoutSpy = spyOn(global, "setTimeout").mockImplementation(((
      callback: any,
    ) => {
      if (typeof callback === "function") {
        callback();
      }
      return 0 as any;
    }) as any);

    try {
      await expect(setupGitHubToken()).rejects.toThrow(
        "Workflow missing from current branch",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(warningSpy).not.toHaveBeenCalled();
      expect(setSecretSpy).not.toHaveBeenCalled();
    } finally {
      getIdTokenSpy.mockRestore();
      setSecretSpy.mockRestore();
      warningSpy.mockRestore();
      fetchSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    }
  });
});
