import { scanPage } from "./scanner/analyzer.js";
import {
  bindScanForm,
  clearResults,
  renderApp,
  renderResults,
  setLoading,
  showError,
  showProgress,
} from "./ui/render.js";
import "./styles.css";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app element");

renderApp(app);
bindScanForm(handleScan);

async function handleScan(url: string): Promise<void> {
  clearResults();
  setLoading(true);

  try {
    const summary = await scanPage(url, (progress) => showProgress(progress));
    renderResults(summary);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    showError(message);
  } finally {
    setLoading(false);
  }
}
