import { execSync } from "child_process";
import { promises as fs } from "fs";
import { Account } from "@tago-io/sdk";

(async () => {
  const account = new Account({ token: "Your-Account-Profile-Token" });
  const analysis_list = await account.analysis.list({ amount: 99, fields: ["id", "tags"], filter: { tags: [{ key: "export_id" }] } });

  for (const { id, tags } of analysis_list) {
    const script_name = tags.find((tag) => tag.key === "export_id")?.value;
    console.log(`\nBuilding ${script_name}.ts`);
    execSync(`analysis-builder src/analysis/${script_name}.ts ./build/${script_name}.tago.js`, { stdio: "inherit" });

    const script = await fs.readFile(`build//${script_name}.tago.js`, { encoding: "base64" });
    await account.analysis
      .uploadScript(id, {
        content: script,
        language: "node",
        name: `${script_name}.tago.js`,
      })
      .then(() => console.log(`\n> Script ${script_name}.ts successfully uploaded to TagoIO!`), console.log);
  }
})();
