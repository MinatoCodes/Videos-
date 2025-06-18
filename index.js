import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔐 GitHub config (set your repo and token here)
const GITHUB_OWNER = "MinatoCodes";
const GITHUB_REPO = "Videos-"; // ✅ must exist
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN = "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"; // replace safely

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.get("/", (req, res) => {
  res.send("✅ HostVideo API is running!");
});

// 🎯 Upload video endpoint
app.post("/host", async (req, res) => {
  const videoUrl = req.body.url || req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: "Missing video URL." });
  }

  try {
    const head = await axios.head(videoUrl);
    const size = parseInt(head.headers["content-length"] || 0);
    if (size > 100 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "File exceeds 100MB GitHub limit." });
    }

    const fileName = `video_${Date.now()}.mp4`;
    const localPath = path.join("/tmp", fileName);
    const githubPath = `video/${fileName}`;

    const response = await axios({ url: videoUrl, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const content = fs.readFileSync(localPath, { encoding: "base64" });

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: githubPath,
      message: `Upload via API: ${fileName}`,
      content,
      branch: GITHUB_BRANCH,
    });

    fs.unlinkSync(localPath);

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${githubPath}`;
    res.json({ success: true, url: rawUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 HostVideo API is running on http://localhost:${PORT}`);
});
                                 
