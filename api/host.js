import axios from "axios";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const GITHUB_OWNER = "MinatoCodes";
const GITHUB_REPO = "Videos-";
const GITHUB_BRANCH = "main";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Only GET supported" });
  }

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, message: "Missing URL" });

  try {
    const head = await axios.head(url);
    const size = parseInt(head.headers["content-length"] || 0);
    if (size > 100 * 1024 * 1024)
      return res.status(400).json({ success: false, message: "File too large for GitHub (100MB limit)" });

    const fileName = `video_${Date.now()}.mp4`;
    const localPath = path.join("/tmp", fileName);
    const githubPath = `video/${fileName}`;

    const response = await axios({ url, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const content = fs.readFileSync(localPath, { encoding: "base64" });
    fs.unlinkSync(localPath);

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: githubPath,
      message: `Upload via API: ${fileName}`,
      content,
      branch: GITHUB_BRANCH
    });

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${githubPath}`;
    return res.json({ success: true, url: rawUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
  }
                                 
