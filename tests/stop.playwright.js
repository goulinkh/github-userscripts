async (page) => {
  const stopped = await page.evaluate(() => {
    if (!window.__githubOverType) return false;
    window.__githubOverType.destroy();
    return true;
  });
  return { stopped };
}
