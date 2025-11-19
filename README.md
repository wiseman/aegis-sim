<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NUSQ2pZY1n2oN0LZCcWCMEOmO9-cgmFS

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `pnpm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `pnpm dev`

## Deploy with Docker

**Prerequisites:** Docker

1. Build the Docker image:
   ```bash
   docker build -t aegis-sim:latest .
   ```

2. Run the container:
   ```bash
   docker run -p 8080:80 -e GEMINI_API_KEY=your_api_key_here aegis-sim:latest
   ```

3. Access the app at `http://localhost:8080`

The Docker image uses a multi-stage build with nginx to serve the production build. The final image is approximately 54MB.
