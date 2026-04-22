import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as core from "@actions/core";
import {
  parseAdditionalPermissions,
  setupGitHubToken,
} from "../src/github/token";

describe("github token setup", () => {
  let originalEnv: typeof process.env;
  const workflowValidationErrorResponse = {
    message: "Workflow missing from current branch",
    error: {
      message: "Workflow missing from current branch",
      details: {
        error_code: "workflow_not_found_on_default_branch",
      },
    },
  };

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

  test("parseAdditionalPermissions returns undefined when unset", () => {
    expect(parseAdditionalPermissions()).toBeUndefined();
  });

  test("setupGitHubToken exchanges the OIDC token successfully", async () => {
    const getIdTokenSpy = spyOn(core, "getIDToken").mockResolvedValue(
      "oidc-token",
    );
    const setSecretSpy = spyOn(core, "setSecret").mockImplementation(() => {});
    const warningSpy = spyOn(core, "warning").mockImplementation(() => {});
    const fetchSpy = spyOn(global, "fetch").mockImplementation((() => {
      return new Response(JSON.stringify({ token: "app-token" }), {
        status: 200,
        statusText: "OK",
      });
    }) as any);

    try {
      await expect(setupGitHubToken()).resolves.toBe("app-token");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(setSecretSpy).toHaveBeenCalledWith("app-token");
      expect(warningSpy).not.toHaveBeenCalled();
    } finally {
      getIdTokenSpy.mockRestore();
      setSecretSpy.mockRestore();
      warningSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  test("setupGitHubToken throws on workflow_not_found_on_default_branch", async () => {
    const getIdTokenSpy = spyOn(core, "getIDToken").mockResolvedValue(
      "oidc-token",
    );
    const setSecretSpy = spyOn(core, "setSecret").mockImplementation(() => {});
    const warningSpy = spyOn(core, "warning").mockImplementation(() => {});
    const fetchSpy = spyOn(global, "fetch").mockImplementation((() => {
      return new Response(JSON.stringify(workflowValidationErrorResponse), {
        status: 400,
        statusText: "Bad Request",
      });
    }) as any);
    // Execute retry waits immediately so the test stays fast while still
    // verifying that setupGitHubToken retries and ultimately throws.
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
