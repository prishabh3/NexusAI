import { test, expect, Page } from "@playwright/test";
import path from "path";

test.describe("Dataset Upload & Analysis Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("home page loads and shows navigation", async ({ page }) => {
    await expect(page.getByText("NexusAI")).toBeVisible();
    await expect(page.getByText("Overview")).toBeVisible();
    await expect(page.getByText("Datasets")).toBeVisible();
  });

  test("navigates to datasets page", async ({ page }) => {
    await page.click("text=Datasets");
    await expect(page).toHaveURL(/\/datasets/);
    await expect(page.getByText("Upload Dataset")).toBeVisible();
  });

  test("upload dialog opens on button click", async ({ page }) => {
    await page.goto("/datasets");
    await page.click("button:has-text('Upload Dataset')");
    await expect(page.getByText("Drag & drop or click to upload")).toBeVisible();
  });

  test("chat page loads with dataset selector", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByPlaceholder(/Ask about trends/)).toBeVisible();
  });

  test("insights page is accessible", async ({ page }) => {
    await page.goto("/insights");
    // Expect either insights or empty state
    const content = page.locator("main");
    await expect(content).toBeVisible();
  });
});

test.describe("Analysis interface", () => {
  test("analysis page renders without error", async ({ page }) => {
    await page.goto("/analysis");
    await expect(page.locator("main")).toBeVisible();
  });
});
