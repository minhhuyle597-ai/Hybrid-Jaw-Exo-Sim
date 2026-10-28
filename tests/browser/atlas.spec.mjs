import { test, expect } from "@playwright/test";

const route = "#/atlas?structure=muscle.masseter.left";
const ready = (page) =>
  expect(page.locator(".atlas-scene-wrap")).toHaveAttribute(
    "data-status",
    "ready",
  );

test("direct Atlas links load real 3D resources without fetching replay frames or videos", async ({
  page,
}) => {
  const requests = [],
    errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route);
  await ready(page);
  await expect(page.locator(".atlas-details h2")).toHaveText("左侧咬肌");
  await expect(page.locator(".atlas-binding")).toHaveCount(2);
  await expect(page.locator(".atlas-claim")).toHaveCount(2);
  expect(
    requests.filter((url) => /frames\.json|\.mp4|states\.npz/.test(url)),
  ).toEqual([]);
  expect(
    requests.some((url) => url.endsWith("/atlas/maxilla.glb")),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  await page.reload();
  await ready(page);
  await expect(page.locator(".atlas-details h2")).toHaveText("左侧咬肌");
});

test("layer controls change rendered pixels; search does not hide anatomy; empty layers recover", async ({
  page,
}) => {
  await page.goto(route);
  await ready(page);
  const canvas = page.locator(".atlas-scene canvas");
  const original = await canvas.screenshot();
  await page.getByRole("checkbox", { name: "显示颅骨", exact: true }).uncheck();
  expect((await canvas.screenshot()).equals(original)).toBeFalsy();
  await page.getByRole("searchbox", { name: "搜索结构" }).fill("M13");
  await expect(page.locator(".atlas-entry")).toHaveCount(1);
  await expect(page.locator(".atlas-directory .panel-title")).toContainText(
    "17 个可见",
  );
  await page.getByRole("button", { name: "单独显示", exact: true }).click();
  await expect(page.locator(".atlas-directory .panel-title")).toContainText(
    "1 个可见",
  );
  const opaque = await canvas.screenshot();
  await page.getByRole("slider", { name: "所选结构透明度" }).fill("0.4");
  await expect(page.locator(".atlas-opacity output")).toHaveText("40% 不透明");
  expect((await canvas.screenshot()).equals(opaque)).toBeFalsy();
  await page
    .getByRole("checkbox", { name: "显示左侧咬肌", exact: true })
    .uncheck();
  await expect(
    page.getByText("所有图层已隐藏", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复默认图层" }).click();
  await expect(page.locator(".atlas-directory .panel-title")).toContainText(
    "18 个可见",
  );
  await expect(page.locator(".atlas-opacity output")).toHaveText("100% 不透明");
});

test("Atlas, graph and replay preserve structure mapping and replay time across navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route + "&frame=125");
  await ready(page);
  await page.getByRole("button", { name: "查看知识关系 ↗" }).click();
  await expect(page.locator(".graph-active")).toContainText("M13");
  await page
    .getByRole("combobox", { name: "查找知识图谱节点" })
    .selectOption("claim:咬肌:0");
  await expect(page.locator(".graph-active")).toContainText("110-111");
  await expect(page).toHaveURL(/#\/graph/);
  await page
    .getByRole("combobox", { name: "查找知识图谱节点" })
    .selectOption("muscle:superficial_masseter_left");
  await page.getByRole("button", { name: "在 Atlas 中定位" }).click();
  await ready(page);
  await expect(page.locator(".atlas-details h2")).toHaveText("左侧咬肌");
  await page.getByRole("button", { name: "查看运动与曲线 ↗" }).click();
  await expect(page.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
  await expect(page.getByTestId("time")).toContainText("5.00");
  await expect(page.locator(".muscle[aria-pressed=true]")).toHaveCount(2);
  await expect(
    page.locator(".muscle[aria-pressed=true]").first(),
  ).toContainText("M13");
  await expect(page.locator(".muscle[aria-pressed=true]").last()).toContainText(
    "M15",
  );
  await page.getByRole("slider", { name: "回放时间轴" }).fill("200");
  await expect(page.getByTestId("time")).toContainText("8.00");
  await page.getByRole("button", { name: "后观 Posterior" }).click();
  await expect(page.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
  await expect(page.getByTestId("time")).toContainText("8.00");
  await page.getByRole("link", { name: "结构 Atlas", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "查看运动与曲线 ↗" }).click();
  await expect(page.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
  await expect(page.getByTestId("time")).toContainText("8.00");
  expect(errors).toEqual([]);
});

test("an unavailable mesh reports a recoverable error without losing structure and evidence navigation", async ({
  page,
}) => {
  await page.route("**/atlas/maxilla.glb", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto(route);
  await expect(page.locator(".atlas-scene-wrap")).toHaveAttribute(
    "data-status",
    "error",
  );
  await expect(page.locator(".atlas-details h2")).toHaveText("左侧咬肌");
  await page.unroute("**/atlas/maxilla.glb");
  await page.getByRole("button", { name: "重新载入模型" }).click();
  await ready(page);
});

test("mesh picking and camera direction controls operate on the rendered scene", async ({
  page,
}) => {
  await page.goto(route);
  await ready(page);
  const canvas = page.locator(".atlas-scene canvas");
  const box = await canvas.boundingBox();
  await canvas.click({
    position: { x: box.width * 0.5, y: box.height * 0.32 },
  });
  await expect(page.locator(".atlas-details h2")).toHaveText("颅骨");
  await expect(
    page.getByRole("button", { name: "查看运动与曲线 ↗" }),
  ).toBeDisabled();
  const oblique = await canvas.screenshot();
  await page.getByRole("button", { name: "后观", exact: true }).click();
  expect((await canvas.screenshot()).equals(oblique)).toBeFalsy();
});

test("browser history updates a mounted replay to its bookmarked frame", async ({
  page,
}) => {
  await page.goto("#/replay?structure=muscle.masseter.left&frame=125");
  await expect(page.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
  await expect(page.getByTestId("time")).toContainText("5.00");
  await page.evaluate(() => {
    location.hash = "#/replay?structure=muscle.masseter.left&frame=200";
  });
  await expect(page.getByTestId("time")).toContainText("8.00");
  await page.goBack();
  await expect(page.getByTestId("time")).toContainText("5.00");
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => Math.round(v.currentTime * 25)),
    )
    .toBe(125);
});

test("WebGL failure retains usable semantic navigation", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith("webgl") ? null : get.call(this, type, ...args);
    };
  });
  await page.goto(route);
  await expect(page.getByRole("alert")).toContainText("此设备未能启动三维显示");
  await page.getByRole("button", { name: "查看知识关系 ↗" }).click();
  await expect(page.locator(".graph-active")).toContainText("M13");
});

test("mobile layout stays within the viewport and supports filters and unsupported structures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("#/atlas?structure=bone.mandible");
  await ready(page);
  await expect(page.locator(".atlas-details h2")).toHaveText("下颌骨");
  await expect(
    page.getByRole("button", { name: "查看运动与曲线 ↗" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("combobox", { name: "Atlas 左右侧" })
    .selectOption("left");
  await page.getByRole("combobox", { name: "Atlas 区域" }).selectOption("口底");
  await expect(page.locator(".atlas-entry")).toHaveCount(3);
  await page
    .getByRole("searchbox", { name: "搜索结构" })
    .fill("missing-structure");
  await expect(page.getByText("没有匹配的结构。")).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.locator(".atlas-entry")).toHaveCount(18);
  await page.goto("#/atlas?structure=unknown");
  await expect(
    page.getByText("未找到链接中的结构，已显示默认选择。"),
  ).toBeVisible();
});
