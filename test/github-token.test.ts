import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as core from "@actions/core";
import { setupGitHubToken } from "../src/github/token";

describe("GitHub token setup", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("falls back to the workflow token when app token exchange rejects a non-default-branch workflow", async () => {
    process.env.DEFAULT_WORKFLOW_TOKEN = "workflow-token";

    const getIdToken = spyOn(core, "getIDToken").mockResolvedValue(
      "oidc-token",
    );
    const setSecret = spyOn(core, "setSecret").mockImplementation(() => {});
    const setOutput = spyOn(core, "setOutput").mockImplementation(() => {});
    const warning = spyOn(core, "warning").mockImplementation(() => {});
    const fetch = spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Workflow is not present on the default branch",
            details: {
              error_code: "workflow_not_found_on_default_branch",
            },
          },
        }),
        { status: 400, statusText: "Bad Request" },
      ),
    );

    try {
      await expect(setupGitHubToken()).resolves.toBe("workflow-token");

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setSecret).toHaveBeenCalledWith("workflow-token");
      expect(setOutput).toHaveBeenCalledWith(
        "used_default_workflow_token",
        "true",
      );
      expect(warning).toHaveBeenCalledWith(
        "The Claude GitHub App rejected this workflow because it is not on the default branch. Falling back to the workflow GITHUB_TOKEN.",
      );
    } finally {
      getIdToken.mockRestore();
      setSecret.mockRestore();
      setOutput.mockRestore();
      warning.mockRestore();
      fetch.mockRestore();
    }
  });

  test("preserves the validation error when no workflow token is available", async () => {
    const getIdToken = spyOn(core, "getIDToken").mockResolvedValue(
      "oidc-token",
    );
    const warning = spyOn(core, "warning").mockImplementation(() => {});
    const fetch = spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Workflow is not present on the default branch",
            details: {
              error_code: "workflow_not_found_on_default_branch",
            },
          },
        }),
        { status: 400, statusText: "Bad Request" },
      ),
    );

    try {
      await expect(setupGitHubToken()).rejects.toThrow(
        "Workflow is not present on the default branch",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      getIdToken.mockRestore();
      warning.mockRestore();
      fetch.mockRestore();
    }
  });
});
